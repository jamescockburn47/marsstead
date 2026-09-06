import assert from 'node:assert/strict';
import * as THREE from 'three';
import { activeCrewCount, crewMode, crewTarget, crewDock, commandCrew, canOpenCrew, CREW_HOME_RADIUS } from '../src/crew-control.js';
import { CrownLayer } from '../src/crownlayer.js';
import { CrewSession } from '../src/crew-session.js';
import { createBurrow, plan, tick, serialize } from '../src/burrow.js';

const opening = () => ({ version: 1, visitedHome: false, followed: false, worked: false, fleetMode: 'park' });
const bots = [{ ...crewDock(0), visible: true }, { ...crewDock(1), visible: true }, { ...crewDock(2), visible: true }];
const player = { ...bots[0] }, state = opening();
assert.equal(activeCrewCount(null, 4.5), 4.5, 'Legacy effective digging rate is unchanged');
assert.equal(crewMode(null), 'auto');
assert.equal(activeCrewCount(state, 3), 0);
const before = JSON.stringify(state);
for (const blocked of [false, true]) assert.equal(commandCrew(state, 'work', { player: { x: 100, z: 100 }, bots, blocked }), false);
assert.equal(commandCrew(state, 'follow', { player, bots, blocked: true }), false);
assert.equal(commandCrew(state, 'invalid', { player, bots }), false);
assert.equal(commandCrew(state, 'work', { player, bots: bots.map(bot => ({ ...bot, visible: false })) }), false);
assert.equal(JSON.stringify(state), before, 'Remote, blocked and nonexistent-worker commands cannot earn progress');
assert.equal(commandCrew(state, 'follow', { player, bots }), true);
assert.equal(state.followed, true); assert.equal(state.worked, false); assert.equal(activeCrewCount(state, 3), 0);
assert.equal(canOpenCrew(state, { x: 15, z: 0 }, [{ x: 14, z: 0, visible: true }]), true, 'Following worker stays locally commandable');
assert.equal(canOpenCrew(state, { x: 50, z: 0 }, bots), false, 'No remote crew menu');
const farState = opening(), farPlayer = { x: 16, z: 0 }, farBots = [{ x: 16, z: 0, visible: true }];
assert.equal(commandCrew(farState, 'follow', { player, bots }), true);
assert.equal(commandCrew(farState, 'park', { player: farPlayer, bots: farBots }), true, 'Following crew can hold away from dock');
assert.equal(canOpenCrew(farState, farPlayer, farBots), true, 'Held crew remains locally commandable throughout its home area');
assert.equal(commandCrew(farState, 'work', { player: farPlayer, bots: farBots }), true, 'Held distant crew can resume without reloading');
assert.equal(activeCrewCount(farState, 3), 3);
const farBefore = JSON.stringify(farState);
for (const mode of ['park', 'follow', 'work']) assert.equal(commandCrew(farState, mode,
  { player: { x: CREW_HOME_RADIUS + .1, z: 0 }, bots: [{ x: CREW_HOME_RADIUS - .5, z: 0, visible: true }] }), false,
  'Proximity cannot grant commands from outside the home boundary');
assert.equal(JSON.stringify(farState), farBefore, 'Outside-home rejection leaves mode and progress untouched');
assert.equal(CrewSession.prototype.open.call({ eligible: () => true, localPlayer: () => ({ x: 0, z: 0 }),
  bots: () => bots.map(bot => ({ ...bot, x: 8, z: 0 })) }), false,
  'Goal action near the crown cannot open an unusable crew menu away from the actual workers');
