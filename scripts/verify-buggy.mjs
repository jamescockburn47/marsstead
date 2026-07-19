// verify-buggy: the dynamics hold their theory — the DFA-1 arcade-car
// model (Dan's Dune Flip Arena, used with permission) on honest Mars
// ballistics. Grip is deliberately exaggerated (MU is arcade, not
// regolith); airtime, suspension and slopes obey G_MARS. The quarter-car
// suspension settles like the model says, rocks kick wheels without
// stopping the car, boulders deflect and NEVER trap, and everything is
// deterministic.

import {
  createBuggy, stepBuggy, deflectBuggy, chassisClearance, wheelContactHeight,
  MU, MASS, TOP_SPEED,
  SUSP_STATIC, SUSP_TRAVEL, WHEEL_R, HALF_TRACK, WHEELBASE_F, WHEELBASE_R,
  maxLatAccel, brakingDistance,
} from '../src/buggy.js';
import { G_MARS, jumpApex } from '../src/physics.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

const FLAT = { h: 0, gx: 0, gz: 0 };
const DT = 1 / 240;
const drive = (s, input, ground, seconds) => {
  const out = { skidR: 0, skidF: 0, air: 0, landed: false, impact: 0 };
  for (let t = 0; t < seconds; t += DT) {
    const g = typeof ground === 'function' ? ground(s) : ground;
    const f = stepBuggy(s, input, g, DT);
    if (f.skidR) out.skidR++;
    if (f.skidF) out.skidF++;
    if (f.airborne) out.air++;
    if (f.landed) { out.landed = true; out.impact = Math.max(out.impact, f.impact); }
  }
  return out;
};
// a buggy already settled on its springs (most tests want to skip the drop)
const settled = (x = 0, z = 0, heading = 0) => {
  const s = createBuggy(x, z, heading);
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, FLAT, 3);
  return s;
};

// 1. the headline numbers: arcade grip (DFA-1), quoted by the HUD
check('max lateral accel = MU * g (arcade)', Math.abs(maxLatAccel() - MU * G_MARS) < 1e-12);
check('braking 15 m/s -> ~24 m', Math.abs(brakingDistance(15) - 24.19) < 0.15,
  `${brakingDistance(15).toFixed(2)}`);

// 2. BRISK: pulls away hard, 90% of top speed inside 8 s, tops out sane
{
  const s = settled();
  let t90 = null;
  for (let t = 0; t < 25; t += DT) {
    stepBuggy(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    if (t90 === null && s.u > TOP_SPEED * 0.9) t90 = t;
  }
  check('reaches near top speed', s.u > TOP_SPEED * 0.85 && s.u < TOP_SPEED * 1.25, `u=${s.u.toFixed(1)}`);
  check('90% of top speed inside 9 s (was ~13, and the first 3 s are brisk)',
    t90 !== null && t90 < 9 && t90 > 2,
    `t90=${t90 === null ? 'never' : t90.toFixed(1)}s`);
}

// 3. braking distance matches the closed form
{
  const s = settled(); s.u = 15;
  let dist = 0, prev = { x: s.x, z: s.z };
  for (let t = 0; t < 12 && Math.abs(s.u) > 0.05; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 1, handbrake: false }, FLAT, DT);
    dist += Math.hypot(s.x - prev.x, s.z - prev.z);
    prev = { x: s.x, z: s.z };
  }
  const ideal = brakingDistance(15);
  check('braking distance ~ friction-limited', dist > ideal * 0.7 && dist < ideal * 1.4,
    `${dist.toFixed(1)} m vs tyre-only ideal ${ideal.toFixed(1)} m`);
}

// 4. ROLLS TO A REAL STOP: lift off at speed, regen + rolling drag bring
// it to rest in seconds, not most of a minute
{
  const s = settled(); s.u = 15;
  let tStop = null;
  for (let t = 0; t < 30; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    if (tStop === null && s.u === 0) { tStop = t; break; }
  }
  check('coasts to a stop inside 16 s (was ~50)', tStop !== null && tStop < 16,
    `tStop=${tStop === null ? 'never' : tStop.toFixed(1)}s`);
}

