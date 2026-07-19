// verify-machines: the built refinery is honest — buildable from the
// world's actual economy, faster than the lander's bench, same contract.

import {
  MACHINE_TYPES, MACHINE_QUEUE_CAP, createMachine, canPlaceMachine,
  machineFeed, machineTick, machineTake, machineOutCount,
} from '../src/machines.js';
import { RECIPES } from '../src/refine.js';
import { ITEMS } from '../src/inventory.js';
import { LANDER_STOCK } from '../src/salvage.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. every machine names real costs and real recipes, and OUT-RATES the fab
{
  let ok = true, faster = true;
  for (const t of Object.values(MACHINE_TYPES)) {
    for (const [id, n] of t.costs) if (!ITEMS[id] || n < 1) ok = false;
    for (const [raw, r] of Object.entries(t.recipes)) {
      if (!ITEMS[raw] || !ITEMS[r.out] || !(r.seconds > 0)) ok = false;
      if (RECIPES[raw] && r.seconds >= RECIPES[raw].seconds) faster = false;
    }
  }
  check('costs and recipes are real', ok);
  check('machines out-rate the fabricator', faster);
}

// 1b. THE CHAIN LAW: the lander's stock is the head start, never the
//     ceiling. Every cost is either producible somewhere or salvaged;
//     everything a settler needs MANY of costs producible goods only;
//     and no bench accidentally eats its own output (the T-refeed trap)
//     except the sanctioned ore walk: regolith → iron-ore → steel.
{
  const producible = new Set(Object.values(RECIPES).map((r) => r.out));
  for (const t of Object.values(MACHINE_TYPES)) {
    for (const r of Object.values(t.recipes)) producible.add(r.out);
  }
  const salvage = new Set(LANDER_STOCK.map((r) => r.id));
  // spoil pays these directly — the ground itself is a source
  producible.add('regolith'); producible.add('iron-ore');
  producible.add('silica'); producible.add('ice');

  let closed = true;
  for (const [name, t] of Object.entries(MACHINE_TYPES)) {
    for (const [id] of t.costs) {
      if (!producible.has(id) && !salvage.has(id)) {
        closed = false;
        console.error(`        ${name} costs ${id}: neither producible nor salvage`);
      }
    }
  }
  check('every cost is producible or salvaged (no dead ends)', closed);

  // the renewables: arrays, banks and drone frames must never be capped
  // by finite salvage — the grid and the fleet scale from the ground
  const renewable = (ids) => ids.every(([id]) => producible.has(id));
  check('solar arrays are renewable', renewable(MACHINE_TYPES['solar-array'].costs));
  check('battery banks are renewable', renewable(MACHINE_TYPES.battery.costs));
  check('the mill (electronics source) is renewable-or-salvage-once',
    MACHINE_TYPES.mill.costs.every(([id, n]) => producible.has(id)
      || (salvage.has(id) && n <= (LANDER_STOCK.find((r) => r.id === id)?.count ?? 0))));
  check('drone frames grow from the ground', [...Object.values(MACHINE_TYPES)]
    .some((t) => Object.values(t.recipes).some((r) => r.out === 'drone-frame'
      && producible.has(Object.keys(t.recipes).find((k) => t.recipes[k].out === 'drone-frame')))));

  // no accidental pipeline: within one bench, an input that is also that
  // bench's output must be on the sanctioned ore walk (T refeeds the
  // tray — anything else silently swallows goods forever, the old
  // mill-eats-its-own-parts bug that made the assembler unbuildable)
  const OREWALK = new Set(['iron-ore']);
  let noTrap = true;
  const benches = { fab: RECIPES, ...Object.fromEntries(
    Object.entries(MACHINE_TYPES).map(([k, t]) => [k, t.recipes])) };
  for (const [name, recipes] of Object.entries(benches)) {
    const outs = new Set(Object.values(recipes).map((r) => r.out));
    for (const input of Object.keys(recipes)) {
      if (outs.has(input) && !OREWALK.has(input)) {
        noTrap = false;
        console.error(`        ${name}: recipe input ${input} is also its output — T-refeed trap`);
      }
    }
  }
  check('no bench eats its own output (ore walk excepted)', noTrap);
}

// 2. placement law: level ground, spaced out
{
  check('places on the level', canPlaceMachine('smelter', 0.1, [], 0, 0));
  check('refuses a slope', !canPlaceMachine('smelter', 0.3, [], 0, 0));
  const built = [createMachine('smelter', 0, 0)];
  check('refuses to stack', !canPlaceMachine('electrolyser', 0.1, built, 1, 1));
  check('spaces out fine', canPlaceMachine('electrolyser', 0.1, built, 5, 0));
  check('unknown type refuses', createMachine('replicator', 0, 0) === null);
}

// 3. the cook: same contract as the fab, per-type recipes
{
  const sm = createMachine('smelter', 0, 0);
  check('smelter refuses ice', machineFeed(sm, 'ice', 1) === 0);
  machineFeed(sm, 'iron-ore', 2);
  machineFeed(sm, 'silica', 1);
  const drops = [];
  for (let t = 0; t < 40; t += 0.5) { const d = machineTick(sm, 0.5); if (d) drops.push(d); }
  check('smelts in order at rate', drops.join(' ') === 'steel-panel steel-panel glass', drops.join(' '));
  check('tray hands over', machineTake(sm, 'steel-panel', 9) === 2 && machineOutCount(sm) === 1);
  const el = createMachine('electrolyser', 0, 0);
  machineFeed(el, 'ice', 1);
  let w = null;
  for (let t = 0; t < 8 && !w; t += 0.5) w = machineTick(el, 0.5);
  check('electrolyser makes water', w === 'water');
  check('queue caps', machineFeed(el, 'ice', 99) === MACHINE_QUEUE_CAP);
}

if (failed) { console.error(`verify-machines: ${failed} FAILED`); process.exit(1); }
console.log('verify-machines: all green');
