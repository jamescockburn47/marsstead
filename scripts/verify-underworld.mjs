import assert from 'node:assert/strict';
import { UNDER_LENGTH, centreAt, floorAt, constrainPosition, UNDER_NODES,
  acceptUnderworld, interactUnderworld, nextUnderNode } from '../src/underworld.js';

assert.equal(UNDER_LENGTH, 150);
for (let z = 0; z <= UNDER_LENGTH; z += 0.25) {
  const c = centreAt(z);
  assert.deepEqual(centreAt(z), c);
  assert(c.width >= 2.3 && c.width <= 6.8);
  assert(c.height >= 2.4 && c.height <= 5);
  assert(Math.abs(floorAt(c.x, z) - c.y) < 1e-9);
  for (const sign of [-1, 1]) {
    assert(Math.abs(floorAt(c.x + sign * c.width, z) - (c.y + c.height)) < 1e-7);
    assert(Math.abs(floorAt(c.x + sign * 0.5 * c.width, z)-c.y) < .05);
    const p = constrainPosition(c.x + sign * 1000, z);
    const boundedCentre = centreAt(p.z);
    assert(p.z >= 1 && p.z <= 149);
    assert(Math.abs(p.x - boundedCentre.x) + 0.4 <= boundedCentre.width * 0.8 + 1e-9);
    assert(Math.abs(p.x - boundedCentre.x) + 0.4 <= boundedCentre.width - 0.6 + 1e-9);
    assert.equal(p.y, floorAt(p.x, p.z));
    assert(Object.values(p).every(Number.isFinite));
  }
  if (z > 0) {
    const previous = centreAt(z - 0.25);
    assert(Math.abs(c.x - previous.x) < 0.19, 'continuous centreline');
    assert(Math.abs(c.width - previous.width) < 0.13, 'smooth chamber widening');
    assert(c.y < previous.y, 'descent is monotonic');
  }
}
for (const at of [38, 85, 132]) assert(centreAt(at).width > 6);
assert(centreAt(0).width < 3);
for (const invalid of [NaN, Infinity, -Infinity, null, 'bad']) {
  assert(Object.values(centreAt(invalid)).every(Number.isFinite));
  assert(Number.isFinite(floorAt(invalid, invalid)));
  assert(Object.values(constrainPosition(invalid, invalid, invalid)).every(Number.isFinite));
}
assert.equal(constrainPosition(0, -99).z, 1);
assert.equal(constrainPosition(0, 999).z, 149);
assert.equal(new Set(UNDER_NODES.map((n) => n.id)).size, 3);
assert.deepEqual(UNDER_NODES.map((n) => n.z), [30, 78, 128]);
for (const n of UNDER_NODES) {
  assert(n.description.length > 20);
  assert(Math.abs(n.x - centreAt(n.z).x) < centreAt(n.z).width * 0.8);
}
assert.deepEqual(acceptUnderworld(null), { completed: [], returned: false });
assert.deepEqual(acceptUnderworld({ completed: ['lattice'], returned: true }), { completed: [], returned: false });
assert.deepEqual(acceptUnderworld({ completed: ['relay', 'relay', 'unknown', 3, 'lattice'] }),
  { completed: ['relay'], returned: false });
const s = acceptUnderworld(null);
assert.equal(nextUnderNode(s).id, 'relay');
assert.equal(interactUnderworld(s, 'brood'), false);
assert.deepEqual(s.completed, []);
for (const n of UNDER_NODES) {
  assert.equal(nextUnderNode(s).id, n.id);
  assert(interactUnderworld(s, n.id));
  assert.equal(interactUnderworld(s, n.id), false, 'no duplicate completion');
  assert.deepEqual(acceptUnderworld(JSON.parse(JSON.stringify(s))), s);
}
assert.equal(nextUnderNode(s), null);
assert.equal(s.returned, false, 'finishing a reading does not teleport home');
s.returned = true;
assert.deepEqual(acceptUnderworld(JSON.parse(JSON.stringify(s))), s);
assert.equal(interactUnderworld(s, 'lattice'), false);
assert.equal(s.returned, true);
assert.equal(interactUnderworld(null, 'relay'), false);
assert.deepEqual(acceptUnderworld({ completed: [...s.completed].reverse(), returned: 'true' }),
  { completed: s.completed, returned: false });
console.log('verify-underworld: deterministic gallery, walk limits, ordered readings and save acceptance green');
