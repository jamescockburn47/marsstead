// verify-power: the thermostat's contract — solar rides sun and dust,
// the RTG never wavers, the bank conserves, and deficit sheds up the
// ladder in order: comfort last, never a death spiral.

import {
  RTG_KW, ARRAY_KW, BATTERY_CAP, LOADS, SHED_ORDER, BUILD_KWH,
  solarFactor, createPower, capacity, supplyKw, demandLedger, tickPower,
  spend, serializePower, deserializePower,
} from '../src/power.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. supply: the sun curve, the dust tax, the steady floor
{
  check('night solar is exactly zero', solarFactor(-10, 0.2) === 0 && solarFactor(0, 0.2) === 0);
  check('noon beats morning', solarFactor(80, 0.3) > solarFactor(20, 0.3));
  check('dust taxes the panel', solarFactor(60, 0.9) < solarFactor(60, 0.2));
  check('a deep storm kills solar', solarFactor(60, 2.0) === 0);
  check('the RTG holds through the night', supplyKw(3, -30, 5) === RTG_KW);
  check('arrays add up', supplyKw(2, 90, 0) > supplyKw(1, 90, 0));
}

// 2. the ledger: itemised, shed-ordered, comfort last
{
  const loads = { drones: 3, cooking: { fab: 1, assembler: 2 }, warrenRooms: 4 };
  const led = demandLedger(loads);
  check('every load is named', led.every((l) => l.name && l.kw > 0));
  check('the ladder is respected', led.map((l) => l.name).join(',') === 'assembler,fab,drone,warren');
  check('warren comfort is last', led[led.length - 1].name === 'warren');
  check('empty base draws nothing', demandLedger({ drones: 0, cooking: {}, warrenRooms: 0 }).length === 0);
}

// 3. the bank: charges on surplus, drains on deficit, conserves, clamps
{
  const p = createPower();
  const day = tickPower(p, 1, 2, 1, 80, 0.2, { drones: 0, cooking: {}, warrenRooms: 0 });
  check('surplus charges the bank', p.charge > 0 && day.shed.length === 0);
  check('the bank clamps at capacity', (() => {
    for (let i = 0; i < 40; i++) tickPower(p, 1, 4, 1, 85, 0.1, { drones: 0, cooking: {}, warrenRooms: 0 });
    return Math.abs(p.charge - capacity(1)) < 1e-9;
  })());
  const night = tickPower(p, 1, 2, 1, -20, 0.2, { drones: 2, cooking: {}, warrenRooms: 2 });
  check('night draws the bank down', p.charge < capacity(1) && night.shed.length === 0);
  check('serve equals demand while the bank holds', night.served === night.demand);
}

// 4. shedding: dry bank darkens the ladder head first, floor survives
{
  const p = createPower(); // empty bank, night, heavy load
  const r = tickPower(p, 1, 3, 1, -20, 0.2,
    { drones: 3, cooking: { assembler: 1, mill: 1, smelter: 1 }, warrenRooms: 3 });
  check('deficit sheds', r.shed.length > 0);
  check('the assembler darkens first', r.shed[0] === 'assembler');
  check('shed follows the ladder', r.shed.every((n, i) => SHED_ORDER.indexOf(n)
    >= (i ? SHED_ORDER.indexOf(r.shed[i - 1]) : 0)));
  check('what remains is served', r.served <= r.supply + 1e-9 || p.charge > 0);
  check('charge never goes negative', p.charge >= 0);
  // the RTG floor: warren comfort alone survives the worst night
  const p2 = createPower();
  const floor = tickPower(p2, 1, 0, 0, -30, 5, { drones: 0, cooking: {}, warrenRooms: 4 });
  check('the RTG carries the warren alone', floor.shed.length === 0);
}

// 5. round trip + constants sane
{
  const p = createPower(); p.charge = 7.5;
  check('save round-trip', deserializePower(serializePower(p)).charge === 7.5);
  check('garbage in, landfall float out (old saves are not stranded)',
    deserializePower(null).charge === createPower().charge);
  check('constants sane', RTG_KW > 0 && ARRAY_KW > RTG_KW && BATTERY_CAP > ARRAY_KW
    && SHED_ORDER[SHED_ORDER.length - 1] === 'warren'
    && Object.values(LOADS).every((v) => v > 0));
}

// 6. the currency: the nanofab spends the bank, never overdrafts
{
  const p = createPower(); p.charge = 8;
  check('a funded build spends', spend(p, BUILD_KWH.machine) && p.charge === 2);
  check('an unfunded build refuses', !spend(p, BUILD_KWH.machine) && p.charge === 2);
  check('refusal costs nothing', p.charge === 2);
  check('build costs are legible integers', Object.values(BUILD_KWH)
    .every((v) => Number.isInteger(v) && v > 0 && v <= BATTERY_CAP));
  // landfall economics: the lander's half-charged cells fund the first
  // parts but NOT a machine — income before ambition, no deadlock
  const fresh = createPower();
  check('landfall funds a part', fresh.charge >= BUILD_KWH.steadPart);
  check('landfall cannot fund a bench', fresh.charge < BUILD_KWH.machine);
  check('the lander bank breaks the battery deadlock',
    capacity(0) > 0 && capacity(0) >= BUILD_KWH.machine);
}

if (failed) { console.error(`verify-power: ${failed} FAILED`); process.exit(1); }
console.log('verify-power: all green');
