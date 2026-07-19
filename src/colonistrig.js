// The colonist's rig — pure pose mathematics, no THREE, no DOM.
// verify-colonist.mjs guards it.
//
// Third cut, and a change of species: the sine-wave walk is dead. Sine
// joint rotations can never plant a foot — the boot skates through its
// step because nothing ties it to the ground — and that skate is THE
// robotic tell. This module is built the way procedural character work
// actually gets done (Rosen's Overgrowth GDC talk; Orange Duck's
// analytic IK; Juckett's damped springs):
//
//   1. a PHASE CLOCK with real stance/swing windows (duty factor: walk
//      overlaps in double support, the lope has true flight phases),
//   2. WORLD-LOCKED FOOT PLANTS — a stance boot freezes where it landed
//      and the body vaults over it (inverted pendulum), enforced by
//   3. analytic TWO-BONE IK (law of cosines) per leg, and
//   4. DAMPED SPRINGS layering the life on top: head lag, arm settle,
//      landing squash, acceleration lean, idle breathing and fidgets.
//
// 0.38 g tuning (hypogravity gait research): cadence is LOW, strides are
// LONG, the lope is a chain of floaty bounds with high swing lift and a
// forward lean, and the walk->lope change is a smooth blend, not a gear
// shift (low-g transitions are gradual — Froude ~0.37 not 0.5).
//
// Angle conventions (semantic; the view maps to THREE rotations):
//   hipPitch    + swings the thigh FORWARD
//   kneeFlex    + bends the shin BACK (never negative: no hyperextension)
//   anklePitch  + lifts the TOES
//   shoulderPitch + swings the arm FORWARD;  elbowFlex + bends forward

import { hash2 } from './noise.js';

// ---- suit skeleton (metres) — the view builds flesh on these bones ------
export const BONES = {
  HIP_Y: 0.92,       // pelvis root over the sole, standing easy
  THIGH: 0.44,       // hip pivot -> knee pivot
  SHIN: 0.38,        // knee pivot -> ankle pivot
  ANKLE_H: 0.10,     // ankle pivot over the sole
  FOOT_LAT: 0.16,    // half-spacing between boot centrelines
  SHOULDER_Y: 0.62,  // shoulder pivots over the pelvis root
  SHOULDER_X: 0.30,  // half-spacing between shoulder pivots
  UPPER_ARM: 0.30,
  FOREARM: 0.28,
};
const LEG = BONES.THIGH + BONES.SHIN;         // full leg reach, hip->ankle
const REST_HIP = BONES.HIP_Y - BONES.ANKLE_H; // hip over the ANKLE at rest

// ---- gait numbers (0.38 g) ----------------------------------------------
export const GAIT = {
  WALK_V: 2.6, LOPE_V: 6.0,        // physics.js speeds — kept in step
  CAD_WALK: 1.4, CAD_LOPE: 1.1,    // strides/s (physics.js STRIDE_HZ_*)
  DUTY_WALK: 0.62,                 // stance fraction: double support, a walk
  DUTY_LOPE: 0.30,                 // stance fraction: real flight, a bound
  LIFT_WALK: 0.07, LIFT_LOPE: 0.20, // swing-foot arc height (high: low-g)
  PEND_SOFT: 0.42,                 // knee absorbs this much of the vault
};

