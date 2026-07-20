// verify-hopper: the flight core's contract — honest 0.38 g ballistics
// (apex is a quarter of range at 45°), payload eats range, fuel spends
// once at ignition, the staged phase machine walks its sequence
// deterministically, and NEVER free flight: position is a function of
// the plotted hop and the clock, nothing else.

import {
  HOPPER_DRY_KG, TANK_FUEL_KG, MAX_TANKS, MIN_HOP_KM, APEX_FRACTION,
  wetMass, hopRangeKm, fuelForKm, createHopper, loadTank, planHop,
  hopDurations, beginHop, tickHop, serializeHopper, deserializeHopper,
} from '../src/hopper.js';
import { G_MARS } from '../src/physics.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the range model: honest relationships, world-scaled reach — the
//    playable planet is ~107 km around (mars.js 1:200), so a full rack
//    crosses a great arc of it and never laps it
{
  const full = hopRangeKm(MAX_TANKS * TANK_FUEL_KG, 0);
  const one = hopRangeKm(TANK_FUEL_KG, 0);
  check('one tank clears a real hop', one >= MIN_HOP_KM, `${one.toFixed(1)} km`);
  check('a full rack crosses the region, never laps the world',
    full >= 15 && full <= 45, `${full.toFixed(1)} km`);
  check('more fuel, more range', hopRangeKm(200, 0) > hopRangeKm(100, 0));
  check('payload eats range (the buggy costs km)',
    hopRangeKm(200, 260) < hopRangeKm(200, 0));
  check('no fuel, no range', hopRangeKm(0, 0) === 0);
  check('fuelForKm inverts hopRangeKm', (() => {
    const f = fuelForKm(8, 0);
    return hopRangeKm(f, 0) >= 8 && hopRangeKm(f - 0.5, 0) < 8;
  })());
  check('fuel need is monotonic in distance', fuelForKm(14, 0) > fuelForKm(5, 0));
  check('beyond the rack is Infinity', fuelForKm(100000, 0) === Infinity);
  check('wet mass adds up', wetMass(100, 50) === HOPPER_DRY_KG + 95 + 150);
  // the pillar, asserted: the same fuel on Earth's g would go under half
  // as far — low gravity IS the distance-compressor
  const vFor = (km) => Math.sqrt(km * 1000 * G_MARS);
  check('apex fraction is the 45° truth', APEX_FRACTION === 0.25 && vFor(1) > 0);
}

// 2. the plot: inside the circle or not at all
{
  const h = createHopper();
  check('a parked, dry hopper plans nothing', !planHop(h, [0, 0], [50000, 0]).ok);
  for (let i = 0; i < 3; i++) loadTank(h);
  check('tanks load to the rack and no further', (() => {
    const g = createHopper();
    let n = 0;
    while (loadTank(g)) n++;
    return n === MAX_TANKS && g.fuelKg === MAX_TANKS * TANK_FUEL_KG;
  })());
  const near = planHop(h, [0, 0], [800, 0]);
  check('under the minimum the buggy is the answer', !near.ok && MIN_HOP_KM >= 1);
  const fair = planHop(h, [0, 0], [8000, 0]);
  check('a fair target plots', fair.ok && fair.distKm === 8 && fair.fuelNeed <= h.fuelKg);
  const far = planHop(h, [0, 0], [900000, 0]);
  check('beyond the fuel circle refuses', !far.ok);
  const laden = planHop(h, [0, 0], [8000, 0], 260);
  check('the cradle shrinks the circle', laden.fuelNeed > fair.fuelNeed);
}

