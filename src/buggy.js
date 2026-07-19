// The buggy — pure vehicle dynamics, no THREE, no DOM. verify-buggy.mjs
// guards it. Tier-1 traversal (DESIGN.md): fast, open to the cold, and a
// proper skill to learn.
//
// The dynamics follow the DFA-1 arcade-car model from Dan's Dune Flip
// Arena (github.com/golnuggit/dune-flip-arena — used with permission,
// credit: Dan), adapted to Mars: BALLISTICS ARE HONEST — airtime,
// suspension and slopes all integrate against the true G_MARS, so low
// gravity shows where low gravity actually shows (long floaty hops, a
// slow loping suspension) — while TYRE GRIP IS EXAGGERATED well past
// regolith-honest (DFA-1's core trick: arcade grip ~ several times
// game-g), so the buggy pulls away briskly and brakes convincingly
// instead of treacling. The fiction: grousered mesh wheels bite.
//
// What's new over v2 (and why it feels heavy AND low-g at once):
// per-wheel quarter-car suspension (DFA-1 §2). Each wheel samples the
// ground under itself; springs (critically-ish damped, per-wheel force
// capped at a few times static load so a compressed corner can never
// launch the car) carry a sprung chassis whose heave, pitch and roll are
// real second-order states. Brake dive, throttle squat and cornering
// lean EMERGE from load-transfer torques; rocks under one wheel kick
// that wheel and the chassis answers with a bounce. Airborne is not a
// flag set by a height test any more — it's what happens when all four
// springs unload.
//
// The lateral model is unchanged: linear bicycle with slip angles and
// per-axle cornering stiffness, saturated by a friction circle. Drive is
// AWD, rear-biased; the handbrake cuts rear grip for deliberate drifts;
// in the air throttle/steer become pitch/roll authority (reaction wheels
// in spirit; Dune Flip Arena in soul).
//
// stepBuggy takes the terrain as data — ground { h, gx, gz, wh? } where
// wh = [hFL, hFR, hRL, hRR] are per-wheel surface heights (terrain plus
// drive-over rocks). Without wh the module synthesizes the four heights
// from the plane h + gradients, so the verify can drive analytic ramps.
//
// s.y stays what consumers always read it as: the ground-line datum the
// chassis rides ~RIDE above at rest — it bounces with the suspension but
// settles back onto the mean wheel-contact line.

import { G_MARS } from './physics.js';

// ---- the vehicle (exported so the verify holds the same numbers) ----------
export const MASS = 780;          // kg — bigger tyres, sturdier frame, planted
export const WHEELBASE_F = 1.05;  // m, CoM to front axle
export const WHEELBASE_R = 1.15;  // m, CoM to rear axle
export const HALF_TRACK = 0.95;   // m to the wheel centres
export const WHEEL_R = 0.62;      // m — LARGE mesh drums; rocks are speed bumps
export const YAW_INERTIA = 1050;  // kg m^2
export const PITCH_INERTIA = 950; // kg m^2 — the dive/squat axis
export const ROLL_INERTIA = 430;  // kg m^2 — the lean axis
export const H_CG = 0.55;         // m, centre-of-mass height — the tipping lever

export const MU = 1.25;           // grousered wheels, DFA-1 arcade grip —
                                  // NOT regolith-honest, deliberately (see header)
export const C_ALPHA = 9800;      // N/rad cornering stiffness per axle
export const F_DRIVE = 3400;      // N peak drive, both axles together
export const F_BRAKE = 5200;      // N peak braking demand (circle clamps it)
export const F_ENGINE_BRAKE = 620;// N regen drag when the throttle lifts —
                                  // an electric rover slows when you stop asking
export const DRAG = 3.0;          // N/(m/s)^2 — mostly wheel churn, not air
export const ROLL_DRAG = 380;     // N rolling resistance — loose regolith is soft
export const STEER_MAX = 0.55;    // rad at the road wheels
export const HANDBRAKE_MU = 0.32; // rear grip fraction under the handbrake
export const TOP_SPEED = 17;      // m/s-ish, where power meets drag/rolling
export const TRACTION = 0.82;     // drive may spend this much of the rear circle
export const U_KIN = 3.5;         // below this, blend to kinematic steering
export const POWER = 24000;       // W — engines are power-limited at speed
export const FRONT_SPLIT = 0.35;  // AWD, rear-biased: the rally layout
export const PITCH_RATE = 2.6;    // rad/s of airborne pitch authority
export const ROLL_RATE = 3.2;     // rad/s of airborne roll authority
export const CLEAN_ATT = 0.5;     // rad from level that still lands clean
export const TRIP_V = 4.5;        // m/s sideways: fast enough to trip a rollover
export const BODY_R = 1.15;       // m — the chassis disc boulders push against

