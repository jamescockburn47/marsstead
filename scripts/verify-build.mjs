// verify-build: the build grammar holds — canonical faces, the rooting
// law, costs declared, save round-trips, determinism.

import {
  CELL, PART_TYPES, faceKey, parseFaceKey, faceCells, cellFaces, faceCentre,
  createStead, canPlace, place, removePart, partAt, serialize, deserialize,
  cardinal, wallFace, roofFace, cursorFace,
} from '../src/build.js';
import { ITEMS } from '../src/inventory.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. face keys canonical: a cell's +x face IS its neighbour's -x face
{
  const plusX = cellFaces(0, 0, 0)[1];
  const minusXOfNeighbour = cellFaces(1, 0, 0)[0];
  check('shared faces share keys', plusX === minusXOfNeighbour, `${plusX} vs ${minusXOfNeighbour}`);
  const f = parseFaceKey(faceKey(3, -2, 7, 1));
  check('face key round-trips', f.x === 3 && f.y === -2 && f.z === 7 && f.axis === 1);
  const { lo, hi } = faceCells(1, 0, 0, 0);
  check('faceCells brackets the face', lo[0] === 0 && hi[0] === 1);
}

// 2. every part type names real item costs
{
  let ok = true;
  for (const t of Object.values(PART_TYPES)) {
    for (const [id, n] of t.costs) if (!ITEMS[id] || n < 1) ok = false;
  }
  check('part costs reference real items', ok);
}

// 3. the rooting law: ground floors first, walls only touching the build
{
  const s = createStead();
  check('floor on the ground places', place(s, faceKey(0, 0, 0, 1), 'panel'));
  check('wall standing on the ground places', place(s, faceKey(5, 0, 5, 0), 'panel'));
  check('floating wall refuses', canPlace(s, faceKey(10, 3, 10, 0)) === false);
  check('wall touching the floor places', place(s, faceKey(0, 0, 0, 0), 'panel'));
  check('double placement refuses', place(s, faceKey(0, 0, 0, 1), 'panel') === false);
  check('unknown type refuses', place(s, faceKey(1, 0, 0, 1), 'nonsense') === false);
  removePart(s, faceKey(0, 0, 0, 0));
  check('removal removes', partAt(s, faceKey(0, 0, 0, 0)) === null);
}

// 4. save round-trip: serialize -> deserialize -> identical parts
{
  const s = createStead();
  place(s, faceKey(0, 0, 0, 1), 'panel');
  place(s, faceKey(0, 0, 0, 0), 'window');
  place(s, faceKey(0, 0, 0, 2), 'airlock');
  const restored = deserialize(serialize(s));
  let same = restored.parts.size === s.parts.size;
  for (const [k, v] of s.parts) if (restored.parts.get(k)?.type !== v.type) same = false;
  check('save round-trips', same);
}

// 5. geometry helpers stay put
{
  const c = faceCentre(0, 0, 0, 1);
  check('face centre on the cell floor', c[0] === CELL / 2 && c[1] === 0 && c[2] === CELL / 2, `${c}`);
}

// 6. the build cursor: cardinal snap, canonical walls, the outward walk
{
  check('cardinal snaps to x', cardinal(0.9, 0.3).dx === 1 && cardinal(0.9, 0.3).dz === 0);
  check('cardinal snaps to -z', cardinal(0.2, -0.8).dz === -1);
  // the wall between (0,0) and (1,0) carries the same key seen from both sides
  check('wall face canonical both sides',
    wallFace(0, 0, 1, 0) === wallFace(1, 0, -1, 0));
  check('roof sits on top of the cell', roofFace(2, 3) === faceKey(2, 1, 3, 1));

  const s = createStead();
  const first = cursorFace(s, 'wall', 0, 0, 1, 0);
  check('empty stead: cursor is the near wall', first === wallFace(0, 0, 1, 0));
  place(s, first, 'panel');
  check('occupied: cursor walks outward',
    cursorFace(s, 'wall', 0, 0, 1, 0) === wallFace(1, 0, 1, 0));
  check('remove cursor finds the occupied face',
    cursorFace(s, 'wall', 0, 0, 1, 0, true) === first);
  check('remove cursor null on empty walk',
    cursorFace(createStead(), 'wall', 0, 0, 1, 0, true) === null);
}

if (failed) { console.error(`verify-build: ${failed} FAILED`); process.exit(1); }
console.log('verify-build: all green');
