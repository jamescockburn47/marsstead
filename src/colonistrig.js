// Pure procedural pose mathematics. Grounded exploration uses short alternating
// steps matched to actual displacement. Sprint uses longer low-g bounds; real
// airborne physics selects the jump pose. Feet are world-locked during support
// and finally solved against the rendered hip with analytic two-bone IK.
// Upper-body springs provide counter-swing and settle without moving boot plants.
// The grounded walking contract is checked by verify-colonist.mjs and its
// rendered-hierarchy contact checks; media/gait-review.html compares real rigs.
//
// Angle conventions (semantic; the view maps to THREE rotations):
//   hipPitch    + swings the thigh FORWARD
//   kneeFlex    + bends the shin BACK (never negative: no hyperextension)
//   anklePitch  + lifts the TOES
//   shoulderPitch + swings the arm FORWARD;  elbowFlex + bends forward
import { G_MARS, HABITAT_WALK_SPEED } from './physics.js';
import { supportHeight, solveFoot, swingFoot } from './colonistcontact.js';
import { stepLope } from './colonistlope.js';

// ---- suit skeleton (metres) — the view builds flesh on these bones ------
export const BONES = {
  HIP_Y: 0.92,       // pelvis root over the sole, standing easy
  THIGH: 0.44,       // hip pivot -> knee pivot
  SHIN: 0.38,        // knee pivot -> ankle pivot
  ANKLE_H: 0.10,     // ankle pivot over the sole
  // step width (2026-07-20 gait audit): real feet land 8-12 cm apart —
  // the old 32 cm straddle read as a cowboy waddle, THE goofy tell #2
  FOOT_LAT: 0.10,    // half-spacing between boot centrelines
  SHOULDER_Y: 0.62,  // shoulder pivots over the pelvis root
  SHOULDER_X: 0.30,  // half-spacing between shoulder pivots
  UPPER_ARM: 0.30,
  FOREARM: 0.28,
};
const LEG = BONES.THIGH + BONES.SHIN;         // full leg reach, hip->ankle
const REST_HIP = BONES.HIP_Y - BONES.ANKLE_H; // hip over the ANKLE at rest

// Supported exploration steps are an animation choice, not a claim that an
// unassisted human would choose this cadence on Mars. The gameplay controller
// stays grounded when walking; its visual gait must do the same. Sprint retains
// long low-gravity bounds, and actual jumps use the airborne pose.
export const GAIT = {
  WALK_V: HABITAT_WALK_SPEED, LOPE_V: 6.0,
  CAD_WALK: 1.85, CAD_LOPE: 1.45,
  DUTY_WALK: 0.52, DUTY_LOPE: 0.30,
  LIFT_WALK: 0.04, LIFT_LOPE: 0.16,
  PEND_SOFT: 0.42,
};
export const G_EFF = G_MARS;
export function froude(speed) { return (speed * speed) / (G_EFF * LEG); }
export function gaitBlend(speed) {
  const t = Math.max(0, Math.min(1, (speed - 2.8) / 2.2));
  return t * t * (3 - 2 * t);
}
export function cadence(speed) {
  const walk = Math.min(2.05, 0.75 + Math.max(0, speed) * 0.5);
  return walk + (GAIT.CAD_LOPE - walk) * gaitBlend(speed);
}
export function dutyFactor(speed) {
  return GAIT.DUTY_WALK + (GAIT.DUTY_LOPE - GAIT.DUTY_WALK) * gaitBlend(speed);
}
export function strideLength(speed) { return Math.max(0.5, speed / cadence(speed)); }

// ---- the one physics primitive: a damped spring -------------------------
// semi-implicit Euler (velocity first) — stable where explicit explodes.
// s = {x, v}; omega = angular frequency (stiffness); zeta = damping ratio
// (1 = critical: fastest settle, no overshoot; <1 wobbles — that's jiggle).
export function springStep(s, target, omega, zeta, dt) {
  // SUB-STEPPED (2026-07-20): semi-implicit Euler sits near its
  // stability wall at omega·dt ≈ 2, and a run of clamped 0.1 s frames
  // at omega 18 walked the hip spring to 1e+250 — FINITE, so every NaN
  // guard waved it through while the body stood a googol metres up.
  // Substeps hold omega·h ≤ 0.5: unconditionally stable, same feel.
  const n = Math.max(1, Math.ceil((omega * dt) / 0.5));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = -omega * omega * (s.x - target) - 2 * zeta * omega * s.v;
    s.v += a * h;
    s.x += s.v * h;
  }
  return s;
}

