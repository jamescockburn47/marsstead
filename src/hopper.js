// The hopper — Stage 3's flight core, pure, no THREE, no DOM.
// verify-hopper.mjs guards it. STRUCTURE.md's doctrine, held in code:
// SEMI-CINEMATIC, NEVER FREE FLIGHT — a hop is plotted on the console
// inside the fuel circle (payload mass matters: the buggy rides a
// cradle), then plays as a staged sequence: ignition → ascent up the sky
// ladder → the arc over the baked MOLA vista → the descent onto the
// chosen ellipse while the destination streams in. This module owns the
// honest arithmetic (0.38 g ballistics + the rocket equation) and the
// deterministic phase machine; the layer only reads it.
//
// The physics is legible-honest, the family way: a ballistic hop's range
// under Mars gravity really is v²/g at 45°, and thin air + low g really
// are why a cupful of methane crosses a horizon (DESIGN.md's pillar).
// Numbers are tuned for FUN inside that shape, not for Aerospace.

import { G_MARS } from './physics.js';

// ---- the craft ------------------------------------------------------------
export const HOPPER_DRY_KG = 380;    // a skeletal frame: engine, cradle, avionics
export const TANK_FUEL_KG = 110;     // one methane-tank item, burned whole-ish
export const MAX_TANKS = 6;          // the manifold's rack
export const CRADLE_BUGGY_KG = 260;  // the buggy, slung beneath
export const PILOT_KG = 95;          // settler + suit

// ---- the honest range model ----------------------------------------------
// Δv from Tsiolkovsky (methalox vacuum Isp ≈ 355 s), split half for
// ascent burn and half for the landing burn, with a gravity-loss tax;
// range from the 45° ballistic: R = v² / g. Mars is small and g is low —
// this is why hops are enormous, and the numbers below keep the game's
// 50–300 km promise inside real physics' shape.
export const ISP_S = 355;
export const G0 = 9.80665;           // rocket-equation reference, Earth-fixed
export const LOSS_FACTOR = 0.78;     // gravity/steering losses eat the rest

export function wetMass(fuelKg, payloadKg) {
  return HOPPER_DRY_KG + PILOT_KG + Math.max(0, payloadKg) + Math.max(0, fuelKg);
}

// the whole load burned: the best range this fuel and payload can buy
export function hopRangeKm(fuelKg, payloadKg = 0) {
  if (fuelKg <= 0) return 0;
  const m0 = wetMass(fuelKg, payloadKg);
  const m1 = m0 - fuelKg;
  const dv = ISP_S * G0 * Math.log(m0 / m1) * LOSS_FACTOR;
  const v = dv / 2;                      // half up, half held for the landing
  return (v * v) / G_MARS / 1000;        // 45° ballistic, in kilometres
}

// fuel needed for a given distance at a given payload: invert by search
// (monotonic; 0.5 kg steps keep it deterministic and exact enough for a
// console that sells fuel by the tank)
export function fuelForKm(distKm, payloadKg = 0) {
  if (distKm <= 0) return 0;
  for (let f = 0.5; f <= MAX_TANKS * TANK_FUEL_KG; f += 0.5) {
    if (hopRangeKm(f, payloadKg) >= distKm) return f;
  }
  return Infinity;
}

// ---- the plot -------------------------------------------------------------
export const MIN_HOP_KM = 4;         // under this the buggy is the answer
export const APEX_FRACTION = 0.25;   // 45° ballistic: apex = range / 4

export function createHopper() {
  return {
    fuelKg: 0,
    state: 'parked',   // parked | ascent | arc | descent
    hop: null,         // { from:[x,z], to:[x,z], distKm, t, dur, apexM, payloadKg }
    x: 0, z: 0,        // world position while parked (pads move it)
  };
}

export function loadTank(h) {
  if (h.state !== 'parked') return false;
  if (h.fuelKg + TANK_FUEL_KG > MAX_TANKS * TANK_FUEL_KG + 1e-9) return false;
  h.fuelKg += TANK_FUEL_KG;
  return true;
}

