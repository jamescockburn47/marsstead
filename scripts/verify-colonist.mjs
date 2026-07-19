// verify-colonist: the colonist rig's pure pose maths (colonistrig.js).
// The contract this defends: feet PLANT (world-locked in stance — the
// anti-skate law), the IK is exact and never hyperextends a knee, the
// gaits keep their duty factors (walk double-supports, the lope flies),
// springs settle instead of exploding, and every number a frame emits
// is finite.

import {
  BONES, GAIT, JOINT_CAP, gaitBlend, cadence, dutyFactor, strideLength,
  springStep, smoothDampAngle, smoother01, solveLeg, legFK, angDiff, ColonistRig,
} from '../src/colonistrig.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok  ${name}`);
  else { console.error(`FAIL  ${name} ${detail}`); failed++; }
}

// ---- IK: solve then reconstruct — the two must agree -----------------------
{
  const T = BONES.THIGH, S = BONES.SHIN;
  let worst = 0, kneeBad = false;
  for (let dz = -0.55; dz <= 0.55; dz += 0.11) {
    for (let dy = -0.78; dy <= -0.3; dy += 0.08) {
      const d = Math.hypot(dz, dy);
      if (d > T + S - 0.006) continue;           // out of reach: clamped, skip
      const { hipPitch, kneeFlex } = solveLeg(T, S, dz, dy);
      if (kneeFlex < -1e-9) kneeBad = true;
      const fk = legFK(T, S, hipPitch, kneeFlex);
      worst = Math.max(worst, Math.hypot(fk.z - dz, fk.y - dy));
    }
  }
  check('IK round-trips through FK', worst < 1e-9, `worst ${worst}`);
  check('knee never hyperextends', !kneeBad);
  // beyond reach: clamps, still finite, still solves
  const far = solveLeg(T, S, 2, -2);
  check('IK clamps beyond reach', Number.isFinite(far.hipPitch)
    && Number.isFinite(far.kneeFlex) && far.kneeFlex >= 0);
}

// ---- springs ---------------------------------------------------------------
{
  const s = { x: 0, v: 0 };
  let overshoot = 0;
  for (let i = 0; i < 400; i++) {
    springStep(s, 1, 12, 1, 1 / 60);
    overshoot = Math.max(overshoot, s.x - 1);
  }
  check('critical spring settles on target', Math.abs(s.x - 1) < 1e-3, `x ${s.x}`);
  check('critical spring barely overshoots', overshoot < 0.02, `over ${overshoot}`);
  const u = { x: 0, v: 0 };
  let wobbled = false;
  for (let i = 0; i < 400; i++) {
    springStep(u, 1, 12, 0.35, 1 / 60);
    if (u.x > 1.05) wobbled = true;
  }
  check('under-damped spring wobbles then lands', wobbled && Math.abs(u.x - 1) < 0.02);
}

// ---- gait parameters -------------------------------------------------------
check('walk double-supports (duty > 0.5)', dutyFactor(GAIT.WALK_V * 0.8) > 0.5);
check('lope flies (duty < 0.5)', dutyFactor(GAIT.LOPE_V) < 0.5);
check('blend is smooth 0..1', gaitBlend(0) === 0 && gaitBlend(9) === 1
  && gaitBlend(4.3) > 0 && gaitBlend(4.3) < 1);
check('stride grows with speed',
  strideLength(GAIT.LOPE_V) > strideLength(GAIT.WALK_V));
check('cadence eases DOWN toward the lope (low-g)',
  cadence(GAIT.LOPE_V) < cadence(GAIT.WALK_V));
check('angDiff wraps', Math.abs(angDiff(0.1, Math.PI * 2 + 0.2) - 0.1) < 1e-9
  && Math.abs(angDiff(3, -3) - (2 * Math.PI - 6)) < 1e-9);

// ---- a walked simulation: plant lock, alternation, continuity --------------
const flat = () => 0;
function simulate(speed, seconds, dtStep = 1 / 90) {
  const rig = new ColonistRig();
  const frames = [];
  let x = 0, z = 0;
  const inp = { x, z, heading: 0, vx: 0, vz: speed, speed,
    airborne: false, vy: 0, groundAt: flat, simT: 0 };
  for (let t = 0; t < seconds; t += dtStep) {
    inp.x = x; inp.z = z += speed * dtStep; inp.simT = t;
    frames.push({ t, pose: rig.step(dtStep, inp), z });
  }
  return frames;
}

