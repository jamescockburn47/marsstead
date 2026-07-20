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

// ---- the range model -------------------------------------------------------
// Δv from Tsiolkovsky (methalox vacuum Isp ≈ 355 s), split half for the
// ascent burn and half for the landing burn, with a gravity-loss tax;
// range from the 45° ballistic: R = v² / g. The mass RELATIONSHIPS are
// real — that's what makes fuel and payload honest decisions — but the
// absolute range is compressed by WORLD_RANGE: the playable planet is
// 1:200 (mars.js M_PER_DEG — the whole world is ~107 km around), so a
// truthful 300 km hop would lap it three times. The sanctioned
// fun-over-truth override (DESIGN.md), applied once, named, and visible.
export const ISP_S = 355;
export const G0 = 9.80665;           // rocket-equation reference, Earth-fixed
export const LOSS_FACTOR = 0.78;     // gravity/steering losses eat the rest
export const WORLD_RANGE = 1 / 14;   // the 1:200 world's compression of reach

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
  return (v * v) / G_MARS / 1000 * WORLD_RANGE; // 45° ballistic, world-scaled
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
export const MIN_HOP_KM = 1.2;       // under this the buggy is the answer
export const APEX_FRACTION = 0.25;   // 45° ballistic: apex = range / 4
// the second sanctioned fun-over-truth override (WORLD_RANGE's sibling,
// James's eye 2026-07-20: "we go too high"): the DRAWN apex is compressed
// so the arc reads majestic instead of leaving the world a postage stamp.
// The ballistic truth (range/4) stays in APEX_FRACTION; the shot flies
// at just over half of it.
export const APEX_VIEW = 0.55;

// the landing (the pad system died 2026-07-20, James's call): every
// landing is EXACT where you aim — the fuel circle is the only
// constraint, and flying anywhere is the whole point. The avionics
// land the ship; the pilot picks the ground.
export function landingPoint(from, to) {
  return [to[0], to[1]];
}

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
// with distance so a long hop feels long without outstaying the shot.
// ignition is the hold-down (fire building under a still craft); settle
// is the last dozen metres, flown on a dying burn — the two bookends
// that make the middle believable.
export const SETTLE_ALT_M = 14;
export function hopDurations(distKm) {
  const arc = Math.min(40, 12 + distKm * 1.3);
  return {
    ignition: 3.5, ascent: 9, arc, descent: 10, settle: 2.8,
    total: 3.5 + 9 + arc + 10 + 2.8,
  };
}

// smooth 0..1 ramp with edges eased — the profile-shaper's workhorse
const smooth = (k) => k * k * (3 - 2 * k);

export function beginHop(h, from, to, payloadKg = 0) {
  const plan = planHop(h, from, to, payloadKg);
  if (!plan.ok) return false;
  h.fuelKg = Math.max(0, h.fuelKg - plan.fuelNeed); // spent at ignition, all of it
  const land = landingPoint(from, to);
  const dur = hopDurations(plan.distKm);
  h.state = 'ignition';
  h.hop = {
    from: [...from], to: land,       // the flight flies to the TRUE landing
    aim: [...to],                    // …the console's mark, kept for the map
    distKm: plan.distKm, payloadKg,
    t: 0, dur,
    apexM: plan.distKm * 1000 * APEX_FRACTION * APEX_VIEW,
  };
  return true;
}

// one tick: advances the staged clock, returns the phase snapshot the
// layer renders — position along the ground track, altitude up the sky
// ladder, the phase name, and the burn/shake/scour the drama reads.
// Deterministic in (hop, t).
//   burn  0..1  throttle: the flame, the light, the noise of the thing
//   shake 0..1  how hard the frame (and the camera) trembles
//   scour 0..1  ground-effect: burning close to the ground blasts dust
export function tickHop(h, dt) {
  if (!h.hop) return null;
  const H = h.hop;
  H.t += dt;
  const { ignition, ascent, arc, descent, settle, total } = H.dur;
  let phase, prog, alt, burn, shake;
  if (H.t < ignition) {
    // hold-down: the craft stands still while the fire builds to full
    phase = 'ignition';
    const k = H.t / ignition;
    prog = 0; alt = 0;
    burn = smooth(k) * smooth(k);            // slow catch, hard finish
    shake = 0.25 + 0.55 * burn;              // trembling against the clamps
  } else if (H.t < ignition + ascent) {
    // the slow terrible rise: near-hover off the pad, then away
    phase = 'ascent';
    const k = (H.t - ignition) / ascent;
    prog = 0.04 * k * k;                     // downrange comes late, with the tip-over
    alt = H.apexM * 0.82 * k * k * k;        // hangs on the fire, then steepens hard
    // (0.82: meets the arc's edge exactly — no seam-pop at the handover)
    burn = 1;
    shake = 0.55 * (1 - k) + 0.12;           // smooths out as the air thins
  } else if (H.t < ignition + ascent + arc) {
    phase = 'arc';
    const k = (H.t - ignition - ascent) / arc;
    prog = 0.04 + 0.92 * k;
    alt = H.apexM * (1 - (2 * k - 1) * (2 * k - 1) * 0.18); // a high, flat crest
    burn = 0; shake = 0;                     // dead ballistic: the silence is the point
  } else if (H.t < ignition + ascent + arc + descent) {
    phase = 'descent';
    const k = (H.t - ignition - ascent - arc) / descent;
    prog = 0.96 + 0.04 * k;
    alt = SETTLE_ALT_M + (H.apexM * 0.82 - SETTLE_ALT_M) * (1 - k) * (1 - k) * (1 - k);
    // the braking burn wakes late and spikes — a suicide burn, felt
    burn = k < 0.55 ? 0.04 : smooth((k - 0.55) / 0.45) * 0.95 + 0.05;
    shake = burn * 0.6;
  } else if (H.t < total) {
    // settle: the last dozen metres on a dying burn, flame to a puff
    phase = 'settle';
    const k = (H.t - ignition - ascent - arc - descent) / settle;
    prog = 1;
    alt = SETTLE_ALT_M * (1 - smooth(k));
    burn = 0.85 - 0.55 * k;
    shake = 0.3 - 0.15 * k;
  } else {
    // touchdown: the hopper stands at the target, tanks lighter, parked
    h.state = 'parked';
    h.x = H.to[0]; h.z = H.to[1];
    h.hop = null;
    return {
      phase: 'landed', prog: 1, alt: 0, x: h.x, z: h.z,
      burn: 0, shake: 0, scour: 0, touchdown: true,
    };
  }
  h.state = phase;
  const x = H.from[0] + (H.to[0] - H.from[0]) * prog;
  const z = H.from[1] + (H.to[1] - H.from[1]) * prog;
  // ground-effect: the burn scours dust only near the ground
  const scour = burn * Math.max(0, 1 - alt / 60);
  return { phase, prog, alt, x, z, burn, shake, scour, touchdown: false };
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
