// verify-inventory: mass is the law — caps enforced, sums exact,
// transfers bounded by both supply and capacity.

import {
  ITEMS, SUIT_CAPACITY, ROVER_CAPACITY,
  createStore, massOf, canAdd, add, remove, count, transfer, loadLabel,
} from '../src/inventory.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the catalogue is whole: names, positive masses, known tiers
{
  const tiers = new Set(['salvage', 'bulk', 'mined', 'refined']);
  let ok = true;
  for (const item of Object.values(ITEMS)) {
    if (!item.name || !(item.kg > 0) || !tiers.has(item.tier)) ok = false;
  }
  check('catalogue whole', ok);
}

// 2. the suit carries about one panel — the logistics premise itself
{
  check('suit fits one alloy panel', ITEMS['alloy-panel'].kg <= SUIT_CAPACITY);
  check('suit cannot fit two', ITEMS['alloy-panel'].kg * 2 > SUIT_CAPACITY);
  check('rover deck carries a build', ROVER_CAPACITY >= ITEMS['alloy-panel'].kg * 12);
}

// 3. caps enforced exactly
{
  const suit = createStore(SUIT_CAPACITY);
  check('adds within cap', add(suit, 'seal-kit', 3) === 3);
  check('mass sums', Math.abs(massOf(suit) - 12) < 1e-9);
  const added = add(suit, 'alloy-panel', 2);
  check('cap stops the second panel', added === 0, `added=${added}`); // 12+28=40 > 35
  add(suit, 'cable', 1);
  check('partial fills fill partially', count(suit, 'cable') === 1);
}

// 4. remove and transfer bounded by supply and capacity
{
  const rover = createStore(ROVER_CAPACITY);
  const suit = createStore(SUIT_CAPACITY);
  add(rover, 'alloy-panel', 8);
  check('remove bounded by supply', remove(rover, 'alloy-panel', 99) === 8);
  add(rover, 'alloy-panel', 8);
  const moved = transfer(rover, suit, 'alloy-panel', 5);
  check('transfer bounded by capacity', moved === 1, `moved=${moved}`);
  check('transfer conserves mass', count(rover, 'alloy-panel') === 7 && count(suit, 'alloy-panel') === 1);
}

// 5. the label reads like a gauge
{
  const s = createStore(420);
  add(s, 'iron-ore', 3);
  check('load label', loadLabel(s) === '90 / 420 kg', loadLabel(s));
}

if (failed) { console.error(`verify-inventory: ${failed} FAILED`); process.exit(1); }
console.log('verify-inventory: all green');
