// Sleep — the night skip, pure, no THREE, no DOM. verify-sleep.mjs guards
// it. This is an INDIVIDUAL world (DESIGN.md): with shelter, the player may
// hand the night to VESPER and wake into the morning light. The clock jump
// is computed here from the same Mars24 sun the light rig reads, so the
// wake moment is deterministic and always lands in a real dawn — never a
// guessed "8 hours later" that could strand you in polar night.
//
// Shelter itself is the CALLER's judgement (the lander's shadow now, a
// pressurised volume once the first hab seals); this module only answers
// "is it night?" and "when is dawn?".

import { sunElevation } from './marstime.js';

export const SOL_MS = 88775244;   // one sol in clock millis
export const WAKE_EL = 3;         // deg — wake into usable morning light

// The lander stays the bedroom until you build something that BEATS it
// (James's call): a pressurised volume must hold at least this many cells
// to sleep the night in — a size the finite salvage stock cannot seal
// (it caps out at a 2×2), so the first real bedroom costs mined steel.
// Smaller sealed volumes still shelter: air, warmth, a door against the
// dust — they just aren't anywhere to sleep through a −80° night.
export const HAB_MIN_CELLS = 6;

// night enough to sleep: the sun is properly down (not merely setting)
export function canSleep(sunEl) { return sunEl < -1; }

// is this pressurised volume a real bedroom, or a closet with gauges?
export function bedworthy(volume) {
  return !!volume && volume.cells.length >= HAB_MIN_CELLS;
}

// the next moment the RISING sun crosses WAKE_EL at (lat, lonE), or null
// if no dawn comes within a sol and a quarter (polar night — the caller
// should refuse the bed rather than jump a season)
export function wakeMillis(millis, lat, lonE) {
  const step = SOL_MS / 288; // 5 Mars-minutes
  let prev = sunElevation(millis, lat, lonE);
  for (let t = millis + step; t <= millis + SOL_MS * 1.25; t += step) {
    const el = sunElevation(t, lat, lonE);
    // a true crossing from below — a noon call still waits for NEXT dawn
    if (prev < WAKE_EL && el >= WAKE_EL) {
      // bisect the crossing down to the odd second
      let lo = t - step, hi = t;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (sunElevation(mid, lat, lonE) >= WAKE_EL) hi = mid; else lo = mid;
      }
      return Math.round(hi);
    }
    prev = el;
  }
  return null;
}