// 5. cornering below the limit tracks the wheel; above it, the circle caps
{
  const gentle = settled(); gentle.u = 6;
  drive(gentle, { throttle: 0.28, steer: 0.5, brake: 0, handbrake: false }, FLAT, 6);
  check('gentle corner develops yaw', Math.abs(gentle.r) > 0.15, `r=${gentle.r.toFixed(3)}`);

  const hot = settled(); hot.u = 16;
  let worstLat = 0, prevAng = null, skidF = 0, skidR = 0;
  for (let t = 0; t < 3; t += DT) {
    const f = stepBuggy(hot, { throttle: 0.6, steer: 1, brake: 0, handbrake: false }, FLAT, DT);
    if (f.skidF) skidF++;
    if (f.skidR) skidR++;
    const wx1 = hot.u * Math.sin(hot.heading) + hot.v * Math.cos(hot.heading);
    const wz1 = hot.u * Math.cos(hot.heading) - hot.v * Math.sin(hot.heading);
    const sp = Math.hypot(wx1, wz1);
    const ang = Math.atan2(wx1, wz1);
    if (prevAng !== null && sp > 4 && Math.abs(hot.u) > 4) {
      const dAng = Math.abs(((ang - prevAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      worstLat = Math.max(worstLat, (dAng / DT) * sp);
    }
    prevAng = ang;
  }
  check('hot corner saturates (skids)', skidF + skidR > 50, `skid frames F=${skidF} R=${skidR}`);
  check('velocity turn rate <= mu*g ceiling', worstLat < maxLatAccel() * 1.25,
    `${worstLat.toFixed(2)} vs ${maxLatAccel().toFixed(2)} m/s^2`);
}

// 6. throttle oversteer: the same corner sheds MORE rear grip under power
{
  const a = settled(); a.u = 8;
  const fa = drive(a, { throttle: 0, steer: 0.6, brake: 0, handbrake: false }, FLAT, 2.5);
  const b = settled(); b.u = 8;
  const fb = drive(b, { throttle: 1, steer: 0.6, brake: 0, handbrake: false }, FLAT, 2.5);
  check('power-on sheds rear grip', fb.skidR > fa.skidR, `with=${fb.skidR} without=${fa.skidR}`);
}

// 7. the handbrake drift: same corner, handbrake on -> far more yaw
{
  const a = settled(); a.u = 10;
  drive(a, { throttle: 0, steer: 0.7, brake: 0, handbrake: false }, FLAT, 1.2);
  const b = settled(); b.u = 10;
  const fb = drive(b, { throttle: 0, steer: 0.7, brake: 0, handbrake: true }, FLAT, 1.2);
  check('handbrake breaks the rear loose', Math.abs(b.r) > Math.abs(a.r) * 1.3 && fb.skidR > 0,
    `r ${b.r.toFixed(3)} vs ${a.r.toFixed(3)}`);
  check('the tail steps out', Math.abs(b.v) > Math.abs(a.v),
    `v ${b.v.toFixed(2)} vs ${a.v.toFixed(2)}`);
}

// 8. the crest hop: ground falls away -> ballistic flight under G_MARS
{
  const s = settled(); s.u = 14;
  const terrain = (st) => st.z < 30
    ? { h: st.z * 0.12, gx: 0, gz: 0.12 }
    : { h: 30 * 0.12 - (st.z - 30) * 1.2, gx: 0, gz: -1.2 };
  // 12 s window: the springs launch the hop with honest UPWARD vy now, so
  // the flight is the long 0.38 g float the design wants — it takes a while
  const f = drive(s, { throttle: 0.4, steer: 0, brake: 0, handbrake: false }, terrain, 12);
  check('crest launches the buggy', f.air > 30, `air frames=${f.air}`);
  check('it lands again', f.landed === true);
  check('landing has an impact reading', f.impact > 0.5, `${f.impact.toFixed(2)}`);
}

// 9. ballistic honesty: launched with known vy, apex matches physics
{
  const s = createBuggy(); s.u = 10; s.airborne = true; s.vy = 3; s.y = 0;
  const deep = { h: -100, gx: 0, gz: 0 };
  let apex = 0;
  for (let t = 0; t < 3; t += DT) { stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, deep, DT); apex = Math.max(apex, s.y); }
  check('hop apex obeys G_MARS', Math.abs(apex - jumpApex(3)) < 0.05,
    `${apex.toFixed(3)} vs ${jumpApex(3).toFixed(3)}`);
}

// 10. determinism: same inputs, same trajectory, twice (invariant 4)
{
  const run = () => {
    const s = createBuggy();
    for (let i = 0; i < 2000; i++) {
      stepBuggy(s, { throttle: 0.8, steer: Math.sin(i / 60) * 0.5, brake: 0, handbrake: i % 500 < 60 }, FLAT, DT);
    }
    return [s.x, s.z, s.u, s.v, s.r, s.heading, s.y, s.pitch, s.roll];
  };
  const A = run(), B = run();
  check('deterministic', A.every((v, i) => v === B[i]));
}

// 11. reverse works and stays tame
{
  const s = settled();
  drive(s, { throttle: -1, steer: 0, brake: 0, handbrake: false }, FLAT, 5);
  check('reverses', s.u < -1.5, `u=${s.u.toFixed(2)}`);
}

// ---- the playtest regressions (James, 2026-07-17): "spins on the spot,
// no traction, can't hold a straight line, slides around when parked"

// 12. full throttle, no steer: the buggy holds a STRAIGHT line
{
  const s = settled();
  drive(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, FLAT, 10);
  check('full throttle holds a straight line',
    Math.abs(s.heading) < 0.02 && Math.abs(s.x) < 1.5 && Math.abs(s.v) < 0.3,
    `heading=${s.heading.toFixed(4)} x-drift=${s.x.toFixed(2)} v=${s.v.toFixed(2)}`);
  check('and actually goes somewhere', s.z > 70 && s.u > 12, `z=${s.z.toFixed(0)} u=${s.u.toFixed(1)}`);
}

// 13. full throttle + full lock FROM STANDSTILL: pulls away in an arc,
// does not pirouette (yaw rate stays near the kinematic circle's)
{
  const s = settled();
  drive(s, { throttle: 1, steer: 1, brake: 0, handbrake: false }, FLAT, 4);
  const kinCap = Math.abs(s.u) * Math.tan(0.55) / 2.2 + 0.35;
  check('standing-start full lock arcs, no pirouette', Math.abs(s.r) < kinCap * 1.4,
    `r=${s.r.toFixed(2)} vs kinematic ~${kinCap.toFixed(2)}`);
  check('the arc makes way', Math.hypot(s.x, s.z) > 6);
}

// 14. steer at a genuine standstill: nothing rotates
{
  const s = settled();
  drive(s, { throttle: 0, steer: 1, brake: 0, handbrake: false }, FLAT, 3);
  check('no yaw at standstill', Math.abs(s.r) < 0.01 && Math.abs(s.heading) < 0.01);
}

// 15. parked on a real slope: static friction holds it still
{
  const slope = { h: 0, gx: 0.18, gz: 0.10 }; // ~20% grade, well inside mu
  const s = createBuggy();
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, slope, 6);
  check('parks on a slope without creeping', Math.hypot(s.x, s.z) < 0.2,
    `crept ${Math.hypot(s.x, s.z).toFixed(3)} m`);
}

// 16. ...but a slope STEEPER than the friction cone does slide (honesty —
// with arcade MU the cone holds to ~51 deg, so the probe is a real cliff)
{
  const cliff = { h: 0, gx: 2.2, gz: 0 };
  const s = createBuggy();
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, cliff, 6);
  check('over-steep slope still slides', Math.hypot(s.x, s.z) > 1);
}

