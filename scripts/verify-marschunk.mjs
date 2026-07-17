// verify-marschunk: the lockstep gate (Saltstead's wave rule, on land) —
// chunk mesh vertices ARE groundHeight() values; the walker and the mesh
// can never disagree. Plus determinism, colour law, skirt integrity.

import { groundHeight } from '../src/mars.js';
import {
  CHUNK, RES_NEAR, RES_FAR, SKIRT_DROP, buildChunkData, resForRing, colourFor,
} from '../src/marschunk.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. LOCKSTEP: every interior vertex height equals groundHeight(x, z)
{
  let worst = 0;
  for (const [cx, cz] of [[0, 0], [3, -2], [-5, 7]]) {
    const { pos, n } = buildChunkData(cx, cz, RES_NEAR);
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = (j * n + i) * 3;
        worst = Math.max(worst, Math.abs(pos[k + 1] - groundHeight(pos[k], pos[k + 2])));
      }
    }
  }
  // mesh heights live in Float32Array — lockstep to float32 precision
  // (microns at chunk scale; the walker can never visibly disagree)
  check('CPU/mesh height lockstep', worst < 1e-4, `worst=${worst}`);
}

// 2. skirt ring hangs exactly SKIRT_DROP below its rim vertex
{
  const { pos, n } = buildChunkData(1, 1, RES_NEAR);
  let ok = true;
  for (let i = 0; i < n; i++) {
    const top = pos[((1) * n + Math.max(1, Math.min(n - 2, i))) * 3 + 1];
    const skirt = pos[((0) * n + i) * 3 + 1];
    if (Math.abs((top - skirt) - SKIRT_DROP) > 1e-4) ok = false; // float32
  }
  check('skirt drop exact', ok);
}

// 3. determinism: same chunk, same bytes, twice (invariant 4)
{
  const a = buildChunkData(2, -3, RES_NEAR), b = buildChunkData(2, -3, RES_NEAR);
  let same = a.pos.length === b.pos.length && a.idx.length === b.idx.length;
  if (same) for (let i = 0; i < a.pos.length; i++) if (a.pos[i] !== b.pos[i]) { same = false; break; }
  check('chunk build deterministic', same);
}

// 4. LOD tiers step down with ring distance, and coarse < fine in verts
{
  check('ring tiers ordered', resForRing(0) > resForRing(5) && resForRing(5) > resForRing(8));
  const fine = buildChunkData(0, 0, RES_NEAR), coarse = buildChunkData(0, 0, RES_FAR);
  check('far LOD is cheaper', coarse.pos.length < fine.pos.length / 4,
    `${coarse.pos.length} vs ${fine.pos.length}`);
}

// 5. the colour law: Mars owns the warm hues — red channel rules, no green
{
  let ok = true;
  for (let i = 0; i < 500; i++) {
    const h = -30 + (i % 60), x = i * 13.7, z = i * 7.3;
    const c = colourFor(h, x, z, (i % 10) / 10);
    if (!(c[0] >= c[1] && c[1] >= c[2])) ok = false;          // warm ordering
    if (c.some((v) => v < 0 || v > 1)) ok = false;             // bounded
  }
  check('colour law: warm world, bounded', ok);
}

// 6. indices reference real vertices
{
  const { pos, idx } = buildChunkData(0, 0, RES_FAR);
  const nVerts = pos.length / 3;
  let ok = idx.length % 3 === 0;
  for (const i of idx) if (i >= nVerts) ok = false;
  check('index buffer valid', ok);
}

check('chunk size sane', CHUNK >= 32 && CHUNK <= 128);

if (failed) { console.error(`verify-marschunk: ${failed} FAILED`); process.exit(1); }
console.log('verify-marschunk: all green');
