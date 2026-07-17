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

// elevation + position -> flat-shaded palette (RGB 0..1). Deterministic.
// Mars owns the warm colours (DESIGN.md, the colour law): no green, ever.
export function colourFor(h, x, z, steep) {
  // basalt shows through where the ground is steep or scoured
  if (steep > 0.55) return [0.24, 0.13, 0.10];
  const dustier = fbm2(x * 0.02 + 7, z * 0.02) * 0.12;
  if (h > 12) return [0.62 + dustier, 0.42, 0.28];   // pale high dust
  if (h < -14) return [0.35, 0.18, 0.12];            // low dark floor
  return [0.51 + dustier, 0.29, 0.18];               // the ochre plain
}

// positions (world-space), colours, and indices for chunk (cx, cz) at a
// given resolution, with a one-vert skirt ring dropped SKIRT_DROP below.
// Deterministic: same chunk + res, same mesh, every client (invariant 4).
export function buildChunkData(cx, cz, res) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const n = res + 1;          // interior verts per side
  const N = n + 2;            // + skirt ring
  const pos = new Float32Array(N * N * 3);
  const col = new Float32Array(N * N * 3);
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

  return { pos, col, idx: new Uint32Array(idx), n: N };
}

// which latitudes get seasonal frost tint (Phase 1 wires season in)
export function frostAt(x, z) {
  const { lat } = worldToLatLon(x, z);
  return Math.abs(lat) > 55;
}