// blend 0 (walk) -> 1 (lope), smooth — low-g transitions are gradual
export function gaitBlend(speed) {
  const t = (speed - GAIT.WALK_V) / (GAIT.LOPE_V - GAIT.WALK_V);
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
export function cadence(speed) {
  const b = gaitBlend(speed);
  return GAIT.CAD_WALK + (GAIT.CAD_LOPE - GAIT.CAD_WALK) * b;
}
export function dutyFactor(speed) {
  const b = gaitBlend(speed);
  return GAIT.DUTY_WALK + (GAIT.DUTY_LOPE - GAIT.DUTY_WALK) * b;
}
export function strideLength(speed) { return Math.max(0.5, speed / cadence(speed)); }

// ---- the one physics primitive: a damped spring -------------------------
// semi-implicit Euler (velocity first) — stable where explicit explodes.
// s = {x, v}; omega = angular frequency (stiffness); zeta = damping ratio
// (1 = critical: fastest settle, no overshoot; <1 wobbles — that's jiggle).
export function springStep(s, target, omega, zeta, dt) {
  const a = -omega * omega * (s.x - target) - 2 * zeta * omega * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  return s;
}

// ---- analytic two-bone IK (law of cosines), sagittal plane --------------
// Hip at origin; foot target dz forward, dy DOWN-negative, in hip space.
// Returns { hipPitch, kneeFlex } — closed form, one evaluation, stable,
// knee always bending the right way. (CCD/FABRIK are for longer chains.)
export function solveLeg(thigh, shin, dz, dy) {
  const reach = thigh + shin;
  let d = Math.hypot(dz, dy);
  d = Math.min(Math.max(d, Math.abs(thigh - shin) + 0.01), reach - 0.005);
  const base = Math.atan2(dz, -dy);            // straight-down -> forward
  const cosH = (thigh * thigh + d * d - shin * shin) / (2 * thigh * d);
  const hipPitch = base + Math.acos(Math.max(-1, Math.min(1, cosH)));
  const cosK = (thigh * thigh + shin * shin - d * d) / (2 * thigh * shin);
  const kneeFlex = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosK)));
  return { hipPitch, kneeFlex };
}

