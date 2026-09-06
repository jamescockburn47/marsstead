import assert from 'node:assert/strict';
import { createOpening, acceptOpening, seedStarterHome, openingGoal, recordOpeningVisit, STARTER_HOME, OPENING_EXPANSION } from '../src/opening.js';
import { createBurrow, tick, digCost, isPressurised, isBedworthy, plan, spoilFor } from '../src/burrow.js';
import { createLander, LANDER_STOCK } from '../src/salvage.js';
import { createPower, capacity, tickPower, spend, BUILD_KWH, DIG_KWH } from '../src/power.js';
import { habitatLayout, constrainHabitat } from '../src/habitat-model.js';
import { acceptFieldwork, firstLightGoal, FIELD_SITE } from '../src/fieldwork.js';
import { acceptHabitatActivities, activityAction } from '../src/habitat-activities.js';
import { MACHINE_TYPES } from '../src/machines.js';
import { acceptSave } from '../src/save.js';
import { commandCrew, activeCrewCount } from '../src/crew-control.js';

const fresh = () => ({ burrow: createBurrow(), lander: createLander(), power: createPower(), machines: [],
  crownPos: { x: -4, z: -16 }, expedition: acceptFieldwork(null), activities: acceptHabitatActivities(null) });
const snapshot = value => JSON.stringify(value, (_, v) => v instanceof Map ? [...v] : v);
assert.deepEqual(createOpening(), { version: 1, visitedHome: false, followed: false, worked: false, fleetMode: 'park' });
for (const raw of [undefined, null, {}, { version: 0 }, { version: 2 }, { version: '1' }]) {
  assert.equal(acceptOpening(raw), null, 'no retrofit for absent or unknown opening versions');
}
assert.deepEqual(acceptOpening({ version: 1, visitedHome: 1, followed: 'true', worked: true, fleetMode: 'invalid' }),
  { ...createOpening(), worked: true }, 'strict booleans and closed fleet modes');
for (const fleetMode of ['park', 'follow', 'work']) {
  const state = { ...createOpening(), visitedHome: true, followed: true, worked: true, fleetMode };
  assert.deepEqual(acceptOpening(JSON.parse(JSON.stringify(state))), state, 'opening choices survive round trip');
}
const old = fresh();
assert.equal(openingGoal(old), null);
assert.equal(firstLightGoal(old).id, 'plan', 'legacy opening remains available');
old.opening = acceptOpening({ version: 99 });
assert.equal(firstLightGoal(old).id, 'plan', 'unknown opening falls back safely');

const game = fresh(), stock = { ...game.lander.stock };
assert.equal(seedStarterHome(game), true);
assert.equal(game.burrow.cells.size, 7);
for (const [key, piece] of STARTER_HOME) assert.deepEqual(game.burrow.cells.get(key),
  { piece, dug: 1, planned: false, funded: true }, 'completed starter cell truth');
