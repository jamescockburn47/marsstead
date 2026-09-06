import assert from 'node:assert/strict';
import * as T from 'three';
import {MachineLayer} from '../src/machinelayer.js';
import {RigLayer} from '../src/riglayer.js';
import {SteadLayer} from '../src/steadlayer.js';
const scene=new T.Scene(),machines=new MachineLayer(scene),rig=new RigLayer(scene),stead=new SteadLayer(scene);
const types=['smelter','mill','electrolyser','assembler','solar-array','battery'];
const states=types.map((type,i)=>({type,x:i*4,z:0,heading:.3,queue:['test']}));
const initial=JSON.stringify(states);machines.sync(states,()=>0);machines.update(states,2);
assert.equal(JSON.stringify(states),initial,'Rendering leaves production state alone');
assert.equal(machines.meshes.length,6);
for(const m of machines.meshes){const position=m.position.toArray();m.traverse(o=>{if(o.name==='industrial-fittings'){assert.ok(o.children.length<=4,'Bounded material batches');o.visible=false;}});assert.deepEqual(m.position.toArray(),position);}
for(const deployed of [false,true]){const state={x:2,z:5,heading:.8,deployed,hopper:{}};const before=JSON.stringify(state);rig.update(state,0,20);assert.equal(JSON.stringify(state),before);assert.equal(rig.legs.every(l=>l.visible),deployed);assert.ok(rig.mast.children.some(o=>o.name==='industrial-fittings'),'Auger follows existing folded mast');}
for(const type of ['window','airlock','steel-panel-part']){const p=stead.makePart(type,0);scene.add(p);assert.ok(p.children.some(o=>o.name==='industrial-fittings'));}
scene.traverse(o=>{assert.ok(!o.isLight,'No additional lights');if(o.isMesh)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v),'Finite visual geometry');});
for(const m of machines.meshes){const glow=m.userData.glow;if(glow)assert.equal(glow.visible,true);}
machines.update(states.map(m=>({...m,queue:[]})),3);for(const m of machines.meshes)if(m.userData.glow)assert.equal(m.userData.glow.visible,false,'Original work glow still follows queue');
console.log('Industry fittings: finite batched geometry, original work states, unchanged production records, fold/leg ownership and no extra lights pass');