// forward kinematics — verify's mirror of solveLeg (and the view's truth)
export function legFK(thigh, shin, hipPitch, kneeFlex) {
  const kz = Math.sin(hipPitch) * thigh, ky = -Math.cos(hipPitch) * thigh;
  const a2 = hipPitch - kneeFlex;
  return { z: kz + Math.sin(a2) * shin, y: ky - Math.cos(a2) * shin };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
// shortest signed angular difference a->b
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const mkSpring = (x = 0) => ({ x, v: 0 });

export class ColonistRig {
  constructor() {
    this.phase = 0.25;         // both feet grounded at rest (D > 0.5 walk)
    this.t = 0;                // rig-local clock (breathing, noise)
    this.feet = [
      { px: 0, pz: 0, py: 0, planted: false, lift: null, side: -1 },
      { px: 0, pz: 0, py: 0, planted: false, lift: null, side: 1 },
    ];
    this.first = true;
    this.lastX = 0; this.lastZ = 0; this.lastSpeed = 0;
    this.lastHeading = 0; this.prevAirborne = false;
    // the spring rack
    this.hipYS = mkSpring(REST_HIP);
    this.leanS = mkSpring(0);        // accel lean (pitch)
    this.rollS = mkSpring(0);        // centripetal roll
    this.swayS = mkSpring(0);        // pelvis lateral weight shift
    this.torsoYawS = mkSpring(0);    // look/counter-yaw lag
    this.armS = [mkSpring(0), mkSpring(0)];      // shoulder pitches L/R
    this.packS = mkSpring(0);        // pack jiggle (under-damped, rides hipY)
    this.idleStep = null;            // in-flight tidy-up step when idling
  }

  // inp: { x, z, heading, vx, vz, speed, airborne, vy, groundAt(x,z), dt }
  step(dt, inp) {
    dt = clamp(dt, 1e-4, 0.1);
    this.t += dt;
    const { x, z, heading, speed, airborne } = inp;
    const ground = inp.groundAt;
    const moving = speed > 0.25 && !airborne;
    const b = gaitBlend(speed);

    // teleports (buggy dismount, save load) re-seat everything
    if (this.first || Math.hypot(x - this.lastX, z - this.lastZ) > 1.5) {
      this.replant(inp); this.first = false;
    }

    // heading frame
    const fx = Math.sin(heading), fz = Math.cos(heading);   // forward
    const rx = fz, rz = -fx;                                // right

    // ---- the phase clock --------------------------------------------------
    const cad = cadence(speed);
    const D = dutyFactor(speed);
    const T = 1 / cad;
    if (moving) this.phase = (this.phase + cad * dt) % 1;

    // landing: both boots down NOW, and the squash spring takes the hit
    if (this.prevAirborne && !airborne) {
      this.phase = 0.55 * D;      // both cycles inside their stance windows
      this.replant(inp);
      const sev = clamp(Math.abs(inp.vy || 0) / 6, 0, 1);
      this.hipYS.v -= sev * 2.2;  // the knees take it; the spring gives it back
    }
    this.prevAirborne = airborne;

    // ---- feet: locked plants and swing arcs -------------------------------
    const halfStance = clamp(speed * D * T * 0.5, 0, LEG * 0.9);
    const pose = { legL: {}, legR: {} };
    let stanceWSum = 0, stanceHip = 0, swayTarget = 0;

    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const cyc = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      const inStance = cyc < D;

      if (airborne) { f.planted = false; f.lift = null; continue; }

      if (!moving) {
        // idling: boots stay where they were left, unless the tidy-up
        // micro-step (below) is walking one home
        if (!f.planted) this.plantFoot(f, x, z, rx, rz, fx, fz, 0, ground);
        continue;
      }

      if (inStance) {
        if (!f.planted) {
          // heel-strike: freeze the boot where the swing delivered it
          this.plantFoot(f, f.px, f.pz, rx, rz, fx, fz, 0, ground, true);
        }
        // the planted boot: WORLD-LOCKED — this is the anti-skate law
        const sFrac = cyc / D;
        const w = Math.sin(Math.PI * sFrac);           // loaded mid-stance
        const horiz = Math.hypot(x - f.px, z - f.pz) * GAIT.PEND_SOFT;
        const pend = Math.sqrt(Math.max(
          LEG * LEG * 0.92 - horiz * horiz, LEG * LEG * 0.25));
        stanceHip += (f.py + pend) * w; stanceWSum += w;
        swayTarget += f.side * w;
      } else {
        // swing: an arc from lift-off to the predicted catch point
        if (f.planted) { f.planted = false; f.lift = { x: f.px, z: f.pz, y: f.py }; }
        if (!f.lift) f.lift = { x: f.px, z: f.pz, y: f.py };
        const u = (cyc - D) / (1 - D);
        const tLand = (1 - u) * (1 - D) * T;
        // capture point: land where the body will need catching
        const tx = x + inp.vx * tLand + fx * halfStance + rx * f.side * BONES.FOOT_LAT;
        const tz = z + inp.vz * tLand + fz * halfStance + rz * f.side * BONES.FOOT_LAT;
        const s = smooth01(u);
        f.px = lerp(f.lift.x, tx, s);
        f.pz = lerp(f.lift.z, tz, s);
        const gY = ground(f.px, f.pz);
        const liftH = lerp(GAIT.LIFT_WALK, GAIT.LIFT_LOPE, b);
        f.py = Math.max(gY, lerp(f.lift.y, gY, s)) + Math.sin(Math.PI * u) * liftH;
      }
    }

    // ---- idle housekeeping: weight shift + tidy-up steps ------------------
    if (!moving && !airborne) this.idleFeet(inp, fx, fz, rx, rz, dt);

    // ---- pelvis height: the inverted pendulum, spring-smoothed ------------
    const gHere = ground(x, z);
    let hipTarget;
    if (airborne) {
      hipTarget = REST_HIP - 0.12;                    // tucked, in flight
    } else if (stanceWSum > 1e-4) {
      hipTarget = (stanceHip / stanceWSum) - gHere;   // vault over the plant
    } else {
      hipTarget = REST_HIP - (moving ? lerp(0, 0.05, b) : 0.015);
    }
    hipTarget = clamp(hipTarget, REST_HIP - 0.30, REST_HIP + 0.06);
    springStep(this.hipYS, hipTarget, 18, 1, dt);
    // the pack rides the same rail on a sloppier spring — the jiggle is
    // the DIFFERENCE between the two (mass visibly floating at 0.38 g)
    springStep(this.packS, this.hipYS.x, 9, 0.38, dt);

    // ---- legs through the IK ---------------------------------------------
    const hipW = gHere + this.hipYS.x + BONES.ANKLE_H; // hip world height
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const out = i === 0 ? pose.legL : pose.legR;
      let dz, dy;
      if (airborne) {
        // the tuck: knees drawn up, asymmetric (a body, not a mechanism)
        const k = i === 0 ? 1 : 0.72;
        Object.assign(out, {
          hipPitch: 0.55 * k, kneeFlex: 1.05 * k, anklePitch: -0.25 * k,
        });
        continue;
      }
      // boot -> hip space (heading frame)
      const wx = f.px - x, wz = f.pz - z;
      dz = wx * fx + wz * fz;
      dy = (f.py + BONES.ANKLE_H) - hipW;
      const ik = solveLeg(BONES.THIGH, BONES.SHIN, dz, dy);
      out.hipPitch = ik.hipPitch; out.kneeFlex = ik.kneeFlex;
      // ankle: sole level, plus heel-strike / toe-off styling
      let style = 0;
      const cyc = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      if (moving) {
        if (cyc < D) {
          const sf = cyc / D;
          style = sf < 0.25 ? lerp(0.22, 0, sf / 0.25)          // heel first
            : sf > 0.72 ? lerp(0, -0.38, (sf - 0.72) / 0.28) : 0; // toe push
        } else {
          const u = (cyc - D) / (1 - D);
          style = lerp(-0.3, 0.18, smooth01(u));  // toes trail, then reach
        }
      }
      out.anklePitch = -(out.hipPitch - out.kneeFlex) + style;
    }

    // ---- torso, arms, head: the spring-driven life ------------------------
    const accel = clamp((speed - this.lastSpeed) / dt, -14, 14);
    this.lastSpeed = speed;
    springStep(this.leanS, accel * 0.028, 6, 1, dt);
    const turnRate = angDiff(this.lastHeading, heading) / dt;
    this.lastHeading = heading;
    springStep(this.rollS, clamp(-turnRate * speed * 0.02, -0.3, 0.3), 7, 1, dt);
    springStep(this.swayS, moving ? swayTarget * 0.028
      : Math.sin(this.t * 0.55) * 0.02, 4, 1, dt);

    // pelvis follows the legs; shoulders answer against them; a suited
    // torso carries a permanent forward lean that grows with the bound
    const legDelta = (pose.legR.hipPitch || 0) - (pose.legL.hipPitch || 0);
    const pelvisYaw = clamp(legDelta * 0.16, -0.2, 0.2);
    springStep(this.torsoYawS, -pelvisYaw * 1.5, 9, 1, dt);

    // arms: targets from the OPPOSITE leg, delivered late by their spring
    // (overlapping action — distal parts lag). Suit shoulders ride wide.
    const armAmp = 0.5 + 0.45 * b;
    const tL = airborne ? -0.55 : (pose.legR.hipPitch || 0) * armAmp;
    const tR = airborne ? -0.55 : (pose.legL.hipPitch || 0) * armAmp;
    springStep(this.armS[0], tL, 9, 0.85, dt);
    springStep(this.armS[1], tR, 9, 0.85, dt);

    // idle breathing + the never-still noise floor (coherent drift, not
    // twitching: value noise, per-channel offsets so nothing is in phase)
    const breathe = Math.sin((this.t / 4.3) * Math.PI * 2);
    const n1 = hash2(Math.floor(this.t * 0.7), 3) - 0.5;
    const n2 = hash2(Math.floor(this.t * 0.5) + 7, 11) - 0.5;
    const fid = moving || airborne ? null : this.fidget(inp.simT || this.t);

    pose.hipY = this.hipYS.x;
    pose.sway = this.swayS.x;
    pose.pelvisYaw = pelvisYaw;
    pose.pelvisPitch = 0.05 + speed * 0.012 + lerp(0, 0.1, b)
      + this.leanS.x + (airborne ? -0.08 : 0);
    pose.pelvisRoll = this.rollS.x;
    pose.torsoYaw = this.torsoYawS.x + (fid ? fid.yaw : n1 * 0.05);
    pose.torsoPitch = breathe * 0.012 + (fid ? fid.pitch : n2 * 0.03);
    pose.breath = breathe;
    pose.packOff = clamp(this.packS.x - this.hipYS.x, -0.05, 0.05);
    const bend = 0.5 + 0.3 * b;   // the suit's pre-bent elbows
    pose.armL = {
      shoulderPitch: this.armS[0].x + (fid && fid.wrist ? 0.95 : 0),
      elbowFlex: airborne ? 0.9
        : bend + Math.max(0, this.armS[0].x) * 0.6 + (fid && fid.wrist ? 1.1 : 0),
      abduct: 0.16 + 0.05 * b,
    };
    pose.armR = {
      shoulderPitch: this.armS[1].x,
      elbowFlex: airborne ? 0.9 : bend + Math.max(0, this.armS[1].x) * 0.6,
      abduct: 0.16 + 0.05 * b,
    };
    // debug/verify taps
    pose.footL = { x: this.feet[0].px, y: this.feet[0].py, z: this.feet[0].pz,
      planted: this.feet[0].planted };
    pose.footR = { x: this.feet[1].px, y: this.feet[1].py, z: this.feet[1].pz,
      planted: this.feet[1].planted };
    pose.duty = D;

    this.lastX = x; this.lastZ = z;
    return pose;
  }

  // freeze a boot into the world at (bx,bz) (snapped under the hip frame
  // when fresh: rest offset right of the centreline)
  plantFoot(f, bx, bz, rx, rz, fx, fz, ahead, ground, exact = false) {
    if (!exact) {
      bx = bx + rx * f.side * BONES.FOOT_LAT + fx * ahead;
      bz = bz + rz * f.side * BONES.FOOT_LAT + fz * ahead;
    }
    f.px = bx; f.pz = bz; f.py = ground(bx, bz);
    f.planted = true; f.lift = null;
  }

  replant(inp) {
    const fx = Math.sin(inp.heading), fz = Math.cos(inp.heading);
    const rx = fz, rz = -fx;
    for (const f of this.feet) {
      this.plantFoot(f, inp.x, inp.z, rx, rz, fx, fz,
        f.side < 0 ? 0.06 : -0.04, inp.groundAt);
    }
    this.lastX = inp.x; this.lastZ = inp.z;
    this.lastHeading = inp.heading; this.lastSpeed = inp.speed;
  }

  // when idle, boots that were abandoned mid-stride walk themselves home,
  // one at a time — a settle step, never a snap
  idleFeet(inp, fx, fz, rx, rz, dt) {
    const { x, z, groundAt } = inp;
    if (this.idleStep) {
      const st = this.idleStep, f = this.feet[st.i];
      st.u = Math.min(1, st.u + dt / 0.28);
      const s = smooth01(st.u);
      f.px = lerp(st.from.x, st.to.x, s);
      f.pz = lerp(st.from.z, st.to.z, s);
      f.py = groundAt(f.px, f.pz) + Math.sin(Math.PI * st.u) * 0.05;
      if (st.u >= 1) { f.py = groundAt(f.px, f.pz); this.idleStep = null; }
      return;
    }
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const hx = x + rx * f.side * BONES.FOOT_LAT;
      const hz = z + rz * f.side * BONES.FOOT_LAT;
      if (Math.hypot(f.px - hx, f.pz - hz) > 0.34) {
        this.idleStep = { i, u: 0, from: { x: f.px, z: f.pz },
          to: { x: hx, z: hz } };
        break;
      }
    }
  }

  // the occasional discrete fidget: deterministic from the sim clock so
  // shared worlds could replay it. Every ~9 s window may fire one; the
  // envelope eases in and out over the middle of the window.
  fidget(simT) {
    const win = Math.floor(simT / 9);
    const r = hash2(win, 91);
    if (r < 0.45) return null;                    // most windows: nothing
    const u = (simT - win * 9) / 9;
    const env = smooth01((u - 0.2) / 0.15) * (1 - smooth01((u - 0.65) / 0.15));
    if (env < 1e-3) return null;
    const kind = hash2(win, 17);
    if (kind < 0.35) return { yaw: 0.5 * env, pitch: 0.05 * env, wrist: false };
    if (kind < 0.7) return { yaw: -0.55 * env, pitch: 0.02 * env, wrist: false };
    // check the wrist display: forearm up, eyes down
    return { yaw: 0.12 * env, pitch: 0.16 * env, wrist: env > 0.35 };
  }
}
