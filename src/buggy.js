// The buggy — pure vehicle dynamics, no THREE, no DOM. verify-buggy.mjs
// guards it. Tier-1 traversal (DESIGN.md): fast, open to the cold, and a
// proper skill to learn, because the physics is REAL and Mars is the
// teacher: grip is mu * m * g and Mars keeps only 38% of the g — so the
// buggy carries Earth inertia on a third of Earth's traction. Everything
// that follows (long braking, wide lines, throttle oversteer, crest hops)
// EMERGES from that one fact; nothing here is scripted.
//
// The model is the standard linear bicycle model with slip angles and
// per-axle cornering stiffness, saturated by a friction circle (combined
// longitudinal + lateral demand cannot exceed mu*N per axle — exceed it
// and that axle SKIDS). Drive is AWD, rear-biased (every real Mars rover
// drives all wheels): pull-away is brisk, the rear still breaks loose
// first, so power-on oversteer is physics, not flag. The handbrake
// cuts rear grip for deliberate drifts. Off a crest the ground falls away
// and the buggy flies ballistic under G_MARS — no control in the air,
// exactly as honest as the colonist's jump.
//
// stepBuggy takes the terrain as data ({ h, gx, gz } at the buggy's
// position) so this module stays world-free and the verify can drive it
// over analytic ramps and crests.

import { G_MARS } from './physics.js';

// ---- the vehicle (exported so the verify holds the same numbers) ----------
export const MASS = 620;          // kg, buggy + suited settler
export const WHEELBASE_F = 1.05;  // m, CoM to front axle
export const WHEELBASE_R = 1.15;  // m, CoM to rear axle
export const YAW_INERTIA = 850;   // kg m^2
export const MU = 0.65;           // regolith on wire wheels
export const C_ALPHA = 5200;      // N/rad cornering stiffness per axle
export const F_DRIVE = 1900;      // N peak drive (rear axle)
export const F_BRAKE = 2600;      // N peak braking (both axles)
export const DRAG = 0.9;          // N/(m/s)^2 — thin air: nearly nothing
export const ROLL_DRAG = 210;     // N rolling resistance — loose regolith is soft
export const STEER_MAX = 0.55;    // rad at the road wheels
export const HANDBRAKE_MU = 0.32; // rear grip fraction under the handbrake
export const TOP_SPEED = 17;      // m/s-ish, where drive meets drag/rolling
export const TRACTION = 0.82;     // drive may spend this much of the rear circle
                                  // (the rest STAYS lateral: full throttle must
                                  // never zero the rear's cornering grip)
export const U_KIN = 3.5;         // below this, blend to kinematic steering
export const POWER = 9500;        // W — engines are power-limited at speed
export const FRONT_SPLIT = 0.25;  // AWD, rear-biased: the rally layout
export const PITCH_RATE = 2.6;    // rad/s of airborne pitch authority
export const ROLL_RATE = 3.2;     // rad/s of airborne roll authority
export const CLEAN_ATT = 0.5;     // rad from level that still lands clean
export const H_CG = 0.55;         // m, centre-of-mass height — the tipping lever
export const HALF_TRACK = 0.95;   // m to the outer wheels
export const TRIP_V = 4.5;        // m/s sideways: fast enough to trip a rollover

// per-axle vertical load (static split; g does the low-grip work)
export function axleLoad() { return (MASS * G_MARS) / 2; }

// the theory the game teaches, as numbers the HUD and verify can quote:
// max lateral acceleration and the braking distance from speed u.
export function maxLatAccel() { return MU * G_MARS; }                  // ~2.4 m/s^2
export function brakingDistance(u) { return (u * u) / (2 * MU * G_MARS); }

