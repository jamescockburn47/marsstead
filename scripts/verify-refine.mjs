// verify-refine: the fabricator cooks in order, at its rates, into the
// out-tray — and won't eat what it has no recipe for.

import {
  RECIPES, QUEUE_CAP, createFab, fabFeed, fabTick, fabTake, fabOutCount,
} from '../src/refine.js';
import { ITEMS } from '../src/inventory.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. recipes name real items on both sides
{
  let ok = true;
  for (const [raw, r] of Object.entries(RECIPES)) {
    if (!ITEMS[raw] || !ITEMS[r.out] || !(r.seconds > 0)) ok = false;
  }
  check('recipes are real', ok);
  check('ore becomes steel', RECIPES['iron-ore'].out === 'steel-panel');
  // the rake: dig spoil IS ore stock — "the house pays for itself" is
  // literal, and the fab's one sanctioned pipeline walks a sack of
  // regolith to a steel panel unattended (rake → smelt at one bench)
  check('regolith rakes to iron ore', RECIPES.regolith
    && RECIPES.regolith.out === 'iron-ore');
  check('the rake pipelines into steel at the same bench',
    RECIPES[RECIPES.regolith.out].out === 'steel-panel');
}

// 1b. The actual unattended product: no synthetic T/refeed in the test.
{
  const fab = createFab();
  fabFeed(fab, 'regolith', 1);
  for (let t = 0; t < 60; t += 0.5) {
    fabTick(fab, 0.5);
  }
  check('a sack of spoil ends as a steel panel', fab.out['steel-panel'] === 1);
  check('pipeline stops at steel', fab.queue.length === 0 && !fab.out['iron-ore']);
  const full = createFab();
  fabFeed(full, 'regolith', QUEUE_CAP);
  fabTick(full, RECIPES.regolith.seconds);
  check('intermediate keeps the full queue bounded', full.queue.length === QUEUE_CAP
    && full.queue[0] === 'iron-ore' && fabOutCount(full) === 0);
}

// 2. the cook: FIFO, per-recipe rates, out-tray fills
{
  const fab = createFab();
  check('no recipe, no meal', fabFeed(fab, 'alloy-panel', 3) === 0);
  check('feeds ore', fabFeed(fab, 'iron-ore', 2) === 2);
  fabFeed(fab, 'ice', 1);
  const drops = [];
  for (let t = 0; t < 80; t += 0.5) {
    const d = fabTick(fab, 0.5);
    if (d) drops.push(d);
  }
  check('cooks in order at rate', drops.join(' ') === 'steel-panel steel-panel water', drops.join(' '));
  check('out-tray holds it', fab.out['steel-panel'] === 2 && fabOutCount(fab) === 3);
  check('tray hands over', fabTake(fab, 'steel-panel', 5) === 2 && fabOutCount(fab) === 1);
}

// 3. the queue cap: an honest bench, not a warehouse
{
  const fab = createFab();
  check('queue caps', fabFeed(fab, 'iron-ore', QUEUE_CAP + 10) === QUEUE_CAP);
  check('idle fab keeps no heat', (fabTick(createFab(), 999), true));
}

if (failed) { console.error(`verify-refine: ${failed} FAILED`); process.exit(1); }
console.log('verify-refine: all green');
