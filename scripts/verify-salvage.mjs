// verify-salvage: the lander's manifest is finite, ordered, and honest —
// and everything it yields is carriable and buildable.

import {
  LANDER_STOCK, createLander, remaining, remainingTotal, available,
  unboltSeconds, takeOne, takenCount,
} from '../src/salvage.js';
import { ITEMS, SUIT_CAPACITY } from '../src/inventory.js';
import { PART_TYPES } from '../src/build.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. every stocked item exists in the catalogue; everything fits the suit
//    EXCEPT the airlock ring — deliberately rover-only cargo (the one
//    irreplaceable part demands the haul: bring the rover alongside)
{
  let ok = true;
  const tooHeavy = [];
  for (const { id, count, seconds } of LANDER_STOCK) {
    if (!ITEMS[id] || count < 1 || !(seconds > 0)) ok = false;
    if (ITEMS[id] && ITEMS[id].kg > SUIT_CAPACITY) tooHeavy.push(id);
  }
  check('stock rows whole', ok);
  check('only the ring is rover-only cargo',
    tooHeavy.length === 1 && tooHeavy[0] === 'airlock-ring', `${tooHeavy}`);
}

// 2. the stock covers a first hab: enough sealing parts for a 1-cell room
//    (six faces: 5 panels + the airlock) with seals to spare
{
  const l = createLander();
  check('panels for a room and more', remaining(l, 'alloy-panel') >= 6);
  check('exactly one airlock ring', remaining(l, 'airlock-ring') === 1);
  check('the build grammar can spend it', !!PART_TYPES.airlock && PART_TYPES.airlock.costs.some(([id]) => id === 'airlock-ring'));
}

// 3. unbolting depletes, never below zero, and the hull count tracks
{
  const l = createLander();
  const total = remainingTotal(l);
  check('takes deplete', takeOne(l, 'seal-kit') && remaining(l, 'seal-kit') === 3);
  check('total follows', remainingTotal(l) === total - 1);
  check('taken count mirrors', takenCount(l, 'seal-kit') === 1);
  for (let i = 0; i < 9; i++) takeOne(l, 'cable');
  check('empty bins refuse', remaining(l, 'cable') === 0 && takeOne(l, 'cable') === false);
  check('never negative', remaining(l, 'cable') === 0);
}

// 4. availability follows stock, in declared (Q-cycle) order
{
  const l = createLander();
  check('all types available at start', available(l).length === LANDER_STOCK.length);
  takeOne(l, 'airlock-ring');
  check('emptied types drop out', !available(l).includes('airlock-ring'));
  const order = available(l);
  const declared = LANDER_STOCK.map((r) => r.id).filter((id) => order.includes(id));
  check('Q-cycle order stable', JSON.stringify(order) === JSON.stringify(declared));
}

// 5. times are humane: nothing under 1 s or over 10
{
  check('unbolt times humane', LANDER_STOCK.every(({ id }) => {
    const s = unboltSeconds(id);
    return s >= 1 && s <= 10;
  }));
}

if (failed) { console.error(`verify-salvage: ${failed} FAILED`); process.exit(1); }
console.log('verify-salvage: all green');
