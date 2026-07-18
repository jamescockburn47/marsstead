// Everything above the dust — pure, no THREE, no DOM. verify-marsheavens.mjs
// guards it. The Saltstead celestial frame, stood on Mars:
//
//   * The star catalogue is real (J2000 RA/Dec — the same stars every
//     navigator learns), but the WHEEL is Mars's: the sky turns about
//     MARS'S celestial pole — which sits in Cygnus, near Deneb. Polaris
//     is nobody's pole star here. The star-chart rule: the sky teaches a
//     true thing by existing.
//   * Phobos and Deimos ride the same frame as near-equatorial circular
//     orbits with their REAL periods — and the frame itself makes Phobos
//     rise in the west (it orbits faster than the planet turns) and
//     Deimos crawl east-to-west over days. Nothing is scripted.
//   * Earth is an evening star: circular heliocentric orbits for both
//     planets give its elongation from the sun — never more than ~41°,
//     swapping morning/evening sky over the synodic cycle.
//
// v1 honesty note: the wheel's zero point is not yet calibrated against
// the Mars24 sun, so WHICH constellations own which season is approximate;
// geometry, pole, rates and periods are true. The star-chart instrument
// (Phase 3) brings the calibration.

// ---- constants (real values) ----------------------------------------------
export const SOLAR_SOL_MS = 88775244;          // mean solar sol (marstime's)
export const SIDEREAL_SOL_MS = 88642656;       // 24.62296 h — the star wheel
export const P_PHOBOS_MS = 27553844;           // 7.65384 h orbital period
export const P_DEIMOS_MS = 109074960;          // 30.2986 h
export const MARS_POLE_RA_H = 21.1787;         // Mars's north celestial pole
export const MARS_POLE_DEC = 52.887;           //   (Earth-equatorial coords; Cygnus)
const J2000_MS = 946727935816;                 // 2000-01-01 11:58:55.816 UTC
const EARTH_YEAR_D = 365.256;
const MARS_YEAR_D = 686.980;
const EARTH_L0 = 100.46435 * Math.PI / 180;    // mean longitudes at J2000
const MARS_L0 = 355.45332 * Math.PI / 180;
const EARTH_A = 1.0, MARS_A = 1.52371;         // AU
const OBLIQUITY = 23.4393 * Math.PI / 180;     // Earth's, for ecliptic -> RA/Dec

// ---- frames ----------------------------------------------------------------
// RA/Dec -> unit vector in the EARTH-equatorial frame (Saltstead's frame:
// pole = +Y, RA 0 meridian = +Z, east = +X)
export function raDecToEq(raH, decDeg) {
  const ra = (raH * Math.PI) / 12, dec = (decDeg * Math.PI) / 180;
  return [
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
    Math.cos(dec) * Math.cos(ra),
  ];
}

