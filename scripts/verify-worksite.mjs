import assert from 'node:assert/strict';
import { createStore, add, massOf, SUIT_CAPACITY, ROVER_CAPACITY } from '../src/inventory.js';
import { createMachine, MACHINE_TYPES, machineFeed, machineTick } from '../src/machines.js';
import { poolCount, missingCosts, payCosts, depositCosts, refundMachine } from '../src/worksite.js';
import { createPower, tickPower, spend, DIG_KWH } from '../src/power.js';
import { createBurrow, plan, tick, handsBusy, digPrice, serialize, deserialize,
  installRing, isBedworthy } from '../src/burrow.js';

// Real carry constraints: two panels never fit the suit; a nearby rover
// supplies the missing material, and duplicate store references add nothing.
const suit = createStore(SUIT_CAPACITY), rover = createStore(ROVER_CAPACITY);
assert.equal(add(suit, 'steel-panel', 2), 1);
add(rover, 'steel-panel', 1);
const costs = MACHINE_TYPES.smelter.costs;
assert.deepEqual(missingCosts([suit], costs), [['steel-panel', 1]]);
assert.equal(poolCount([suit, suit], 'steel-panel'), 1);
const p = { charge: 6 };
const before = JSON.stringify([suit, rover, p]);
assert.equal(payCosts([suit], costs, p, 6), null);
assert.equal(JSON.stringify([suit, rover, p]), before);
assert.equal(payCosts([suit, rover], costs, p, 7), null);
assert.equal(JSON.stringify([suit, rover, p]), before);
const paid = payCosts([suit, rover, suit], costs, p, 6);
assert.deepEqual(paid, costs);
assert.equal(p.charge, 0);
assert.equal(poolCount([suit, rover], 'steel-panel'), 0);

// Duplicate costs are summed before checking: no partial debit or overdraw.
add(suit, 'electronics', 1);
const single = JSON.stringify(suit);
assert.equal(payCosts([suit], [['electronics', 1], ['electronics', 1]]), null);
assert.equal(JSON.stringify(suit), single);
assert.equal(payCosts([suit], [['electronics', -1]]), null);

// New alternative payments survive exact refunds instead of turning a
// historical solar wing into manufactured steel.
const wingStore = createStore(35);
add(wingStore, 'solar-wing', 1);
const wingPaid = payCosts([wingStore], MACHINE_TYPES['solar-array'].altCosts);
const array = createMachine('solar-array', 0, 0, 0, wingPaid);
assert(refundMachine(array, [wingStore]));
assert.deepEqual(wingStore.slots, { 'solar-wing': 1 });
assert(refundMachine(array, [wingStore]));
assert.deepEqual(wingStore.slots, { 'solar-wing': 1 });

// Busy deconstruction returns the paid materials, queued raw and every
// finished output; insufficient capacity changes neither inventory nor machine.
const smelter = createMachine('smelter', 0, 0, 0, paid);
machineFeed(smelter, 'iron-ore', 2);
machineTick(smelter, 12);
assert.deepEqual(smelter.out, { 'steel-panel': 1 });
const tooSmall = createStore(35);
const busyBefore = JSON.stringify([smelter, tooSmall]);
assert.equal(refundMachine(smelter, [tooSmall]), false);
assert.equal(JSON.stringify([smelter, tooSmall]), busyBefore);
const depot = createStore(420);
assert(refundMachine(smelter, [tooSmall, depot]));
assert.equal(poolCount([tooSmall, depot], 'steel-panel'), 3);
assert.equal(poolCount([tooSmall, depot], 'iron-ore'), 1);
assert.equal(smelter.queue.length, 0);
assert.deepEqual(smelter.out, {});
assert(massOf(tooSmall) <= tooSmall.capacity && massOf(depot) <= depot.capacity);
const fullBefore = JSON.stringify(wingStore);
assert.equal(depositCosts([wingStore], [['iron-ore', 1]]), false);
assert.equal(JSON.stringify(wingStore), fullBefore);

// Every machine's standard recipe can be built from a real rover load;
// the suit cap stays intact throughout, rather than silently being increased.
for (const [type, def] of Object.entries(MACHINE_TYPES)) {
  const deck = createStore(ROVER_CAPACITY);
  for (const [id, n] of def.costs) assert.equal(add(deck, id, n), n);
  assert(payCosts([createStore(SUIT_CAPACITY), deck], def.costs, { charge: 6 }, 6), type);
  assert.deepEqual(deck.slots, {});
}

// Probe the same ledger->dig ordering as main in real-second steps. No
// arrays, fabricated free power, harvest, clock skip or rigged inventory.
// Fit the ring when the shaft finishes, billing all dug cells exactly as
// main does. The resulting room really is pressurised and sleepable.
const burrow = createBurrow(), power = createPower();
const dt = 0.05, finished = [];
plan(burrow, 'shaft', 0, 1);
for (let t = 0; t < 900; t += dt) {
  const grid = tickPower(power, dt * 40 / 3600, 0, 0, 25, 0.3,
    { drones: handsBusy(burrow) ? 3 : 0, cooking: {},
      warrenRooms: burrow.ringInstalled ? [...burrow.cells.values()].filter((c) => c.dug >= 1).length : 0 });
  for (const event of tick(burrow, dt, grid.shed.includes('drone') ? 0 : 3,
    (cost) => spend(power, cost))) {
    if (event.type !== 'dug') continue;
    finished.push({ piece: event.piece, seconds: +t.toFixed(1) });
    if (event.piece === 'shaft') { installRing(burrow); plan(burrow, 'corridor', 1, 1); }
    if (event.piece === 'corridor') plan(burrow, 'bunk', 2, 1);
  }
  if (burrow.cells.get('2,1')?.dug >= 1) break;
}
assert.equal(finished.length, 3);
assert(isBedworthy(burrow));
assert(finished[1].seconds < 300, 'a tangible connected home before five minutes');
assert(finished[2].seconds >= 360 && finished[2].seconds <= 600, 'first bunk at six to ten minutes');
assert.equal(digPrice(burrow, 'corridor'), DIG_KWH.corridor);
assert.equal(digPrice(burrow, 'bunk'), DIG_KWH.bunk);
const restored = deserialize(serialize(burrow));
assert.equal(digPrice(restored, 'bunk'), DIG_KWH.bunk, 'reload does not restore the starter saving');
assert.equal(digPrice(restored, 'garden'), DIG_KWH.garden);
console.log('verify-worksite: transactions, refunds and first-home pacing green', finished);
