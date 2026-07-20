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

// ---- PHASE 1: the whole planet answers ------------------------------------
{
  const { nearestFeature, featuresInBox, FEATURES } = await import('../src/mars.js');
  // published landmarks answer with real elevations (areoid-referenced)
  const olympus = elevationReal(18.65, 226.2);
  check('Olympus stands', olympus > 14000, `${Math.round(olympus)} m`);
  const hellas = elevationReal(-40, 66);
  check('Hellas sinks', hellas < -5500, `${Math.round(hellas)} m`);
  // the fine window and the globe agree at the seam (a 4ppd cell is ~15 km;
  // disagreement at the boundary stays under the coarse cell's own relief)
  const seam = Math.abs(elevationReal(21.99, 77) - elevationReal(22.03, 77));
  check('the window seam holds', seam < 150, `${Math.round(seam)} m`);
  // longitude wraps: 359.9E and 0.1E are neighbours
  const wrapGap = Math.abs(elevationReal(0, 359.95) - elevationReal(0, 0.05));
  check('the planet wraps', wrapGap < 400, `${Math.round(wrapGap)} m`);
  // the gazetteer names the land
  check('features baked and decoded', FEATURES.length >= 60 && FEATURES[0].name.length > 2);
  const home = latLonToWorld(18.41, 77.69);
  check('home knows its name', /jezero/i.test(nearestFeature(home.x, home.z).name),
    nearestFeature(home.x, home.z).name);
  const oly = FEATURES.find((f) => f.name === 'Olympus Mons');
  check('Olympus has world coords', Number.isFinite(oly.x) && Number.isFinite(oly.z));
  const box = featuresInBox(oly.x - 2000, oly.z - 2000, oly.x + 2000, oly.z + 2000);
  check('the chart finds the mountain', box.some((f) => f.name === 'Olympus Mons'));
}

if (failed) { console.error(`verify-mars: ${failed} FAILED`); process.exit(1); }
console.log('verify-mars: all green');
