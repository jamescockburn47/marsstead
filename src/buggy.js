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
// and that axle SKIDS). Rear-wheel drive, so throttle spends the rear
// circle first: power-on oversteer is physics, not flag. The handbrake
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
export const ROLL_DRAG = 95;      // N rolling resistance
export const STEER_MAX = 0.55;    // rad at the road wheels
export const HANDBRAKE_MU = 0.32; // rear grip fraction under the handbrake
export const TOP_SPEED = 17;      // m/s-ish, where drive meets drag/rolling

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
    wheelSpin: 0,           // rolling phase for the visual layer
  };
}

// input: { throttle: -1..1, steer: -1..1, brake: 0..1, handbrake: bool }
// ground: { h, gx, gz } — height and gradient at (x, z)
// returns flags { skidF, skidR, airborne, landed, impact }
export function stepBuggy(s, input, ground, dt) {
  const flags = { skidF: false, skidR: false, airborne: false, landed: false, impact: 0 };

  // steering eases to command — a wheel, not a switch (speed-sensitive:
  // full lock crawling, gentler at speed, like real steering feel)
  const speedFactor = 1 / (1 + Math.abs(s.u) * 0.09);
  const steerTarget = input.steer * STEER_MAX * speedFactor;
  s.steer += (steerTarget - s.steer) * Math.min(1, 8 * dt);

  const sin = Math.sin(s.heading), cos = Math.cos(s.heading);

  if (!s.airborne) {
    const N = axleLoad();
    const muF = MU, muR = input.handbrake ? MU * HANDBRAKE_MU : MU;

    // slip angles (bicycle model; guarded at crawl speed)
    const uEff = Math.max(Math.abs(s.u), 0.6) * Math.sign(s.u || 1);
    const alphaF = s.steer - Math.atan2(s.v + WHEELBASE_F * s.r, Math.abs(uEff)) * Math.sign(uEff);
    const alphaR = -Math.atan2(s.v - WHEELBASE_R * s.r, Math.abs(uEff)) * Math.sign(uEff);

    // longitudinal demand: drive on the rear, brakes on both
    const driving = input.throttle * F_DRIVE;
    const braking = -Math.sign(s.u) * input.brake * F_BRAKE;
    let fxR = driving + braking * 0.55;
    let fxF = braking * 0.45;

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
    if (Math.abs(fxR) >= capR * 0.98 && Math.abs(driving) > 0) flags.skidR = true;

    // resistance: thin-air drag (tiny) + rolling
    const fRes = -Math.sign(s.u) * (DRAG * s.u * s.u + (Math.abs(s.u) > 0.05 ? ROLL_DRAG : 0));

    // gravity along the slope, rotated into the body frame
    const gxB = (ground.gx * cos - ground.gz * sin);
    const gzB = (ground.gx * sin + ground.gz * cos);
    // body accelerations (bicycle equations)
    const du = (fxR + fxF * Math.cos(s.steer) + fRes) / MASS + s.v * s.r - G_MARS * gzB;
    const dv = (fyF * Math.cos(s.steer) + fyR) / MASS - s.u * s.r - G_MARS * gxB;
    const dr = (WHEELBASE_F * fyF * Math.cos(s.steer) - WHEELBASE_R * fyR) / YAW_INERTIA;

    s.u += du * dt;
    s.v += dv * dt;
    s.r += dr * dt;
    // low-speed cleanup: no phantom creep
    if (Math.abs(s.u) < 0.08 && input.throttle === 0 && input.brake > 0) s.u = 0;
    s.v *= 1 - Math.min(1, 2.5 * dt) * (Math.abs(s.u) < 1 ? 1 : 0); // parked cars don't slide sideways
  } else {
    // ballistic: no tyre forces, yaw settles, the world holds its breath
    s.r *= 1 - Math.min(1, 0.8 * dt);
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
      // touchdown: scrub speed with the vertical hit, report the impact
      const hit = Math.abs(s.vy);
      const scrub = 1 - Math.min(0.45, hit * 0.045);
      s.u *= scrub; s.v *= scrub * 0.8;
      s.y = ground.h; s.vy = 0;
      s.airborne = false;
      flags.landed = true; flags.impact = hit;
    }
  }

  // wheel roll phase for the visual layer (radius ~0.42 m)
  s.wheelSpin += (s.u / 0.42) * dt;
  return flags;
}
