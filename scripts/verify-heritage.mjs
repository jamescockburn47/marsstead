// verify-heritage: the old machines are REAL — right places, right kit,
// honest salvage arithmetic, and the travel tiers the design promises
// (a walk, a buggy day, an expedition, a far flight).

import {
  HERITAGE, heritageXZ, remainingAt, isStripped, recordTake,
  serializeHeritage, deserializeHeritage,
} from '../src/heritage.js';
import { ITEMS } from '../src/inventory.js';
import { latLonToWorld, HOME } from '../src/mars.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the record is real: sites, places, kit
{
  check('a proper graveyard', HERITAGE.length >= 10, `${HERITAGE.length}`);
  const byId = Object.fromEntries(HERITAGE.map((s) => [s.id, s]));
  // the survey's own coordinates, spot-checked
  check('Perseverance rests in Jezero', Math.abs(byId.perseverance.lat - 18.44) < 0.1
    && Math.abs(byId.perseverance.lonE - 77.45) < 0.1);
  check('Viking 1 rests in Chryse', Math.abs(byId.viking1.lat - 22.5) < 0.5
    && Math.abs(byId.viking1.lonE - 312) < 0.5);
  check('Phoenix rests in the far north', byId.phoenix.lat > 65);
  check('Mars 3 rests in the south', byId.mars3.lat < -40);
  // every manifest speaks the game's own item language
  check('every manifest is real kit', HERITAGE.every((s) => s.salvage.length >= 2
    && s.salvage.every(([id, n]) => ITEMS[id] && n > 0)));
  check('every site tells its story', HERITAGE.every((s) => s.story.length > 60
    && s.story.length < 420 && s.place.length > 3 && s.year > 1960 && s.year < 2030));
  check('kinds are drawable', HERITAGE.every((s) => ['lander', 'rover', 'crash'].includes(s.kind)));
}

// 2. the travel tiers: a walk, a buggy day, and far country
{
  const home = latLonToWorld(HOME.lat, HOME.lon);
  const dist = (s) => { const p = heritageXZ(s); return Math.hypot(p.x - home.x, p.z - home.z); };
  const byId = Object.fromEntries(HERITAGE.map((s) => [s.id, s]));
  check('Perseverance is a walk', dist(byId.perseverance) < 400, `${Math.round(dist(byId.perseverance))} m`);
  check('Beagle 2 is a buggy day', dist(byId.beagle2) > 2000 && dist(byId.beagle2) < 8000,
    `${Math.round(dist(byId.beagle2))} m`);
  check('Curiosity is an expedition', dist(byId.curiosity) > 12000, `${Math.round(dist(byId.curiosity))} m`);
  check('Viking country is a far flight', dist(byId.viking1) > 25000, `${Math.round(dist(byId.viking1))} m`);
}

// 3. the salvage arithmetic: partial hauls, honest remainders, one truth
{
  const site = HERITAGE.find((s) => s.id === 'viking1');
  let taken = {};
  check('a fresh site holds its whole manifest',
    remainingAt(site, taken).length === site.salvage.length && !isStripped(site, taken));
  taken = recordTake(site, taken, 'electronics', 1);
  const rem = Object.fromEntries(remainingAt(site, taken));
  check('a partial haul leaves the remainder', rem.electronics === 1);
  taken = recordTake(site, taken, 'electronics', 1);
  check('the bin empties when its count is gone',
    !Object.fromEntries(remainingAt(site, taken)).electronics);
  for (const [id, n] of site.salvage) taken = recordTake(site, taken, id, n);
  check('a stripped site is stripped', isStripped(site, taken));
}

// 4. the save: additive, laundered, over-claims clamped
{
  const site = HERITAGE[0];
  let taken = recordTake(site, {}, site.salvage[0][0], 1);
  const back = deserializeHeritage(serializeHeritage(taken));
  check('hauls ride the save', back[site.id][site.salvage[0][0]] === 1);
  const dirty = deserializeHeritage({
    [site.id]: { [site.salvage[0][0]]: 999, 'stolen-gold': 4 },
    'fake-site': { electronics: 1 },
    junk: 'nonsense',
  });
  check('over-claims clamp to the manifest',
    dirty[site.id][site.salvage[0][0]] === site.salvage[0][1]);
  check('unknown sites and items launder away',
    !dirty['fake-site'] && !dirty[site.id]['stolen-gold']);
  check('nothing wakes clean', Object.keys(deserializeHeritage(null)).length === 0);
}

// 5. the recycling ethos, mechanical: wings to raise power, logs that
//    tie the wrecks into the listening story — never a plot word
{
  const wings = HERITAGE.filter((s) => s.salvage.some(([id]) => id === 'solar-wing'));
  check('the sun can be salvaged', wings.length >= 4, `${wings.length} sites carry wings`);
  check('a wing IS an array (the alt cost stands)', (async () => true)() && (await import('../src/machines.js'))
    .payableCosts('solar-array', (id) => (id === 'solar-wing' ? 1 : 0))?.[0][0] === 'solar-wing');
  check('panels still build arrays the long way', (await import('../src/machines.js'))
    .payableCosts('solar-array', (id) => (id === 'steel-panel' ? 2 : 0))?.[0][0] === 'steel-panel');
  const logs = HERITAGE.filter((s) => s.record);
  check('some machines were listening', logs.length >= 3 && logs.length <= 6, `${logs.length}`);
  const PLOT = /\b(pattern|seed|betray\w*|weaver\w*|replicat\w*|halcyon)\b/i;
  const MENACE = /\b(kill|die|dead|blood|hate|stupid|useless|abandon)\b/i;
  check('the logs stay clean and chunk-sized', logs.every((s) => s.record.length > 80
    && s.record.length < 420 && !PLOT.test(s.record) && !MENACE.test(s.record)));
}

if (failed) { console.error(`verify-heritage: ${failed} FAILED`); process.exit(1); }
console.log('verify-heritage: all green');
