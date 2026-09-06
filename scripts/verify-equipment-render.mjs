import assert from 'node:assert/strict';
import * as T from 'three';
import {BuggyLayer} from '../src/buggylayer.js';
import {createBuggy, WHEEL_R} from '../src/buggy.js';
import {createCrownFinish} from '../src/crown-finish.js';
const scene=new T.Scene(),layer=new BuggyLayer(scene),state=createBuggy(3,5,.7);
state.y=2;state.wheelSpin=1.2;state.steer=.18;
layer.update(.016,state,{skidF:false,skidR:false,airborne:false,landed:false});layer.setLamps(true);
const snapshot=()=>{scene.updateMatrixWorld(true);return{body:layer.group.matrixWorld.toArray(),wheels:layer.wheels.map(w=>w.matrixWorld.toArray()),lamps:[layer.lampL.intensity,layer.lampR.intensity],steering:layer.steerPivots.map(p=>p.rotation.y)};};
layer.finish.setEnabled(false);const original=snapshot();layer.finish.setEnabled(true);assert.deepEqual(snapshot(),original,'Finish does not change chassis, wheel contact transforms, steering or lamps');
assert.equal(layer.wheels.length,4);
for(const g of layer.finish.wheelGroups){
 const box=new T.Box3();for(const m of g.children){m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox);}
 assert.ok(box.max.y<=WHEEL_R+.025&&box.min.y>=-WHEEL_R-.025,'Same wheel radius envelope');
 assert.ok(box.max.x<.26&&box.min.x>-.26,'Same wheel width envelope');
 assert.ok(g.children.length<=3,'Wheel finishes batched');
}
const crown=createCrownFinish();crown.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(crown);
assert.ok(bounds.min.y>=.27&&bounds.max.y<.85,'Fittings remain on existing collar');
assert.ok(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z))<1.7,'No enlarged entrance footprint');
assert.ok(crown.children.length<=5,'Five or fewer finish batches');
assert.ok(!crown.children.some(m=>m.isLight),'Existing lighting budget retained');
for(const root of [layer.finish.group,...layer.finish.wheelGroups,crown])root.traverse(m=>{if(m.isMesh){for(const n of m.geometry.attributes.position.array)assert.ok(Number.isFinite(n),'Finite geometry');}});
console.log('Equipment finish: unchanged wheel/chassis/light transforms, bounded geometry, original entrance footprint and draw budgets pass');
