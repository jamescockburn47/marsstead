import assert from 'node:assert/strict';
import { strideState, stepTravel, movementEase, ballisticStep } from '../src/locomotion.js';
import { G_MARS, JUMP_V0, WALK_SPEED, LOPE_SPEED, HABITAT_WALK_SPEED } from '../src/physics.js';

const rates = [30, 60, 120];
const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
function controller(hz) {
  const state = strideState(), dt = 1 / hz;
  let motion = { y: 0, vy: 0, airborne: false }, velocity = 0, position = 0;
  return {
    state, dt,
    get motion() { return motion; },
    get velocity() { return velocity; },
    get position() { return position; },
    step(speed, { moving = speed !== 0, blocked = false, manualJump = false, ground = 0 } = {}) {
      // Same ordering as the surface controller: ease, resolve travel, then integrate vertical motion.
      velocity += (speed - velocity) * movementEase(dt, motion.airborne, moving);
      if (blocked) velocity = 0;
      position += velocity * dt;
      motion = stepTravel(state, dt, { ...motion, speed: Math.abs(velocity), moving, manualJump, ground });
      assert.ok(Number.isFinite(motion.y) && Number.isFinite(motion.vy), 'finite controller output');
      assert.ok(motion.y >= ground, 'never integrates beneath support');
      if (motion.gait) {
        assert.equal(motion.gait.phase === 'flight', motion.airborne, 'pose phase reflects this frame after integration');
        assert.ok(motion.gait.u >= 0 && motion.gait.u <= 1, 'bounded phase progress');
      }
      if (!motion.airborne) {
        assert.equal(motion.y, ground, 'landed height is immediately current');
        assert.equal(motion.vy, 0, 'landed velocity is immediately current');
      }
      return motion;
    },
  };
}
function travel(speed, hz) {
  const c = controller(hz), launches = [], contacts = [];
  let previous = c.motion, apex = 0, air = 0, support = 0;
  for (let i = 0; i < hz * 15; i++) {
    const m = c.step(speed);
    if (!previous.airborne && m.airborne) launches.push(m.gait.side);
    if (previous.airborne && !m.airborne) {
      contacts.push(m.gait.side);
      assert.equal(m.gait.side, -previous.gait.side, 'touchdown immediately changes support foot');
      assert.equal(m.gait.cycle, previous.gait.cycle + 1, 'touchdown starts one new support cycle');
    }
    if (m.airborne) air += c.dt; else support += c.dt;
    apex = Math.max(apex, m.y); previous = m;
  }
  assert.ok(launches.length > 8 && contacts.length > 8, 'repeated support and flight');
  assert.ok(launches.every((side, i) => !i || side === -launches[i - 1]), 'alternating launch feet');
  assert.ok(contacts.every((side, i) => !i || side === -contacts[i - 1]), 'alternating support feet');
  assert.ok(air > 2 && support > 1, 'sustained travel contains meaningful airborne and grounded intervals');
  return { launches: launches.length, apex, air };
}
function stopFromPhase(hz, phase, action) {
  const c = controller(hz);
  const matches = m => m.gait && (phase === 'support' ? m.gait.phase === 'support' && m.gait.u > .65
    : m.airborne && (phase === 'rising' ? m.vy > .1 : m.vy < -.1));
  for (let i = 0; i < hz * 3 && !matches(c.motion); i++) c.step(LOPE_SPEED);
  assert.ok(matches(c.motion), `exercise ${phase} interruption`);
  let previous = c.motion;
  const start = c.position;
  for (let i = 0; i < hz * 3; i++) {
    const m = action === 'blocked' ? c.step(LOPE_SPEED, { blocked: true })
      : action === 'habitat' ? c.step(HABITAT_WALK_SPEED, { moving: false }) : c.step(0);
    assert.ok(previous.airborne || !m.airborne, `${action} during ${phase} cannot start another automatic flight`);
    previous = m;
  }
  assert.equal(c.motion.airborne, false, `${action} returns to ground`);
  assert.equal(c.motion.gait, undefined, `${action} clears travel gait`);
  if (action !== 'habitat') assert.ok(Math.abs(c.velocity) < .001, `${action} brakes to rest`);
  if (action === 'release') assert.ok(c.position - start < LOPE_SPEED, 'release stops within one second of full-speed distance');
}

