// verify-burrow: the warren's contract — socket rules hold, drones dig in
// order, spoil is ore, the ring is the boundary, and a save round-trip
// rebuilds the same home.

import {
  BURROW_PIECES, COLS, DEPTHS, LIGHT_REACH, createBurrow, canPlan, plan,
  cancelPlan, tick, installRing, isPressurised, isBedworthy, takeSpoil,
  spoilFor, digCost, serialize, deserialize, warrenReport, gardenLit,
} from '../src/burrow.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

const digAll = (b, drones = 4) => { let guard = 0; while (b.queue.length && guard++ < 500) tick(b, 10, drones); };

// 1. socket rules
{
  const b = createBurrow();
  check('shaft starts at the top, column 0', canPlan(b, 'shaft', 0, 1));
  check('no shaft off-column', !canPlan(b, 'shaft', 1, 1));
  check('no deep shaft before shallow is DUG', plan(b, 'shaft', 0, 1) && !canPlan(b, 'shaft', 0, 2));
  check('no corridor off undug shaft', !canPlan(b, 'corridor', 1, 1));
  digAll(b);
  check('deeper shaft after digging', canPlan(b, 'shaft', 0, 2));
  check('corridor off dug shaft', plan(b, 'corridor', 1, 1));
  check('no room off the shaft directly', !canPlan(b, 'bunk', -1, 1));
  digAll(b);
  check('room off dug corridor', plan(b, 'bunk', 2, 1));
  check('no double occupancy', !canPlan(b, 'store', 2, 1));
  check('bounds hold', !canPlan(b, 'corridor', COLS + 2, 1) && !canPlan(b, 'shaft', 0, DEPTHS + 1));
}

// 2. the hands: oldest dig first, spoil pays, cancel only before the spade
{
  const b = createBurrow();
  plan(b, 'shaft', 0, 1);
  const before = tick(b, 0.5, 2);
  check('digging is gradual', before.length === 0 && b.cells.get('0,1').dug > 0);
  check('a started dig cannot be cancelled', !cancelPlan(b, 0, 1));
  const events = [];
  let guard = 0;
  while (b.queue.length && guard++ < 200) events.push(...tick(b, 5, 3));
  check('the dig completes with an event', events.some((e) => e.type === 'dug' && e.key === '0,1'));
  const s = takeSpoil(b);
  check('spoil is ore (the house pays)', s.regolith > 0);
  check('spoil drawer empties', takeSpoil(b).regolith === 0);
  check('no drones, no progress', (plan(b, 'shaft', 0, 2), tick(b, 100, 0).length === 0));
  check('spoil deterministic', JSON.stringify(spoilFor(3, 4)) === JSON.stringify(spoilFor(3, 4)));
  check('depth digs slower', digCost('bunk', 5) > digCost('bunk', 1));
}

// 3. the ring and the pressure boundary
{
  const b = createBurrow();
  check('no ring on unbroken ground', !installRing(b));
  plan(b, 'shaft', 0, 1); digAll(b);
  check('ring caps a dug shaft', installRing(b));
  check('ring installs once', !installRing(b));
  check('shaft alone is not a home', !isPressurised(b));
  plan(b, 'corridor', 1, 1); digAll(b);
  plan(b, 'store', 2, 1); digAll(b);
  check('a dug room behind the ring holds pressure', isPressurised(b));
  check('a store is not a bed', !isBedworthy(b));
  plan(b, 'bunk', -1, 1);
  check('rooms never hang off the shaft', !b.cells.has('-1,1'));
  plan(b, 'corridor', -1, 1); digAll(b);
  plan(b, 'bunk', -2, 1); digAll(b);
  check('a dug bunk is bedworthy', isBedworthy(b));
}

// 4. save round-trip
{
  const b = createBurrow();
  plan(b, 'shaft', 0, 1); digAll(b); installRing(b);
  plan(b, 'corridor', 1, 1); digAll(b);
  plan(b, 'bunk', 2, 1); tick(b, 3, 1); // leave it half-dug
  const back = deserialize(serialize(b));
  check('round-trip keeps the cells', back.cells.size === b.cells.size);
  check('round-trip keeps the ring', back.ringInstalled === true);
  check('round-trip keeps the half-dug queue', back.queue.length === 1
    && back.cells.get('2,1').dug > 0 && back.cells.get('2,1').dug < 1);
  check('round-trip stays pressurised… wait — no room is dug yet',
    isPressurised(back) === false);
  digAll(back);
  check('…and digs on to a home (the bunk completes)', isPressurised(back) && isBedworthy(back));
  check('garbage in, empty warren out', deserialize(null).cells.size === 0
    && deserialize({ cells: [[1, 2], ['x,y', 'nonsense', 9]] }).cells.size === 0);
}