// ---- suspension (DFA-1 §2: quarter-car, critically-ish damped) ------------
export const SUSP_F_N = 1.1;      // Hz ride frequency — the low-g lope
export const SUSP_ZETA = 0.62;    // damping ratio — bouncy, never wobbly
export const SUSP_TRAVEL = 0.45;  // m usable travel
const M_Q = MASS / 4;
export const SUSP_K = M_Q * Math.pow(2 * Math.PI * SUSP_F_N, 2); // N/m
export const SUSP_C = 2 * SUSP_ZETA * Math.sqrt(SUSP_K * M_Q);   // N s/m
export const SUSP_STATIC = (M_Q * G_MARS) / SUSP_K;              // m at rest
const SUSP_F_CAP = 5 * M_Q * G_MARS; // per-wheel: a corner never launches the car
export const RIDE = WHEEL_R + SUSP_TRAVEL - SUSP_STATIC; // chassis datum offset

// wheel order FL, FR, RL, RR — local (lx lateral +right, lz forward)
const WHEELS = [
  { lx: -HALF_TRACK, lz: WHEELBASE_F },
  { lx: HALF_TRACK, lz: WHEELBASE_F },
  { lx: -HALF_TRACK, lz: -WHEELBASE_R },
  { lx: HALF_TRACK, lz: -WHEELBASE_R },
];

// per-axle vertical load (static split; the friction circle spends it)
export function axleLoad() { return (MASS * G_MARS) / 2; }

// the headline numbers the HUD and verify can quote: max lateral
// acceleration and braking distance from speed u — arcade-brisk now
export function maxLatAccel() { return MU * G_MARS; }                  // ~4.7 m/s^2
export function brakingDistance(u) { return (u * u) / (2 * MU * G_MARS); }

export function createBuggy(x = 0, z = 0, heading = 0) {
  return {
    x, z, y: 0, heading,
    u: 0, v: 0, r: 0,       // body frame: forward, lateral, yaw rate
    vy: 0, airborne: false,
    airT: 0, prevAirT: 0,   // seconds since the last wheel touched down
    steer: 0,               // smoothed road-wheel angle
    drive: 0,               // smoothed throttle — keys step, engines ramp
    pitch: 0, roll: 0,      // sprung body attitude (nose-down +, right-up +)
    pitchV: 0, rollV: 0,    // ...and its rates
    susp: [SUSP_STATIC, SUSP_STATIC, SUSP_STATIC, SUSP_STATIC], // per-wheel
    rollKick: 0,            // rad/s imposed by a rollover launch
    airSpin: 0,             // |rotation| accumulated this flight (flips!)
    wheelSpin: 0,           // rolling phase for the visual layer
  };
}

// deflect the buggy off a boulder disc at (cx, cz, r): positional push to
// the surface, and the INWARD velocity component dies (small restitution) —
// the tangential component survives, so you glance off and, crucially, can
// always reverse straight back out. Returns the inward speed killed (m/s),
// 0 when there was no contact — main.js turns a big number into a thump.
export function deflectBuggy(s, cx, cz, r) {
  const dx = s.x - cx, dz = s.z - cz;
  const d = Math.hypot(dx, dz);
  const ring = r + BODY_R;
  if (d >= ring || d < 1e-6) return 0;
  const nx = dx / d, nz = dz / d;
  s.x = cx + nx * ring;
  s.z = cz + nz * ring;
  const sin = Math.sin(s.heading), cos = Math.cos(s.heading);
  let wx = s.u * sin + s.v * cos;
  let wz = s.u * cos - s.v * sin;
  const vr = wx * nx + wz * nz;
  if (vr >= 0) return 0; // already leaving — never steal outbound speed
  const e = 0.25;
  wx -= (1 + e) * vr * nx;
  wz -= (1 + e) * vr * nz;
  s.u = wx * sin + wz * cos;
  s.v = wx * cos - wz * sin;
  return -vr;
}

