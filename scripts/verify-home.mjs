import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createBurrow, plan, canPlan, BURROW_PIECES } from '../src/burrow.js';
import { homeGrowth, homeView, roomDescription, escapeHomeText } from '../src/home-model.js';
import { renderHomeScene } from '../src/home-scene.js';
import { CrownLayer } from '../src/crownlayer.js';

const b=createBurrow();
assert.equal(homeGrowth(b).rooms,0);
assert.equal(homeGrowth(b).keepsake,false);
const first=homeView(b);
assert.deepEqual(first.sockets.map(s=>s.key),['0,1']);
assert(first.maxCol-first.minCol<12,'first home is framed closer than the full lattice');
assert.equal(first.maxDepth,1,'no empty depth beyond the available expansion socket');
assert.equal(first.maxCol-first.minCol,2,'empty home needs only its immediate surroundings');
const finish=(piece,c,d)=>{
  assert(plan(b,piece,c,d)); b.cells.get(`${c},${d}`).dug=1;
  b.queue=b.queue.filter(k=>k!==`${c},${d}`);
};
finish('shaft',0,1); finish('corridor',1,1); finish('bunk',2,1);
assert.equal(homeGrowth(b).keepsake,false,'bunk alone does not imply sealed home');
b.ringInstalled=true;
assert.equal(homeGrowth(b).keepsake,true);
finish('corridor',-1,1); finish('garden',-2,1);
assert.equal(homeGrowth(b,5).drones,5);
assert.equal(homeGrowth(b,999).drones,24,'render pool remains bounded');
assert.equal(homeGrowth(b,NaN).drones,3);
assert.equal(homeGrowth(b,-3).drones,0);
finish('shaft',0,2); finish('corridor',1,2);
assert(plan(b,'store',2,2));
assert.equal(homeGrowth(b).store,0,'queued room does not earn surface dressing');
assert.equal(roomDescription(b,'2,2').state,'Queued · select to cancel');
assert.equal(roomDescription(b,'2,1').state,'Sealed');
assert.equal(roomDescription(b,'9,9'),null);
for(const piece of Object.keys(BURROW_PIECES)) {
  const v=homeView(b,piece);
  for(const s of v.sockets) assert(canPlan(b,piece,s.col,s.depth));
  const drawing=renderHomeScene(b,piece,{droneCount:5});
  assert(!/NaN|undefined|Infinity/.test(drawing.svg));
  assert(!/href=|<image|<script/.test(drawing.svg),'no external images or executable markup');
  assert(drawing.svg.includes('clip-path="url(#home-rockclip)"'),'geology filter stays below the surface');
  for(const c of v.cells) assert(drawing.svg.includes(`data-key="${c.key}"`));
  assert.equal((drawing.svg.match(/data-drone-class=/g)||[]).length,5);
  assert.equal((drawing.svg.match(/data-drone-class="flying"/g)||[]).length,1);
  assert.equal((drawing.svg.match(/data-drone-class="spider"/g)||[]).length,4);
  assert(!drawing.svg.includes('class="home-specimen"'),'discovery not earned');
}
assert(renderHomeScene(b,'shaft',{discovery:true}).svg.includes('class="home-specimen"'));
assert.equal(escapeHomeText('<img a="x">&'), '&lt;img a=&quot;x&quot;&gt;&amp;');
// Three objects can be tested without GPU/DOM: real count and growth drive actual visibility.
const scene=new THREE.Scene(), crown=new CrownLayer(scene,0,0,()=>0);
crown.update(1,false,5,true,true,{burrow:b,droneCount:5,discovery:false});
assert.equal(crown.drones.filter(d=>d.visible).length,5);
assert.equal(crown.homeSurface.gardens.filter(g=>g.visible).length,1);
assert.equal(crown.homeSurface.stores.filter(g=>g.visible).length,0);
assert.equal(crown.homeSurface.specimen.visible,false);
crown.update(2,true,5,true,true,{burrow:b,droneCount:8,discovery:true,reducedMotion:true});
assert.equal(crown.drones.filter(d=>d.visible).length,8);
assert.equal(crown.homeSurface.specimen.visible,true);
assert(crown.homeSurface.leaves.every(p=>p.rotation.z===0));
for(const drone of crown.drones.filter(d=>d.visible)) {
  assert(drone.position.toArray().every(Number.isFinite));
}
for(const name of ['home-model','home-room','home-scene','home-style','home-surface','burrowconsole','crownlayer']) {
  const source=readFileSync(new URL(`../src/${name}.js`,import.meta.url),'utf8');
  assert(source.split('\n').filter(s=>s.trim()&&!s.trim().startsWith('//')).length<=300,`${name} line cap`);
}
console.log('verify-home: state-derived cutaway, discovery rewards, scene bounds, drone pool and surface growth green');