{
  const frames = simulate(GAIT.WALK_V, 6);
  // (a) planted boots never move: track each contiguous planted run
  let maxDrift = 0;
  for (const key of ['footL', 'footR']) {
    let anchor = null;
    for (const f of frames) {
      const ft = f.pose[key];
      if (ft.planted) {
        if (!anchor) anchor = { x: ft.x, z: ft.z };
        else maxDrift = Math.max(maxDrift,
          Math.hypot(ft.x - anchor.x, ft.z - anchor.z));
      } else anchor = null;
    }
  }
  check('stance boots are WORLD-LOCKED', maxDrift < 1e-9, `drift ${maxDrift}`);

  // (b) the feet alternate and both plant repeatedly
  const plantsL = frames.filter((f, i) => i && f.pose.footL.planted
    && !frames[i - 1].pose.footL.planted).length;
  const plantsR = frames.filter((f, i) => i && f.pose.footR.planted
    && !frames[i - 1].pose.footR.planted).length;
  check('both feet stride (plants on each side)', plantsL >= 5 && plantsR >= 5,
    `L ${plantsL} R ${plantsR}`);

  // (c) at walk speed there is NEVER a flight frame (double support gait)
  const flight = frames.filter((f) => !f.pose.footL.planted
    && !f.pose.footR.planted).length;
  check('walk never goes airborne', flight === 0, `${flight} flight frames`);

  // (d) pelvis height is continuous and oscillates in a sane band
  let maxJump = 0, lo = 9, hi = -9;
  for (let i = 1; i < frames.length; i++) {
    maxJump = Math.max(maxJump,
      Math.abs(frames[i].pose.hipY - frames[i - 1].pose.hipY));
    if (frames[i].t > 2) { lo = Math.min(lo, frames[i].pose.hipY);
      hi = Math.max(hi, frames[i].pose.hipY); }
  }
  check('pelvis height continuous', maxJump < 0.02, `jump ${maxJump}`);
  check('pelvis vaults (oscillates, bounded)', hi - lo > 0.005 && hi - lo < 0.2,
    `range ${(hi - lo).toFixed(4)}`);

  // (e) every emitted number is finite
  const last = frames[frames.length - 1].pose;
  const flatVals = JSON.stringify(last);
  check('pose all finite', !/null|NaN|Infinity/.test(flatVals), flatVals);

  // (f) THE naturalistic cap: no joint exceeds its physiological angular
  // velocity — this is the whole fix for "limbs snap too fast". At WALK_V
  // the gait blend is 0, so caps are the base ceilings.
  const dtStep = 1 / 90, r2d = 180 / Math.PI;
  const peakVel = (sel) => {
    let m = 0;
    for (let i = 6; i < frames.length; i++) {
      m = Math.max(m, Math.abs(sel(frames[i].pose) - sel(frames[i - 1].pose)) / dtStep * r2d);
    }
    return m;
  };
  const eps = 6;   // one-frame slew-clamp rounding headroom
  const kneeV = peakVel((p) => p.legL.kneeFlex);
  const hipV = peakVel((p) => p.legL.hipPitch);
  const ankV = peakVel((p) => p.legL.anklePitch);
  const shV = peakVel((p) => p.armL.shoulderPitch);
  check('knee within physiological velocity cap', kneeV <= JOINT_CAP.knee + eps, `${kneeV.toFixed(0)} deg/s`);
  check('hip within physiological velocity cap', hipV <= JOINT_CAP.hip + eps, `${hipV.toFixed(0)} deg/s`);
  check('ankle within physiological velocity cap', ankV <= JOINT_CAP.ankle + eps, `${ankV.toFixed(0)} deg/s`);
  check('shoulder within physiological velocity cap', shV <= JOINT_CAP.shoulder + eps, `${shV.toFixed(0)} deg/s`);
}

// ---- SmoothDamp + slew clamp on a hostile (step-function) target -----------
{
  // hammer the smoother with a target that teleports every frame; the hard
  // slew clamp must still hold the output under the cap
  const rig = new ColonistRig();
  rig.smoothJoint('t', 0, 400, 0.05, 1 / 90);   // seed
  let peak = 0, prev = 0;
  const targets = [0, 3, -3, 3, 0, 2, -2, 2, -2, 0];
  for (let i = 0; i < targets.length; i++) {
    const x = rig.smoothJoint('t', targets[i], 400, 0.05, 1 / 90);
    peak = Math.max(peak, Math.abs(x - prev) / (1 / 90) * (180 / Math.PI));
    prev = x;
  }
  check('slew clamp survives a step-function target', peak <= 400 + 6, `${peak.toFixed(0)} deg/s`);

  // SmoothDamp is monotone toward a fixed target and settles on it
  const s = { x: 0, v: 0 };
  for (let i = 0; i < 300; i++) smoothDampAngle(s, 1, 0.1, 1 / 60);
  check('SmoothDamp settles on target', Math.abs(s.x - 1) < 1e-3, `x ${s.x}`);
  // min-jerk endpoints: flat at 0 and 1, symmetric, monotone
  check('smoother01 endpoints', smoother01(0) === 0 && smoother01(1) === 1
    && Math.abs(smoother01(0.5) - 0.5) < 1e-9);
}