// the fixed rotation Earth-equatorial -> MARS-equatorial: Mars's pole maps
// to +Y; the RA-zero of the Mars frame is an arbitrary (fixed) meridian
const P = raDecToEq(MARS_POLE_RA_H, MARS_POLE_DEC);
const E0 = (() => { // any unit vector ⟂ pole, fixed forever
  const v = [P[1] * 0 - P[2] * 1, P[2] * 0 - P[0] * 0, P[0] * 1 - P[1] * 0]; // P × ẑ
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();
const E2 = [ // pole × E0 completes the basis
  P[1] * E0[2] - P[2] * E0[1],
  P[2] * E0[0] - P[0] * E0[2],
  P[0] * E0[1] - P[1] * E0[0],
];
export function earthEqToMarsEq(v) {
  return [
    v[0] * E0[0] + v[1] * E0[1] + v[2] * E0[2],
    v[0] * P[0] + v[1] * P[1] + v[2] * P[2],
    v[0] * E2[0] + v[1] * E2[1] + v[2] * E2[2],
  ];
}

// the star wheel: one turn per SIDEREAL sol (shorter than the solar sol —
// the ~0.15% gap is the annual lap of the constellations)
export function wheelAngle(millis) {
  const f = (millis / SIDEREAL_SOL_MS) % 1;
  return (f < 0 ? f + 1 : f) * Math.PI * 2;
}

// Mars-equatorial unit vector -> the observer's horizon frame (wheel about
// Y, then tilt about X so the pole stands at the latitude — Saltstead's
// two rotations exactly, re-pointed)
export function marsEqToWorld(v, millis, latDeg) {
  const w = -wheelAngle(millis);
  const cw = Math.cos(w), sw = Math.sin(w);
  const x1 = v[0] * cw + v[2] * sw;
  const z1 = -v[0] * sw + v[2] * cw;
  const a = -(90 - latDeg) * (Math.PI / 180);
  const ca = Math.cos(a), sa = Math.sin(a);
  return [x1, v[1] * ca - z1 * sa, v[1] * sa + z1 * ca];
}

// a catalogue star, from RA/Dec to where it stands over the stead
export function starWorld(raH, decDeg, millis, latDeg) {
  return marsEqToWorld(earthEqToMarsEq(raDecToEq(raH, decDeg)), millis, latDeg);
}

// ---- the catalogue (Saltstead's pocket kit — real J2000 stars) -------------
// [name, RA hours, Dec degrees, magnitude, warmth 0=blue 1=amber]
export const STAR_CATALOGUE = [
  ['Polaris', 2.5303, 89.264, 1.98, 0.40],
  ['Dubhe', 11.0622, 61.751, 1.79, 0.75], ['Merak', 11.0307, 56.383, 2.37, 0.10],
  ['Phecda', 11.8972, 53.695, 2.44, 0.10], ['Megrez', 12.2571, 57.033, 3.31, 0.10],
  ['Alioth', 12.9005, 55.960, 1.77, 0.10], ['Mizar', 13.3988, 54.925, 2.27, 0.10],
  ['Alkaid', 13.7924, 49.313, 1.86, 0.05],
  ['Caph', 0.1530, 59.150, 2.28, 0.30], ['Schedar', 0.6751, 56.537, 2.24, 0.75],
  ['Tsih', 0.9451, 60.717, 2.47, 0.05], ['Ruchbah', 1.4303, 60.235, 2.68, 0.25],
  ['Segin', 1.9066, 63.670, 3.38, 0.10],
  ['Betelgeuse', 5.9195, 7.407, 0.50, 1.00], ['Bellatrix', 5.4189, 6.350, 1.64, 0.05],
  ['Mintaka', 5.5334, -0.299, 2.23, 0.05], ['Alnilam', 5.6036, -1.202, 1.69, 0.05],
  ['Alnitak', 5.6793, -1.943, 1.77, 0.05], ['Saiph', 5.7959, -9.670, 2.09, 0.05],
  ['Rigel', 5.2423, -8.202, 0.13, 0.05],
  ['Sirius', 6.7525, -16.716, -1.46, 0.10],
  ['Acrux', 12.4433, -63.099, 0.76, 0.05], ['Mimosa', 12.7953, -59.689, 1.25, 0.05],
  ['Gacrux', 12.5194, -57.113, 1.64, 0.95], ['Imai', 12.2524, -58.749, 2.79, 0.05],
  ['Alpha Cen', 14.6599, -60.834, -0.27, 0.60], ['Hadar', 14.0637, -60.373, 0.61, 0.05],
  // the pole's neighbourhood — the stars that stand still over Mars
  ['Deneb', 20.6905, 45.280, 1.25, 0.15], ['Sadr', 20.3705, 40.257, 2.23, 0.60],
  ['Vega', 18.6156, 38.784, 0.03, 0.05], ['Altair', 19.8464, 8.868, 0.77, 0.20],
];

// the galactic north pole (Earth-eq) — the Milky Way band is the great
// circle perpendicular to this, drawn in the dome shader
export const GALACTIC_POLE = raDecToEq(12.8567, 27.13);

// deterministic background star field — fixed seed, same heavens for every
// client (invariant 4; directions in the MARS-equatorial frame). The count
// is a SPECTACLE number: a clear Martian night has a hundredth of Earth's
// light pollution, and the sky is the lantern the night is walked by.
export function starField(count = 2600, seed = 1900) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = rnd() * 2 - 1, a = rnd() * 2 * Math.PI;
    const r = Math.sqrt(1 - z * z);
    out.push({
      dir: [r * Math.cos(a), z, r * Math.sin(a)],
      mag: 1.9 + rnd() * rnd() * 4.3, // squared: many faint, a real few bright
      warmth: rnd(),
    });
  }
  return out;
}

// ---- the moons --------------------------------------------------------------
// Near-equatorial circular orbits in the MARS frame; the wheel transform
// does the rest. Phobos's RA advances FASTER than the wheel turns, so it
// rises in the west; Deimos's slower, so it rises east and lingers.
function moonWorld(periodMs, phase0, millis, latDeg) {
  const f = (millis / periodMs + phase0) % 1;
  const a = (f < 0 ? f + 1 : f) * Math.PI * 2;
  return marsEqToWorld([Math.sin(a), 0.019, Math.cos(a)], millis, latDeg); // dec ~1.1°
}
export function phobosWorld(millis, latDeg) { return moonWorld(P_PHOBOS_MS, 0.35, millis, latDeg); }
export function deimosWorld(millis, latDeg) { return moonWorld(P_DEIMOS_MS, 0.71, millis, latDeg); }

// apparent longitude rates (rad/ms) — the verify's rise-direction contract:
// positive = east-running among the stars faster than the sky turns (rises
// west, Phobos); negative = the sky outruns it (rises east, Deimos)
export function apparentRate(periodMs) {
  return Math.PI * 2 * (1 / periodMs - 1 / SIDEREAL_SOL_MS);
}

// ---- Earth, the evening star -------------------------------------------------
// Circular heliocentric orbits: good to a few degrees, honest about the
// one fact that matters — Earth never strays far from the sun in Mars's
// sky. Returns the elongation angle and which twilight owns it.
export function earthElongation(millis) {
  const d = (millis - J2000_MS) / 86400000;
  const lE = EARTH_L0 + (Math.PI * 2 * d) / EARTH_YEAR_D;
  const lM = MARS_L0 + (Math.PI * 2 * d) / MARS_YEAR_D;
  const ex = EARTH_A * Math.cos(lE) - MARS_A * Math.cos(lM);
  const ey = EARTH_A * Math.sin(lE) - MARS_A * Math.sin(lM);
  const sx = -Math.cos(lM), sy = -Math.sin(lM); // the sun, from Mars
  const el = Math.hypot(ex, ey);
  const dot = (ex * sx + ey * sy) / (el || 1e-9);
  const cross = sx * ey - sy * ex;
  return {
    rad: Math.acos(Math.max(-1, Math.min(1, dot))),
    evening: cross > 0, // trails the sun -> lingers after sunset
  };
}
