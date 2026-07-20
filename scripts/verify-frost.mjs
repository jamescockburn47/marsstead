// verify-frost: the frost model's contract — seasonal caps that ride Ls,
// morning surface frost that blazes at dawn and burns off by mid-morning,
// bounded and deterministic everywhere. The glint centrepiece reads THIS.

import { frostCover, frostLineLat } from '../src/frost.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the caps: high latitudes carry frost in their winter, thin in summer
{
  check('north cap in northern winter', frostCover(75, 300, 0.5) > 0.8);
  check('north cap thins in northern summer',
    frostCover(75, 90, 0.5) < frostCover(75, 300, 0.5));
  check('south cap mirrors in southern winter', frostCover(-75, 90, 0.5) > 0.8);
  const nWinter = frostLineLat(300, true), nSummer = frostLineLat(90, true);
  check('the frost line advances in winter', nWinter < nSummer,
    `${nWinter} vs ${nSummer}`);
  check('the line stays on the planet',
    [nWinter, nSummer, frostLineLat(0, false)].every((l) => Math.abs(l) <= 90));
}

// 2. the morning: the plain glitters at dawn, bare by noon (hourFrac local)
{
  const dawn = frostCover(18, 0, 0.26);
  const mid = frostCover(18, 0, 0.45);
  const noon = frostCover(18, 0, 0.5);
  check('dawn frost lies on the plain', dawn > 0.25, `${dawn.toFixed(2)}`);
  check('burned off by mid-morning', mid < dawn * 0.35, `${mid.toFixed(2)}`);
  check('gone by noon', noon < 0.03, `${noon.toFixed(2)}`);
  check('the small hours hold it', frostCover(18, 0, 0.1) > 0.1);
  // burn-off is monotonic once the sun is up
  let last = 1, mono = true;
  for (let h = 0.27; h <= 0.55; h += 0.02) {
    const c = frostCover(18, 0, h);
    if (c > last + 1e-9) mono = false;
    last = c;
  }
  check('burn-off never re-frosts', mono);
}

// 3. bounded and deterministic everywhere
{
  let sane = true;
  for (let lat = -90; lat <= 90; lat += 7) {
    for (let ls = 0; ls < 360; ls += 23) {
      for (let h = 0; h < 1; h += 0.11) {
        const c = frostCover(lat, ls, h);
        if (!Number.isFinite(c) || c < 0 || c > 1) sane = false;
        if (c !== frostCover(lat, ls, h)) sane = false;
      }
    }
  }
  check('cover is bounded 0..1 and deterministic', sane);
}

if (failed) { console.error(`verify-frost: ${failed} FAILED`); process.exit(1); }
console.log('verify-frost: all green');
