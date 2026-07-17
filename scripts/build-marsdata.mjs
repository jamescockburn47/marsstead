// build-marsdata: bakes real Mars topography into src/marsdata.js —
// data-in-code (the earthdata trick at another planet; invariant: no binary
// asset files at runtime).
//
// Real input (downloaded to tools/, gitignored — see docs/DATA.md):
//   tools/megt90n000cb.img — MOLA MEGDR global DEM, 4 px/deg, 1440x720,
//   big-endian Int16 metres vs areoid, row 0 = lat +90, col 0 = lon 0 East,
//   from https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
//   (product MGS-M-MOLA-5-MEGDR-L3-V1.0, public domain).
//
// Until that file lands, this script writes a clearly-stamped SYNTHETIC
// skeleton of the Phase 0 region — Jezero crater and its surrounds —
// shaped from the real published facts (crater at 18.44N 77.45E, ~45 km
// across, floor ~-2600 m, the western inlet valley and its delta, the
// regional fall toward Isidis) plus deterministic noise. Same table format,
// so the real bake drops in with zero code change downstream.
//
// Output: src/marsdata.js (generated, committed). Never edit by hand.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fbm2, ridge2, hash2 } from '../src/noise.js';

// ---- the Phase 0 region (degrees, east-positive) ----
const LAT0 = 14, LAT1 = 22;   // south -> north
const LON0 = 73, LON1 = 81;   // west -> east
const STEP = 0.02;            // deg per cell (50 cells/deg)
const W = Math.round((LON1 - LON0) / STEP) + 1;
const H = Math.round((LAT1 - LAT0) / STEP) + 1;

const MOLA_PATH = 'tools/megt90n000cb.img';
let source, grid;

if (existsSync(MOLA_PATH)) {
  // ---- the real thing: sample MEGDR 4ppd bilinearly onto the region grid
  source = 'MOLA MEGDR 4ppd (megt90n000cb.img)';
  const buf = readFileSync(MOLA_PATH);
  const MW = 1440, MH = 720, PPD = 4;
  const molaAt = (lat, lonE) => {
    const col = ((lonE % 360) + 360) % 360 * PPD;
    const row = (90 - lat) * PPD;
    const c0 = Math.floor(col), r0 = Math.floor(row);
    const fx = col - c0, fy = row - r0;
    const at = (r, c) => buf.readInt16BE(2 * ((Math.min(MH - 1, Math.max(0, r))) * MW + ((c % MW) + MW) % MW));
    const a = at(r0, c0), b = at(r0, c0 + 1), c = at(r0 + 1, c0), d = at(r0 + 1, c0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  grid = new Int16Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      grid[j * W + i] = Math.round(molaAt(LAT0 + j * STEP, LON0 + i * STEP));
    }
  }
} else {
  // ---- the stamped placeholder: Jezero from published shape facts + noise
  source = 'SYNTHETIC placeholder (Jezero analytic model) — drop the MOLA .img in tools/ and rebuild';
  const CLAT = 18.44, CLON = 77.45, CRAD = 0.38; // Jezero, deg
  const synth = (lat, lonE) => {
    // regional ramp: down to the NE toward the Isidis basin (~-3800 m),
    // up to the SW highlands (~-1200 m)
    const t = ((lonE - LON0) / (LON1 - LON0) + (lat - LAT0) / (LAT1 - LAT0)) / 2;
    let e = -1200 - 2600 * t;
    // the crater: raised rim, bowl floor near -2600 m
    const dx = (lonE - CLON) * Math.cos(CLAT * Math.PI / 180), dy = lat - CLAT;
    const r = Math.hypot(dx, dy) / CRAD;
    if (r < 1.6) {
      const rim = Math.exp(-((r - 1) * (r - 1)) / 0.018) * 450;    // the rampart
      const bowl = r < 1 ? (Math.cos(r * Math.PI) + 1) * 0.5 * -700 : 0;
      e = e * 0.35 + -2100 * 0.65 + rim + bowl;
      // the western inlet valley (Neretva Vallis) breaching the rim...
      const va = Math.atan2(dy, dx); // 0 = east; valley comes in from the west
      const valley = Math.exp(-Math.pow((Math.abs(Math.abs(va) - Math.PI)) / 0.22, 2));
      if (r > 0.75 && r < 1.45) e -= valley * 520 * Math.exp(-Math.pow((r - 1) / 0.3, 2));
      // ...and the delta fan just inside the breach
      if (r < 0.9) {
        const fan = valley * Math.exp(-Math.pow((r - 0.62) / 0.28, 2));
        e += fan * 140 * (0.6 + 0.4 * fbm2(lonE * 90, lat * 90));
      }
    }
    // regional roughness + a scatter of small worn craters
    e += (fbm2(lonE * 8, lat * 8) - 0.5) * 260;
    e += (ridge2(lonE * 30, lat * 30) - 0.5) * 90;
    const ci = Math.floor(lonE * 3), cj = Math.floor(lat * 3);
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const h = hash2(ci + a, cj + b);
        if (h < 0.35) continue; // not every cell hosts a crater
        const cx = ci + a + hash2(ci + a + 91, cj + b), cy = cj + b + hash2(ci + a, cj + b + 47);
        const rad = 0.02 + h * 0.06;
        const d = Math.hypot((lonE * 3 - cx), (lat * 3 - cy)) / (rad * 3);
        if (d < 1.5) {
          e += Math.exp(-((d - 1) * (d - 1)) / 0.02) * rad * 2400;      // rim
          if (d < 1) e -= (Math.cos(d * Math.PI) + 1) * 0.5 * rad * 3800; // bowl
        }
      }
    }
    return e;
  };
  grid = new Int16Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const e = synth(LAT0 + j * STEP, LON0 + i * STEP);
      grid[j * W + i] = Math.round(Math.max(-8200, Math.min(21900, e)));
    }
  }
}

// ---- pack & emit -----------------------------------------------------------
const bytes = new Uint8Array(grid.buffer);
const b64 = Buffer.from(bytes).toString('base64');

const out = `// GENERATED by scripts/build-marsdata.mjs — never edit by hand.
// Source: ${source}
// Region: lat ${LAT0}..${LAT1} N, lon ${LON0}..${LON1} E, ${STEP} deg/cell (${W}x${H})
// Encoding: little-endian Int16 metres vs areoid, row 0 = south edge.

export const SOURCE = ${JSON.stringify(source)};
export const IS_PLACEHOLDER = ${!existsSync(MOLA_PATH)};
export const LAT_MIN = ${LAT0}, LAT_MAX = ${LAT1};
export const LON_MIN = ${LON0}, LON_MAX = ${LON1};
export const STEP_DEG = ${STEP};
export const GRID_W = ${W}, GRID_H = ${H};
export const ELEV_B64 = ${JSON.stringify(b64)};
`;

writeFileSync('src/marsdata.js', out);
console.log(`marsdata: ${W}x${H} cells, ${(b64.length / 1024).toFixed(0)} KiB base64 — ${source}`);