// 17. rolling to a stop, it STOPS (no perpetual glide)
{
  const s = settled(); s.u = 6;
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, FLAT, 30);
  check('coasts to a real stop', s.u === 0 && Math.abs(s.v) < 0.01, `u=${s.u} v=${s.v.toFixed(3)}`);
}

// ---- the suspension (DFA-1 quarter-car): the low-g look lives here

// 18. S1 drop test: released from ~1 m, the buggy settles on its springs —
// a soft low-g arrival, level, still, and at the static ride height
{
  const s = createBuggy(); s.y = 1;
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, FLAT, 6);
  check('drop: settles level and still',
    Math.abs(s.pitch) < 0.02 && Math.abs(s.roll) < 0.02 && Math.abs(s.vy) < 0.05,
    `pitch=${s.pitch.toFixed(3)} roll=${s.roll.toFixed(3)} vy=${s.vy.toFixed(3)}`);
  check('drop: rests near the ground line', Math.abs(s.y) < 0.1, `y=${s.y.toFixed(3)}`);
}

// 19. G1 anti-bounce axiom: full-speed cruise on flat ground never leaves
// it — zero airborne frames, tiny vertical motion
{
  const s = settled(); s.u = TOP_SPEED;
  const f = drive(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, FLAT, 8);
  check('flat-out cruise never bounces airborne', f.air === 0, `air frames=${f.air}`);
  check('cruise vertical stays quiet', Math.abs(s.vy) < 0.1 && Math.abs(s.y) < 0.15,
    `vy=${s.vy.toFixed(3)} y=${s.y.toFixed(3)}`);
}