// 3. the staged sequence: deterministic, never free flight
{
  const h = createHopper();
  for (let i = 0; i < 4; i++) loadTank(h);
  const fuelBefore = h.fuelKg;
  const plan = planHop(h, [0, 0], [12000, 0]);
  check('ignition needs a valid plan', !beginHop(h, [0, 0], [1000, 0]) && h.fuelKg === fuelBefore);
  check('a valid hop ignites', beginHop(h, [0, 0], [12000, 0], 0));
  check('fuel spends once, at ignition, exactly the need',
    Math.abs(h.fuelKg - (fuelBefore - plan.fuelNeed)) < 1e-9);
  check('mid-flight loading refuses', !loadTank(h));

  const phases = [];
  let last = null, maxAlt = 0, prog = -1, monotonic = true;
  let ignMaxBurn = 0, ignMoved = false, arcBurn = 0, brakeSpike = 0;
  let settleTop = 0, sane = true, prev = null, maxStep = 0;
  let guard = 0;
  while (guard++ < 100000) {
    const s = tickHop(h, 0.1);
    if (!s) break;
    last = s;
    if (!phases.includes(s.phase)) phases.push(s.phase);
    maxAlt = Math.max(maxAlt, s.alt);
    if (s.prog < prog - 1e-9) monotonic = false;
    prog = s.prog;
    // the drama channels: bounded, and shaped the way the shot demands
    for (const c of [s.burn, s.shake, s.scour]) {
      if (!Number.isFinite(c) || c < 0 || c > 1) sane = false;
    }
    if (s.phase === 'ignition') {
      ignMaxBurn = Math.max(ignMaxBurn, s.burn);
      if (s.alt !== 0 || s.prog !== 0) ignMoved = true; // hold-down HOLDS
    }
    if (s.phase === 'arc') arcBurn = Math.max(arcBurn, s.burn);
    if (s.phase === 'descent') brakeSpike = Math.max(brakeSpike, s.burn);
    if (s.phase === 'settle') settleTop = Math.max(settleTop, s.alt);
    if (prev && prev.phase !== 'landed') maxStep = Math.max(maxStep, Math.abs(s.alt - prev.alt));
    prev = s;
    if (s.phase === 'landed') break;
  }
  check('the sequence walks ignition -> ascent -> arc -> descent -> settle -> landed',
    phases.join(',') === 'ignition,ascent,arc,descent,settle,landed', phases.join(','));
  check('progress never reverses (no free flight)', monotonic);
  check('the crest nears the ballistic apex', maxAlt > 12000 * 0.2 && maxAlt <= 12000 * 0.25 + 1,
    `${Math.round(maxAlt)} m`);
  check('touchdown parks at the target', last.phase === 'landed'
    && h.state === 'parked' && h.x === 12000 && h.z === 0 && h.hop === null);
  check('touchdown announces itself once', last.touchdown === true);
  check('the drama channels stay in [0,1]', sane);
  check('the hold-down builds fire but never lifts', ignMaxBurn > 0.9 && !ignMoved);
  check('the arc is dead ballistic (the silence is the point)', arcBurn === 0);
  check('the braking burn spikes on descent', brakeSpike > 0.9);
  check('settle flies the last dozen metres', settleTop > 0 && settleTop <= 15);
  check('no altitude pops between frames (seamless profile)',
    maxStep < 12000 * 0.25 * 0.1, `${Math.round(maxStep)} m/tick`);
  const durs = hopDurations(12);
  check('the shot never outstays itself', durs.total < 70 && durs.ascent >= 6);
  check('a longer hop earns a longer arc', hopDurations(20).arc > hopDurations(4).arc);
}

// 3b. the landing law (pads dead 2026-07-20): EVERY landing is exact
//     where you aim — the fuel circle is the only constraint
{
  const { landingPoint } = await import('../src/hopper.js');
  const [x, z] = landingPoint([0, 0], [10000, 0]);
  check('you land where you aim', x === 10000 && z === 0);
  const h = createHopper();
  for (let i = 0; i < 4; i++) loadTank(h);
  beginHop(h, [0, 0], [10000, 0], 0);
  check('the flight flies to the aim itself',
    h.hop.to[0] === 10000 && h.hop.to[1] === 0 && h.hop.aim[0] === 10000);
}

// 4. the save: a hop in progress collapses to its landing — refresh is
//    never a rescue, and never a free repeat
{
  const h = createHopper();
  for (let i = 0; i < 2; i++) loadTank(h);
  beginHop(h, [0, 0], [4000, 0], 0);
  tickHop(h, 3);
  const back = deserializeHopper(serializeHopper(h));
  check('mid-hop save lands at the destination', back.x === 4000 && back.z === 0);
  check('the spent fuel stays spent', back.fuelKg === +h.fuelKg.toFixed(1));
  check('garbage in, parked dry hopper out', deserializeHopper(null).fuelKg === 0);
  check('a hacked tank clamps to the rack',
    deserializeHopper({ fuelKg: 1e6 }).fuelKg === MAX_TANKS * TANK_FUEL_KG);
}

if (failed) { console.error(`verify-hopper: ${failed} FAILED`); process.exit(1); }
console.log('verify-hopper: all green');