// 5. the warren report: design has consequences, and the rules are legible
{
  // dig a shaft three deep with corridors at each level
  const base = () => {
    const b = createBurrow();
    plan(b, 'shaft', 0, 1); digAll(b);
    plan(b, 'shaft', 0, 2); digAll(b);
    plan(b, 'shaft', 0, 3); digAll(b);
    installRing(b);
    return b;
  };

  // depth protects: the same bunk scores better deeper
  const shallow = base();
  plan(shallow, 'corridor', 1, 1); digAll(shallow);
  plan(shallow, 'bunk', 2, 1); digAll(shallow);
  const deep = base();
  plan(deep, 'corridor', 1, 3); digAll(deep);
  plan(deep, 'bunk', 2, 3); digAll(deep);
  check('depth protects the bunk',
    warrenReport(deep).shelter > warrenReport(shallow).shelter,
    `${warrenReport(deep).shelter} vs ${warrenReport(shallow).shelter}`);

  // the air loop: a garden stacked beside the bunk pays; a bay costs
  const looped = base();
  plan(looped, 'corridor', 1, 3); digAll(looped);
  plan(looped, 'bunk', 2, 3); digAll(looped);
  plan(looped, 'corridor', 1, 2); digAll(looped);
  plan(looped, 'garden', 2, 2); digAll(looped);
  check('a garden next to the bunk is an air loop',
    warrenReport(looped).shelter > warrenReport(deep).shelter);
  const noisy = base();
  plan(noisy, 'corridor', 1, 3); digAll(noisy);
  plan(noisy, 'bunk', 2, 3); digAll(noisy);
  plan(noisy, 'corridor', 1, 2); digAll(noisy);
  plan(noisy, 'bay', 2, 2); digAll(noisy);
  check('a works bay next to the bunk is noise',
    warrenReport(noisy).shelter < warrenReport(deep).shelter);

  // light-pipes have a reach: gardens go dark too deep
  check('light reaches the shallows', gardenLit(1) && gardenLit(LIGHT_REACH));
  check('light fails the deeps', !gardenLit(LIGHT_REACH + 1));
  const dark = base();
  plan(dark, 'corridor', 1, 3); digAll(dark);
  plan(dark, 'garden', 2, 3); digAll(dark);
  check('a dark garden scrubs nothing', warrenReport(dark).air === 0);
  check('a lit garden pays air', warrenReport(looped).air > 0);

  // staging: a store beside the shaft speeds the haul, and it caps
  const staged = base();
  plan(staged, 'corridor', 1, 2); digAll(staged);
  plan(staged, 'corridor', -1, 2); digAll(staged);
  // stores flanking the shaft: rooms attach to corridors, and the cells
  // beside a shaft ARE corridor-adjacent from the far side
  plan(staged, 'corridor', 2, 2); digAll(staged);
  plan(staged, 'corridor', 3, 2); digAll(staged);
  plan(staged, 'store', 4, 2); digAll(staged);
  check('a store far from the shaft stages nothing', warrenReport(staged).haul === 0);
  plan(staged, 'store', 2, 3); // needs its own corridor — prove placement law
  check('rooms still obey the corridors', !staged.cells.has('2,3'));
  plan(staged, 'store', -2, 2); digAll(staged);
  check('a store by the spine stages the haul', warrenReport(staged).haul === 0.25);
  const rep = warrenReport(looped);
  check('report bounded', [rep.shelter, rep.air, rep.haul].every((v) => v >= 0 && v <= 1));
  check('report deterministic',
    JSON.stringify(warrenReport(looped)) === JSON.stringify(warrenReport(looped)));
  check('notes name their reasons', rep.notes.every((n) => n.key && n.kind && n.why.length > 4));
}

// 6. the nanofab's debit: funded at ground-breaking, once, never again —
//    and a broke bank makes the queue WAIT, not fail
{
  const { DIG_KWH } = await import('../src/burrow.js');
  const b = createBurrow();
  plan(b, 'shaft', 0, 1);
  const broke = tick(b, 5, 3, () => false);
  check('a broke bank waits', broke.some((e) => e.type === 'waiting')
    && b.cells.get('0,1').dug === 0 && b.queue.length === 1);
  check('waiting reports once, not every tick', tick(b, 5, 3, () => false).length === 0);
  let funds = 0;
  const funder = (kwh) => { funds += kwh; return true; };
  let guard = 0;
  while (b.queue.length && guard++ < 200) tick(b, 5, 3, funder);
  check('funding resumes the dig', b.cells.get('0,1').dug >= 1);
  check('the debit lands once, at the listed price', funds === DIG_KWH.shaft);
  // a half-dug cell survives the save without paying twice
  plan(b, 'shaft', 0, 2);
  tick(b, 2, 3, funder); // starts (pays) and half-digs
  const paidBefore = funds;
  const back = deserialize(serialize(b));
  let fundsBack = 0;
  guard = 0;
  while (back.queue.length && guard++ < 200) tick(back, 5, 3, (k) => { fundsBack += k; return true; });
  check('a resumed dig never pays twice', fundsBack === 0 && paidBefore === funds + 0
    && back.cells.get('0,2').dug >= 1);
  check('prices are legible integers', Object.values(DIG_KWH)
    .every((v) => Number.isInteger(v) && v >= 1 && v <= 6));
}

if (failed) { console.error(`verify-burrow: ${failed} FAILED`); process.exit(1); }
console.log('verify-burrow: all green');