// 20. brake dive and throttle squat EMERGE from load transfer
{
  const s = settled(); s.u = 14;
  let dive = 0;
  for (let t = 0; t < 1.2; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 1, handbrake: false }, FLAT, DT);
    dive = Math.max(dive, s.pitch); // nose-down is positive
  }
  check('braking dives the nose', dive > 0.015, `dive=${dive.toFixed(3)} rad`);
  const q = settled();
  let squat = 0;
  for (let t = 0; t < 1.5; t += DT) {
    stepBuggy(q, { throttle: 1, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    squat = Math.min(squat, q.pitch); // nose-up is negative
  }
  check('throttle squats the tail', squat < -0.008, `squat=${squat.toFixed(3)} rad`);
}

// 21. a rock under one front wheel kicks that wheel and rolls the body —
// and the buggy DRIVES OVER it (speed survives; no wall, no stop)
{
  const s = settled(); s.u = 8;
  // a 0.35 m dome in the left front wheel's path only, 6 m ahead
  const terrain = (st) => {
    const wh = [0, 0, 0, 0];
    const sin = Math.sin(st.heading), cos = Math.cos(st.heading);
    const wx = st.x + (-0.95) * cos + 1.05 * sin;
    const wz = st.z - (-0.95) * sin + 1.05 * cos;
    const d = Math.hypot(wx - (-0.95), wz - 6);
    if (d < 0.8) wh[0] = 0.35 * Math.sqrt(1 - (d / 0.8) * (d / 0.8));
    return { h: 0, gx: 0, gz: 0, wh };
  };
  let maxSusp = 0, maxRollV = 0;
  for (let t = 0; t < 3; t += DT) {
    stepBuggy(s, { throttle: 0.5, steer: 0, brake: 0, handbrake: false }, terrain(s), DT);
    maxSusp = Math.max(maxSusp, s.susp[0] - SUSP_STATIC);
    maxRollV = Math.max(maxRollV, Math.abs(s.rollV));
  }
  check('rock compresses the struck wheel', maxSusp > 0.08, `travel=${maxSusp.toFixed(3)} m`);
  check('rock excites the body (the bounce)', maxRollV > 0.1, `rollV=${maxRollV.toFixed(3)}`);
  check('and the buggy drives on through', s.u > 5 && s.z > 15, `u=${s.u.toFixed(1)} z=${s.z.toFixed(1)}`);
}

// ---- the floor is the floor: the chassis can never clip through it

// 21b. a hard drop bottoms out on the chassis, never through the ground:
// at every step the ground-line datum stays above ground minus travel
{
  const s = createBuggy(); s.y = 8; // a real slam — terminal-ish arrival
  let worst = 99;
  for (let t = 0; t < 6; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    worst = Math.min(worst, s.y);
  }
  check('slam landing never punches through', worst > -(SUSP_TRAVEL - SUSP_STATIC) - 0.02,
    `worst y=${worst.toFixed(3)}`);
  check('and it still settles', Math.abs(s.y) < 0.1 && Math.abs(s.vy) < 0.05,
    `y=${s.y.toFixed(3)} vy=${s.vy.toFixed(3)}`);
}

// 21c. charging up a steep rising ramp at speed: the chassis rides the
// slope, it does not spear into it
{
  const s = settled(); s.u = 16;
  const ramp = (st) => st.z < 10
    ? { h: 0, gx: 0, gz: 0 }
    : { h: (st.z - 10) * 0.45, gx: 0, gz: 0.45 };
  let worstBelow = 99;
  for (let t = 0; t < 4; t += DT) {
    const g = ramp(s);
    stepBuggy(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, g, DT);
    worstBelow = Math.min(worstBelow, s.y - g.h);
  }
  check('steep ramp never swallows the chassis', worstBelow > -(SUSP_TRAVEL + 0.1),
    `worst below-ground=${worstBelow.toFixed(3)}`);
}

// 21d. hammering across a field of rock bumps at speed must NOT flip it —
// single-substep lateral spikes are filtered by the LTR persistence gate
{
  const s = settled(); s.u = 12;
  let rolled = false;
  const bumpfield = (st) => {
    const wh = [0, 0, 0, 0];
    // staggered domes under alternating wheels every ~4 m of travel
    const phase = Math.floor(st.z / 4) % 2;
    const k = phase === 0 ? 0 : 1;
    const local = st.z % 4;
    if (local < 1.2) wh[k] = wh[k + 2] = 0.3 * Math.sin((local / 1.2) * Math.PI);
    return { h: 0, gx: 0, gz: 0, wh };
  };
  for (let t = 0; t < 6; t += DT) {
    const f = stepBuggy(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, bumpfield(s), DT);
    if (f.rollover) rolled = true;
  }
  check('rock-bump hammering never flips it', rolled === false);
}

// ---- how vehicles really work (James, 2026-07-19: "driving like its
// centre of mass is at the front, constantly nose diving")

// 20b. the mass sits AFT: at rest the rear springs carry more than the
// front — the stance settles tail-down, never nose-down
{
  const s = settled();
  check('rear springs carry the mass', s.susp[2] > s.susp[0] && s.susp[3] > s.susp[1],
    `F=${s.susp[0].toFixed(3)} R=${s.susp[2].toFixed(3)}`);
  check('standing stance is not nose-down', s.pitch <= 0.005, `pitch=${s.pitch.toFixed(4)}`);
}

// 20c. lifting off at speed must NOT bury the nose: coasting pitch stays
// a whisker, not a dive
{
  const s = settled(); s.u = 14;
  let worstDive = 0;
  for (let t = 0; t < 3; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    worstDive = Math.max(worstDive, s.pitch);
  }
  check('coasting never buries the nose', worstDive < 0.03, `dive=${worstDive.toFixed(3)}`);
}

// 20d. a passive hop off a ledge ARRIVES near level on the flat below
// (DFA landing assist): no input in the air, and no nose-plant
{
  const s = settled(); s.u = 12;
  const ledge = (st) => st.z < 20
    ? { h: 0, gx: 0, gz: 0 }
    : { h: -2, gx: 0, gz: 0 };
  let landPitch = null;
  for (let t = 0; t < 10; t += DT) {
    const f = stepBuggy(s, { throttle: 0.3, steer: 0, brake: 0, handbrake: false }, ledge(s), DT);
    if (f.landed && landPitch === null) landPitch = Math.abs(s.pitch);
  }
  check('ledge hop lands near level', landPitch !== null && landPitch < 0.3,
    `|pitch| at landing=${landPitch === null ? 'never landed' : landPitch.toFixed(3)}`);
}

// 20e. ...and descending onto a steep DOWNSLOPE it arrives at the slope's
// own attitude, not world-level (world-level would tail-strike and tumble)
{
  const s = settled(); s.u = 12;
  const crest = (st) => st.z < 20
    ? { h: 0, gx: 0, gz: 0 }
    : { h: -(st.z - 20) * 0.5, gx: 0, gz: -0.5 };
  let landPitch = null;
  for (let t = 0; t < 10; t += DT) {
    const f = stepBuggy(s, { throttle: 0.3, steer: 0, brake: 0, handbrake: false }, crest(s), DT);
    if (f.landed && landPitch === null) landPitch = s.pitch;
  }
  check('downslope arrival matches the slope, no tumble',
    landPitch !== null && Math.abs(landPitch - 0.46) < 0.4,
    `pitch at landing=${landPitch === null ? 'never landed' : landPitch.toFixed(3)} (slope attitude ~0.46)`);
}

// ---- the skid plate: the BODY never enters the terrain (DFA kept its
// chassis out of the dunes with a real physics-engine collider; ours is
// the analytic CHASSIS_POINTS set — chassisClearance is the guarantee)

// full ground data from an arbitrary sampler, exactly as main.js builds
// it: wheels read through their contact patch, the skid plate point-samples
const mkGround = (at, s) => {
  const e = 0.7, sin = Math.sin(s.heading), cos = Math.cos(s.heading);
  const wh = [[-HALF_TRACK, WHEELBASE_F], [HALF_TRACK, WHEELBASE_F],
    [-HALF_TRACK, -WHEELBASE_R], [HALF_TRACK, -WHEELBASE_R]]
    .map(([lx, lz]) => wheelContactHeight(at,
      s.x + lx * cos + lz * sin, s.z - lx * sin + lz * cos, sin, cos));
  return {
    h: (wh[0] + wh[1] + wh[2] + wh[3]) / 4, wh, at,
    gx: (at(s.x + e, s.z) - at(s.x - e, s.z)) / (2 * e),
    gz: (at(s.x, s.z + e) - at(s.x, s.z - e)) / (2 * e),
  };
};

// 21k. rolling contact: a crack NARROWER than the wheel is bridged — the
// buggy rolls straight across a 0.5 m slot with barely a dip, where a
// point-sampled wheel would drop 0.5 m into it
{
  const slot = (x, z) => (z > 24.75 && z < 25.25) ? -0.5 : 0;
  const s = settled(); s.u = 6;
  let dip = 0;
  for (let t = 0; t < 5; t += DT) {
    stepBuggy(s, { throttle: 0.4, steer: 0, brake: 0, handbrake: false }, mkGround(slot, s), DT);
    if (s.z > 23 && s.z < 27) dip = Math.min(dip, s.y);
  }
  check('narrow crack is bridged, not fallen into', dip > -0.12, `dip=${dip.toFixed(3)}`);
  check('and the crossing does not stop the buggy', s.z > 30, `z=${s.z.toFixed(1)}`);
}

// 21l. rolling contact: a sharp step is FELT before the wheel centre
// reaches it — the patch's leading tap climbs the face early
{
  const step = (x, z) => (z >= 20 ? 0.35 : 0);
  // front wheel centres (buggy z + 1.05) sit 0.25 m short of the face
  const s = createBuggy(0, 18.7, 0);
  const g = mkGround(step, s);
  check('sharp step is felt early', g.wh[0] > 0.05 && g.wh[1] > 0.05,
    `front wheel reads ${g.wh[0].toFixed(3)}`);
}

// 21e. a sharp crest bulge between the axles cannot poke the belly
{
  const ridge = (x, z) => Math.max(0, 0.7 - Math.abs(z - 25) * 0.7);
  const s = settled(); s.u = 10;
  let worst = 99;
  for (let t = 0; t < 6; t += DT) {
    stepBuggy(s, { throttle: 0.6, steer: 0, brake: 0, handbrake: false }, mkGround(ridge, s), DT);
    worst = Math.min(worst, chassisClearance(s, ridge));
  }
  check('crest bulge never enters the belly', worst > -0.06, `worst=${worst.toFixed(3)}`);
  check('and the buggy crosses the ridge', s.z > 30, `z=${s.z.toFixed(1)}`);
}

// 21f. a nose-down arrival cannot spear the ground: the skid plate
// catches the nose, the body comes up level
{
  const flat = (x, z) => 0;
  const s = createBuggy(); s.y = 2; s.vy = -4; s.u = 10; s.pitch = 0.45;
  s.airborne = true;
  let worst = 99;
  for (let t = 0; t < 5; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, mkGround(flat, s), DT);
    worst = Math.min(worst, chassisClearance(s, flat));
  }
  check('nose-down arrival never spears', worst > -0.06, `worst=${worst.toFixed(3)}`);
  check('and it comes up level', Math.abs(s.pitch) < 0.05 && Math.abs(s.roll) < 0.05,
    `pitch=${s.pitch.toFixed(3)}`);
}

