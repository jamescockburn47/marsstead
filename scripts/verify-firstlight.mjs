import assert from 'node:assert/strict';
import { acceptFieldwork, fieldAligned, turnDial, collectFieldwork, firstLightGoal, FIELD_TARGETS } from '../src/fieldwork.js';
import { createStore, add, massOf } from '../src/inventory.js';
import { createBurrow, plan } from '../src/burrow.js';
import { acceptSave } from '../src/save.js';
import { suitStep, freezeSimulation } from '../src/survival.js';
import { missionClock } from '../src/marstime.js';

const state = acceptFieldwork(null), suit = createStore(35), rover = createStore(420);
assert.match(missionClock(100000000, 100000000, 77), /^Sol 1 · \d\d:\d\d local$/);
assert.match(missionClock(100000000 + 88775244, 100000000, 77), /^Sol 2 /);
assert.equal(collectFieldwork(state, [suit]), false, 'unaligned instrument never pays');
assert.equal(turnDial(state, 3, 1), false);
for (let i = 0; i < 3; i++) for (let n = 0; n < FIELD_TARGETS[i]; n++) turnDial(state, i, 1);
assert.ok(fieldAligned(state));
add(suit, 'iron-ore', 1);
assert.equal(collectFieldwork(state, [suit]), false, 'full suit preserves unclaimed reward');
assert.equal(state.claimed, false);
assert.equal(collectFieldwork(state, [suit, rover]), true);
assert.equal(rover.slots['solar-wing'], 1);
assert.ok(massOf(suit) <= 35 && massOf(rover) <= 420);
assert.equal(collectFieldwork(acceptFieldwork(state), [suit, rover]), false, 'reload cannot award again');
assert.equal(turnDial(state, 0, 1), false, 'recorded readings stay fixed');
assert.deepEqual(acceptFieldwork({ dials: [Infinity, -1, 900], complete: true }),
  { dials: [0, 0, 0], claimed: false, complete: false });
const legacy = { version: 1, simMillis: 100, pos: { x: 0, z: 0 } };
assert.equal(acceptSave(legacy).expedition.claimed, false);
const saved = acceptSave({ ...legacy, expedition: { ...state, complete: true },
  settings: { textScale: 1.3, survival: 'standard' }, machines: [{ type: 'solar-array', x: 0, z: 0,
    queue: [], out: {}, paidCosts: [['solar-wing', 1]] }] });
assert.equal(saved.expedition.complete, true);
assert.equal(saved.settings.textScale, 1.3);
assert.deepEqual(saved.machines[0].paidCosts, [['solar-wing', 1]], 'exact paid recipe survives save reader');
assert.deepEqual(acceptSave({ ...legacy, machines: [{ type: 'smelter', x: 0, z: 0,
  paidCosts: [['electronics', 999]], out: {}, queue: [] }] }).machines[0].paidCosts, [['steel-panel', 2]]);
const g = { burrow: createBurrow(), expedition: acceptFieldwork(null), crownPos: { x: -4, z: -16 } };
assert.equal(firstLightGoal(g).id, 'plan');
plan(g.burrow, 'shaft', 0, 1);
assert.equal(firstLightGoal(g).id, 'survey');
g.expedition.claimed = true;
assert.equal(firstLightGoal(g).id, 'power');
g.expedition.complete = true;
assert.equal(firstLightGoal(g).id, 'ring');
g.burrow.ringInstalled = true;
assert.equal(firstLightGoal(g).id, 'bunk');
g.burrow.cells.set('2,1', { piece: 'bunk', dug: 1 });
assert.equal(firstLightGoal(g).id, 'under');
g.underworld = { completed: ['relay', 'brood', 'lattice'], returned: true };
assert.equal(firstLightGoal(g).id, 'next');
const cold = suitStep({ air: 1, warm: 1, temp: -84, mode: 'standard' }, 0.1);
assert.ok(cold.warm < 1 && cold.air < 1, 'cold and air budgets have real consequences');
assert.equal(suitStep({ air: 0, warm: 1, temp: -12 }, 0.1).rescue, true);
assert.ok(suitStep({ air: 0.2, warm: 0.2, temp: -84, sheltered: true }, 0.1).air > 0.2);
assert.ok(suitStep({ air: 1, warm: 1, temp: -84, mode: 'gentle' }, 0.1).air > cold.air);
for (const field of ['orders', 'map', 'journalUI', 'fieldUI']) assert.equal(freezeSimulation({ [field]: { visible: true } }), true);
assert.equal(freezeSimulation({ paused: true }), true);
assert.equal(freezeSimulation({ attract: true, paused: true }), false);
assert.equal(freezeSimulation({ burrowUI: { visible: true } }), false, 'drones work while the home is being viewed');
console.log('verify-firstlight: reward conservation, save compatibility, action guidance and survival contracts pass');
