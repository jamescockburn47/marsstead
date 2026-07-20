// Terrain chunk generation — pure, no THREE, no DOM. verify-marschunk.mjs
// guards it. A chunk is a low-poly heightfield sampled from the Mars module,
// coloured by elevation and slope: dusty ochre plains, dark basalt on the
// steeps, pale dust on the highs. There is NO cheap tile on Mars — every
// chunk builds (DESIGN.md, the hard-sibling rule), so LOD does the saving:
// resolution steps down with ring distance and a dropped skirt hides the
// T-junction seams.

import { groundHeight, worldToLatLon } from './mars.js';
import { fbm2 } from './noise.js';

export const CHUNK = 64;        // metres square
export const RES_NEAR = 16;     // quads per side, rings 0..3
export const RES_MID = 8;       // rings 4..6
export const RES_FAR = 4;       // beyond
export const SKIRT_DROP = 2.5;  // metres the edge skirt hangs below the rim

export function resForRing(r) {
  return r <= 3 ? RES_NEAR : r <= 6 ? RES_MID : RES_FAR;
}

// analytic ground normal at (x, z) — a function of POSITION ONLY (fixed
// epsilon, no chunk or LOD terms), so adjacent chunks and different rings
// compute the SAME normal at a shared vertex: no lighting seams at chunk
// borders, no pop at ring transitions. Skirt verts clamp x/z to the rim,
// so they inherit the rim's normal by construction.
export function groundNormal(x, z) {
  const e = 1.0;
  const gx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e);
  const gz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
  const inv = 1 / Math.hypot(gx, 1, gz);
  return [-gx * inv, inv, -gz * inv];
}

// elevation + position -> the low-frequency vertex palette (RGB 0..1).
// Deterministic. Per-pixel shader detail modulates this base multiplicatively,
// so the law below survives the smooth-shaded look untouched.
// Mars owns the warm colours (DESIGN.md, the colour law): no green, ever.
export function colourFor(h, x, z, steep) {
  // basalt shows through where the ground is steep or scoured
  if (steep > 0.55) return [0.27, 0.12, 0.08];
  const dustier = fbm2(x * 0.02 + 7, z * 0.02) * 0.12;
  // PHASE 1: the planet's own stratigraphy, keyed to real elevation
  // (game h = real m × 0.025). The colour law holds in every band: warm,
  // g < r, no green ever. Frost is the shader's business, not this table's.
  if (h < -160) return [0.63 + dustier, 0.35, 0.19]; // the great basins: pale dust seas
  if (h > 260) return [0.60 + dustier, 0.38, 0.24];  // Tharsis heights: high pale ochre
  if (h > 55) return [0.45 + dustier * 0.6, 0.21, 0.11]; // highland basalt, dust-thin
  if (h > 12) return [0.68 + dustier, 0.38, 0.20];   // pale high dust
  if (h < -14) return [0.36, 0.15, 0.09];            // low dark floor
  return [0.56 + dustier, 0.27, 0.13];               // the rust plain
}

// positions (world-space), colours, NORMALS and indices for chunk (cx, cz)
// at a given resolution, with a one-vert skirt ring dropped SKIRT_DROP below.
// Deterministic: same chunk + res, same mesh, every client (invariant 4).
// Normals are analytic (groundNormal), not computed from the triangles —
// that is what keeps lighting seamless across borders and LOD rings.
export function buildChunkData(cx, cz, res) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const n = res + 1;          // interior verts per side
  const N = n + 2;            // + skirt ring
  const pos = new Float32Array(N * N * 3);
  const col = new Float32Array(N * N * 3);
  const nrm = new Float32Array(N * N * 3);
  const step = CHUNK / res;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      // skirt verts clamp to the rim in x/z and drop in y
      const ii = Math.min(n - 1, Math.max(0, i - 1));
      const jj = Math.min(n - 1, Math.max(0, j - 1));
      const x = x0 + ii * step, z = z0 + jj * step;
      const onSkirt = (i === 0 || j === 0 || i === N - 1 || j === N - 1);
      const h = groundHeight(x, z);
      const k = (j * N + i) * 3;
      pos[k] = x;
      pos[k + 1] = onSkirt ? h - SKIRT_DROP : h;
      pos[k + 2] = z;
      const nv = groundNormal(x, z);
      nrm[k] = nv[0]; nrm[k + 1] = nv[1]; nrm[k + 2] = nv[2];
      // slope from a short forward difference (cheap, deterministic)
      const hx = groundHeight(x + step, z), hz = groundHeight(x, z + step);
      const steep = Math.min(1, Math.hypot(hx - h, hz - h) / step);
      const c = colourFor(h, x, z, steep);
      col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2];
    }
  }

  const idx = [];
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  return { pos, col, nrm, idx: new Uint32Array(idx), n: N };
}

// which latitudes get seasonal frost tint (Phase 1 wires season in)
export function frostAt(x, z) {
  const { lat } = worldToLatLon(x, z);
  return Math.abs(lat) > 55;
}

// ---- the surface the walker STANDS on -------------------------------------
// The renderer draws straight triangles between lattice samples; the smooth
// analytic groundHeight dips above and below those planes mid-cell, so feet
// standing on the analytic value clip through the visible ground. This
// function returns the height of the DRAWN surface: the same near-ring
// lattice (global — chunk edges align by construction), the same diagonal
// split as buildChunkData's index order (a,c,b / b,c,d), interpolated
// barycentrically. Walker, camera and mesh can no longer disagree anywhere.
export function meshGroundHeight(x, z) {
  const step = CHUNK / RES_NEAR;
  const gx = x / step, gz = z / step;
  const i0 = Math.floor(gx), j0 = Math.floor(gz);
  const u = gx - i0, v = gz - j0;
  const x0 = i0 * step, z0 = j0 * step;
  const h00 = groundHeight(x0, z0);
  const h10 = groundHeight(x0 + step, z0);
  const h01 = groundHeight(x0, z0 + step);
  const h11 = groundHeight(x0 + step, z0 + step);
  // triangles split on the same diagonal the index buffer uses
  if (u + v < 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}
