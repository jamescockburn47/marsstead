import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Purposeful fittings on the existing biconic ship; no changes to landing
// footprint, tank count, flight transforms or lights. Batched by finish.
export function addShipFinish(parent,{shell,metal,dark,rubber,accent}){
 const group=new THREE.Group();group.name='ship-engineered-finish';parent.add(group);
 const buckets=new Map();
 const add=(geo,mat,x=0,y=0,z=0,rotation=null)=>{if(rotation)geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation));geo.translate(x,y,z);if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(geo);};
 const box=(mat,x,y,z,w,h,d,rot)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,rot);
 const ring=(mat,r,tube,y)=>{const geo=new THREE.TorusGeometry(r,tube,8,80);geo.rotateX(Math.PI/2);add(geo,mat,0,y,0);};
 // Hull joints are shallow seals, not a second spaceframe around the craft.
 ring(rubber,1.777,.013,3.98);ring(metal,1.785,.016,3.94);
 ring(rubber,1.526,.012,5.9);ring(metal,1.535,.018,5.86);
 ring(dark,1.626,.018,1.53);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,rot=new THREE.Euler(0,a,0),x=Math.sin(a),z=Math.cos(a);
  box(metal,x*1.793,3.96,z*1.793,.07,.10,.023,rot);
  // Vent panels along the engine skirt: vertical depth catches low lamps.
  box(metal,x*1.454,.83,z*1.454,.038,.36,.065,rot);
 }
 for(const side of [-1,1]){
  const a=side*1.8,x=Math.sin(a),z=Math.cos(a),rot=new THREE.Euler(0,a,0);
  box(rubber,x*1.788,3.12,z*1.788,.63,.94,.04,rot);
  box(shell,x*1.82,3.12,z*1.82,.57,.86,.035,rot);
  for(const y of [2.85,3.38])box(metal,x*1.846,y,z*1.846,.20,.04,.035,rot);
  for(let k=0;k<5;k++)box(dark,x*1.845,3.05+k*.055,z*1.845,.33,.019,.02,rot);
  // Rear ladder rails and handholds; existing rungs remain the entry reference.
  box(metal,side*.32,1.05,-1.83,.035,1.52,.05);
  box(accent,side*.64,1.8,-1.75,.035,.43,.065);
 }
 // Exposed workshop objects replace the featureless luminous rectangle.
 box(dark,0,2.72,1.84,1.36,1.14,.035);
 box(metal,0,2.29,1.99,1.35,.07,.32);
 box(shell,-.4,2.57,1.98,.37,.48,.16);
 for(let i=0;i<4;i++)box(dark,-.4,2.42+i*.085,2.07,.28,.025,.03);
 box(accent,.36,2.5,1.97,.30,.32,.16);
 for(let i=0;i<3;i++)box(metal,-.18+i*.18,2.97,1.93,.036,.25,.07);
 const lamp=new THREE.MeshStandardMaterial({color:0xffe3b2,emissive:0xffc886,emissiveIntensity:1.7,roughness:.5});
 box(lamp,0,3.27,1.98,1.20,.035,.08);
 // Wide landing pads retain their original radius with visible compression
 // pistons and small clamps rooted to the strut/foot positions.
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+Math.PI/4,x=Math.cos(a),z=Math.sin(a);
  const from=new THREE.Vector3(x*2.7,.95,z*2.7),to=new THREE.Vector3(x*3.25,.12,z*3.25);
  const axis=to.clone().sub(from),g=new THREE.CylinderGeometry(.048,.048,axis.length()*.65,12);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize()));
  const p=from.clone().lerp(to,.58);add(g,metal,p.x,p.y+.055,p.z);
  for(const off of [-.24,.24])box(metal,x*3.25+off,.15,z*3.25,.08,.055,.12);
 }
 for(const [mat,list]of buckets){const geo=mergeGeometries(list);list.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 return group;
}
