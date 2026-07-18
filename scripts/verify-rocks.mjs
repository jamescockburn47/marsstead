// verify-rocks: the scatter's contract — deterministic (invariant 4),
// bounded, geological (rocky country outnumbers clean; outcrops share a
// strike), buried-not-floating, and honest about what the boot can and
// cannot walk through.

import { CHUNK, meshGroundHeight } from '../src/marschunk.js';
import {
  ROCK_KINDS, MAX_PER_CHUNK, rockiness, rocksInChunk, collidersNear,
  clearRockCache,
} from '../src/rocks.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. determinism: same chunk, same rocks, across a cache wipe
{
  const a = JSON.stringify(rocksInChunk(3, -2));
  clearRockCache();
  const b = JSON.stringify(rocksInChunk(3, -2));
  check('scatter deterministic across cache wipe', a === b);
  check('scatter cached (shared array contract)', rocksInChunk(5, 5) === rocksInChunk(5, 5));
}

// 2. bounds: counts, kinds, positions, sizes, burial
{
  let ok = true, over = 0, floating = 0, swallowed = 0;
  for (const [cx, cz] of [[0, 0], [7, -3], [-11, 19], [40, 40], [-25, -8]]) {
    const rocks = rocksInChunk(cx, cz);
    if (rocks.length > MAX_PER_CHUNK) over++;
    for (const rk of rocks) {
      const k = ROCK_KINDS[rk.kind];
      if (!k) { ok = false; continue; }
      if (rk.x < cx * CHUNK || rk.x > (cx + 1) * CHUNK
        || rk.z < cz * CHUNK || rk.z > (cz + 1) * CHUNK) ok = false;
      if (rk.r < k.rMin - 1e-9 || rk.r > k.rMax + 1e-9) ok = false;
      if (rk.sx <= 0 || rk.sy <= 0 || rk.sz <= 0) ok = false;
      const ground = meshGroundHeight(rk.x, rk.z);
      if (rk.y > ground + 1e-9) floating++;          // must bite the ground
      if (rk.y < ground - rk.r * 0.5) swallowed++;   // must not drown in it
    }
  }
  check('counts bounded', over === 0);
  check('kinds, positions, sizes in range', ok);
  check('rocks bite the ground, never float', floating === 0, `${floating}`);
  check('rocks never swallowed', swallowed === 0, `${swallowed}`);
}

// 3. rockiness is a bounded field
{
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const v = rockiness(i * 37.3 - 3000, i * 53.7 - 4000);
    if (!(v >= 0 && v <= 1)) ok = false;
  }
  check('rockiness bounded [0,1]', ok);
}

// 4. geology: rocky country carries more rocks than clean country
{
  let rockyAt = null, cleanAt = null;
  for (let cx = -60; cx <= 60 && (!rockyAt || !cleanAt); cx += 3) {
    for (let cz = -60; cz <= 60 && (!rockyAt || !cleanAt); cz += 3) {
      const r = rockiness((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK);
      if (r > 0.6 && !rockyAt) rockyAt = [cx, cz];
      if (r < 0.12 && !cleanAt) cleanAt = [cx, cz];
    }
  }
  check('both rocky and clean country exist', !!rockyAt && !!cleanAt,
    `rocky=${rockyAt} clean=${cleanAt}`);
  if (rockyAt && cleanAt) {
    const count = ([cx, cz]) => rocksInChunk(cx, cz).length;
    check('rocky country outnumbers clean', count(rockyAt) > count(cleanAt),
      `${count(rockyAt)} vs ${count(cleanAt)}`);
  }
}

// 5. outcrops: slabs in a chunk share one strike (bedding, not dice)
{
  let slabChunk = null;
  outer: for (let cx = -40; cx <= 40; cx += 1) {
    for (let cz = -40; cz <= 40; cz += 1) {
      if (rocksInChunk(cx, cz).filter((r) => r.kind === 'slab').length >= 3) {
        slabChunk = [cx, cz]; break outer;
      }
    }
  }
  check('an outcrop exists somewhere', !!slabChunk, 'no slab cluster in ±40 chunks');
  if (slabChunk) {
    const rots = rocksInChunk(...slabChunk)
      .filter((r) => r.kind === 'slab').map((r) => r.rot);
    const spread = Math.max(...rots) - Math.min(...rots);
    check('slabs share the strike', spread < 0.7, `spread=${spread.toFixed(2)}`);
    const tilts = rocksInChunk(...slabChunk)
      .filter((r) => r.kind === 'slab').map((r) => r.tilt);
    check('slabs lean together', tilts.every((t) => t > 0.1 && t < 0.5));
  }
}

// 6. colliders: the boot pushes off boulders, never pebbles
{
  let boulder = null;
  outer: for (let cx = -40; cx <= 40; cx += 1) {
    for (let cz = -40; cz <= 40; cz += 1) {
      boulder = rocksInChunk(cx, cz).find((r) => r.kind === 'boulder');
      if (boulder) break outer;
    }
  }
  check('a boulder exists somewhere', !!boulder);
  if (boulder) {
    const near = collidersNear(boulder.x, boulder.z);
    check('collidersNear finds the boulder', near.some((c) =>
      Math.hypot(c.x - boulder.x, c.z - boulder.z) < 0.01 && c.r > 0));
    check('colliders are all big kinds', near.every((c) => c.r >= 0.4),
      near.map((c) => c.r.toFixed(2)).join(','));
  }
  check('pebbles never collide', ROCK_KINDS.pebble.collides === false
    && ROCK_KINDS.rock.collides === false);
}

if (failed) { console.error(`verify-rocks: ${failed} FAILED`); process.exit(1); }
console.log('verify-rocks: all green');