assert.deepEqual(game.burrow.queue, [OPENING_EXPANSION]);
assert.deepEqual(game.burrow.cells.get(OPENING_EXPANSION), { piece: 'corridor', dug: 0, planned: true, funded: true });
assert.deepEqual(game.burrow.spoil, { regolith: 0, ore: 0 }, 'prelanded rooms do not mint excavation spoil');
assert.ok(isPressurised(game.burrow) && isBedworthy(game.burrow), 'the fresh home is immediately warm, sealed and bedworthy');
assert.equal(game.lander.stock['airlock-ring'], stock['airlock-ring'] - 1, 'the installed ring comes off the finite manifest');
for (const { id } of LANDER_STOCK) if (id !== 'airlock-ring') assert.equal(game.lander.stock[id], stock[id]);
assert.equal(game.machines.length, 1);
assert.equal(game.machines[0].type, 'battery');
assert.deepEqual(game.machines[0].paidCosts, MACHINE_TYPES.battery.costs, 'supplied battery retains its physical component provenance');
assert.equal(game.power.charge, 12);
assert.ok(game.power.charge <= capacity(1), 'starter charge respects real bank capacity');
const savedMachine = acceptSave({ version: 1, simMillis: 100, pos: { x: 0, z: 0 }, machines: game.machines }).machines[0];
assert.deepEqual(savedMachine.paidCosts, game.machines[0].paidCosts, 'battery dismantling provenance is unchanged by reload');
const seeded = snapshot(game);
assert.equal(seedStarterHome(game), false);
assert.equal(snapshot(game), seeded, 'seeding twice cannot duplicate any gift or replace progress');
for (const edit of [g => g.burrow.cells.set('0,1', { piece: 'shaft', dug: .2 }),
  g => g.burrow.queue.push('0,1'), g => g.lander.stock['airlock-ring'] = 0,
  g => g.power.charge = NaN, g => g.burrow.ringInstalled = true]) {
  const existing = fresh(); edit(existing); const before = snapshot(existing);
  assert.equal(seedStarterHome(existing), false);
  assert.equal(snapshot(existing), before, 'refused seed is atomic and preserves existing state');
}
const layout = habitatLayout(game.burrow);
assert.equal(layout.rooms.length, 6, 'only finished cells become walkable rooms');
for (const [key, target] of [['-2,1', -16], ['2,1', 16]]) {
  assert.ok(layout.byKey.has(key));
  const position = constrainHabitat(layout, { x: 0, z: 0 }, { x: target, z: 0 }, 1);
  assert.ok(Math.abs(position.x - target) < 1e-8, 'the exact starter layout connects entry to workshop and bunk');
}
assert.equal(firstLightGoal(game).id, 'home');
assert.equal(recordOpeningVisit(game.opening), true);
assert.equal(recordOpeningVisit(game.opening), false);
assert.equal(recordOpeningVisit(null), false);
assert.equal(firstLightGoal(game).id, 'crew-follow');
assert.match(firstLightGoal(game).detail, /Call over/, 'guidance names the actual crew command');
game.opening.followed = true;
assert.equal(firstLightGoal(game).id, 'crew-work');
assert.match(firstLightGoal(game).detail, /Resume excavation/, 'guidance names the actual excavation command');
game.opening.worked = true;
assert.equal(firstLightGoal(game).id, 'crew-work', 'historical work does not mean the parked crew is cutting');
game.opening.fleetMode = 'work';
assert.equal(firstLightGoal(game).id, 'home-expansion');
const beforeGoal = snapshot(game);
for (let i = 0; i < 5; i++) openingGoal(game);
assert.equal(snapshot(game), beforeGoal, 'guidance never mutates progress or restricts another action');
const commandContext = { player: { x: 0, z: 0 }, bots: [{ x: 1, z: 0, visible: true }] };
const outOfOrder = fresh();
assert.ok(seedStarterHome(outOfOrder)); recordOpeningVisit(outOfOrder.opening);
assert.ok(commandCrew(outOfOrder.opening, 'work', commandContext));
assert.equal(firstLightGoal(outOfOrder).id, 'crew-follow');
assert.ok(commandCrew(outOfOrder.opening, 'follow', commandContext));
assert.equal(firstLightGoal(outOfOrder).id, 'crew-work', 'work then follow still requires excavation to resume');
assert.equal(firstLightGoal(outOfOrder).actionId, 'crew');
assert.ok(commandCrew(outOfOrder.opening, 'work', commandContext));
tick(outOfOrder.burrow, 1, activeCrewCount(outOfOrder.opening, 3));
const heldProgress = outOfOrder.burrow.cells.get(OPENING_EXPANSION).dug;
assert.ok(heldProgress > 0 && heldProgress < 1);
for (const mode of ['park', 'follow']) {
  assert.ok(commandCrew(outOfOrder.opening, mode, commandContext));
  assert.equal(firstLightGoal(outOfOrder).id, 'crew-work', 'holding or recalling a working crew changes the instruction');
  tick(outOfOrder.burrow, 1, activeCrewCount(outOfOrder.opening, 3));
  assert.equal(outOfOrder.burrow.cells.get(OPENING_EXPANSION).dug, heldProgress, 'guidance agrees with paused excavation');
}

