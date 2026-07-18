// verify-tracks: the permanence contract — marks land at honest spacing,
// boots alternate, the cap holds, and a save round-trip puts every stamp
// back where it fell (within the decimetre the encoding promises).

import {
  TRACK_CAP, BOOT_SPACING, WHEEL_SPACING,
  createTrail, appendTrack, serializeTrail, deserializeTrail,
} from '../src/tracks.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. spacing: a shuffle of tiny steps lands ONE mark per spacing-length
{
  const t = createTrail();
  for (let d = 0; d <= 3; d += 0.05) appendTrack(t, d, 0, 0, 'boot');
  const expected = Math.floor(3 / BOOT_SPACING) + 1;
  check('boot spacing honest', Math.abs(t.pts.length - expected) <= 1,
    `${t.pts.length} vs ~${expected}`);
  const w = createTrail();
  for (let d = 0; d <= 6; d += 0.1) appendTrack(w, 0, d, 1.2, 'wheel');
  const expW = Math.floor(6 / WHEEL_SPACING) + 1;
  check('wheel spacing honest', Math.abs(w.pts.length - expW) <= 1,
    `${w.pts.length} vs ~${expW}`);
}

// 2. boots alternate sides; wheels carry none
{
  const t = createTrail();
  for (let d = 0; d <= 8; d += 0.8) appendTrack(t, d, 0, 0, 'boot');
  let alt = true;
  for (let i = 1; i < t.pts.length; i++) if (t.pts[i].s === t.pts[i - 1].s) alt = false;
  check('boots alternate left/right', alt && t.pts.every((p) => p.s === 1 || p.s === -1));
  const w = createTrail();
  appendTrack(w, 0, 0, 0, 'wheel');
  check('wheels carry no side', w.pts[0].s === 0);
}

// 3. kinds keep independent spacing chains
{
  const t = createTrail();
  appendTrack(t, 0, 0, 0, 'boot');
  check('a wheel mark lands beside a fresh bootprint',
    appendTrack(t, 0.1, 0, 0, 'wheel') === true);
}

// 4. the cap holds, oldest first out, order preserved
{
  const t = createTrail();
  for (let i = 0; i < TRACK_CAP + 500; i++) appendTrack(t, i * BOOT_SPACING, 0, 0, 'boot');
  check('cap holds', t.pts.length === TRACK_CAP);
  check('oldest marks fade first', t.pts[0].x > 0);
  let ordered = true;
  for (let i = 1; i < t.pts.length; i++) if (t.pts[i].x <= t.pts[i - 1].x) ordered = false;
  check('the trail stays retraceable (ordered)', ordered);
}

// 5. save round-trip: every stamp back where it fell
{
  const t = createTrail();
  for (let i = 0; i < 60; i++) {
    appendTrack(t, Math.sin(i) * 40, i * 1.7 - 30, i * 0.21 - 3, i % 3 ? 'boot' : 'wheel');
  }
  const back = deserializeTrail(serializeTrail(t));
  let ok = back.pts.length === t.pts.length;
  if (ok) {
    for (let i = 0; i < t.pts.length; i++) {
      const a = t.pts[i], b = back.pts[i];
      if (Math.abs(a.x - b.x) > 0.051 || Math.abs(a.z - b.z) > 0.051
        || Math.abs(a.hd - b.hd) > 0.006 || a.k !== b.k || a.s !== b.s) ok = false;
    }
  }
  check('serialize round-trip exact to the decimetre', ok,
    `${t.pts.length} vs ${back.pts.length}`);
  // side parity survives the trip: the next boot continues the walk
  const t2 = createTrail();
  for (let i = 0; i < 5; i++) appendTrack(t2, i, 0, 0, 'boot');
  const b2 = deserializeTrail(serializeTrail(t2));
  appendTrack(b2, 6, 0, 0, 'boot');
  check('gait parity survives the save',
    b2.pts[b2.pts.length - 1].s === -b2.pts[b2.pts.length - 2].s);
}

// 6. garbage in, empty trail out — never a crash
{
  check('rejects non-finite input', appendTrack(createTrail(), NaN, 0, 0, 'boot') === false);
  check('deserialize null', deserializeTrail(null).pts.length === 0);
  check('deserialize garbage quads', deserializeTrail([1, NaN, 3, 'x', 5]).pts.length === 0);
  const big = deserializeTrail(new Array((TRACK_CAP + 99) * 4).fill(1));
  check('deserialize respects the cap', big.pts.length <= TRACK_CAP);
}

if (failed) { console.error(`verify-tracks: ${failed} FAILED`); process.exit(1); }
console.log('verify-tracks: all green');