// the console's truth for a candidate target: inside the fuel circle?
export function planHop(h, from, to, payloadKg = 0) {
  const distKm = Math.hypot(to[0] - from[0], to[1] - from[1]) / 1000;
  const rangeKm = hopRangeKm(h.fuelKg, payloadKg);
  const fuelNeed = fuelForKm(distKm, payloadKg);
  return {
    distKm: +distKm.toFixed(1),
    rangeKm: +rangeKm.toFixed(1),
    fuelNeed: Number.isFinite(fuelNeed) ? +fuelNeed.toFixed(1) : Infinity,
    ok: h.state === 'parked' && distKm >= MIN_HOP_KM && fuelNeed <= h.fuelKg,
  };
}

// phase durations: staged and cinematic, not simulated — scaled gently
// with distance so a long hop feels long without outstaying the shot
export function hopDurations(distKm) {
  const arc = Math.min(46, 14 + distKm * 0.11);
  return { ascent: 8, arc, descent: 9, total: 8 + arc + 9 };
}

export function beginHop(h, from, to, payloadKg = 0) {
  const plan = planHop(h, from, to, payloadKg);
  if (!plan.ok) return false;
  h.fuelKg = Math.max(0, h.fuelKg - plan.fuelNeed); // spent at ignition, all of it
  const dur = hopDurations(plan.distKm);
  h.state = 'ascent';
  h.hop = {
    from: [...from], to: [...to],
    distKm: plan.distKm, payloadKg,
    t: 0, dur,
    apexM: plan.distKm * 1000 * APEX_FRACTION,
  };
  return true;
}

// one tick: advances the staged clock, returns the phase snapshot the
// layer renders — position along the ground track, altitude up the sky
// ladder, and the phase name. Deterministic in (hop, t).
export function tickHop(h, dt) {
  if (!h.hop) return null;
  const H = h.hop;
  H.t += dt;
  const { ascent, arc, descent, total } = H.dur;
  let phase, prog, alt;
  if (H.t < ascent) {
    phase = 'ascent';
    const k = H.t / ascent;
    prog = 0.04 * k;
    alt = H.apexM * k * k;                    // the climb steepens away
  } else if (H.t < ascent + arc) {
    phase = 'arc';
    const k = (H.t - ascent) / arc;
    prog = 0.04 + 0.92 * k;
    alt = H.apexM * (1 - (2 * k - 1) * (2 * k - 1) * 0.18); // a high, flat crest
  } else if (H.t < total) {
    phase = 'descent';
    const k = (H.t - ascent - arc) / descent;
    prog = 0.96 + 0.04 * k;
    alt = H.apexM * 0.82 * (1 - k) * (1 - k); // the fall home
  } else {
    // touchdown: the hopper stands at the target, tanks lighter, parked
    h.state = 'parked';
    h.x = H.to[0]; h.z = H.to[1];
    h.hop = null;
    return { phase: 'landed', prog: 1, alt: 0, x: h.x, z: h.z };
  }
  h.state = phase;
  const x = H.from[0] + (H.to[0] - H.from[0]) * prog;
  const z = H.from[1] + (H.to[1] - H.from[1]) * prog;
  return { phase, prog, alt, x, z };
}

// ---- save -----------------------------------------------------------------
// a hop in progress never rides the save (refresh = the flight lands):
// serialize collapses to the destination — no rescue, no repeat either
export function serializeHopper(h) {
  const done = h.hop ? { x: h.hop.to[0], z: h.hop.to[1] } : { x: h.x, z: h.z };
  return { fuelKg: +h.fuelKg.toFixed(1), x: done.x, z: done.z };
}
export function deserializeHopper(raw) {
  const h = createHopper();
  if (raw && typeof raw === 'object') {
    if (Number.isFinite(raw.fuelKg)) {
      h.fuelKg = Math.max(0, Math.min(MAX_TANKS * TANK_FUEL_KG, raw.fuelKg));
    }
    if (Number.isFinite(raw.x)) h.x = raw.x;
    if (Number.isFinite(raw.z)) h.z = raw.z;
  }
  return h;
}