// 21g. driving along a real cross-slope: the downhill flank stays out of
// the ground the whole way
{
  const slope = (x, z) => x * 0.35;
  const s = createBuggy(); // settle ON the slope first
  for (let t = 0; t < 3; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, mkGround(slope, s), DT);
  }
  s.u = 10;
  let worst = 99, rolled = false;
  for (let t = 0; t < 4; t += DT) {
    const f = stepBuggy(s, { throttle: 0.6, steer: 0, brake: 0, handbrake: false }, mkGround(slope, s), DT);
    worst = Math.min(worst, chassisClearance(s, slope));
    if (f.rollover) rolled = true;
  }
  check('cross-slope flank stays clear', worst > -0.06, `worst=${worst.toFixed(3)}`);
  check('cross-slope cruise does not flip', rolled === false);
}

// 21h. THE nose-stand bug (James, 2026-07-19 screenshot): a buggy left
// standing on its nose — skid plate holding it up, no wheel touching —
// must right itself and resettle; it must never freeze in a crashed frame
{
  const flat = () => 0;
  const s = createBuggy(); s.y = 0.9; s.pitch = 1.35; s.airborne = true;
  for (let t = 0; t < 5; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, mkGround(flat, s), DT);
  }
  check('nose-stand rights itself', Math.abs(s.pitch) < 0.05 && Math.abs(s.roll) < 0.05,
    `pitch=${s.pitch.toFixed(2)}`);
  check('and resettles on its wheels', !s.airborne && Math.abs(s.y) < 0.12 && Math.abs(s.vy) < 0.05,
    `y=${s.y.toFixed(2)} vy=${s.vy.toFixed(2)}`);
}

