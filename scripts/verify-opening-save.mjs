import assert from 'node:assert/strict';
import { snapshotSave, acceptSave } from '../src/save.js';
import { createBurrow, serialize, deserialize, tick, cancelPlan, plan, digPrice } from '../src/burrow.js';
import { createPower, serializePower, deserializePower, spend } from '../src/power.js';
import { createLander, takeOne } from '../src/salvage.js';
import { seedStarterHome, OPENING_EXPANSION } from '../src/opening.js';
import { MACHINE_TYPES } from '../src/machines.js';
import { machineRefundCosts } from '../src/worksite.js';

const fresh = () => ({ burrow: createBurrow(), lander: createLander(), power: createPower(), machines: [],
  crownPos: { x: -4, z: -16 }, opening: null });
// Match the runtime boundary: containers become flat source records before
// snapshotSave; applySave reconstructs their models after acceptSave.
function encode(game) {
  return snapshotSave({ simMillis: 1770000000000, pos: { x: 0, z: 0 }, heading: .3,
    buggy: { x: 14, z: 6, heading: -.8 }, suit: {}, rover: {}, lander: game.lander.stock,
    stead: [], exploration: [], saidFirsts: new Set(),
    rig: { x: -16, z: -1, heading: .6, deployed: false, depositId: null, hopper: {} },
    prospected: new Set(), fab: { queue: [], t: 0, out: {} },
    machines: game.machines, opening: game.opening,
    burrow: serialize(game.burrow), power: serializePower(game.power) });
}
function restore(raw) {
  const saved = acceptSave(JSON.parse(JSON.stringify(raw)));
  assert.ok(saved, 'the saved game remains loadable');
  return { ...fresh(), opening: saved.opening, machines: saved.machines,
    lander: { stock: saved.lander }, burrow: deserialize(saved.burrow), power: deserializePower(saved.power) };
}
const roundTrip = game => restore(encode(game));
const stateOf = game => JSON.stringify({ opening: game.opening, machines: game.machines,
  lander: game.lander, burrow: serialize(game.burrow), power: game.power });

const game = fresh();
assert.ok(seedStarterHome(game));
Object.assign(game.opening, { visitedHome: true, followed: true, worked: true, fleetMode: 'work' });
for (const fleetMode of ['park', 'follow', 'work']) {
  game.opening.fleetMode = fleetMode;
  const saved = encode(game), restored = restore(saved);
  assert.deepEqual(saved.opening, game.opening, 'snapshot retains opening progress and chosen fleet mode');
  assert.deepEqual(restored.opening, game.opening, 'accept/restore retains opening progress and chosen fleet mode');
  assert.deepEqual(restored.lander.stock, game.lander.stock, 'consumed ring remains consumed');
  assert.deepEqual(restored.machines, game.machines, 'supplied battery is restored, not recreated');
  assert.deepEqual(restored.burrow.cells.get(OPENING_EXPANSION),
    game.burrow.cells.get(OPENING_EXPANSION), 'prepaid, unstarted expansion round-trips');
}
for (const version of [undefined, null, { version: 2 }]) {
  const raw = encode(game);
  if (version === undefined) delete raw.opening; else raw.opening = version;
  const restored = restore(raw);
  assert.equal(restored.opening, null, 'missing or unsupported opening stays legacy');
  assert.equal(encode(restored).opening, null, 'subsequent saving does not opt a legacy game into the opening');
}
const restored = roundTrip(game), beforeSeed = stateOf(restored);
assert.equal(seedStarterHome(restored), false);
assert.equal(stateOf(restored), beforeSeed, 'reload cannot grant rooms, battery, charge or inventory twice');
assert.ok(takeOne(restored.lander, 'alloy-panel'));
restored.power.charge = 3.5;
restored.machines = []; // Dismantled supplied equipment stays dismantled after reload.
const changed = roundTrip(restored), beforeRetry = stateOf(changed);
assert.equal(seedStarterHome(changed), false);
assert.equal(stateOf(changed), beforeRetry, 'spent starter resources do not regenerate after reload');
assert.equal(changed.machines.length, 0);
assert.equal(changed.power.charge, 3.5);

const prepaid = roundTrip(game), initialCharge = prepaid.power.charge;
let bills = 0;
tick(prepaid.burrow, .25, 3, cost => { bills++; return spend(prepaid.power, cost); });
assert.equal(bills, 0, 'prepaid zero-progress expansion does not charge on first post-load work');
assert.equal(prepaid.power.charge, initialCharge);
const resumed = roundTrip(prepaid);
tick(resumed.burrow, .25, 3, () => { bills++; return false; });
assert.equal(bills, 0, 'partially worked prepaid expansion remains paid after another reload');

const oldRaw = encode(game);
delete oldRaw.opening; delete oldRaw.burrow.funded;
const legacy = restore(oldRaw), expected = digPrice(legacy.burrow, 'corridor'), legacyCharge = legacy.power.charge;
assert.equal(legacy.burrow.cells.get(OPENING_EXPANSION).funded, false, 'legacy zero-progress cells are not gifted funding');
tick(legacy.burrow, .1, 3, cost => { bills++; return spend(legacy.power, cost); });
assert.equal(bills, 1, 'legacy zero-progress cell pays exactly once when work begins');
assert.equal(legacy.power.charge, legacyCharge - expected);

const replanned = roundTrip(game);
assert.ok(cancelPlan(replanned.burrow, 1, 2));
assert.ok(plan(replanned.burrow, 'corridor', 1, 2));
assert.ok(!encode(replanned).burrow.funded.includes(OPENING_EXPANSION), 'cancel/replan clears the paid entitlement');
const reloadedPlan = roundTrip(replanned), planCharge = reloadedPlan.power.charge;
let planBills = 0;
tick(reloadedPlan.burrow, .1, 3, cost => { planBills++; return spend(reloadedPlan.power, cost); });
assert.equal(planBills, 1, 'a newly planned replacement must pay after reload');
assert.equal(reloadedPlan.power.charge, planCharge - digPrice(replanned.burrow, 'corridor'));

// Serialization rounds progress. Paid work smaller than the stored precision
// must retain its payment even when its encoded progress becomes zero.
const tiny = roundTrip(game);
tick(tiny.burrow, .0001, 3, () => { throw new Error('prepaid work unexpectedly billed'); });
assert.ok(tiny.burrow.cells.get(OPENING_EXPANSION).dug > 0);
const tinyRaw = encode(tiny);
assert.equal(tinyRaw.burrow.cells.find(([key]) => key === OPENING_EXPANSION)[2], 0);
const tinyRestored = restore(tinyRaw);
let tinyBills = 0;
tick(tinyRestored.burrow, .1, 3, () => { tinyBills++; return true; });
assert.equal(tinyBills, 0, 'rounding a paid progress sample to zero cannot bill it again');

const battery = game.machines[0], savedBattery = roundTrip(game).machines[0];
assert.deepEqual(battery.paidCosts, MACHINE_TYPES.battery.costs);
assert.deepEqual(savedBattery.paidCosts, battery.paidCosts, 'battery retains normal supplied-component provenance');
assert.deepEqual(machineRefundCosts(savedBattery), machineRefundCosts(battery), 'reload cannot change the physical dismantling return');
console.log('verify-opening-save: opening/legacy round trips, no regrant, prepaid and rounded funding, cancel/replan and battery provenance pass');
