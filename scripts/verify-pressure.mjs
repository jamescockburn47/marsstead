// verify-pressure: airtightness is computed truth — sealed boxes enclose,
// pulled panels vent, the leak finder points at the seam, airlocks door
// the volume, determinism throughout.

import { createStead, place, removePart, faceKey, cellFaces } from '../src/build.js';
import { analyse, volumeAtCell, canPressurise, findLeaks } from '../src/pressure.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// a 1-cell room at (0,0,0): floor, roof, four walls — one wall an airlock
function buildBox(airlockWall = true) {
  const s = createStead();
  place(s, faceKey(0, 0, 0, 1), 'panel');          // floor
  place(s, faceKey(0, 0, 0, 0), 'panel');          // -x wall
  place(s, faceKey(0, 0, 0, 2), airlockWall ? 'airlock' : 'panel'); // -z door
  place(s, faceKey(1, 0, 0, 0), 'panel');          // +x wall
  place(s, faceKey(0, 0, 1, 2), 'panel');          // +z wall
  place(s, faceKey(0, 1, 0, 1), 'panel');          // roof
  return s;
}

// 1. the sealed box encloses exactly one 1-cell volume
{
  const a = analyse(buildBox());
  check('sealed box encloses', a.volumes.length === 1 && a.volumes[0].cells.length === 1,
    `volumes=${a.volumes.length}`);
  const v = volumeAtCell(a, 0, 0, 0);
  check('the volume is the room', !!v);
  check('the airlock is counted', v.airlocks >= 1);
  check('doored + fed = pressurises', canPressurise(v, true) === true);
  check('no air supply = no pressure', canPressurise(v, false) === false);
}

// 2. a box with no airlock encloses but cannot pressurise (no door!)
{
  const a = analyse(buildBox(false));
  const v = volumeAtCell(a, 0, 0, 0);
  check('doorless box encloses but never pressurises', !!v && canPressurise(v, true) === false);
}

// 3. pull a wall panel: the room vents, and the leak finder POINTS AT IT
{
  const s = buildBox();
  removePart(s, faceKey(1, 0, 0, 0)); // the +x wall comes off
  const a = analyse(s);
  check('breached box vents', volumeAtCell(a, 0, 0, 0) === null);
  const leaks = findLeaks(s, [0, 0, 0]);
  check('leak finder finds the gap', leaks.includes(faceKey(1, 0, 0, 0)), `${leaks}`);
}

// 4. an intact room reports no leaks
{
  const leaks = findLeaks(buildBox(), [0, 0, 0]);
  check('sealed room reports no leaks', Array.isArray(leaks) && leaks.length === 0);
}

// 5. a 2x1 room (two cells sharing an open face) is ONE volume
{
  const s = createStead();
  // floors
  place(s, faceKey(0, 0, 0, 1), 'panel'); place(s, faceKey(1, 0, 0, 1), 'panel');
  // ring walls (skip the shared face between the cells)
  place(s, faceKey(0, 0, 0, 0), 'airlock');
  place(s, faceKey(2, 0, 0, 0), 'panel');
  place(s, faceKey(0, 0, 0, 2), 'panel'); place(s, faceKey(1, 0, 0, 2), 'panel');
  place(s, faceKey(0, 0, 1, 2), 'panel'); place(s, faceKey(1, 0, 1, 2), 'panel');
  // roofs
  place(s, faceKey(0, 1, 0, 1), 'panel'); place(s, faceKey(1, 1, 0, 1), 'panel');
  const a = analyse(s);
  check('two open cells, one volume', a.volumes.length === 1 && a.volumes[0].cells.length === 2,
    `volumes=${a.volumes.length} cells=${a.volumes[0]?.cells.length}`);
}

// 6. windows seal like panels (glass holds air)
{
  const s = buildBox();
  removePart(s, faceKey(0, 0, 1, 2));
  place(s, faceKey(0, 0, 1, 2), 'window');
  const a = analyse(s);
  check('windows hold pressure', volumeAtCell(a, 0, 0, 0) !== null);
}

// 7. determinism: same stead, same analysis, twice
{
  const s = buildBox();
  const a = JSON.stringify(analyse(s).volumes);
  const b = JSON.stringify(analyse(s).volumes);
  check('analysis deterministic', a === b);
}

// 8. the empty stead analyses to nothing without exploding
{
  const a = analyse(createStead());
  check('empty stead analyses clean', a.volumes.length === 0);
}

if (failed) { console.error(`verify-pressure: ${failed} FAILED`); process.exit(1); }
console.log('verify-pressure: all green');