export function createBuggy(x = 0, z = 0, heading = 0) {
  return {
    x, z, y: 0, heading,
    u: 0, v: 0, r: 0,      // body frame: forward, lateral, yaw rate
    vy: 0, airborne: false,
    steer: 0,               // smoothed road-wheel angle
    drive: 0,               // smoothed throttle — keys step, engines ramp
    pitch: 0, roll: 0,      // body attitude — the flip axes
    rollKick: 0,            // rad/s imposed by a rollover launch
    airSpin: 0,             // |rotation| accumulated this flight (flips!)
    wheelSpin: 0,           // rolling phase for the visual layer
  };
}

// input: { throttle: -1..1, steer: -1..1, brake: 0..1, handbrake: bool }
// ground: { h, gx, gz } — height and gradient at (x, z)
// returns flags { skidF, skidR, airborne, landed, impact }
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
  // don't) — this is also what makes pulling away controllable
  const dThr = input.throttle - s.drive;
  s.drive += dThr * Math.min(1, (dThr > 0 ? 2.2 : 8) * dt);

  const sin = Math.sin(s.heading), cos = Math.cos(s.heading);

  // parked: static friction is real — no throttle, no way on, and a slope
  // shallower than the friction cone simply HOLDS the car
  const slopeMag = Math.hypot(ground.gx, ground.gz);
  const parked = !s.airborne && Math.abs(input.throttle) < 0.05
    && Math.abs(s.u) < 0.6 && slopeMag < MU * 0.9;

  if (!s.airborne) {
    const N = axleLoad();
    const muF = MU, muR = input.handbrake ? MU * HANDBRAKE_MU : MU;

    // slip angles (bicycle model; guarded at crawl speed)
    const uEff = Math.max(Math.abs(s.u), 0.6) * Math.sign(s.u || 1);
    const alphaF = s.steer - Math.atan2(s.v + WHEELBASE_F * s.r, Math.abs(uEff)) * Math.sign(uEff);
    const alphaR = -Math.atan2(s.v - WHEELBASE_R * s.r, Math.abs(uEff)) * Math.sign(uEff);

    // longitudinal demand: drive on the rear, brakes on both. TRACTION
    // caps the drive's share of the rear circle — full throttle may spin
    // the wheels but it can NEVER zero the rear's lateral grip (the bug
    // that made v1 unsteerable in a straight line)
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

    // resistance: thin-air drag (tiny) + rolling
    const fRes = -Math.sign(s.u) * (DRAG * s.u * s.u + (Math.abs(s.u) > 0.05 ? ROLL_DRAG : 0));

    // gravity along the slope, rotated into the body frame — unless the
    // car is parked, where static friction simply answers it
    const gxB = parked ? 0 : (ground.gx * cos - ground.gz * sin);
    const gzB = parked ? 0 : (ground.gx * sin + ground.gz * cos);
    // body accelerations (bicycle equations)
    const du = (fxR + fxF * Math.cos(s.steer) + fRes) / MASS + s.v * s.r - G_MARS * gzB;
    const dv = (fyF * Math.cos(s.steer) + fyR) / MASS - s.u * s.r - G_MARS * gxB;
    const dr = (WHEELBASE_F * fyF * Math.cos(s.steer) - WHEELBASE_R * fyR) / YAW_INERTIA;

    // ---- lateral stability: the tipping ledger. Load-transfer ratio =
    // (felt lateral accel x CG height) / (g x half-track); at 1.0 the
    // inner wheels unload. On FLAT ground friction caps aLat at mu*g, so
    // LTR tops out ~0.38 — the buggy slides before it tips, as the real
    // physics says. What DOES roll it: side-slopes stacking gravity on
    // the same side, and the trip rollover — sliding sideways fast into
    // rising ground. A rollover LAUNCHES the tumble; the judged landing
    // machinery already knows what to do with an upside-down arrival.
    const aLat = (fyF * Math.cos(s.steer) + fyR) / MASS + G_MARS * gxB;
    const ltr = Math.abs(aLat) * H_CG / (G_MARS * HALF_TRACK)
      + Math.abs(gxB) * 0.6; // side-slope adds its own lever
    const tripped = Math.abs(s.v) > TRIP_V && Math.sign(s.v) * gxB < -0.12;
    if ((ltr > 1 || tripped) && Math.abs(s.u) + Math.abs(s.v) > 3) {
      flags.rollover = true;
      s.airborne = true;
      s.vy = Math.max(s.vy, 1.6);
      s.rollKick = (Math.sign(aLat || s.v) || 1) * 4.5;
    }

    s.u += du * dt;
    s.v += dv * dt;
    s.r += dr * dt;

    // low-speed blend to KINEMATIC steering: the dynamic model is invalid
    // near standstill (a standing car cannot yaw) — below U_KIN the yaw
    // rate eases to the kinematic bicycle's u*tan(steer)/L and sideslip
    // dies. This is the fix for spinning on the spot.
    const kin = Math.max(0, 1 - Math.abs(s.u) / U_KIN);
    if (kin > 0 && !input.handbrake) {
      const rKin = (s.u * Math.tan(s.steer)) / (WHEELBASE_F + WHEELBASE_R);
      s.r += (rKin - s.r) * kin * Math.min(1, 12 * dt);
      s.v *= 1 - kin * Math.min(1, 6 * dt);
    }

    // the static hold itself: a parked car STOPS and stays stopped
    if (parked) {
      const settle = Math.min(1, 14 * dt);
      s.u *= 1 - settle; s.v *= 1 - settle; s.r *= 1 - settle;
      if (Math.abs(s.u) < 0.05) s.u = 0;
      if (Math.abs(s.v) < 0.05) s.v = 0;
      if (Math.abs(s.r) < 0.02) s.r = 0;
    }
  } else {
    // ballistic: no tyre forces, yaw settles — but the FLIP AXES are
    // yours: in the air, throttle/steer become pitch/roll authority
    // (reaction wheels in spirit; Dune Flip Arena in soul). Low gravity
    // means long hang time means flip time.
    s.r *= 1 - Math.min(1, 0.8 * dt);
    const dPitch = input.throttle * PITCH_RATE * dt;
    const dRoll = -input.steer * ROLL_RATE * dt + s.rollKick * dt;
    s.pitch += dPitch;
    s.roll += dRoll;
    s.airSpin += Math.abs(dPitch) + Math.abs(dRoll);
    flags.airborne = true;
  }

  // heading + world position from body-frame velocity
  s.heading += s.r * dt;
  const sin2 = Math.sin(s.heading), cos2 = Math.cos(s.heading);
  const wx = s.u * sin2 + s.v * cos2;
  const wz = s.u * cos2 - s.v * sin2;
  s.x += wx * dt;
  s.z += wz * dt;

  // ---- vertical: follow the ground until it falls away, then fly
  if (!s.airborne) {
    // grounded vertical rate = dh/dt along the path (carried into a launch)
    s.vy = ground.gx * wx + ground.gz * wz;
    const newH = ground.h;
    if (newH < s.y - 0.12) {
      s.airborne = true;      // the crest dropped away — ballistic from here
    } else {
      s.y = newH;
    }
  }
  if (s.airborne) {
    s.vy -= G_MARS * dt;
    s.y += s.vy * dt;
    flags.airborne = true;
    if (s.y <= ground.h) {
      // touchdown: the LANDING is judged. Attitude near level -> the
      // ordinary vertical-hit scrub; crooked -> a hard scrub; upside
      // down-ish -> a crash-out (speed mostly gone, never death).
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
      s.y = ground.h; s.vy = 0;
      s.airborne = false;
      s.airSpin = 0;
      s.rollKick = 0;
      flags.landed = true; flags.impact = att > 2.0 ? Math.max(hit, 6) : hit;
    }
  }

  // grounded: attitude settles back to the ground plane fast
  if (!s.airborne) {
    const settle = Math.min(1, 8 * dt);
    s.pitch *= 1 - settle;
    s.roll *= 1 - settle;
  }

  // wheel roll phase for the visual layer (radius ~0.42 m)
  s.wheelSpin += (s.u / 0.42) * dt;
  return flags;
}
