import assert from 'node:assert/strict';
import { acceptHabitatActivities as accept, activityAction as act,
  tickHabitatActivities as tick, bindActivityRooms, CROP_SECONDS, ROUTE_SECONDS } from '../src/habitat-activities.js';

const all = { sealed: true, nearWorker: true, nearBench: true, nearCrop: true, nearHatch: true,
  gardenPresent: true, paused: false };
const empty = accept();
assert.deepEqual(empty, { worker: 'stranded', routeProgress: 0, routeOpen: false,
  crop: { phase: 'empty', growth: 0 }, harvests: 0, rations: 0, benchRoom:null, cropRoom:null });
const rooms=accept();bindActivityRooms(rooms,[{key:'2,1',piece:'bay'},{key:'-2,1',piece:'garden'}]);
assert.equal(bindActivityRooms(rooms,[{key:'-4,1',piece:'bay'},{key:'-3,1',piece:'garden'},{key:'2,1',piece:'bay'},{key:'-2,1',piece:'garden'}]),false);
assert.equal(rooms.benchRoom,'2,1');assert.equal(rooms.cropRoom,'-2,1');
assert.deepEqual(accept(JSON.parse(JSON.stringify(rooms))),rooms,'assigned rooms survive reload and expansion');
for (const legacy of [null, false, 42, 'old', [], {}]) assert.deepEqual(accept(legacy), empty);
assert.deepEqual(accept({ worker: '__proto__', crop: 'bad', routeOpen: true,
  routeProgress: Infinity, growth: NaN, harvests: -12, rations: '9' }), empty);
assert.equal(accept({ worker: 'equipped', routeProgress: 12, routeOpen: true }).routeOpen, false);
assert.equal(accept({ worker: 'deployed', routeProgress: 12, routeOpen: false }).routeOpen, true);
assert.equal(accept({ crop: 'planted', growth: 60 }).crop.growth, 0);
assert.equal(accept({ crop: 'watered', growth: 60 }).crop.phase, 'ready');
assert.equal(accept({ crop: 'ready' }).crop.growth, CROP_SECONDS);
assert.equal(accept({ harvests: 2000, rations: 99 }).harvests, 999);
assert.equal(accept({ harvests: 2.8, rations: 8.9 }).rations, 8);

const worker = accept();
for (const action of ['bench', 'diagnose', 'repair', 'equip', 'deploy']) {
  assert.equal(act(worker, action, all).ok, false, `${action} cannot skip recovery`);
  assert.deepEqual(worker, empty);
}
assert.equal(act(worker, 'rescue', { ...all, nearWorker: false }).ok, false);
assert.equal(act(worker, 'rescue', { ...all, paused: true }).ok, false);
assert(act(worker, 'rescue', { nearWorker: true }).ok, 'rescue works outside without shelter');
assert.equal(act(worker, 'rescue', all).ok, false, 'cannot recover a worker twice');
for (const [action, expected] of [['bench', 'bench'], ['diagnose', 'diagnosed'],
  ['repair', 'repaired'], ['equip', 'equipped'], ['deploy', 'deployed']]) {
  const before = { ...worker };
  if (action !== 'deploy') assert.equal(act(worker, action, { ...all, sealed: false }).ok, false);
  assert.equal(act(worker, action, { ...all, nearBench: false, nearHatch: false }).ok, false);
  assert.equal(act(worker, action, { ...all, paused: true }).ok, false);
  assert.deepEqual(worker, before, 'rejected actions never change progress');
  assert(act(worker, action, all).ok);
  assert.equal(worker.worker, expected);
  assert.equal(act(worker, action, all).ok, false, `${action} is single-use`);
}
tick(worker, 100, all);
assert.equal(worker.routeProgress, .25, 'large frames never simulate offline time');
for (const dt of [-1, NaN, Infinity]) tick(worker, dt, all);
assert.equal(worker.routeProgress, .25);
tick(worker, .25, { ...all, paused: true });
assert.equal(worker.routeProgress, .25);
for (let i = 1; i < ROUTE_SECONDS * 4; i++) tick(worker, .25, all);
assert(worker.routeOpen);
assert.equal(worker.routeProgress, ROUTE_SECONDS);
assert.deepEqual(accept(JSON.parse(JSON.stringify(worker))), worker, 'route completion survives reload');
tick(worker, .25, all);
assert.equal(worker.routeProgress, ROUTE_SECONDS);

const crop = accept();
for (const action of ['water', 'harvest', 'eat']) assert.equal(act(crop, action, all).ok, false);
for (const [action, expected] of [['plant', 'planted'], ['water', 'watered']]) {
  assert.equal(act(crop, action, { ...all, nearCrop: false }).ok, false);
  assert.equal(act(crop, action, { ...all, sealed: false }).ok, false);
  assert(act(crop, action, all).ok);
  assert.equal(crop.crop.phase, expected);
  assert.equal(act(crop, action, all).ok, false);
}
for (const context of [{ ...all, sealed: false }, { ...all, gardenPresent: false }, { ...all, paused: true }]) {
  tick(crop, .25, context);
  assert.equal(crop.crop.growth, 0, 'inactive or unsuitable gardens cannot grow');
}
for (let i = 0; i < CROP_SECONDS * 4 - 1; i++) tick(crop, .25, all);
assert.equal(act(crop, 'harvest', all).ok, false);
tick(crop, .25, all);
assert.equal(crop.crop.phase, 'ready');
const resumed = accept(JSON.parse(JSON.stringify(crop)));
assert.deepEqual(resumed, crop, 'ripe crop survives reload');
assert(act(crop, 'harvest', all).ok);
assert.equal(crop.crop.phase, 'empty');
assert.equal(crop.harvests, 1);
assert.equal(crop.rations, 1);
assert.equal(act(crop, 'harvest', all).ok, false, 'harvest cannot duplicate food');
assert(act(crop, 'eat', { sealed: false }).ok, 'packed rations work on expeditions');
assert.equal(crop.rations, 0);
assert.equal(act(crop, 'eat', all).ok, false);
const full = accept({ crop: 'ready', rations: 9, harvests: 999 });
const snapshot = { ...full };
assert.equal(act(full, 'harvest', all).ok, false);
assert.deepEqual(full, snapshot, 'full pack keeps harvest on plant');
assert(act(full, 'eat', all).ok);
assert(act(full, 'harvest', all).ok);
assert.equal(full.harvests, 999);
assert.equal(full.rations, 9);
assert.equal(act(full, '<script>', all).ok, false);
console.log('Habitat activities: ordered rescue/repair/deployment, crop lifecycle, bounds, pause and save checks passed.');