// Gameplay time, rather than instant fixture completion: three commissioned
// workers finish the prepaid corridor in ten active seconds, without a bank debit.
let elapsed = 0, fundingCalls = 0;
while (game.burrow.queue.length && elapsed < 15) {
  tickPower(game.power, .1 * 40 / 3600, 0, 1, 45, .1, { drones: 3, warrenRooms: 6 });
  tick(game.burrow, .1, 3, () => { fundingCalls++; return false; });
  elapsed += .1;
}
assert.equal(game.burrow.queue.length, 0, 'first construction completes within the quick-win budget');
assert.ok(elapsed <= digCost('corridor', 2) / 3 + .11);
assert.equal(fundingCalls, 0, 'prepaid expansion does not debit the player a second time');
assert.deepEqual(game.burrow.spoil, spoilFor(1, 2), 'only the newly worked corridor yields spoil');
assert.ok(habitatLayout(game.burrow).byKey.has(OPENING_EXPANSION), 'the new passage becomes walkable from the same cell');
assert.equal(firstLightGoal(game).id, 'survey');
assert.deepEqual(firstLightGoal(game).target, FIELD_SITE);
game.expedition.claimed = true;
assert.equal(firstLightGoal(game).id, 'worker-stranded', 'recover the nearby worker before returning with the wing');
assert.ok(activityAction(game.activities, 'rescue', { nearWorker: true }).ok);
assert.equal(firstLightGoal(game).id, 'power');
assert.ok(spend(game.power, BUILD_KWH.machine), 'the starter reserve can build the recovered solar wing');
game.expedition.complete = true;
assert.equal(firstLightGoal(game).id, 'worker-carried');
for (const [action, next] of [['bench', 'bench'], ['diagnose', 'diagnosed'], ['repair', 'repaired']]) {
  assert.ok(activityAction(game.activities, action, { nearWorker: true, nearBench: true, nearHatch: true, sealed: true }).ok);
  assert.equal(firstLightGoal(game).id, 'worker-' + next, 'bench guidance follows actual worker state');
}
assert.ok(activityAction(game.activities, 'equip', { nearBench: true, sealed: true }).ok);
assert.equal(firstLightGoal(game).id, 'home-garden', 'grow home before suggesting another field trip');
assert.equal(game.activities.routeOpen, false, 'garden guidance does not require deployment');
assert.ok(plan(game.burrow, 'garden', 2, 2), 'the expansion provides a legal shallow garden socket');
for (const mode of ['park', 'follow']) {
  assert.ok(commandCrew(game.opening, mode, commandContext));
  assert.equal(firstLightGoal(game).id, 'crew-garden', 'garden guidance notices a held or following crew');
  assert.equal(firstLightGoal(game).actionId, 'crew', 'resume instruction routes to crew controls');
  assert.match(firstLightGoal(game).detail, /Resume excavation/);
}
assert.ok(commandCrew(game.opening, 'work', commandContext));
assert.equal(firstLightGoal(game).id, 'home-garden');
while (game.power.charge < DIG_KWH.garden && elapsed < 15 * 60) {
  tickPower(game.power, .1 * 40 / 3600, 1, 1, 45, .1, { drones: 0, warrenRooms: 7 });
  elapsed += .1;
}
assert.ok(game.power.charge >= DIG_KWH.garden, 'one array can fund a garden within the opening time budget');
while (game.burrow.queue.length && elapsed < 15 * 60) {
  tickPower(game.power, .1 * 40 / 3600, 1, 1, 45, .1, { drones: 3, warrenRooms: 7 });
  tick(game.burrow, .1, 3, cost => spend(game.power, cost)); elapsed += .1;
}
assert.equal(game.burrow.queue.length, 0, 'the first garden can actually be completed');
assert.equal(firstLightGoal(game).id, 'worker-crop');
game.activities.harvests = 1;
assert.equal(firstLightGoal(game).id, 'worker-equipped', 'deployment becomes an optional next expedition');
assert.ok(activityAction(game.activities, 'deploy', { nearHatch: true }).ok);
assert.equal(firstLightGoal(game).id, 'worker-deployed');
game.activities.routeOpen = true;
assert.equal(firstLightGoal(game).id, 'worker-route');
console.log(`verify-opening: fresh-only starter home, ring/battery conservation, legacy fallback, playable cells, goals and ${elapsed.toFixed(1)}s construction/power budget pass`);
