// Dust — the pure drive, no THREE, no DOM. verify-dust.mjs guards it.
// One system, four registers (DESIGN.md): suspension (the tau haze),
// drift (wind made visible), swirl (dust answers to THINGS — the wake off
// a moving suit, the wandering devils), storm (Phase 3). This module owns
// the wind field, the vortex maths and the devil tracks; dustlayer.js just
// skins instanced points onto what these functions say.

import { fbm2, hash2 } from './noise.js';

// ---- the wind field --------------------------------------------------------
// A slowly-evolving planetary breeze: direction wanders over minutes,
// strength breathes. Deterministic in (x, z, t) — every client agrees.
export function windAt(x, z, t) {
  const a = fbm2(x * 0.004 + t * 0.008, z * 0.004) * Math.PI * 4;
  const s = 1.5 + 3.5 * fbm2(x * 0.002 + 31, z * 0.002 + t * 0.01);
  return { x: Math.cos(a) * s, z: Math.sin(a) * s, speed: s };
}

// ---- suspension ------------------------------------------------------------
// Ambient dust load tau: a clear-sol base with a gentle afternoon rise
// (convection lofts dust as the ground warms). Phase 1 replaces the base
// with the Montabone replay; the shape survives.
export function tauAt(mtcHours, base = 0.4) {
  const afternoon = Math.exp(-Math.pow((mtcHours - 15) / 4.5, 2)) * 0.25;
  return base + afternoon;
}

// ---- swirl: the vortex wake ------------------------------------------------
// The velocity a dust mote feels near a moving body: a trailing vortex
// pair — dust curls in behind you and rides your wake. Analytic, bounded,
// deterministic. (vx, vz) body velocity; (dx, dz) mote offset from body.
export function swirl(vx, vz, dx, dz) {
  const sp = Math.hypot(vx, vz);
  if (sp < 0.3) return { x: 0, z: 0 };
  const r2 = dx * dx + dz * dz + 0.35;         // softened core — never blows up
  const fall = Math.exp(-r2 / 6);              // reach ~2.5 m
  // rotational part (a vortex around the body)...
  const rot = (1.1 * sp * fall) / r2;
  // ...plus entrainment along the wake
  const drag = 0.55 * fall;
  return {
    x: -dz * rot + vx * drag,
    z: dx * rot + vz * drag,
  };
}

// ---- the devils ------------------------------------------------------------
// A dust devil is the swirl register at column scale: a wandering vortex
// with a lifetime, deterministic from its index + a day seed. Position in
// metres relative to the field's origin; devils live minutes, then die and
// are reborn elsewhere.
export const DEVIL_COUNT = 3;
export const DEVIL_LIFE = 210;     // seconds
export const DEVIL_RANGE = 900;    // how far afield they wander

export function devilState(i, t, seed = 0) {
  const cycle = Math.floor(t / DEVIL_LIFE);
  const phase = (t % DEVIL_LIFE) / DEVIL_LIFE;      // 0..1 through its life
  const h = (k) => hash2(i * 37 + k, cycle * 101 + seed);
  // birth and death points; the devil walks a wandering line between them
  const x0 = (h(1) - 0.5) * 2 * DEVIL_RANGE, z0 = (h(2) - 0.5) * 2 * DEVIL_RANGE;
  const x1 = (h(3) - 0.5) * 2 * DEVIL_RANGE, z1 = (h(4) - 0.5) * 2 * DEVIL_RANGE;
  const wob = 40;
  const x = x0 + (x1 - x0) * phase + (fbm2(phase * 6 + i * 9, cycle) - 0.5) * wob;
  const z = z0 + (z1 - z0) * phase + (fbm2(phase * 6 + 50, i * 7 + cycle) - 0.5) * wob;
  // intensity envelope: spin up, hold, die away
  const inten = Math.sin(Math.min(Math.PI, phase * Math.PI * 1.15));
  const height = 28 + h(5) * 40;                    // column height, m
  const radius = 1.6 + h(6) * 2.6;                  // core radius, m
  return { x, z, intensity: Math.max(0, inten), height, radius, phase };
}

// tangential wind speed a mote feels at distance r from a devil core —
// a Rankine-ish vortex: solid-body inside the core, 1/r outside, bounded.
export function devilSpin(r, radius, intensity) {
  const vmax = 9 * intensity;
  return r < radius ? vmax * (r / radius) : vmax * (radius / Math.max(radius, r));
}
