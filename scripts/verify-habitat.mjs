import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBurrow } from '../src/burrow.js';
import { habitatLayout, roomAt, roomByKey, constrainHabitat, habitatObstacles } from '../src/habitat-model.js';
import { leafGeometry, plant } from '../src/habitat-plants.js';
import { cushionGeometry, duvetGeometry } from '../src/habitat-textiles.js';
import { HabitatLayer } from '../src/habitat-layer.js';

const burrow = createBurrow();
for (const [key, piece] of [['0,1', 'shaft'], ['1,1', 'corridor'], ['2,1', 'bunk'],
  ['0,2', 'shaft'], ['-1,2', 'corridor'], ['-2,2', 'garden'], ['1,2', 'corridor'],
  ['2,2', 'store'], ['3,2', 'bay']]) burrow.cells.set(key, { piece, dug: 1 });
burrow.cells.set('3,1', { piece: 'store', dug: .99 });
burrow.cells.set('bad,1', { piece: 'bunk', dug: 1 });
const layout = habitatLayout(burrow);
assert.equal(layout.rooms.length, 9, 'only valid finished cells become inhabitable');
assert.equal(roomByKey(layout, '2,1').x, 16);
assert.equal(roomByKey(layout, '0,2').y, -4);
assert(roomByKey(layout, '0,1').below);
assert(roomByKey(layout, '0,2').above);
assert(!roomByKey(layout, '2,1').right, 'unfinished neighbour cannot create an exit');
assert.equal(roomAt(layout, 16, 0, 1).piece, 'bunk');
assert.equal(roomAt(layout, 16, 0, 2).piece, 'store');
assert.equal(roomAt(layout, 16, 5, 1), null);
const walk = (from, to, depth = 1) => constrainHabitat(layout, from, to, depth);
assert(Math.abs(walk({ x: 0, z: 0 }, { x: 16, z: 0 }).x - 16) < 1e-6,
  'real contiguous side doors permit traversal through the saved layout');
assert(walk({ x: 0, z: 2 }, { x: 16, z: 2 }).x < 3.6,
  'large frame cannot tunnel through wall beside the doorway');
assert(walk({ x: 16, z: 0 }, { x: 80, z: 0 }).x < 19.6,
  'planned room remains solid even with a very large movement');
assert(walk({ x: 0, z: 0 }, { x: -20, z: 0 }).x > -3.6,
  'missing neighbour is not traversable');
assert(walk({ x: 14.7, z: 0 }, { x: 14.7, z: -3.5 }).z > -1.53,
  'bunk furniture blocks the player at its actual footprint');
assert(walk({ x: 0, z: 0 }, { x: -16, z: 0 }, 2).x < -15.9);
assert(walk({ x: 0, z: 0 }, { x: 0, z: 200 }).z < 3.6);
for (const room of layout.rooms) for (const obstacle of habitatObstacles(room)) {
  assert(Math.abs(obstacle.x - room.x) + obstacle.w / 2 < 3.85);
  assert(Math.abs(obstacle.z) - obstacle.l / 2 > 1.7, 'centre route is clear');
}

const scene = new THREE.Scene(), layer = new HabitatLayer(scene, burrow);
assert.equal(layer.rooms.size, 9);
let lights = 0, shadowLights = 0, meshes = 0;
layer.group.traverse(object => {
  if (object.isLight) { lights++; if (object.castShadow) shadowLights++; }
  if (object.isMesh) {
    meshes++;
    assert(object.geometry.attributes.position.array.every(Number.isFinite));
  }
});
assert.equal(lights, 4, 'hemisphere and three pooled lights regardless of room count');
assert.equal(shadowLights, 1);
assert(meshes <= 9 * 12, 'static room furnishing is batched by material');
layer.update(1, { position: { x: -16, z: 0 }, depth: 2, sealed: true });
assert(!layer.rooms.get('0,1').visible);
assert(layer.rooms.get('-2,2').visible);
assert.equal(layer.lights[0].position.x, -16);
assert.equal(layer.lights[0].position.y, -4 + 3.02);
assert.equal(layer.lights[0].intensity, 65, 'garden overhead remains a usable work light');
assert(layer.lights[1].intensity > 0 && layer.lights[1].intensity < layer.lights[0].intensity,
  'local task illumination remains subordinate to overhead lighting');
layer.update(2, { position: { x: 0, z: 0 }, depth: 1, sealed: false });
assert.equal(layer.lights[0].intensity, 18);
let disposed = 0;
layer.group.traverse(object => { if (object.isMesh) object.geometry.addEventListener('dispose', () => disposed++); });
layer.dispose(); assert.equal(scene.children.length, 0); assert.equal(disposed, meshes);
console.log('Habitat: exact completed layout, swept walls/doors/furniture, decks, batched rendering and bounded lights PASS');

const garden = roomByKey(layout, '-2,2'), beds = habitatObstacles(garden);
assert.equal(beds.length, 4, 'greenhouse uses four real occupied beds');
assert(beds.reduce((a, b) => a + b.w * b.l, 0) > 17, 'growing footprint exceeds twice the old single trough');
assert(walk({ x: -12.5, z: 0 }, { x: -19.4, z: 0 }, 2).x < -19.3,
  'wide centre aisle between growing banks stays walkable');
assert(walk({ x: -17.55, z: 0 }, { x: -17.55, z: -3.3 }, 2).z > -1.75,
  'expanded growing banks block at their actual visible edge');
const silhouettes = new Set();
for (const kind of ['lettuce', 'grass', 'tomato', 'bean', 'herb', 'seedling', 'vine']) {
  let count = 0, positions = 0;
  plant({ custom(g) { count++; positions += g.attributes.position.count;
    assert(g.attributes.position.array.every(Number.isFinite));
    assert(g.attributes.color, 'leaf colour and age variation survive material batching');
    g.dispose(); return { rotation: { set() {} } }; }, cylinder() { count++; }, sphere() { count += 10; } },
  {}, 0, 0, 0, kind, 9);
  silhouettes.add(`${count}:${positions}`);
}
assert.equal(silhouettes.size, 7, 'seven structurally distinct crop forms');
const leaf = leafGeometry(.5, .2, .4, .2);
assert(new Set(Array.from(leaf.attributes.position.array).filter((_, i) => i % 3 === 1)).size > 20,
  'leaf is a curved lamina, not a flat card'); leaf.dispose();
for (const geometry of [cushionGeometry(.7, .3, 1.1), duvetGeometry(2.6, 1.6)]) {
  assert(geometry.attributes.position.array.every(Number.isFinite));
  assert(geometry.attributes.position.count > 500, 'cloth curvature resolves at room distance'); geometry.dispose();
}
console.log('Habitat art: four collision-matched beds, seven crop structures, curved leaves, inflated cushions and folded cloth PASS');