const burrow = createBurrow(); assert.equal(plan(burrow, 'shaft', 0, 1), true);
let charges = 0; const fund = () => { charges++; return true; };
const untouched = JSON.stringify(serialize(burrow));
tick(burrow, 30, activeCrewCount(state, 3), fund);
assert.equal(JSON.stringify(serialize(burrow)), untouched); assert.equal(charges, 0, 'Follow neither digs nor charges');
assert.equal(commandCrew(state, 'work', { player, bots }), true); assert.equal(state.worked, true);
tick(burrow, 5, activeCrewCount(state, 3), fund);
assert.equal(burrow.cells.get('0,1').dug, .5); assert.equal(charges, 1, 'Work feeds actual excavation once');
assert.equal(commandCrew(state, 'park', { player, bots }), true);
const paused = JSON.stringify(serialize(burrow)); tick(burrow, 30, activeCrewCount(state, 3), fund);
assert.equal(JSON.stringify(serialize(burrow)), paused); assert.equal(charges, 1, 'Park preserves funded work and resources');
assert.equal(commandCrew(state, 'work', { player, bots }), true);
tick(burrow, 30, activeCrewCount(state, 3), fund); const complete = JSON.stringify(serialize(burrow));
tick(burrow, 30, activeCrewCount(state, 3), fund);
assert.equal(JSON.stringify(serialize(burrow)), complete); assert.equal(charges, 1, 'Repeated work cannot duplicate spoil or charge');
for (let index = 0; index < 24; index++) {
  for (const p of [{ x: 18, z: 0 }, { x: 0, z: -18 }, { x: -12, z: 12 }, { x: 999, z: 999 }]) {
    const target = crewTarget('follow', index, p);
    assert.ok(Math.hypot(target.x, target.z) <= CREW_HOME_RADIUS, 'Formation remains within home boundary');
  }
  assert.deepEqual(crewTarget('follow', index, { x: 19, z: 0 }), crewDock(index), 'Far player sends crew to dock');
}

// Real renderer hierarchy, without a browser/GPU: commands reuse the existing fleet.
const crown = new CrownLayer(new THREE.Scene(), 100, 200, (x,z) => x*.02+z*.01);
const fleet = [...crown.drones], renderState = opening();
const home = { burrow, droneCount: 3, opening: renderState, player: { x: 8, z: 4 }, reducedMotion: false };
const resources = JSON.stringify(serialize(burrow));
crown.update(0, true, 1, false, false, home);
assert.equal(crown.drones.filter(drone => drone.visible).length, 3);
assert.deepEqual(crown.drones.filter(drone => drone.visible).map(drone => drone.userData.droneClass), ['spider', 'spider', 'flying']);
assert.deepEqual(crown.drones.slice(0,3).map(drone => drone.userData.crewIdentity), ['Spider 01', 'Spider 02', 'Survey flyer 01']);
assert.ok(crown.drones.slice(0,3).every(drone => drone.userData.workPhase === 'holding'));
assert.ok(crown.workFaces.filter(Boolean).every(face => !face.visible), 'Park disables work-face effects');
const initial = crown.drones[0].position.clone(); renderState.fleetMode = 'follow';
for (let i=1;i<=80;i++) crown.update(i*.1, true, 1, false, false, home);
const target = crewTarget('follow',0,home.player);
assert.ok(Math.hypot(crown.drones[0].position.x-target.x,crown.drones[0].position.z-target.z) < .05, 'Existing worker reaches player formation');
assert.ok(crown.drones[0].position.distanceTo(initial)>2, 'Call over visibly moves existing worker');
renderState.fleetMode = 'park'; crown.update(8.1, true, 1, false, false, home);
const held = crown.drones[0].position.clone(); home.player = { x: -8, z: -8 };
for(let i=82;i<=100;i++) crown.update(i*.1,true,1,false,false,home);
assert.ok(crown.drones[0].position.distanceTo(held)<1e-9, 'Hold position holds the actual worker');
renderState.fleetMode='follow'; home.player={x:50,z:50};
for(let i=101;i<=240;i++) crown.update(i*.1,true,1,false,false,home);
assert.ok(Math.hypot(crown.drones[0].position.x-crewDock(0).x,crown.drones[0].position.z-crewDock(0).z)<.05, 'Distant player gets dock fallback');
renderState.fleetMode='work';
for(let i=241;i<=600;i++) crown.update(i*.1,true,1,false,false,home);
assert.ok(crown.drones.slice(0,3).some(drone => ['excavating','hauling','collecting','delivering','returning'].includes(drone.userData.workPhase)), 'Resume restores actual work presentation');
assert.deepEqual(crown.drones, fleet, 'No workers created or replaced by commands');
assert.equal(crown.drones.filter(drone => drone.visible).length,3);
assert.equal(JSON.stringify(serialize(burrow)),resources,'Renderer cannot grant or consume resources');
home.opening=null; crown.update(61,true,1,false,false,home);
assert.ok(crown.drones.slice(0,3).every(drone=>drone.userData.crewMode==='auto'), 'Legacy retains automatic fleet behavior');
console.log('Crew: local command guards, bounded follow/hold/dock, real excavation accounting, original fleet identity/count and legacy auto pass');