// SmoothDamp — a critically-damped ease toward a MOVING target (Game
// Programming Gems 4, Thomas Lowe; the maths behind Unity's SmoothDamp).
// It never overshoots and eases the corner; paired with the slew clamp
// below it is the whole answer to "limbs snap too fast". s = {x, v}.
export function smoothDampAngle(s, target, smoothTime, dt) {
  smoothTime = Math.max(1e-4, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = angDiff(target, s.x);        // = s.x - target, shortest arc
  const retarget = s.x - change;
  const temp = (s.v + omega * change) * dt;
  s.v = (s.v - omega * temp) * exp;
  s.x = retarget + (change + temp) * exp;
  return s.x;
}

// min-jerk time profile (Flash & Hogan 1985): zero velocity AND zero
// acceleration at both ends — the swing foot neither jerks off the ground
// nor stamps down. This IS smootherstep.
export function smoother01(t) {
  const c = clamp(t, 0, 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

// physiological angular-velocity ceilings, deg/s (Winter/Perry normative
// gait). The slew clamp holds every joint to these, so no IK target-jump
// at a foot plant can ever survive as a snap. Scaled up with the bound —
// a Mars lope is allowed faster limbs than a walk.
export const JOINT_CAP = {
  hip: 260, knee: 420, ankle: 320, shoulder: 300, elbow: 300, torso: 110,
};

// ---- analytic two-bone IK (law of cosines), sagittal plane --------------
// Hip at origin; foot target dz forward, dy DOWN-negative, in hip space.
// Returns { hipPitch, kneeFlex } — closed form, one evaluation, stable,
// knee always bending the right way. (CCD/FABRIK are for longer chains.)
export function solveLeg(thigh, shin, dz, dy) {
  const reach = thigh + shin;
  let d = Math.hypot(dz, dy);
  d = Math.min(Math.max(d, Math.abs(thigh - shin) + 0.01), reach - 0.0015);
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
    this.listS = mkSpring(0);        // pelvic list: swing-side drop (gait det. #3)
    this.armS = [mkSpring(0), mkSpring(0)];      // shoulder pitches L/R
    this.packS = mkSpring(0);        // pack jiggle (under-damped, rides hipY)
    this.idleStep = null;            // in-flight tidy-up step when idling
    this.sm = {};                    // per-joint SmoothDamp + slew states
    this.moving = false;             // hysteresis latch (no stop-boundary flicker)
  }

  // smooth a joint toward its target: SmoothDamp eases the curve, then a
  // HARD slew clamp (deg/s) guarantees the physiological ceiling. First
  // call seeds at the target so nothing snaps into place on spawn.
  smoothJoint(id, target, capDps, smoothTime, dt) {
    let s = this.sm[id];
    if (!s) { this.sm[id] = { x: target, v: 0 }; return target; }
    const prev = s.x;
    smoothDampAngle(s, target, smoothTime, dt);
    const cap = capDps * (Math.PI / 180) * dt;
    const d = angDiff(prev, s.x);
    if (d > cap) { s.x = prev + cap; s.v = cap / dt; }
    else if (d < -cap) { s.x = prev - cap; s.v = -cap / dt; }
    return s.x;
  }

  // inp: { x, z, heading, vx, vz, speed, airborne, vy, groundAt(x,z), dt }
  step(dt, inp) {
    dt = clamp(dt, 1e-4, 0.1);
    this.t += dt;
    if (inp.gait) { this.lopeSettle = null; return stepLope(this, dt, inp, BONES, solveLeg, springStep); }
    if (this.lope) {
      this.lope = null;
      // Complete the actual recovery arc before handing feet to the walk clock.
      // The supporting heel lowers around its existing toe pivot.
      const recovering = this.feet.findIndex(f => !f.planted);
      if (!inp.airborne && recovering >= 0) {
        const f = this.feet[recovering];
        const leg = recovering === 0 ? this.lastLopePose.legR : this.lastLopePose.legL;
        this.lopeSettle = { i: recovering, u: 0, from: { x: f.px, y: f.py, z: f.pz },
          style: leg.anklePitch + leg.hipPitch - leg.kneeFlex };
      } else for (const f of this.feet) if (f.toe) {
        f.px -= Math.sin(f.yaw) * .20; f.pz -= Math.cos(f.yaw) * .20; f.toe = false;
      }
      this.prevAirborne = false;
      this.sm = {};
      if (this.lastLopePose) for (const [tag, leg] of [['L',this.lastLopePose.legL],['R',this.lastLopePose.legR]]) {
        this.sm['h'+tag]={x:leg.hipPitch,v:0};
        this.sm['k'+tag]={x:leg.kneeFlex,v:0};
        this.sm['a'+tag]={x:leg.anklePitch,v:0};
      }
    }
    // the poison rule (this codebase keeps re-learning it): a value that
    // reaches a spring poisoned — NaN OR a finite explosion (a hip a
    // metre out of band is already impossible) — must never survive a
    // second frame. Re-seed and walk on.
    if (!Number.isFinite(this.hipYS.x) || Math.abs(this.hipYS.x - REST_HIP) > 1
      || !Number.isFinite(this.phase)
      || this.feet.some((f) => !Number.isFinite(f.px) || !Number.isFinite(f.py))) {
      this.phase = 0.25;
      this.hipYS = mkSpring(REST_HIP);
      this.packS = mkSpring(REST_HIP);
      this.sm = {};
      this.replant(inp);
    }
    const { x, z, heading, speed, airborne } = inp;
    const ground = inp.groundAt;
    // hysteresis: start striding above 0.35 m/s, stop below 0.15 — so a
    // figure hovering near the threshold can't flicker between gait and
    // idle (that flicker read as a tremor).
    if (airborne) this.moving = false;
    else if (this.moving) { if (speed < 0.15) this.moving = false; }
    else if (speed > 0.35) this.moving = true;
    const moving = this.moving;
    if (moving || airborne) this.idleStep = null;
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
    const T = 1 / cad;
    // the anatomy guard: stance travel (speed × stance time) can never
    // exceed what a leg can actually pass over — duty yields before the
    // IK is asked to lie (the old over-stride clamped a straight leg at
    // every heel-strike; this is what removes it at ANY speed)
    const D = Math.min(dutyFactor(speed),
      speed > 0.2 ? (0.92 * LEG) / (speed * T) : 1);
    if (airborne) this.lopeSettle = null;
    const settling = !!this.lopeSettle;
    let settleStyle = 0;
    if (settling) {
      const st = this.lopeSettle, f = this.feet[st.i];
      st.u = Math.min(1, st.u + dt / .24);
      const k = smoother01(st.u);
      settleStyle = st.style * (1 - k);
      const ahead = Math.min(.12, speed * .08);
      const tx = x + rx * f.side * BONES.FOOT_LAT + fx * ahead;
      const tz = z + rz * f.side * BONES.FOOT_LAT + fz * ahead;
      f.px = lerp(st.from.x, tx, k); f.pz = lerp(st.from.z, tz, k);
      f.py = lerp(st.from.y, ground(f.px, f.pz), k);
      if (st.u === 1) {
        f.planted = true; f.yaw = heading; f.lift = null; f.swingStart = null;
        // The other boot leaves support next; the recovered boot receives weight.
        this.phase = st.i === 0 ? (D + .5) % 1 : D;
        for (const boot of this.feet) if (boot.toe) {
          boot.px -= Math.sin(boot.yaw) * .20; boot.pz -= Math.cos(boot.yaw) * .20; boot.toe = false;
        }
        this.lopeSettle = null;
      }
    } else if (moving) this.phase = (this.phase + cad * dt) % 1;

    // A manual landing seats both boots before the next travelling support.
    // Do not interpret the other leg as an already advanced walking swing
    // on this same frame: at speed that invents a metre-long recovery target.
    const landed = this.prevAirborne && !airborne;
    if (landed) {
      this.phase = 0.55 * D;      // both cycles inside their stance windows
      this.replant(inp);
      if (moving) {
        const f=this.feet[1]; f.planted=false;
        this.lopeSettle={i:1,u:0,from:{x:f.px,y:f.py,z:f.pz},style:0};
      }
      const sev = clamp(Math.abs(this.lastVy || inp.vy || 0) / 6, 0, 1);
      this.hipYS.v -= sev * 2.2;  // the knees take it; the spring gives it back
    }
    this.prevAirborne = airborne;
    this.lastVy = inp.vy || 0;

    // ---- feet: locked plants and swing arcs -------------------------------
    const halfStance = clamp(speed * D * T * 0.5, 0, LEG * 0.9);
    const pose = { legL: {}, legR: {} };
    let stanceWSum = 0, stanceHip = 0, swayTarget = 0;

    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const cyc = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      const inStance = cyc < D;

      if (airborne) { f.planted = false; f.lift = null; continue; }

      if (settling || landed) continue;

      if (!moving) {
        // idling: boots stay where they were left, unless the tidy-up
        // micro-step (below) is walking one home
        continue;
      }

      if (inStance) {
        if (!f.planted) {
          // Seat at the sub-frame touchdown, not the previous frame's
          // swing sample. At 30 Hz a runner travels 20 cm per frame;
          // freezing that stale sample overextends the next stance.
          this.plantFoot(f, x, z, rx, rz, fx, fz, halfStance - speed * cyc * T, ground);
        }
        // the planted boot: WORLD-LOCKED — this is the anti-skate law
        const sFrac = cyc / D;
        const w = Math.sin(Math.PI * sFrac);           // loaded mid-stance
        const horiz = Math.hypot(x - f.px, z - f.pz);
        const pend = Math.sqrt(Math.max(
          LEG * LEG * 0.985 - horiz * horiz, LEG * LEG * 0.25));
        stanceHip += (f.py + pend) * w; stanceWSum += w;
        swayTarget += f.side * w;
      } else {
        // swing: an arc from lift-off to the predicted catch point
        if (f.planted) { f.planted = false; f.lift = { x: f.px, z: f.pz, y: f.py }; f.swingStart = null; }
        if (!f.lift) f.lift = { x: f.px, z: f.pz, y: f.py };
        const u = (cyc - D) / (1 - D);
        const liftH = lerp(GAIT.LIFT_WALK, GAIT.LIFT_LOPE, b);
        swingFoot(f, inp, u, (1 - D) * T, halfStance, liftH, BONES);
      }
    }

    // ---- idle housekeeping: weight shift + tidy-up steps ------------------
    if (!moving && !airborne && !settling) this.idleFeet(inp, fx, fz, rx, rz, dt);

    // ---- pelvis height: the inverted pendulum, spring-smoothed ------------
    const gHere = ground(x, z);
    let hipTarget;
    if (airborne) {
      hipTarget = REST_HIP - 0.12; // manual jump tuck
    } else if (stanceWSum > 1e-4) {
      // Anticipate touchdown, then rise over the supporting leg at
      // mid-stance. Holding the longest-step height throughout the cycle
      // crouches both knees even while the feet pass beneath the hips.
      const supportRail = Math.sqrt(LEG * LEG * 0.985 - halfStance * halfStance) + 0.008;
      hipTarget = (stanceHip / stanceWSum) - gHere;
      if (b < 0.01) hipTarget = supportRail - 0.024 * Math.cos(this.phase * Math.PI * 4);
    } else if (moving) {
      // the lope's flight sliver: neither boot down — the body FLOATS a
      // touch high and the spring draws the bound's arc between stances
      hipTarget = REST_HIP + 0.045;
    } else {
      // stopped: stand tall on near-straight legs (hip just under full
      // reach — enough for a natural micro-bend, not a crouch)
      hipTarget = REST_HIP - 0.0015;
    }
    if (landed) hipTarget = this.hipYS.x - .015;
    hipTarget = clamp(hipTarget, REST_HIP - 0.30, REST_HIP + 0.06);
    springStep(this.hipYS, hipTarget, moving && b < 0.01 && !settling && !landed ? 38 : 18, 1, dt);
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
        // Draw the knees up on ascent, then extend for the ground on the
        // way down. A constant tuck made every jump a rigid frozen pose.
        const tuck = smooth01(((inp.vy || 0) + 2) / 3.5);
        const ik = solveLeg(BONES.THIGH, BONES.SHIN,
          (i === 0 ? .06 : -.04) + tuck * .10,
          -this.hipYS.x + tuck * (i === 0 ? .19 : .13));
        Object.assign(out, ik, { anklePitch: -(ik.hipPitch-ik.kneeFlex) });
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
    springStep(this.swayS, moving ? swayTarget * 0.028 : 0, 4, 1, dt);
    // pelvic list (Perry's determinant): the free side of the pelvis
    // DROPS a few degrees while its leg swings — weight is visibly ON
    // the stance hip. swayTarget signs toward the stance foot; the drop
    // goes the other way.
    springStep(this.listS, moving && !airborne ? -swayTarget * 0.055 : 0, 6, 1, dt);

    // pelvis follows the legs; shoulders answer against them; a suited
    // torso carries a permanent forward lean that grows with the bound
    const legDelta = (pose.legR.hipPitch || 0) - (pose.legL.hipPitch || 0);
    const pelvisYaw = clamp(legDelta * 0.16, -0.2, 0.2);
    // counter-rotation is EQUAL and opposite (2026-07-20 audit): real
    // shoulders cancel the pelvis and stay near world-still — the old
    // 1.5x over-counter twisted them past neutral every step
    springStep(this.torsoYawS, -pelvisYaw, 9, 1, dt);

    // arms swing from the shoulder like loose pendulums, opposite the
    // legs — at REAL amplitude (2026-07-20 audit): brisk-walk arm swing
    // is ±10-15°, not the ±40° cartoon march the old 0.9-1.4x drive
    // produced. The under-damped spring keeps the loose follow-through.
    // Remove the common knee-flexion bias: the arms must swing behind as
    // well as ahead, rather than both hands hanging permanently forward.
    const armAmp = 0.42 + 0.12 * b;
    const counterSwing = ((pose.legR.hipPitch || 0) - (pose.legL.hipPitch || 0)) * armAmp;
    const tL = airborne ? -0.5 : counterSwing;
    const tR = airborne ? -0.5 : -counterSwing;
    springStep(this.armS[0], tL, 14, 1, dt);
    springStep(this.armS[1], tR, 14, 1, dt);

    // breathing is the ONLY idle motion — a slow swell of the chest, and
    // nothing that rotates a joint. No drift, no fidgets: a standing figure
    // is still (the twitch read as Parkinsonian and had to go entirely).
    const breathe = Math.sin((this.t / 4.3) * Math.PI * 2);

    pose.hipY = this.hipYS.x;
    pose.sway = this.swayS.x;
    pose.pelvisYaw = pelvisYaw;
    // upright when stopped; the forward lean is a moving posture only
    pose.pelvisPitch = (moving ? 0.05 : 0.0) + speed * 0.012 + lerp(0, 0.1, b)
      + this.leanS.x + (airborne ? -0.08 : 0);
    pose.pelvisRoll = this.rollS.x + this.listS.x;
    pose.torsoYaw = this.torsoYawS.x;
    pose.torsoPitch = 0;
    pose.breath = breathe;
    pose.packOff = clamp(this.packS.x - this.hipYS.x, -0.05, 0.05);
    // the suit holds the arms OUT (never flat to the sides) and keeps a
    // pre-bent elbow that pumps a little as the hand swings forward; the
    // shoulder opens a touch further as the arm travels back.
    const bend = 0.3 + 0.2 * b;
    const swL = this.armS[0].x, swR = this.armS[1].x;
    pose.armL = {
      shoulderPitch: swL,
      elbowFlex: airborne ? 0.9 : bend + Math.max(0, swL) * 0.25,
      abduct: 0.2 + 0.05 * b + Math.max(0, -swL) * 0.08,
    };
    pose.armR = {
      shoulderPitch: swR,
      elbowFlex: airborne ? 0.9 : bend + Math.max(0, swR) * 0.25,
      abduct: 0.2 + 0.05 * b + Math.max(0, -swR) * 0.08,
    };

    // Smooth airborne poses and upper-body follow-through. Grounded legs
    // are solved finally below: smoothing those angles breaks foot contact.
    const kk = 1 + b;
    const ST_LEG = 0.05, ST_ARM = 0.09, ST_TOR = 0.14;
    if (airborne) for (const [tag, lp] of [['L', pose.legL], ['R', pose.legR]]) {
      lp.hipPitch = this.smoothJoint('h' + tag, lp.hipPitch, JOINT_CAP.hip * kk, ST_LEG, dt);
      lp.kneeFlex = this.smoothJoint('k' + tag, lp.kneeFlex, JOINT_CAP.knee * kk, ST_LEG, dt);
      lp.anklePitch = this.smoothJoint('a' + tag, lp.anklePitch, JOINT_CAP.ankle * kk, ST_LEG, dt);
    }
    for (const [tag, ap] of [['L', pose.armL], ['R', pose.armR]]) {
      ap.shoulderPitch = this.smoothJoint('s' + tag, ap.shoulderPitch, JOINT_CAP.shoulder * kk, ST_ARM, dt);
      ap.elbowFlex = this.smoothJoint('e' + tag, ap.elbowFlex, JOINT_CAP.elbow * kk, ST_ARM, dt);
    }
    pose.torsoYaw = this.smoothJoint('ty', pose.torsoYaw, JOINT_CAP.torso, ST_TOR, dt);
    pose.torsoPitch = this.smoothJoint('tp', pose.torsoPitch, JOINT_CAP.torso, ST_TOR, dt);

    // Final IK uses the ACTUAL translated hip, including lateral sway and
    // turn offsets. Support boots remain exact in the rendered hierarchy.
    if (!airborne) {
      const targets = settling ? this.feet.map(f => {
        if (!f.toe) return f;
        const a = -settleStyle, along = .20 * Math.cos(a) - BONES.ANKLE_H * Math.sin(a);
        return { ...f, px: f.px - Math.sin(f.yaw) * along, pz: f.pz - Math.cos(f.yaw) * along,
          py: f.py + .20 * Math.sin(a) + BONES.ANKLE_H * (Math.cos(a) - 1) };
      }) : this.feet;
      pose.hipY = supportHeight(pose, targets, inp, BONES);
      for (const [i, lp] of [[0, pose.legL], [1, pose.legR]]) {
        Object.assign(lp, solveFoot(targets[i], pose, inp, BONES, solveLeg));
        if (settling && this.feet[i].toe) lp.anklePitch += settleStyle;
      }
      // Seed takeoff smoothing from the actual last supported joints.
      for (const [tag, lp] of [['L',pose.legL],['R',pose.legR]]) {
        this.sm['h'+tag]={x:lp.hipPitch,v:0};
        this.sm['k'+tag]={x:lp.kneeFlex,v:0};
        this.sm['a'+tag]={x:lp.anklePitch,v:0};
      }
    }
    // debug/verify taps
    pose.footL = { x: this.feet[0].px, y: this.feet[0].py, z: this.feet[0].pz,
      planted: this.feet[0].planted };
    pose.footR = { x: this.feet[1].px, y: this.feet[1].py, z: this.feet[1].pz,
      planted: this.feet[1].planted };
    pose.duty = D;

    this.lastX = x; this.lastZ = z;
    this.lastPose = pose;
    return pose;
  }

  supportHint(x,z,heading) {
    const fx=Math.sin(heading),fz=Math.cos(heading);
    return this.feet.filter(f=>f.planted).map(f=>({side:f.side,
      ahead:(f.px-x)*fx+(f.pz-z)*fz-(f.toe?.20:0)}))
      .sort((a,b)=>b.ahead-a.ahead)[0];
  }

  // freeze a boot into the world at (bx,bz) (snapped under the hip frame
  // when fresh: rest offset right of the centreline)
  plantFoot(f, bx, bz, rx, rz, fx, fz, ahead, ground, exact = false) {
    if (!exact) {
      bx = bx + rx * f.side * BONES.FOOT_LAT + fx * ahead;
      bz = bz + rz * f.side * BONES.FOOT_LAT + fz * ahead;
    }
    f.px = bx; f.pz = bz; f.py = ground(bx, bz);
    f.yaw = Math.atan2(fx, fz);
    f.planted = true; f.lift = null; f.tgt = null; f.swingStart = null;
  }

  replant(inp) {
    this.idleStep = null;
    this.lopeSettle = null;
    const fx = Math.sin(inp.heading), fz = Math.cos(inp.heading);
    const rx = fz, rz = -fx;
    for (const f of this.feet) {
      // square stance: boots straight under the hips, no fore-aft stagger
      this.plantFoot(f, inp.x, inp.z, rx, rz, fx, fz, 0, inp.groundAt);
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
      f.py = lerp(st.from.y, groundAt(f.px, f.pz), s) + Math.sin(Math.PI * st.u) ** 2 * 0.05;
      if (st.u >= 1) {
        f.py = groundAt(f.px, f.pz); f.planted = true;
        f.yaw = inp.heading;
        f.lift = null; f.swingStart = null; this.idleStep = null;
      }
      return;
    }
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const hx = x + rx * f.side * BONES.FOOT_LAT;
      const hz = z + rz * f.side * BONES.FOOT_LAT;
      if (!f.planted || Math.hypot(f.px - hx, f.pz - hz) > 0.035) {
        // bring a stray boot back directly under the hip — on a stop, this
        // squares the stance so he settles with feet beneath him
        f.planted = false;
        this.idleStep = { i, u: 0, from: { x: f.px, z: f.pz, y: f.py },
          to: { x: hx, z: hz } };
        break;
      }
    }
  }

}
