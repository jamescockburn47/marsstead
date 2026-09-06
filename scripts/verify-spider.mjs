import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { spiderPose } from '../src/spider-rig.js';
import { WorkerSpider } from '../src/workerspider.js';
import { FlyingDrone } from '../src/flyingdrone.js';
import { droneClass, fleetCounts } from '../src/dronefleet.js';
import { flyingJob } from '../src/fleet-job.js';
import { CrownLayer } from '../src/crownlayer.js';
import { createBurrow } from '../src/burrow.js';

const options = { moving: .27, working: true, seed: 41 };
for(const [t,phase,carrying] of [[1,'collecting',false],[3,'collecting',true],[9,'hauling',true],
  [15,'delivering',true],[18,'delivering',false],[23,'returning',false]]) {
  const job=flyingJob(t,2,true);
  assert.equal(job.phase,phase);assert.equal(job.carrying,carrying);
  assert(job.clearance>=.8 && job.clearance<=2.6);
}
assert.equal(flyingJob(9,2,false).phase,'standby');
assert.equal(flyingJob(9,2,false).carrying,false);
assert.deepEqual(flyingJob(1,2,true,true),flyingJob(91,2,true,true));
for(const boundary of [0,5,14,19,28,32]) {
  const a=flyingJob(boundary-.00001,2,true),b=flyingJob(boundary+.00001,2,true);
  assert(Math.hypot(a.x-b.x,a.z-b.z,a.clearance-b.clearance)<.001,'job positions stay continuous across phases');
}
assert.deepEqual(fleetCounts(3),{total:3,spider:2,flying:1});
for(const count of [-2,0,1,2,3,8,24,30,NaN]) {
  const fleet=fleetCounts(count);
  assert.equal(fleet.spider+fleet.flying,fleet.total);
  assert.equal(Array.from({length:fleet.total},(_,i)=>droneClass(i)).filter(c=>c==='flying').length,fleet.flying);
}
assert.deepEqual(spiderPose(3.3, options), spiderPose(3.3, options));
assert.notDeepEqual(spiderPose(3.3, options), spiderPose(3.3, { ...options, seed: 42 }));
assert.deepEqual(spiderPose(1, { ...options, reducedMotion: true }), spiderPose(9, { ...options, reducedMotion: true }));
for (const speed of [0, .12, .5, 1.2]) for (let t=0;t<3;t+=.011) {
  const pose = spiderPose(t, { moving:speed, seed:41 });
  assert.equal(pose.legs.length,6);
  assert(pose.legs.filter(l=>l.stance).length>=3,'at least one support tripod remains down');
  for (const leg of pose.legs) {
    assert([...leg.hip,...leg.shoulder,...leg.knee,...leg.foot].every(Number.isFinite));
    assert(leg.foot[1]>=.022-1e-9,'boots cannot travel below contact plane');
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    assert(Math.abs(distance(leg.shoulder,leg.knee)-.19)<1e-7,'upper limb retains its length');
    assert(Math.abs(distance(leg.knee,leg.foot)-.29)<1e-7,'lower limb retains its length');
    if (speed && leg.stance) {
      const next=spiderPose(t+.00001,{moving:speed,seed:41}).legs[pose.legs.indexOf(leg)];
      if(next.stance) assert(Math.abs((next.foot[2]-leg.foot[2])/.00001+speed)<1e-6,'stance foot cancels forward travel');
    }
  }
}
const workers=['dig','fabricate','repair'].map(variant=>new WorkerSpider({variant,seed:3}));
assert.equal(workers[0].resources,workers[1].resources,'static geometry and finish resources are shared');
for(const worker of workers) {
  worker.update(2,options);worker.group.updateMatrixWorld(true);
  let draws=0, lights=0;
  worker.group.traverse(o=>{if(o.isMesh)draws++;if(o.isLight)lights++;});
  assert(draws<=10,'bounded per-worker draw batches');assert.equal(lights,0,'lighting belongs to scene pool');
  for(const mesh of [worker.links,worker.joints,worker.pistons,worker.pads]) {
    assert([...mesh.instanceMatrix.array].every(Number.isFinite));
  }
}
assert.notEqual(workers[0].tool.geometry,workers[1].tool.geometry,'variants have distinct working tools');
workers[0].update(9,{working:true});workers[0].group.updateMatrixWorld(true);
const drillTip=new THREE.Vector3(0,0,.34).applyMatrix4(workers[0].tool.matrixWorld);
assert(drillTip.y>.01 && drillTip.y<.04,'auger tip visibly engages the ground plane');
assert(workers[0].toolPivot.rotation.x>.6,'excavator drills down, not horizontally into empty air');
const angle=workers[0].tool.rotation.z;workers[0].update(9.1,{working:true});
assert.notEqual(workers[0].tool.rotation.z,angle,'auger rotates while working');
assert(workers[0].pose.legs.every(l=>l.stance),'excavation braces all six feet');
const silhouettes=workers.map(w=>{
  w.group.updateMatrixWorld(true);return new THREE.Box3().setFromObject(w.body).getSize(new THREE.Vector3()).toArray();
});
assert.notDeepEqual(silhouettes[0],silhouettes[1]);assert.notDeepEqual(silhouettes[1],silhouettes[2]);
workers[0].dispose();workers[1].update(3,{moving:.2});workers[0].dispose();
assert.equal(workers[1].disposed,false,'one worker disposal cannot invalidate shared resources');
workers.slice(1).forEach(w=>w.dispose());
const replacement=new WorkerSpider();replacement.update(1);replacement.dispose();
const flyers=[new FlyingDrone({seed:7,variant:'cargo'}),new FlyingDrone({seed:8,variant:'survey'})];
assert.notEqual(flyers[0].variant,flyers[1].variant);
assert.notDeepEqual(flyers[0].payload.scale.toArray(),flyers[1].payload.scale.toArray(),'cargo chassis has a larger load cradle');
assert.equal(flyers[0].resources,flyers[1].resources,'flyers share static resources');
for(const flyer of flyers) {
  flyer.update(4,{working:true});
  assert.equal(flyer.rotors.count,8,'four crossed rotor pairs');
  assert([...flyer.rotors.instanceMatrix.array].every(Number.isFinite));
  assert.equal(flyer.payload.visible,true);
  let draws=0,lights=0;
  flyer.group.traverse(o=>{if(o.isMesh)draws++;if(o.isLight)lights++;});
  assert(draws<=7);assert.equal(lights,0,'fleet cannot multiply the scene light budget');
  flyer.update(1,{reducedMotion:true});const rotors=[...flyer.rotors.instanceMatrix.array];
  flyer.update(8,{reducedMotion:true});assert.deepEqual([...flyer.rotors.instanceMatrix.array],rotors);
}
flyers[0].dispose();flyers[0].dispose();flyers[1].update(8);flyers[1].dispose();
new FlyingDrone().dispose();
const scene=new THREE.Scene(), ground=(x,z)=>.04*x+.02*z;
const crown=new CrownLayer(scene,10,12,ground), burrow=createBurrow();
crown.update(2,true,0,false,false,{burrow,droneCount:5,reducedMotion:false});
assert.equal(crown.drones.filter(d=>d.visible).length,5);
for(const drone of crown.drones.filter(d=>d.visible)) {
  const world=drone.getWorldPosition(new THREE.Vector3());
  const clearance=world.y-ground(world.x,world.z);
  if(drone.userData.droneClass==='flying') assert(clearance>=.8-1e-7 && clearance<=2.6,'flyer has terrain clearance');
  else assert(Math.abs(clearance)<1e-7,'spiders follow the actual terrain');
}
crown.update(9,true,0,false,false,{burrow,droneCount:3});
assert.equal(crown.drones[0].userData.workPhase,'excavating');
assert.equal(crown.drones[2].userData.workPhase,'hauling');
assert.equal(crown.workers[2].payload.visible,true);
crown.update(23,true,0,false,false,{burrow,droneCount:3});
assert.equal(crown.workers[2].payload.visible,false,'empty return trip');
for(const count of [0,1,2,3,8,24]) {
  crown.update(4,false,0,false,false,{burrow,droneCount:count});
  const visible=crown.drones.filter(d=>d.visible);
  assert.equal(visible.length,count,'classes never create extra deployed units');
  assert.equal(visible.filter(d=>d.userData.droneClass==='flying').length,Math.floor(count/3));
}
crown.update(99,true,0,false,false,{burrow,droneCount:8,reducedMotion:true});
const still=crown.drones.map(d=>d.position.toArray());
crown.update(123,true,0,false,false,{burrow,droneCount:8,reducedMotion:true});
assert.deepEqual(crown.drones.map(d=>d.position.toArray()),still);
crown.workers.forEach(w=>w.dispose());
for(const name of ['workerspider','flyingdrone','dronefleet','fleet-job','spider-rig','crownlayer']) {
  const text=readFileSync(new URL(`../src/${name}.js`,import.meta.url),'utf8');
  assert(text.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('//')).length<=300,`${name} line cap`);
  assert(!text.includes('Math.random('),'seeded shared presentation');
}
console.log('verify-spider: contact gait, shared resources, bounded draws, terrain spiders, four-rotor flyers, exact fleet totals, reduced motion pass');