const results = [];
for (const hz of rates) {
  const walk = travel(WALK_SPEED, hz), lope = travel(LOPE_SPEED, hz);
  assert.ok(walk.apex > 0 && lope.apex > walk.apex, 'both leave ground; faster travel rises higher');
  assert.ok(lope.apex < JUMP_V0 ** 2 / (2 * G_MARS), 'travel bounds remain below deliberate jump');
  results.push({ hz, walk, lope });
  for (const phase of ['support', 'rising', 'falling']) {
    for (const action of ['release', 'blocked', 'habitat']) stopFromPhase(hz, phase, action);
  }
  for (const blocked of [false, true]) {
    const c = controller(hz);
    for (let i = 0; i < hz * 3; i++) {
      const m = c.step(blocked ? LOPE_SPEED : HABITAT_WALK_SPEED, { blocked });
      assert.equal(m.airborne, false, blocked ? 'pushing against a wall cannot launch' : 'habitat pace stays grounded');
      assert.equal(m.gait, undefined, 'no travel bounds at precision pace or zero actual speed');
    }
  }
  // A deliberate jump overrides a pending travelling support and does not inherit its pose.
  for (const moving of [false, true]) {
    const c = controller(hz);
    if (moving) {
      for (let i = 0; i < hz * 2 && !c.motion.gait; i++) c.step(WALK_SPEED);
      assert.equal(c.motion.gait?.phase, 'support', 'exercise manual jump from active travel support');
      assert.equal(c.motion.airborne, false, 'jump starts from supported travel');
    }
    let m = c.step(moving ? WALK_SPEED : 0, { manualJump: true }), peak = m.y, elapsed = c.dt;
    assert.equal(m.airborne, true, 'grounded Space launches immediately');
    near(m.vy, JUMP_V0 - G_MARS * c.dt, 1e-12, 'manual jump uses its independent launch velocity');
    assert.equal(m.gait, undefined, 'manual jump cannot inherit automatic travel gait');
    while (m.airborne && elapsed < 3) {
      m = c.step(0, { manualJump: true }); elapsed += c.dt; peak = Math.max(peak, m.y);
      assert.equal(m.gait, undefined, 'manual flight remains independent through landing');
    }
    near(peak, JUMP_V0 ** 2 / (2 * G_MARS), G_MARS * c.dt ** 2 / 8 + 1e-10, 'manual jump reaches Mars ballistic apex');
    near(elapsed, 2 * JUMP_V0 / G_MARS, c.dt + 1e-10, 'manual jump returns at Mars hang time');
    assert.equal(m.airborne, false, 'manual jump lands');
  }
  const turning = controller(hz);
  for (let i = 0; i < hz; i++) turning.step(LOPE_SPEED);
  const originalPosition = turning.position;
  for (let i = 0; i < hz; i++) turning.step(-LOPE_SPEED);
  assert.ok(turning.velocity < -.9 * LOPE_SPEED, 'direction reversal responds within a second');
  assert.ok(turning.position < originalPosition, 'direction reversal produces actual backwards travel');
}
for (const pace of ['walk', 'lope']) {
  const counts = results.map(r => r[pace].launches);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${pace} cadence comparable at 30/60/120 Hz`);
}
const flight = ballisticStep(0, JUMP_V0, JUMP_V0 / G_MARS);
near(flight.y, JUMP_V0 ** 2 / (2 * G_MARS), 1e-12, 'exact Mars ballistic apex');
for (const airborne of [false, true]) for (const moving of [false, true]) {
  const ease = rates.map(hz => 1 - (1 - movementEase(1 / hz, airborne, moving)) ** hz);
  near(Math.max(...ease), Math.min(...ease), 1e-12, 'acceleration/braking independent of render frequency');
}
console.log('verify-locomotion: support/flight state, alternating feet, release/wall/habitat interruptions, independent jump, reversal and 30/60/120 Hz cadence pass');
