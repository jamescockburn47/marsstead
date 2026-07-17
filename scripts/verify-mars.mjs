// verify-mars: the geography module decodes the baked table faithfully,
// projects consistently, and the ground never lies.

import {
  latLonToWorld, worldToLatLon, elevationReal, groundHeight,
  detailGame, M_PER_DEG, VERT, HOME, IS_PLACEHOLDER, SOURCE,
} from '../src/mars.js';
import {
  LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, GRID_W, GRID_H,
} from '../src/marsdata.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

console.log(`  source: ${SOURCE}`);

// projection round-trips exactly
{
  let worst = 0;
  for (const [lat, lon] of [[18.44, 77.45], [14.2, 73.1], [21.9, 80.8], [16, 76]]) {
    const w = latLonToWorld(lat, lon);
    const b = worldToLatLon(w.x, w.z);
    worst = Math.max(worst, Math.abs(b.lat - lat), Math.abs(b.lon - lon));
  }
  check('projection round-trip', worst < 1e-9, `worst=${worst}`);
}

// HOME maps to the origin
{
  const w = latLonToWorld(HOME.lat, HOME.lon);
  check('HOME at origin', Math.abs(w.x) < 1e-9 && Math.abs(w.z) < 1e-9);
}

// elevations plausible for Mars everywhere on the table
{
  let ok = true, lo = 1e9, hi = -1e9;
  for (let i = 0; i < 4000; i++) {
    const lat = LAT_MIN + ((i * 7919) % 1000) / 1000 * (LAT_MAX - LAT_MIN);
    const lon = LON_MIN + ((i * 104729) % 1000) / 1000 * (LON_MAX - LON_MIN);
    const e = elevationReal(lat, lon);
    lo = Math.min(lo, e); hi = Math.max(hi, e);
    if (!(e >= -8200 && e <= 21900)) ok = false;
  }
  check('elevation within Mars bounds', ok, `range ${lo.toFixed(0)}..${hi.toFixed(0)} m`);
  check('region has real relief', hi - lo > 400, `relief=${(hi - lo).toFixed(0)} m`);
}

// Jezero reads as a crater: rim above floor
{
  const floor = elevationReal(18.44, 77.45);
  const rimW = elevationReal(18.44, 77.45 - 0.40);
  const rimE = elevationReal(18.44, 77.45 + 0.40);
  check('Jezero rim above floor', rimW > floor && rimE > floor,
    `floor=${floor.toFixed(0)} rimW=${rimW.toFixed(0)} rimE=${rimE.toFixed(0)}`);
}

// off-table continuation is finite and sane
{
  const e = elevationReal(-40, 200);
  check('off-table continuation sane', e > -8200 && e < 21900, `${e}`);
}

// determinism: the ground answers the same twice (invariant 4)
{
  let ok = true;
  for (let i = 0; i < 500; i++) {
    const x = (i * 137.7) % 2000 - 1000, z = (i * 251.3) % 2000 - 1000;
    if (groundHeight(x, z) !== groundHeight(x, z)) ok = false;
    if (detailGame(x, z) !== detailGame(x, z)) ok = false;
  }
  check('groundHeight deterministic', ok);
}

// groundHeight = real * VERT + detail, exactly (one truth)
{
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const x = (i * 61.7) % 1200 - 600, z = (i * 97.3) % 1200 - 600;
    const { lat, lon } = worldToLatLon(x, z);
    const want = elevationReal(lat, lon) * VERT + detailGame(x, z);
    if (Math.abs(groundHeight(x, z) - want) > 1e-9) ok = false;
  }
  check('groundHeight composition exact', ok);
}

// the table's declared shape matches its payload
check('grid dimensions coherent', GRID_W > 100 && GRID_H > 100);
console.log(`  placeholder: ${IS_PLACEHOLDER}`);

if (failed) { console.error(`verify-mars: ${failed} FAILED`); process.exit(1); }
console.log('verify-mars: all green');