{
  const frames = simulate(GAIT.LOPE_V, 6);
  const settled = frames.filter((f) => f.t > 2);
  const flight = settled.filter((f) => !f.pose.footL.planted
    && !f.pose.footR.planted).length;
  check('the lope has real flight phases', flight / settled.length > 0.2,
    `${(flight / settled.length).toFixed(2)} of frames`);
}

// ---- the settle: walk, stop, and stand tall on straight legs under him -----
{
  const rig = new ColonistRig();
  const dtStep = 1 / 90;
  let x = 0, z = 0;
  const inp = { x, z, heading: 0, vx: 0, vz: GAIT.WALK_V, speed: GAIT.WALK_V,
    airborne: false, vy: 0, groundAt: () => 0, simT: 0 };
  for (let t = 0; t < 3; t += dtStep) {   // walk
    inp.x = x; inp.z = z += GAIT.WALK_V * dtStep; inp.simT = t;
    rig.step(dtStep, inp);
  }
  inp.vz = 0; inp.speed = 0;              // stop, and hold for 4 s to settle
  let last;
  for (let t = 3; t < 7; t += dtStep) { inp.simT = t; last = rig.step(dtStep, inp); }

  // legs near-straight (small standing knee bend, not a crouch)
  const r2d = 180 / Math.PI;
  const kneeDeg = Math.max(last.legL.kneeFlex, last.legR.kneeFlex) * r2d;
  check('settles with near-straight legs', kneeDeg < 12, `knee ${kneeDeg.toFixed(1)} deg`);
  // feet directly under the body (only the lateral half-stance, no fore-aft)
  const offL = Math.abs(Math.hypot(last.footL.x - x, last.footL.z - z) - BONES.FOOT_LAT);
  const offR = Math.abs(Math.hypot(last.footR.x - x, last.footR.z - z) - BONES.FOOT_LAT);
  check('boots settle directly under the hips', offL < 0.05 && offR < 0.05,
    `L ${offL.toFixed(3)} R ${offR.toFixed(3)}`);
  // upright: no forward lean at rest
  check('stands upright at rest', Math.abs(last.pelvisPitch) < 0.02,
    `pitch ${last.pelvisPitch.toFixed(3)}`);
}

// ---- landing squash --------------------------------------------------------
{
  const rig = new ColonistRig();
  const inp = { x: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0,
    airborne: true, vy: -3.5, groundAt: flat, simT: 0 };
  for (let i = 0; i < 30; i++) rig.step(1 / 60, inp);
  inp.airborne = false;
  let minHip = 9, hip0 = null, ended = null;
  for (let i = 0; i < 240; i++) {
    const p = rig.step(1 / 60, inp);
    if (hip0 === null) hip0 = p.hipY;
    minHip = Math.min(minHip, p.hipY);
    ended = p.hipY;
  }
  check('landing squashes then recovers',
    minHip < ended - 0.02 && Math.abs(ended - (BONES.HIP_Y - BONES.ANKLE_H)) < 0.05,
    `min ${minHip.toFixed(3)} end ${ended.toFixed(3)}`);
}

// ---- idle: alive but planted ----------------------------------------------
{
  const rig = new ColonistRig();
  const inp = { x: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0,
    airborne: false, vy: 0, groundAt: flat, simT: 0 };
  let moved = 0, first = null;
  for (let t = 0; t < 5; t += 1 / 60) {
    inp.simT = t;
    const p = rig.step(1 / 60, inp);
    if (!first) first = { ...p.footL };
    moved = Math.max(moved, Math.abs(p.footL.x - first.x),
      Math.abs(p.footL.z - first.z));
  }
  check('idle boots stay put', moved < 1e-9, `moved ${moved}`);
}

if (failed) { console.error(`verify-colonist: ${failed} FAILED`); process.exit(1); }
console.log('verify-colonist: all green');
