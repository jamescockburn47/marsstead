// Mars — pure geography module, no THREE, no DOM. verify-mars.mjs guards it.
// Decodes the baked topography table (src/marsdata.js) and answers the
// questions everything else asks:
//
//   latLonToWorld / worldToLatLon — projection + game scale
//   elevationReal(lat, lonE)      — metres vs areoid (bilinear over the table)
//   elevationGame(x, z)           — game metres at a world position
//   groundHeight(x, z)            — alias the walker and chunks BOTH stand on
//
// Scale (Phase 0 numbers, tuned in Phase 1): horizontal 1:200
// (M_PER_DEG = 296 game m per degree — a Mars degree is ~59.28 km), vertical
// 1:40 (VERT = 0.025) so relief reads without turning every slope to cliff.
// Jezero's ~45 km bowl becomes a ~225 m amphitheatre you can walk in minutes;
// its rim stands ~15 m over the floor. Outside the baked region the ground
// continues as a deterministic rolling plain — the walk never hits a wall.

import {
  IS_PLACEHOLDER, SOURCE, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
  STEP_DEG, GRID_W, GRID_H, ELEV_B64,
  G_W, G_H, G_PPD, GLOBAL_B64, FEATURES as RAW_FEATURES,
} from './marsdata.js';
import { fbm2, ridge2 } from './noise.js';

export { IS_PLACEHOLDER, SOURCE };

export const M_PER_DEG = 296;   // horizontal game metres per degree (~1:200)
export const VERT = 0.025;      // vertical game metres per real metre (1:40)

// The Phase 0 anchor: the delta inside Jezero's western breach.
export const HOME = { lat: 18.44, lon: 77.05 };

export function latLonToWorld(lat, lonE) {
  return { x: (lonE - HOME.lon) * M_PER_DEG, z: -(lat - HOME.lat) * M_PER_DEG };
}
export function worldToLatLon(x, z) {
  return { lat: HOME.lat - z / M_PER_DEG, lon: HOME.lon + x / M_PER_DEG };
}

// ---------- decode ----------
function b64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const bytes = b64ToBytes(ELEV_B64);
const copy = new Uint8Array(bytes.length);
copy.set(bytes);
const ELEV = new Int16Array(copy.buffer); // little-endian by construction

// PHASE 1: the whole planet — the global 4ppd table (product row order:
// row 0 = lat +90, col 0 = lon 0 E)
const gBytes = b64ToBytes(GLOBAL_B64);
const gCopy = new Uint8Array(gBytes.length);
gCopy.set(gBytes);
const GLOBAL = new Int16Array(gCopy.buffer);

// global bilinear: lon wraps the planet, lat clamps at the poles
function globalElevation(lat, lonE) {
  const col = (((lonE % 360) + 360) % 360) * G_PPD;
  const row = Math.min(G_H - 1.001, Math.max(0, (90 - lat) * G_PPD));
  const c0 = Math.floor(col), r0 = Math.floor(row);
  const fx = col - c0, fy = row - r0;
  const at = (r, c) => GLOBAL[Math.min(G_H - 1, r) * G_W + ((c % G_W) + G_W) % G_W];
  const a = at(r0, c0), b = at(r0, c0 + 1), c = at(r0 + 1, c0), d = at(r0 + 1, c0 + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// real metres vs areoid: the fine Jezero window where it covers, the whole
// planet everywhere else — the walk (and the flight) never hits a wall
export function elevationReal(lat, lonE) {
  const gx = (lonE - LON_MIN) / STEP_DEG;
  const gy = (lat - LAT_MIN) / STEP_DEG;
  if (gx >= 0 && gy >= 0 && gx <= GRID_W - 1 && gy <= GRID_H - 1) {
    const x0 = Math.min(GRID_W - 2, Math.floor(gx));
    const y0 = Math.min(GRID_H - 2, Math.floor(gy));
    const fx = gx - x0, fy = gy - y0;
    const a = ELEV[y0 * GRID_W + x0], b = ELEV[y0 * GRID_W + x0 + 1];
    const c = ELEV[(y0 + 1) * GRID_W + x0], d = ELEV[(y0 + 1) * GRID_W + x0 + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  return globalElevation(lat, lonE);
}

// ---------- the gazetteer: the land's own names ----------
// world x wraps at half the planet's girth; distances use the short way round
const WORLD_WRAP = 360 * M_PER_DEG;
export const FEATURES = RAW_FEATURES.map(([name, lat, lonE, kind, diamKm]) => {
  // project via the wrap-aware shortest longitude offset from HOME
  let dLon = lonE - HOME.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  return {
    name, lat, lonE, kind, diamKm,
    x: dLon * M_PER_DEG, z: -(lat - HOME.lat) * M_PER_DEG,
  };
});

export function nearestFeature(x, z) {
  let best = null, bestD = Infinity;
  for (const f of FEATURES) {
    let dx = Math.abs(f.x - x) % WORLD_WRAP;
    if (dx > WORLD_WRAP / 2) dx = WORLD_WRAP - dx;
    const d = Math.hypot(dx, f.z - z);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

export function featuresInBox(x0, z0, x1, z1) {
  return FEATURES.filter((f) => {
    let fx = f.x;
    // consider the wrapped twin when the box crosses the seam
    if (fx < x0 - WORLD_WRAP / 2) fx += WORLD_WRAP;
    if (fx > x1 + WORLD_WRAP / 2) fx -= WORLD_WRAP;
    return fx >= x0 && fx <= x1 && f.z >= z0 && f.z <= z1;
  });
}

// --- procedural skin: the ground below the skeleton's resolution ---------
// Dune ripples, scattered rock rubble, worn gullies — deterministic from
// world position, added in GAME metres at human scale.
export function detailGame(x, z) {
  let d = 0;
  d += (ridge2(x * 0.045, z * 0.045) - 0.5) * 2.4;  // dune field, ~20 m wave
  d += (fbm2(x * 0.35, z * 0.35) - 0.5) * 0.5;       // rubble & pocking
  d += (fbm2(x * 0.02 + 40, z * 0.02) - 0.5) * 4.5;  // long soft swells
  return d;
}

// game-metres ground height at a world position — THE height function.
// Chunk meshes bake exactly this; the walker stands on exactly this;
// verify-marschunk asserts they agree (the wave-lockstep rule, on land).
export function groundHeight(x, z) {
  const { lat, lon } = worldToLatLon(x, z);
  return elevationReal(lat, lon) * VERT + detailGame(x, z);
}
