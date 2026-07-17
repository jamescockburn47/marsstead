// verify-buggy: the dynamics hold their theory. Braking distance and
// cornering limits match the closed forms (mu*m*g is the whole game);
// throttle oversteer and handbrake drift EMERGE (rear saturates first);
// the friction circle never leaks; crests launch ballistic hops that obey
// G_MARS; everything deterministic.

import {
  createBuggy, stepBuggy, MU, MASS, F_DRIVE, TOP_SPEED,
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

// 1. the low-grip headline numbers the design quotes
check('max lateral accel ~2.4 m/s^2', Math.abs(maxLatAccel() - MU * G_MARS) < 1e-12);
check('braking 15 m/s -> ~46.5 m', Math.abs(brakingDistance(15) - 46.53) < 0.1,
  `${brakingDistance(15).toFixed(2)}`);

// 2. it accelerates, tops out near TOP_SPEED, and never exceeds it wildly
{
  const s = createBuggy();
  drive(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, FLAT, 25);
  check('reaches near top speed', s.u > TOP_SPEED * 0.85 && s.u < TOP_SPEED * 1.25, `u=${s.u.toFixed(1)}`);
}

// 3. braking distance matches the closed form (the Mars lesson: ~2.6x Earth)
{
  const s = createBuggy(); s.u = 15;
  const x0 = s.z; // heading 0 => forward is +z
  let dist = 0, prev = { x: s.x, z: s.z };
  for (let t = 0; t < 12 && Math.abs(s.u) > 0.05; t += DT) {
    stepBuggy(s, { throttle: 0, steer: 0, brake: 1, handbrake: false }, FLAT, DT);
    dist += Math.hypot(s.x - prev.x, s.z - prev.z);
    prev = { x: s.x, z: s.z };
  }
  // tyres are clamped at mu*N (the circle), but rolling resistance and
  // drag also retard — so the stop lands NEAR the tyre-only ideal, a
  // little under it, never dramatically off in either direction
  const ideal = brakingDistance(15);
  check('braking distance ~ friction-limited', dist > ideal * 0.75 && dist < ideal * 1.4,
    `${dist.toFixed(1)} m vs tyre-only ideal ${ideal.toFixed(1)} m`);
}

// 4. cornering below the limit tracks the wheel; above it, understeer
{
  const gentle = createBuggy(); gentle.u = 6;
  drive(gentle, { throttle: 0.28, steer: 0.5, brake: 0, handbrake: false }, FLAT, 6);
  const yawGentle = Math.abs(gentle.r);
  check('gentle corner develops yaw', yawGentle > 0.15, `r=${yawGentle.toFixed(3)}`);

  const hot = createBuggy(); hot.u = 15;
  // measure the TRUE lateral acceleration: the rate the velocity VECTOR
  // turns times the speed — in a slide, heading and velocity part company
  // and u*r stops meaning anything; the friction circle caps this number
  let worstLat = 0, prevAng = null, skidF = 0, skidR = 0;
  for (let t = 0; t < 3; t += DT) {
    const preU = hot.u, preV = hot.v, preH = hot.heading;
    const wx0 = preU * Math.sin(preH) + preV * Math.cos(preH);
    const wz0 = preU * Math.cos(preH) - preV * Math.sin(preH);
    const f = stepBuggy(hot, { throttle: 0.6, steer: 1, brake: 0, handbrake: false }, FLAT, DT);
    if (f.skidF) skidF++;
    if (f.skidR) skidR++;
    const wx1 = hot.u * Math.sin(hot.heading) + hot.v * Math.cos(hot.heading);
    const wz1 = hot.u * Math.cos(hot.heading) - hot.v * Math.sin(hot.heading);
    const sp = Math.hypot(wx1, wz1);
    const ang = Math.atan2(wx1, wz1);
    // guard: above the parking-cleanup regime (|u| < 1 applies an
    // intentionally non-physical settle that can spin the velocity vector)
    if (prevAng !== null && sp > 4 && Math.abs(hot.u) > 4) {
      const dAng = Math.abs(((ang - prevAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      worstLat = Math.max(worstLat, (dAng / DT) * sp);
    }
    prevAng = ang;
    void wx0; void wz0;
  }
  // demanded lateral accel at 15 m/s full lock >> mu g: the tyres HAVE to wash
  check('hot corner saturates (skids)', skidF + skidR > 50, `skid frames F=${skidF} R=${skidR}`);
  check('velocity turn rate <= mu*g ceiling', worstLat < maxLatAccel() * 1.25,
    `${worstLat.toFixed(2)} vs ${maxLatAccel().toFixed(2)} m/s^2`);
}

// 5. throttle oversteer: the same corner sheds MORE rear grip under power
{
  const a = createBuggy(); a.u = 8;
  const fa = drive(a, { throttle: 0, steer: 0.6, brake: 0, handbrake: false }, FLAT, 2.5);
  const b = createBuggy(); b.u = 8;
  const fb = drive(b, { throttle: 1, steer: 0.6, brake: 0, handbrake: false }, FLAT, 2.5);
  check('power-on sheds rear grip', fb.skidR > fa.skidR, `with=${fb.skidR} without=${fa.skidR}`);
}

// 6. the handbrake drift: same corner, handbrake on -> far more yaw
{
  const a = createBuggy(); a.u = 10;
  drive(a, { throttle: 0, steer: 0.7, brake: 0, handbrake: false }, FLAT, 1.2);
  const b = createBuggy(); b.u = 10;
  const fb = drive(b, { throttle: 0, steer: 0.7, brake: 0, handbrake: true }, FLAT, 1.2);
  check('handbrake breaks the rear loose', Math.abs(b.r) > Math.abs(a.r) * 1.3 && fb.skidR > 0,
    `r ${b.r.toFixed(3)} vs ${a.r.toFixed(3)}`);
  // and the tail actually steps out: lateral velocity grows
  check('the tail steps out', Math.abs(b.v) > Math.abs(a.v),
    `v ${b.v.toFixed(2)} vs ${a.v.toFixed(2)}`);
}

// 7. the crest hop: ground falls away -> ballistic flight under G_MARS
{
  const s = createBuggy(); s.u = 14;
  // a ramp up then a sharp drop: h rises at 12% then falls away hard
  const terrain = (st) => st.z < 30
    ? { h: st.z * 0.12, gx: 0, gz: 0.12 }
    : { h: 30 * 0.12 - (st.z - 30) * 1.2, gx: 0, gz: -1.2 };
  const f = drive(s, { throttle: 0.4, steer: 0, brake: 0, handbrake: false }, terrain, 6);
  check('crest launches the buggy', f.air > 30, `air frames=${f.air}`);
  check('it lands again', f.landed === true);
  check('landing has an impact reading', f.impact > 0.5, `${f.impact.toFixed(2)}`);
}

// 8. ballistic honesty: launched with known vy, apex matches physics
{
  const s = createBuggy(); s.u = 10; s.airborne = true; s.vy = 3; s.y = 0;
  const deep = { h: -100, gx: 0, gz: 0 };
  let apex = 0;
  for (let t = 0; t < 3; t += DT) { stepBuggy(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, deep, DT); apex = Math.max(apex, s.y); }
  check('hop apex obeys G_MARS', Math.abs(apex - jumpApex(3)) < 0.05,
    `${apex.toFixed(3)} vs ${jumpApex(3).toFixed(3)}`);
}

// 9. determinism: same inputs, same trajectory, twice (invariant 4)
{
  const run = () => {
    const s = createBuggy();
    for (let i = 0; i < 2000; i++) {
      stepBuggy(s, { throttle: 0.8, steer: Math.sin(i / 60) * 0.5, brake: 0, handbrake: i % 500 < 60 }, FLAT, DT);
    }
    return [s.x, s.z, s.u, s.v, s.r, s.heading];
  };
  const A = run(), B = run();
  check('deterministic', A.every((v, i) => v === B[i]));
}

// 10. reverse works and stays tame
{
  const s = createBuggy();
  drive(s, { throttle: -1, steer: 0, brake: 0, handbrake: false }, FLAT, 5);
  check('reverses', s.u < -1.5, `u=${s.u.toFixed(2)}`);
}

// ---- the playtest regressions (James, 2026-07-17): "spins on the spot,
// no traction, can't hold a straight line, slides around when parked"

// 11. full throttle, no steer: the buggy holds a STRAIGHT line
{
  const s = createBuggy();
  drive(s, { throttle: 1, steer: 0, brake: 0, handbrake: false }, FLAT, 10);
  check('full throttle holds a straight line',
    Math.abs(s.heading) < 0.02 && Math.abs(s.x) < 1.5 && Math.abs(s.v) < 0.3,
    `heading=${s.heading.toFixed(4)} x-drift=${s.x.toFixed(2)} v=${s.v.toFixed(2)}`);
  check('and actually goes somewhere', s.z > 50 && s.u > 9, `z=${s.z.toFixed(0)} u=${s.u.toFixed(1)}`);
}

// 12. full throttle + full lock FROM STANDSTILL: pulls away in an arc,
// does not pirouette (yaw rate stays near the kinematic circle's)
{
  const s = createBuggy();
  drive(s, { throttle: 1, steer: 1, brake: 0, handbrake: false }, FLAT, 4);
  const kinCap = Math.abs(s.u) * Math.tan(0.55) / 2.2 + 0.35;
  check('standing-start full lock arcs, no pirouette', Math.abs(s.r) < kinCap * 1.4,
    `r=${s.r.toFixed(2)} vs kinematic ~${kinCap.toFixed(2)}`);
  check('the arc makes way', Math.hypot(s.x, s.z) > 6);
}

// 13. steer at a genuine standstill: nothing rotates
{
  const s = createBuggy();
  drive(s, { throttle: 0, steer: 1, brake: 0, handbrake: false }, FLAT, 3);
  check('no yaw at standstill', Math.abs(s.r) < 0.01 && Math.abs(s.heading) < 0.01);
}

// 14. parked on a real slope: static friction holds it still
{
  const slope = { h: 0, gx: 0.18, gz: 0.10 }; // ~20% grade, well inside mu
  const s = createBuggy();
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, slope, 6);
  check('parks on a slope without creeping', Math.hypot(s.x, s.z) < 0.2,
    `crept ${Math.hypot(s.x, s.z).toFixed(3)} m`);
}

// 15. ...but a slope STEEPER than the friction cone does slide (honesty)
{
  const cliff = { h: 0, gx: 1.0, gz: 0 };
  const s = createBuggy();
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, cliff, 6);
  check('over-steep slope still slides', Math.hypot(s.x, s.z) > 1);
}

// 16. rolling to a stop, it STOPS (no perpetual glide)
{
  const s = createBuggy(); s.u = 6;
  drive(s, { throttle: 0, steer: 0, brake: 0, handbrake: false }, FLAT, 30);
  check('coasts to a real stop', s.u === 0 && Math.abs(s.v) < 0.01, `u=${s.u} v=${s.v.toFixed(3)}`);
}

if (failed) { console.error(`verify-buggy: ${failed} FAILED`); process.exit(1); }
console.log('verify-buggy: all green');
