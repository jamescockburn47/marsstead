// verify-marschunk: the lockstep gate (Saltstead's wave rule, on land) —
// chunk mesh vertices ARE groundHeight() values; the walker and the mesh
// can never disagree. Plus determinism, colour law, skirt integrity.

import { groundHeight } from '../src/mars.js';
import {
  CHUNK, RES_NEAR, RES_FAR, SKIRT_DROP, buildChunkData, resForRing, colourFor,
  meshGroundHeight, groundNormal,
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

// 7. the WALKED surface is the DRAWN surface: meshGroundHeight equals the
//    analytic height exactly at lattice points, and mid-cell it lies on the
//    triangle plane — inside the corner heights' hull, never the smooth
//    curve's overshoot. This is the no-clipping contract.
{
  const step = CHUNK / RES_NEAR;
  let exact = true;
  for (let i = -20; i <= 20; i += 3) {
    for (let j = -20; j <= 20; j += 5) {
      if (Math.abs(meshGroundHeight(i * step, j * step) - groundHeight(i * step, j * step)) > 1e-9) exact = false;
    }
  }
  check('mesh surface exact at lattice', exact);

  let hull = true, worstGap = 0;
  for (let n = 0; n < 800; n++) {
    const x = ((n * 137.71) % 900) - 450, z = ((n * 89.13) % 900) - 450;
    const i0 = Math.floor(x / step) * step, j0 = Math.floor(z / step) * step;
    const hs = [
      groundHeight(i0, j0), groundHeight(i0 + step, j0),
      groundHeight(i0, j0 + step), groundHeight(i0 + step, j0 + step),
    ];
    const m = meshGroundHeight(x, z);
    if (m < Math.min(...hs) - 1e-9 || m > Math.max(...hs) + 1e-9) hull = false;
    worstGap = Math.max(worstGap, Math.abs(m - groundHeight(x, z)));
  }
  check('mesh surface within cell hull', hull);
  console.log(`  (analytic-vs-mesh mid-cell gap up to ${worstGap.toFixed(3)} m — the clip the walker no longer feels)`);

  // continuity across a cell edge: approaching from both sides agrees
  const e = 3 * step;
  const a = meshGroundHeight(e - 1e-7, 10.3), b = meshGroundHeight(e + 1e-7, 10.3);
  check('mesh surface continuous at edges', Math.abs(a - b) < 1e-3, `${Math.abs(a - b)}`);
}

// 8. analytic normals: unit length, true to the height gradient, a function
//    of POSITION ONLY — so chunk borders and LOD rings can never disagree —
//    and skirts inherit the rim's normal (they clamp x/z to the rim).
{
  let unit = true, grad = true;
  for (let s = 0; s < 200; s++) {
    const x = ((s * 61.3) % 700) - 350, z = ((s * 47.9) % 700) - 350;
    const nv = groundNormal(x, z);
    if (Math.abs(Math.hypot(nv[0], nv[1], nv[2]) - 1) > 1e-9) unit = false;
    const e = 1.0;
    const gx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e);
    const gz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
    const inv = 1 / Math.hypot(gx, 1, gz);
    if (Math.abs(nv[0] + gx * inv) > 1e-9 || Math.abs(nv[1] - inv) > 1e-9
      || Math.abs(nv[2] + gz * inv) > 1e-9) grad = false;
  }
  check('normals unit length', unit);
  check('normals match the height gradient', grad);

  // every mesh normal IS the analytic normal (skirts included: clamped x/z
  // hands them the rim's normal with no special case to get wrong)
  const { pos, nrm } = buildChunkData(2, -1, RES_NEAR);
  let match = true;
  for (let k = 0; k < pos.length; k += 3) {
    const nv = groundNormal(pos[k], pos[k + 2]);
    if (Math.abs(nrm[k] - nv[0]) > 1e-6 || Math.abs(nrm[k + 1] - nv[1]) > 1e-6
      || Math.abs(nrm[k + 2] - nv[2]) > 1e-6) { match = false; break; }
  }
  check('mesh normals are the analytic normals (skirts inherit rim)', match);

  // LOD tiers agree byte-for-byte where their lattices share a position
  const near = buildChunkData(0, 0, RES_NEAR), far = buildChunkData(0, 0, RES_FAR);
  const at = new Map();
  for (let k = 0; k < near.pos.length; k += 3) at.set(`${near.pos[k]},${near.pos[k + 2]}`, k);
  let lodOk = true, lodShared = 0;
  for (let k = 0; k < far.pos.length; k += 3) {
    const nk = at.get(`${far.pos[k]},${far.pos[k + 2]}`);
    if (nk === undefined) continue;
    lodShared++;
    if (near.nrm[nk] !== far.nrm[k] || near.nrm[nk + 1] !== far.nrm[k + 1]
      || near.nrm[nk + 2] !== far.nrm[k + 2]) lodOk = false;
  }
  check('normals agree across LOD tiers (byte-identical)', lodOk && lodShared > 0,
    `shared=${lodShared}`);

  // neighbouring chunks agree byte-for-byte along their shared rim
  const west = buildChunkData(0, 0, RES_NEAR), east = buildChunkData(1, 0, RES_NEAR);
  const rim = new Map();
  for (let k = 0; k < west.pos.length; k += 3) {
    if (west.pos[k] === CHUNK) rim.set(`${west.pos[k + 2]}`, k);
  }
  let borderOk = true, borderShared = 0;
  for (let k = 0; k < east.pos.length; k += 3) {
    if (east.pos[k] !== CHUNK) continue;
    const wk = rim.get(`${east.pos[k + 2]}`);
    if (wk === undefined) continue;
    borderShared++;
    if (west.nrm[wk] !== east.nrm[k] || west.nrm[wk + 1] !== east.nrm[k + 1]
      || west.nrm[wk + 2] !== east.nrm[k + 2]) borderOk = false;
  }
  check('normals agree across chunk borders (byte-identical)', borderOk && borderShared > 0,
    `shared=${borderShared}`);
}

// ---- PHASE 1: the stratigraphy palette — distinct bands, the colour law
{
  const { colourFor } = await import('../src/marschunk.js');
  const flat = (h) => colourFor(h, 100, 100, 0);
  const bands = [flat(-200), flat(-40), flat(0), flat(20), flat(80), flat(300)];
  // distinct: the basins, floors, plain, high dust, highland, heights all read apart
  let distinct = true;
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      if (bands[i].every((c, k) => Math.abs(c - bands[j][k]) < 0.02)) distinct = false;
    }
  }
  check('the stratigraphy reads in bands', distinct);
  // the colour law: warm everywhere — no green ever, red leads every band
  const lawful = bands.concat([colourFor(0, 5, 5, 1)])
    .every(([r, g, b]) => r > g && g >= b - 0.02 && r <= 1);
  check('the colour law holds in every band', lawful);
  // determinism
  check('palette deterministic', JSON.stringify(flat(33)) === JSON.stringify(flat(33)));
}

if (failed) { console.error(`verify-marschunk: ${failed} FAILED`); process.exit(1); }
console.log('verify-marschunk: all green');
