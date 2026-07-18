// The rock scatter — pure, no THREE, no DOM. verify-rocks.mjs guards it.
// Mars is a rubble world: outcrops, boulders, rocks and pebbles strew the
// plains (every rover picture says so), and this module decides WHERE,
// deterministically — same chunk, same rocks, every client (invariant 4).
//
// Geology, not confetti: a slow "rockiness" field makes rock FIELDS —
// boulder country, clean dune floors — and slope adds talus, so the
// scatter reads as the planet's story. The layer draws instances; the
// walker and buggy push off the big ones (collidersNear). Rocks are
// OBJECTS on the drawn surface — the terrain itself never displaces
// (the walked-surface contract stands).

import { hash2, fbm2 } from './noise.js';
import { groundHeight } from './mars.js';
import { CHUNK, meshGroundHeight } from './marschunk.js';

// kind table: base footprint radius (m) and scale ranges. Colliders only
// for the kinds a boot cannot step over.
export const ROCK_KINDS = {
  pebble: { rMin: 0.12, rMax: 0.34, collides: false },
  rock: { rMin: 0.34, rMax: 0.85, collides: false },
  boulder: { rMin: 0.85, rMax: 2.6, collides: true },
  slab: { rMin: 1.4, rMax: 3.6, collides: true }, // an outcrop's teeth
};

// how rocky the country is at (x, z): 0 clean dune floor -> 1 boulder field.
// Slow fbm picks the fields; slope adds talus under the steeps.
export function rockiness(x, z) {
  const field = fbm2(x * 0.0042 + 31.7, z * 0.0042 - 8.3);
  const e = 2.0;
  const gx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e);
  const gz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
  const talus = Math.min(1, Math.hypot(gx, gz) * 2.2);
  return Math.min(1, Math.max(0, (field - 0.32) * 1.7) + talus * 0.5);
}

// per-chunk instance budget by kind (near-field numbers; the layer thins
// far rings by kind). Bounded: verify holds the counts. Rover photography
// says a Martian plain is STREWN — err rubbly, not tidy.
export const MAX_PER_CHUNK = 160;

// deterministic scatter for chunk (cx, cz). Returns instances:
//   { kind, x, z, y, r, sx, sy, sz, rot, tilt, seed }
// y sits on the DRAWN surface (meshGroundHeight), base buried ~20% so
// rocks bite the ground instead of perching. Outcrops arrive as clusters
// of slabs sharing a strike angle — bedding, not dice.
//
// Cached: colliders run every frame, so a chunk's scatter is computed once
// and SHARED — callers must never mutate the returned array.
const cache = new Map();
export function rocksInChunk(cx, cz) {
  const key = `${cx},${cz}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rocks = buildRocks(cx, cz);
  if (cache.size > 512) cache.clear();
  cache.set(key, rocks);
  return rocks;
}
export function clearRockCache() { cache.clear(); } // the verify's determinism probe

function buildRocks(cx, cz) {
  const out = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const midRockiness = rockiness(x0 + CHUNK / 2, z0 + CHUNK / 2);

  // ---- the outcrop: at most one cluster per chunk, only in rocky country
  const oRoll = hash2(cx * 7919 + 3, cz * 6323 + 11);
  if (midRockiness > 0.5 && oRoll < 0.3) {
    const ox = x0 + 6 + hash2(cx * 131 + 1, cz * 137) * (CHUNK - 12);
    const oz = z0 + 6 + hash2(cx * 139, cz * 149 + 1) * (CHUNK - 12);
    const strike = hash2(cx * 151, cz * 157) * Math.PI; // the bedding's one angle
    const slabs = 3 + Math.floor(hash2(cx * 163, cz * 167) * 4); // 3..6
    for (let s = 0; s < slabs; s++) {
      const along = (s - (slabs - 1) / 2) * 2.6;
      const jx = (hash2(cx * 173 + s, cz * 179) - 0.5) * 1.6;
      const jz = (hash2(cx * 181, cz * 191 + s) - 0.5) * 1.6;
      const x = ox + Math.cos(strike) * along + jx;
      const z = oz + Math.sin(strike) * along + jz;
      const k = ROCK_KINDS.slab;
      const r = k.rMin + hash2(cx * 193 + s, cz * 197) * (k.rMax - k.rMin);
      out.push({
        kind: 'slab', x, z, y: meshGroundHeight(x, z) - r * 0.28, r,
        sx: r * (1.5 + hash2(cx * 199 + s, cz * 211) * 0.9),
        sy: r * (1.1 + hash2(cx * 223 + s, cz * 227) * 1.1),
        sz: r * (0.5 + hash2(cx * 229 + s, cz * 233) * 0.3),
        rot: strike + (hash2(cx * 239 + s, cz * 241) - 0.5) * 0.3,
        tilt: 0.15 + hash2(cx * 251 + s, cz * 257) * 0.3, // slabs lean together
        seed: hash2(cx * 263 + s, cz * 269),
      });
    }
  }

  // ---- boulders, rocks, pebbles: counts ride the local rockiness
  const plant = (kind, count, salt) => {
    const k = ROCK_KINDS[kind];
    for (let i = 0; i < count; i++) {
      const x = x0 + hash2(cx * 271 + i * 7 + salt, cz * 277 + salt) * CHUNK;
      const z = z0 + hash2(cx * 281 + salt, cz * 283 + i * 7 + salt) * CHUNK;
      const local = rockiness(x, z);
      // the field thins its own scatter: a roll against local rockiness
      if (hash2(cx * 293 + i + salt, cz * 307 + i) > local) continue;
      const r = k.rMin + hash2(cx * 311 + i + salt, cz * 313 + i) * (k.rMax - k.rMin);
      out.push({
        kind, x, z, y: meshGroundHeight(x, z) - r * 0.2, r,
        sx: r * (0.8 + hash2(cx * 317 + i + salt, cz * 331) * 0.5),
        sy: r * (0.65 + hash2(cx * 337 + i + salt, cz * 347) * 0.6),
        sz: r * (0.8 + hash2(cx * 349 + i + salt, cz * 353) * 0.5),
        rot: hash2(cx * 359 + i + salt, cz * 367) * Math.PI * 2,
        tilt: 0,
        seed: hash2(cx * 373 + i + salt, cz * 379),
      });
    }
  };
  plant('boulder', 12, 1000);
  plant('rock', 40, 2000);
  plant('pebble', 70, 3000);

  return out.length > MAX_PER_CHUNK ? out.slice(0, MAX_PER_CHUNK) : out;
}

// the big rocks near (x, z) within reach, as push-out discs for the walker
// and the buggy. Cheap: scans the 3x3 chunks around the point.
export function collidersNear(x, z, reach = 3) {
  const ccx = Math.floor(x / CHUNK), ccz = Math.floor(z / CHUNK);
  const found = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const rk of rocksInChunk(ccx + dx, ccz + dz)) {
        if (!ROCK_KINDS[rk.kind].collides) continue;
        const d = Math.hypot(rk.x - x, rk.z - z);
        const rr = Math.max(rk.sx, rk.sz) * 0.8;
        if (d < rr + reach) found.push({ x: rk.x, z: rk.z, r: rr });
      }
    }
  }
  return found;
}
