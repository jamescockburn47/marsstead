// verify-explore: the earned map — fog clears where you walk, stays where
// you haven't, survives the save, and never forgets.

import {
  EXPLORE_CELL, REVEAL_RADIUS, createExploration, visit, isVisited,
  bounds, serialize, deserialize,
} from '../src/explore.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. a visit clears a disc: here yes, the far side of the crater no
{
  const e = createExploration();
  const added = visit(e, 0, 0);
  check('first visit reveals a disc', added > 4, `${added}`);
  check('here is visited', isVisited(e, 0, 0));
  check('inside the radius is visited', isVisited(e, REVEAL_RADIUS * 0.6, 0));
  check('two radii out is fog', !isVisited(e, REVEAL_RADIUS * 2.5, 0));
}

// 2. revisits are free; steps re-stamp only the leading edge
{
  const e = createExploration();
  visit(e, 0, 0);
  check('standing still adds nothing', visit(e, 0, 0) === 0);
  const edge = visit(e, EXPLORE_CELL, 0);
  const total = e.cells.size;
  check('a step adds only the crescent', edge > 0 && edge < total / 2, `${edge}/${total}`);
}

// 3. bounds grow with exploration and hold every visited cell
{
  const e = createExploration();
  check('empty map has no bounds', bounds(e) === null);
  visit(e, 0, 0);
  const b1 = bounds(e);
  visit(e, 900, -600);
  const b2 = bounds(e);
  check('bounds grow with the walk',
    b2.maxX > b1.maxX && b2.minZ < b1.minZ);
  check('bounds hold the far camp', b2.maxX > 900 && b2.minZ < -600);
}

// 4. save round-trip, deterministic
{
  const e = createExploration();
  visit(e, 40, 40); visit(e, -300, 120);
  const back = deserialize(serialize(e));
  check('save round-trips', back.cells.size === e.cells.size
    && [...e.cells].every((k) => back.cells.has(k)));
  const f = createExploration();
  visit(f, 40, 40); visit(f, -300, 120);
  check('deterministic', f.cells.size === e.cells.size);
}

if (failed) { console.error(`verify-explore: ${failed} FAILED`); process.exit(1); }
console.log('verify-explore: all green');