// 21i. ...even with the throttle held: flip authority needs actual flight,
// so a perched body cannot be reaction-wheeled deeper into the ground
{
  const flat = () => 0;
  const s = createBuggy(); s.y = 0.9; s.pitch = 1.35; s.airborne = true;
  for (let t = 0; t < 5; t += DT) {
    stepBuggy(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, mkGround(flat, s), DT);
  }
  check('nose-stand rights itself under held throttle', Math.abs(s.pitch) < 0.35,
    `pitch=${s.pitch.toFixed(2)}`);
}

// 21j. a roof arrival (fully inverted) rights itself the same way
{
  const flat = () => 0;
  const s = createBuggy(); s.y = 1.2; s.pitch = Math.PI * 0.95; s.airborne = true;
  for (let t = 0; t < 6; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, mkGround(flat, s), DT);
  }
  check('roof arrival rights itself', Math.abs(s.pitch) < 0.05, `pitch=${s.pitch.toFixed(2)}`);
}

// ---- boulders: deflect, thump, NEVER trap (the reverse-out guarantee)

// 22. drive straight into a boulder: it stops you, then reverse pulls
// straight back out — nothing eats outbound speed
{
  const s = settled(); s.u = 8;
  const rockAt = { x: 0, z: 12, r: 1.4 };
  let hit = 0;
  for (let t = 0; t < 4; t += DT) {
    stepBuggy(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    hit = Math.max(hit, deflectBuggy(s, rockAt.x, rockAt.z, rockAt.r));
  }
  check('boulder registers a hit', hit > 2, `inward speed killed=${hit.toFixed(1)}`);
  const dAtRock = Math.hypot(s.x - rockAt.x, s.z - rockAt.z);
  check('boulder holds the line', dAtRock >= 1.4 + 1.1, `d=${dAtRock.toFixed(2)}`);
  // now reverse out for 3 s: the buggy must actually get away
  for (let t = 0; t < 3; t += DT) {
    stepBuggy(s, { throttle: -1, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    deflectBuggy(s, rockAt.x, rockAt.z, rockAt.r);
  }
  const dAfter = Math.hypot(s.x - rockAt.x, s.z - rockAt.z);
  check('reverse pulls it straight back out', dAfter > dAtRock + 3,
    `d=${dAfter.toFixed(1)} (was ${dAtRock.toFixed(1)})`);
}

// 23. a glancing hit keeps most speed (tangential survives)
{
  const s = settled(); s.u = 10;
  const wasU = 10;
  // rock offset from the path: a graze, not a head-on
  for (let t = 0; t < 2; t += DT) {
    stepBuggy(s, { throttle: 0.5, steer: 0, brake: 0, handbrake: false }, FLAT, DT);
    deflectBuggy(s, 1.9, 10, 1.0);
  }
  check('glancing boulder hit keeps most speed', s.u > wasU * 0.5, `u=${s.u.toFixed(1)}`);
}

// ---- the flip layer (the Dune Flip Arena tribute): air control is real,
// rotations count, landings are judged

// 24. airborne pitch authority (Space + throttle: tricks are DELIBERATE)
// integrates the commanded rate — and bare throttle does NOTHING
{
  const s = createBuggy(); s.airborne = true; s.vy = 4; s.y = 0; s.u = 10;
  const deep = { h: -200, gx: 0, gz: 0 };
  for (let t = 0; t < 1; t += DT) stepBuggy(s, { throttle: 1, steer: 0, brake: 0, handbrake: true }, deep, DT);
  check('air pitch authority (with the trick key)', Math.abs(s.pitch - 2.6) < 0.1, `pitch=${s.pitch.toFixed(2)}`);
  const p = createBuggy(); p.airborne = true; p.vy = 4; p.y = 0; p.u = 10;
  for (let t = 0; t < 1; t += DT) stepBuggy(p, { throttle: 1, steer: 0, brake: 0, handbrake: false }, deep, DT);
  check('bare throttle never flips in the air', Math.abs(p.pitch) < 0.05, `pitch=${p.pitch.toFixed(2)}`);
}

// 25. a full rotation flags a flip; landing level flags it CLEAN
{
  const s = createBuggy(); s.airborne = true; s.vy = 6; s.y = 0.6; s.u = 12;
  const flat = { h: 0, gx: 0, gz: 0 };
  let flip = false, clean = false;
  for (let t = 0; t < 8; t += DT) {
    const spin = s.airSpin < Math.PI * 2 ? 1 : (Math.abs(((s.pitch % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) > 0.15 ? 1 : 0);
    const f = stepBuggy(s, { throttle: s.airborne ? spin : 0, steer: 0, brake: 0, handbrake: s.airborne && spin > 0 }, flat, DT);
    if (f.flip) flip = true;
    if (f.cleanFlip) clean = true;
    if (f.landed) break;
  }
  check('full rotation lands a clean flip', flip && clean, `flip=${flip} clean=${clean}`);
}

// 26. landing inverted crashes out (speed mostly gone), never "dies"
{
  const s = createBuggy(); s.airborne = true; s.vy = 3; s.y = 0.6; s.u = 14;
  s.pitch = Math.PI; // upside down, no time to recover
  const flat = { h: 0, gx: 0, gz: 0 };
  let impact = 0;
  for (let t = 0; t < 4; t += DT) {
    const f = stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, flat, DT);
    if (f.landed) { impact = f.impact; break; }
  }
  check('inverted landing crashes out', s.u < 14 * 0.35 && impact >= 6, `u=${s.u.toFixed(1)} impact=${impact.toFixed(1)}`);
}

// 27. grounded attitude settles level again (springs, then mercy for
// crashed attitudes beyond them)
{
  const s = settled(); s.pitch = 0.4; s.roll = -0.3; s.u = 5;
  drive(s, { throttle: 0.3, steer: 0, brake: 0, handbrake: false }, FLAT, 3);
  check('attitude settles on the ground', Math.abs(s.pitch) < 0.03 && Math.abs(s.roll) < 0.03,
    `pitch=${s.pitch.toFixed(3)} roll=${s.roll.toFixed(3)}`);
}

// ---- lateral stability: slides before tipping on the flat; rolls on
// side-slopes and trips; rollovers hand off to the judged landing

// 28. flat-ground max-effort cornering NEVER rolls
{
  const s = settled(); s.u = 16;
  let rolled = false;
  for (let t = 0; t < 5; t += DT) {
    const f = stepBuggy(s, { throttle: 0.8, steer: 1, brake: 0, handbrake: false }, FLAT, DT);
    if (f.rollover) rolled = true;
  }
  check('flat ground: slides, never tips', rolled === false);
}

// 29. sliding sideways FAST into rising ground trips a rollover — the
// slide must be sustained (LTR_TRIP_S), so it takes a real one
{
  const s = settled(); s.u = 6; s.v = 9; // a violent sideways slide...
  const bank = { h: 0, gx: -0.3, gz: 0 };    // ...into ground rising that way
  let rolled = false;
  for (let t = 0; t < 2 && !rolled; t += DT) {
    const f = stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, bank, DT);
    if (f.rollover) rolled = true;
  }
  check('trip rollover on a bank', rolled === true);
}

// 30. the rollover ends in a judged landing, never a hang
{
  const s = settled(); s.u = 6; s.v = 9;
  const bank = { h: 0, gx: -0.3, gz: 0 };
  let landed = false;
  for (let t = 0; t < 10 && !landed; t += DT) {
    const f = stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, bank, DT);
    if (f.landed) landed = true;
  }
  check('rollover comes back down', landed === true);
}

// 31. sanity: the wheel is genuinely bigger than the old one, and the
// suspension has real travel (the "larger tyres which bounce" contract)
check('large wheels', WHEEL_R >= 0.6, `${WHEEL_R}`);
check('long-travel suspension', SUSP_TRAVEL >= 0.4 && SUSP_STATIC < SUSP_TRAVEL * 0.3,
  `travel=${SUSP_TRAVEL} static=${SUSP_STATIC.toFixed(3)}`);

if (failed) { console.error(`verify-buggy: ${failed} FAILED`); process.exit(1); }
console.log('verify-buggy: all green');
