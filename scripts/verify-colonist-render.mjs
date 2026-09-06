import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Colonist } from '../src/colonist.js';
const c = new Colonist(new THREE.Scene());
let meshes = 0;
for (const group of c.finishGroups) group.traverse(o => {
  if (!o.isMesh) return;
  meshes++;
  const p = o.geometry.attributes.position;
  for (const value of p.array) assert(Number.isFinite(value), 'Suit fittings contain finite geometry');
  assert.equal(o.material.isMeshPhysicalMaterial, true);
  assert.equal(o.castShadow, true);
});
assert(meshes <= 45, 'Fittings are batched by existing material and moving joint');
const thigh = c.legL.hip.children.find(o => o.isMesh && o.geometry.attributes.position.count > 1000);
assert(thigh, 'Pressure thigh mesh exists');
const p = thigh.geometry.attributes.position, n = thigh.geometry.attributes.normal;
let outward = 0;
for (let i = 0; i < p.count; i++) {
  if (p.getY(i) < -.06 && p.getY(i) > -.37) {
    assert(p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i) > 0, 'Cloth normals face outwards');
    outward++;
  }
}
assert(outward > 100, 'Normal regression covers the full shaped limb');
console.log(`Colonist render: ${meshes} batched fittings; finite geometry and outward cloth normals.`);
