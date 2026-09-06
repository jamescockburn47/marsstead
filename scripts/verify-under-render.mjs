import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {centreAt,floorAt,UNDER_LENGTH} from '../src/underworld.js';
import {shellPoint,shellNormal,underShellData,underCapData,UNDER_SIDES,UNDER_STEP} from '../src/under-geometry.js';
import {UnderLayer} from '../src/underlayer.js';
import {underRockMaterial} from '../src/under-material.js';

for(let z=0;z<=UNDER_LENGTH;z+=2.5) {
  const c=centreAt(z);
  for(let i=0;i<=48;i++) {
    const angle=Math.PI+i/48*Math.PI,[x,y]=shellPoint(z,angle);
    assert(Math.abs(y-floorAt(x,z))<2e-6,'entire lower shell matches broad lava-floor contact');
  }
  const [,ceiling]=shellPoint(z,Math.PI/2);
  assert(ceiling>c.y+c.height*1.5&&ceiling<c.y+c.height*2.5,'irregular vault remains safely enclosed');
}
// Surface normals used by workers agree with inward rock normals after warping.
for(const z of [10,32,58,85,117])for(const angle of [.2,1.2,2.8]) {
  const n=shellNormal(z,angle),p=shellPoint(z,angle),c=centreAt(z);
  assert(Math.abs(Math.hypot(...n)-1)<1e-8);
  assert(n[0]*(c.x-p[0])+n[1]*(c.y+c.height-p[1])>0);
}
// Successive bends hide long sightlines; this is not a renamed elliptical pipe.
assert(Math.abs(centreAt(20).x-centreAt(55).x)>7);
const data=underShellData();
assert.equal(data.rows,UNDER_LENGTH/UNDER_STEP+1);
assert.equal(data.indices.length,(data.rows-1)*UNDER_SIDES*6);
assert(data.positions.every(Number.isFinite));
for(const z of [0,UNDER_LENGTH]) {
  const cap=underCapData(z);assert.equal(cap.indices.length,UNDER_SIDES*3);
  const a=new THREE.Vector3().fromArray(cap.positions,3),b=new THREE.Vector3().fromArray(cap.positions,6);
  const centre=new THREE.Vector3().fromArray(cap.positions,0);
  const n=a.sub(centre).cross(b.sub(centre));
  assert(n.z>0,'cap source ring has a consistent orientation');
}
const scene=new THREE.Scene(),layer=new UnderLayer(scene);
const shell=layer.parts[0].geometry;
const n=shell.attributes.normal;
const bottom=Math.round(UNDER_SIDES*.75);
assert(n.getY(bottom)>.8,'lower-shell normal faces inward toward the lamp');
assert.equal(scene.children.filter(o=>o.isLight).length,4,'ambient plus three local lights only');
assert.equal(scene.children.filter(o=>o.isLight&&o.castShadow).length,1);
assert.equal(layer.marks.length,3);
assert(layer.fractures.length>=30,'irregular geological structure breaks up the tunnel');
for(const rock of layer.fractures) {
  const p=rock.geometry.attributes.position,{side,ceiling}=rock.userData.fracture;
  for(let i=0;i<p.count;i++) {
    const c=centreAt(p.getZ(i));
    if(ceiling)assert(p.getY(i)>=c.y+c.height*.4+3.0999,'ceiling rock clears every walkable head position');
    else assert(side*(p.getX(i)-c.x)>=c.width*.8399,'shoulder rock stays outside walkable width');
  }
  assert(rock.castShadow&&rock.receiveShadow);
  const index=rock.geometry.index,centre=new THREE.Vector3();
  for(let i=0;i<p.count;i++)centre.add(new THREE.Vector3().fromBufferAttribute(p,i));centre.divideScalar(p.count);
  let volume=0;
  for(let i=0;i<index.count;i+=3) {
    const a=new THREE.Vector3().fromBufferAttribute(p,index.getX(i)).sub(centre);
    const b=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+1)).sub(centre);
    const c=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+2)).sub(centre);
    volume+=a.dot(b.cross(c))/6;
  }
  assert(volume>0,'closed geological solids face outward toward the lamp');
}
const pos={x:centreAt(35).x,y:floorAt(centreAt(35).x,35),z:35};
layer.update(5,{position:pos,heading:0,completed:['relay']});
assert(layer.lamp.position.toArray().every(Number.isFinite));
assert(layer.lamp.target.position.z>pos.z);
assert.equal(layer.marks[0].mesh.material,layer.teal);
assert.equal(layer.marks[1].mesh.material,layer.amber);
layer.update(5,{position:pos,heading:Math.PI,lampOn:false,reducedMotion:true});
assert.equal(layer.lamp.intensity,0);
assert.equal(layer.marks[0].mesh.rotation.y,0);
assert(layer.workLight.intensity>0,'warm return lights remain when helmet light is off');
const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
underRockMaterial().onBeforeCompile(shader);
assert(shader.fragmentShader.includes('float underGrain'));
assert(shader.fragmentShader.includes('roughnessFactor=clamp'));
assert(!shader.vertexShader.includes('transformed +='),'detail is shading only');
const geos=new Set(layer.parts.map(p=>p.geometry));let disposed=0;
for(const g of geos)g.addEventListener('dispose',()=>disposed++);
layer.dispose();assert.equal(disposed,geos.size);assert.equal(scene.children.length,0);
for(const file of ['underlayer','under-geometry','under-material']) {
  const source=readFileSync(new URL(`../src/${file}.js`,import.meta.url),'utf8');
  assert(source.split('\n').filter(s=>s.trim()&&!s.trim().startsWith('//')).length<=300);
  assert(!source.includes('Math.random('));
}
console.log('verify-under-render: floor agreement, enclosed mesh, inward normals, light budget, state signals and disposal green');
