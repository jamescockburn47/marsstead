// verify-machines: the built refinery is honest — buildable from the
// world's actual economy, faster than the lander's bench, same contract.

import {
  MACHINE_TYPES, MACHINE_QUEUE_CAP, createMachine, canPlaceMachine,
  machineFeed, machineTick, machineTake, machineOutCount,
} from '../src/machines.js';
import { RECIPES } from '../src/refine.js';
import { ITEMS } from '../src/inventory.js';

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