// input: { throttle: -1..1, steer: -1..1, brake: 0..1, handbrake: bool }
// ground: { h, gx, gz, wh?: [hFL, hFR, hRL, hRR] }
// returns flags { skidF, skidR, airborne, landed, impact, flip, cleanFlip, rollover }
export function stepBuggy(s, input, ground, dt) {
  const flags = {
    skidF: false, skidR: false, airborne: false, landed: false, impact: 0,
    flip: false, cleanFlip: false, rollover: false,
  };

  // steering eases to command — a wheel, not a switch (speed-sensitive:
  // full lock crawling, gentler at speed, like real steering feel)
  const speedFactor = 1 / (1 + Math.abs(s.u) * 0.09);
  const steerTarget = input.steer * STEER_MAX * speedFactor;
  s.steer += (steerTarget - s.steer) * Math.min(1, 8 * dt);

  // throttle ramps (a keyboard steps; an engine and a wheel on regolith
  // don't) — brisker than v2: the pull-away lag was tuning, not physics
  const dThr = input.throttle - s.drive;
  s.drive += dThr * Math.min(1, (dThr > 0 ? 4.5 : 10) * dt);

  const sin = Math.sin(s.heading), cos = Math.cos(s.heading);

  // ---- suspension first: sample the four springs, learn who's grounded.
  // Per-wheel ground heights: supplied (terrain + drive-over rocks), or
  // synthesized from the plane so analytic verifies work unchanged.
  const wh = ground.wh || WHEELS.map(({ lx, lz }) => {
    // body-local -> world offset (heading only), then the plane h + g.(dx,dz)
    const wx = lx * cos + lz * sin, wz = -lx * sin + lz * cos;
    return ground.h + ground.gx * wx + ground.gz * wz;
  });
  let fSum = 0, tPitch = 0, tRoll = 0, contacts = 0;
  // the springs speak small angles: clamp the attitude's reach into the
  // corner heights so a mid-flip attitude can't fake a ground contact
  const pitchEff = Math.max(-0.35, Math.min(0.35, s.pitch));
  const rollEff = Math.max(-0.35, Math.min(0.35, s.roll));
  for (let i = 0; i < 4; i++) {
    const { lx, lz } = WHEELS[i];
    const yCorner = s.y - lz * pitchEff + lx * rollEff; // ground-line at the corner
    const defl = SUSP_STATIC + (wh[i] - yCorner);     // spring compression
    s.susp[i] = Math.max(0, Math.min(SUSP_TRAVEL, defl));
    if (defl <= 0) continue;
    contacts++;
    const rate = -(s.vy - lz * s.pitchV + lx * s.rollV); // compression rate
    let f = SUSP_K * defl + SUSP_C * rate;
    f = Math.max(0, Math.min(SUSP_F_CAP, f)); // springs push, never pull
    fSum += f;
    tPitch -= f * lz; // a loaded front corner drives the nose UP (pitch -)
    tRoll += f * lx;  // a loaded right corner drives the right side UP
  }
  const grounded = contacts > 0;

  if (grounded) {
    s.airT = 0;
    const N = axleLoad();
    const muF = MU, muR = input.handbrake ? MU * HANDBRAKE_MU : MU;

    // parked: static friction is real — no throttle, no way on, and a slope
    // shallower than the friction cone simply HOLDS the car
    const slopeMag = Math.hypot(ground.gx, ground.gz);
    const parked = Math.abs(input.throttle) < 0.05
      && Math.abs(s.u) < 0.6 && slopeMag < MU * 0.9;

    // slip angles (bicycle model; guarded at crawl speed)
    const uEff = Math.max(Math.abs(s.u), 0.6) * Math.sign(s.u || 1);
    const alphaF = s.steer - Math.atan2(s.v + WHEELBASE_F * s.r, Math.abs(uEff)) * Math.sign(uEff);
    const alphaR = -Math.atan2(s.v - WHEELBASE_R * s.r, Math.abs(uEff)) * Math.sign(uEff);

    // longitudinal demand: AWD rear-biased, brakes on both. TRACTION caps
    // the drive's share of the rear circle — full throttle may spin the
    // wheels but it can NEVER zero the rear's lateral grip
    const driveCap = Math.min(F_DRIVE, POWER / Math.max(Math.abs(s.u), 1.5));
    const driving = s.drive * driveCap;
    const braking = -Math.sign(s.u) * input.brake * F_BRAKE;
    const tCapR = TRACTION * muR * N, tCapF = TRACTION * muF * N;
    let fxR = Math.max(-tCapR, Math.min(tCapR, driving * (1 - FRONT_SPLIT))) + braking * 0.55;
    let fxF = Math.max(-tCapF, Math.min(tCapF, driving * FRONT_SPLIT)) + braking * 0.45;

    // the friction circle, per axle: longitudinal spends first, lateral
    // gets what remains — saturate either and that axle skids
    const capF = muF * N, capR = muR * N;
    fxF = Math.max(-capF, Math.min(capF, fxF));
    fxR = Math.max(-capR, Math.min(capR, fxR));
    const lyF = Math.sqrt(Math.max(0.01, capF * capF - fxF * fxF));
    const lyR = Math.sqrt(Math.max(0.01, capR * capR - fxR * fxR));
    let fyF = C_ALPHA * alphaF;
    let fyR = C_ALPHA * alphaR;
    if (Math.abs(fyF) > lyF) { fyF = Math.sign(fyF) * lyF; flags.skidF = true; }
    if (Math.abs(fyR) > lyR) { fyR = Math.sign(fyR) * lyR; flags.skidR = true; }
    // wheelspin: power exceeding the traction share, at speeds where the
    // wheels can actually break loose
    if (Math.abs(driving * (1 - FRONT_SPLIT)) > TRACTION * capR && Math.abs(s.u) < 8) flags.skidR = true;

    // resistance: thin-air drag (tiny) + rolling + regen when the throttle
    // lifts — the fix for "rolls forever": lifting off actually slows you
    const coasting = Math.abs(input.throttle) < 0.05 ? F_ENGINE_BRAKE : 0;
    const fRes = -Math.sign(s.u) * (DRAG * s.u * s.u
      + (Math.abs(s.u) > 0.05 ? ROLL_DRAG + coasting : 0));

    // gravity along the slope, rotated into the body frame — unless the
    // car is parked, where static friction simply answers it
    const gxB = parked ? 0 : (ground.gx * cos - ground.gz * sin);
    const gzB = parked ? 0 : (ground.gx * sin + ground.gz * cos);
    // body accelerations (bicycle equations)
    const fxTotal = fxR + fxF * Math.cos(s.steer) + fRes;
    const fyTotal = fyF * Math.cos(s.steer) + fyR;
    const du = fxTotal / MASS + s.v * s.r - G_MARS * gzB;
    const dv = fyTotal / MASS - s.u * s.r - G_MARS * gxB;
    const dr = (WHEELBASE_F * fyF * Math.cos(s.steer) - WHEELBASE_R * fyR) / YAW_INERTIA;

    // load transfer onto the sprung chassis: braking dives the nose,
    // throttle squats the tail, cornering leans the body out of the turn —
    // ground-level tyre forces torquing a CoM at H_CG. The springs answer,
    // so these settle into honest steady-state attitudes.
    tPitch -= fxTotal * H_CG;
    tRoll -= fyTotal * H_CG;

    // ---- lateral stability: the tipping ledger (LTR + trip rollover).
    // Slides before it tips on the flat; side-slopes and trips roll it.
    const aLat = fyTotal / MASS + G_MARS * gxB;
    const ltr = Math.abs(aLat) * H_CG / (G_MARS * HALF_TRACK)
      + Math.abs(gxB) * 0.6; // side-slope adds its own lever
    const tripped = Math.abs(s.v) > TRIP_V && Math.sign(s.v) * gxB < -0.12;
    if ((ltr > 1 || tripped) && Math.abs(s.u) + Math.abs(s.v) > 3) {
      flags.rollover = true;
      s.vy = Math.max(s.vy, 1.6);
      s.rollKick = (Math.sign(aLat || s.v) || 1) * 4.5;
    }

    s.u += du * dt;
    s.v += dv * dt;
    s.r += dr * dt;

    // low-speed blend to KINEMATIC steering: the dynamic model is invalid
    // near standstill (a standing car cannot yaw) — below U_KIN the yaw
    // rate eases to the kinematic bicycle's and sideslip dies
    const kin = Math.max(0, 1 - Math.abs(s.u) / U_KIN);
    if (kin > 0 && !input.handbrake) {
      const rKin = (s.u * Math.tan(s.steer)) / (WHEELBASE_F + WHEELBASE_R);
      s.r += (rKin - s.r) * kin * Math.min(1, 12 * dt);
      s.v *= 1 - kin * Math.min(1, 6 * dt);
    }

    // the static hold itself: a parked car STOPS and stays stopped (the
    // springs stay live — a parked buggy still settles on its wheels)
    if (parked) {
      const settle = Math.min(1, 14 * dt);
      s.u *= 1 - settle; s.v *= 1 - settle; s.r *= 1 - settle;
      if (Math.abs(s.u) < 0.05) s.u = 0;
      if (Math.abs(s.v) < 0.05) s.v = 0;
      if (Math.abs(s.r) < 0.02) s.r = 0;
    }

    // recovery from a crashed attitude: springs speak small angles only —
    // beyond them (upside-down-ish arrivals) the buggy rights itself over
    // a second or so (arcade mercy: stuck-on-the-roof is not fun)
    if (Math.abs(s.pitch) > 0.6 || Math.abs(s.roll) > 0.6) {
      const right = Math.min(1, 3 * dt);
      s.pitch *= 1 - right; s.roll *= 1 - right;
      s.pitchV *= 1 - right; s.rollV *= 1 - right;
    }
  } else {
    // ballistic: no tyre forces, yaw settles — but the FLIP AXES are
    // yours: throttle/steer become pitch/roll authority (reaction wheels
    // in spirit; Dune Flip Arena in soul). Low gravity means long hang
    // time means flip time.
    s.airT += dt;
    s.r *= 1 - Math.min(1, 0.8 * dt);
    const dPitch = input.throttle * PITCH_RATE * dt;
    const dRoll = -input.steer * ROLL_RATE * dt + s.rollKick * dt;
    s.pitch += dPitch;
    s.roll += dRoll;
    s.pitchV = 0; s.rollV = 0; // the flip axes own attitude in the air
    s.airSpin += Math.abs(dPitch) + Math.abs(dRoll);
    flags.airborne = true;
  }
  s.airborne = !grounded;

  // ---- the sprung chassis: heave from the spring sum, attitude from the
  // spring torques (grounded only — in the air the flip axes rule above)
  s.vy += (fSum / MASS - G_MARS) * dt;
  s.y += s.vy * dt;
  if (grounded) {
    s.pitchV += (tPitch / PITCH_INERTIA) * dt;
    s.rollV += (tRoll / ROLL_INERTIA) * dt;
    s.pitch += s.pitchV * dt;
    s.roll += s.rollV * dt;
    // rest snap: kill the last micro-motion so a settled buggy is STILL
    if (Math.abs(s.vy) < 0.01 && Math.abs(s.pitchV) < 0.01 && Math.abs(s.rollV) < 0.01) {
      s.vy *= 0.8; s.pitchV *= 0.8; s.rollV *= 0.8;
    }
  }

  // heading + world position from body-frame velocity
  s.heading += s.r * dt;
  const sin2 = Math.sin(s.heading), cos2 = Math.cos(s.heading);
  const wx = s.u * sin2 + s.v * cos2;
  const wz = s.u * cos2 - s.v * sin2;
  s.x += wx * dt;
  s.z += wz * dt;

  // ---- touchdown after a real flight: the LANDING is judged. Attitude
  // near level -> an ordinary scrub; crooked -> a hard scrub; upside
  // down-ish -> a crash-out (speed mostly gone, never death). Brief
  // one-wheel skips over rocks (airT < 0.2 s) are just driving.
  if (grounded && s.airT === 0 && s.prevAirT > 0.2) {
    const hit = Math.abs(s.vy);
    const att = Math.max(
      Math.abs(((s.pitch + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI),
      Math.abs(((s.roll + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI),
    );
    let scrub = 1 - Math.min(0.45, hit * 0.045);
    if (att > CLEAN_ATT) scrub *= att > 2.0 ? 0.25 : 0.6;
    if (s.airSpin > Math.PI * 1.8) {
      flags.flip = true;
      if (att <= CLEAN_ATT) flags.cleanFlip = true; // stuck the landing
    }
    s.u *= scrub; s.v *= scrub * 0.8;
    s.airSpin = 0;
    s.rollKick = 0;
    flags.landed = true; flags.impact = att > 2.0 ? Math.max(hit, 6) : hit;
  }
  s.prevAirT = s.airT;

  // wheel roll phase for the visual layer
  s.wheelSpin += (s.u / WHEEL_R) * dt;
  return flags;
}
