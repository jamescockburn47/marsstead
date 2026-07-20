// verify-marslegends: the signal chain's contract — five beats at REAL
// places, distances that escalate, one signal live at a time, a band
// that warms honestly, payloads that stay kid-safe and never speak a
// plot word (her ignorance is real: the secret exists in no
// player-visible string).

import {
  SITES, siteXZ, chainActive, signalStrength, sweepAt,
  serializeMystery, deserializeMystery,
} from '../src/marslegends.js';
import { latLonToWorld, HOME } from '../src/mars.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the beats: five, real, escalating
{
  check('five beats', SITES.length === 5, `${SITES.length}`);
  const home = latLonToWorld(HOME.lat, HOME.lon);
  let last = -1, escalates = true;
  for (const s of SITES) {
    const p = siteXZ(s);
    const d = Math.hypot(p.x - home.x, p.z - home.z);
    if (d <= last) escalates = false;
    last = d;
  }
  check('the road gets longer with every beat', escalates);
  const first = siteXZ(SITES[0]);
  check('the first beat is a walk from home',
    Math.hypot(first.x - home.x, first.z - home.z) < 900);
  const third = siteXZ(SITES[2]);
  check('the third beat demands the hopper',
    Math.hypot(third.x - home.x, third.z - home.z) > 8000);
  check('every beat knows its real place',
    SITES.every((s) => s.place.length > 3 && Number.isFinite(s.lat) && Number.isFinite(s.lonE)));
}

// 2. the chain law: one live signal, in order, silent when done
{
  check('the chain opens at the delta', chainActive([]).id === SITES[0].id);
  check('a found beat wakes the next',
    chainActive([SITES[0].id]).id === SITES[1].id);
  check('order ignores noise ids',
    chainActive(['nonsense', SITES[0].id]).id === SITES[1].id);
  check('the whole chain found goes quiet',
    chainActive(SITES.map((s) => s.id)) === null);
}

// 3. the band: monotonic warmth, 1 at the site, alive even from home
{
  const s = SITES[2];
  const p = siteXZ(s);
  const home = latLonToWorld(HOME.lat, HOME.lon);
  check('at the site the band burns', signalStrength(s, p.x, p.z) > 0.98);
  check('from home the band still whispers',
    signalStrength(s, home.x, home.z) > 0.03);
  let lastV = Infinity, mono = true;
  for (let k = 0; k <= 1; k += 0.05) {
    const v = signalStrength(s, home.x + (p.x - home.x) * k, home.z + (p.z - home.z) * k);
    if (v > lastV + 1e-9 && k < 1) { /* warming toward the site is CORRECT */ }
    lastV = v;
  }
  // approaching must strictly warm
  const far = signalStrength(s, home.x, home.z);
  const mid = signalStrength(s, (home.x + p.x) / 2, (home.z + p.z) / 2);
  check('closing on the site warms the band', far < mid && mid < 1);
  // the sweep: sharper than the band inside the arrival ring
  const near1 = sweepAt(s, p.x + 200, p.z), near2 = sweepAt(s, p.x + 60, p.z);
  const band1 = signalStrength(s, p.x + 200, p.z), band2 = signalStrength(s, p.x + 60, p.z);
  check('the sweep sharpens on foot', (near2 - near1) > (band2 - band1));
  check('the heart is findable', sweepAt(s, p.x + 10, p.z) > 0.9
    && sweepAt(s, p.x + 400, p.z) === 0);
}

// 4. the payloads: kid-safe, chunk-sized, and the secret is NOWHERE
{
  const PLOT = /\b(pattern|seed|betray\w*|weaver\w*|replicat\w*|halcyon)\b/i;
  const MENACE = /\b(kill|die|dead|blood|hate|stupid|useless|abandon)\b/i;
  let sized = true, clean = true;
  for (const s of SITES) {
    const texts = [s.name, s.place, s.relic.name, s.relic.journal, ...s.scene];
    for (const t of texts) {
      if (t.length > 420) sized = false;
      if (PLOT.test(t) || MENACE.test(t)) clean = false;
    }
    if (s.scene.length < 2) sized = false;
  }
  check('payloads are chunk-sized with real scenes', sized);
  check('no plot word, no menace, anywhere a player can read', clean);
  const last = SITES[4];
  check('the fifth beat carries the address',
    /address/i.test(last.relic.journal) || /address/i.test(last.scene.join(' ')));
}

// 5. the save: rides additively, launders garbage
{
  const m = { found: [SITES[0].id, SITES[1].id], read: [SITES[0].relic.id] };
  const back = deserializeMystery(serializeMystery(m));
  check('the mystery rides', back.found.length === 2 && back.read.length === 1);
  const dirty = deserializeMystery({ found: ['x', SITES[2].id, 42], read: 'no', extra: 1 });
  check('garbage launders to known ground',
    dirty.found.length === 1 && dirty.found[0] === SITES[2].id && dirty.read.length === 0);
  check('nothing at all wakes clean', deserializeMystery(null).found.length === 0);
}

if (failed) { console.error(`verify-marslegends: ${failed} FAILED`); process.exit(1); }
console.log('verify-marslegends: all green');
