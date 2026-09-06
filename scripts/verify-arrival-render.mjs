import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ArrivalLayer } from '../src/arrival-layer.js';

const home = { x: -4, z: -16 }, field = { x: 108, z: -94 };
const groundAt = (x, z) => .04 * x - .035 * z + .12 * Math.sin(x * .4);
const scene = new THREE.Scene(), layer = new ArrivalLayer(scene, groundAt, { home, field });
scene.updateMatrixWorld(true);
let meshes = 0, vertices = 0, lightCount = 0;
const geometries = new Set(), materials = new Set();
layer.group.traverse(object => {
  if (object.isLight) lightCount++;
  if (!object.isMesh) return;
  meshes++; geometries.add(object.geometry); materials.add(object.material);
  const p = object.geometry.attributes.position;
  vertices += p.count;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    assert.ok([x, y, z].every(Number.isFinite), 'all arrival geometry is finite');
    const clearance = y - groundAt(x, z);
    assert.ok(clearance > -.04 && clearance < 1.10, `low terrain-seated fittings: ${clearance}`);
    assert.ok(Math.hypot(x - home.x, z - home.z) > 7, 'existing collar and worker apron stay clear');
    if (object.name.endsWith(': paint')) assert.ok(Math.abs(clearance - .018) < 1e-5,
      'paint follows actual drawn terrain at each vertex, including slopes');
  }
  assert.equal(object.material.map, null, 'no runtime textures/assets');
  assert.equal(object.material.transparent, false, 'no transparent sorting layers');
});
assert.equal(lightCount, 0, 'passive reflectors add no lights');
assert.ok(meshes <= 25, `bounded spatially batched draw budget: ${meshes}`);
assert.ok(vertices < 18000, `small additional geometry budget: ${vertices}`);
assert.equal(layer.anchors.filter(a => a.kind === 'home marker').length, 3);
assert.equal(layer.anchors.filter(a => a.kind === 'survey marker').length, 3);
for (const anchor of layer.anchors) {
  assert.equal(anchor.y, groundAt(anchor.x, anchor.z), 'each fixture uses its own ground anchor');
  if (anchor.kind === 'survey marker') {
    const dx = field.x - home.x, dz = field.z - home.z;
    const routeLength = Math.hypot(dx, dz);
    const along = ((anchor.x - home.x) * dx + (anchor.z - home.z) * dz) / routeLength;
    const aside = Math.abs((anchor.x - home.x) * dz - (anchor.z - home.z) * dx) / routeLength;
    assert.ok(along > 20 && along < routeLength - 20, 'survey markers lead to the actual field site');
    assert.ok(Math.abs(aside - 2.5) < 1e-8, 'slender stakes stand beside the clear driving line');
  }
}
const game = Object.freeze({ inLander: false, hopFlight: null });
const before = JSON.stringify(game);
layer.update(game); assert.equal(layer.group.visible, true);
assert.equal(JSON.stringify(game), before, 'presentation never mutates game/save state');
layer.update({ inLander: true }); assert.equal(layer.group.visible, false);
layer.update({ hopFlight: {} }); assert.equal(layer.group.visible, false);
layer.update(game); assert.equal(layer.group.visible, true);
let disposedGeometry = 0, disposedMaterials = 0;
geometries.forEach(g => g.addEventListener('dispose', () => disposedGeometry++));
materials.forEach(m => m.addEventListener('dispose', () => disposedMaterials++));
layer.dispose();
assert.equal(layer.group.parent, null, 'disposal removes scene attachments');
assert.equal(disposedGeometry, geometries.size, 'all batched geometry released');
assert.equal(disposedMaterials, materials.size, 'each shared material released once');
console.log(`Arrival dressing: ${meshes} draws, ${vertices} vertices; grounded service fixtures, six offset route stakes, zero lights, state isolation and disposal pass`);
