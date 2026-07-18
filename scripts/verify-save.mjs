// verify-save: the homestead save round-trips, refuses the future, and
// launders garbage into a playable state — never a crash, never a cheat.

import { SAVE_VERSION, snapshotSave, acceptSave } from '../src/save.js';
import { LANDER_STOCK } from '../src/salvage.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

const state = {
  simMillis: 1770000000000,
  pos: { x: 12.5, z: -3.25 },
  heading: 1.2,
  air: 0.62, warm: 0.8,
  buggy: { x: 20, z: 8, heading: 0.4 },
  suit: { 'alloy-panel': 1, 'seal-kit': 2 },
  rover: { regolith: 4 },
  lander: { 'alloy-panel': 6, 'window-pane': 2, 'seal-kit': 4, cable: 3, electronics: 2, 'airlock-ring': 0 },
  stead: [['4,0,3,0', 'panel'], ['3,1,3,1', 'panel'], ['3,0,3,2', 'airlock']],
  steadBaseY: -52.92,
  steadOrigin: { x: 6, z: 6 },
  exploration: ['0,0', '1,0', '-3,2'],
  everPressurised: true,
  saidFirsts: new Set(['wake', 'first-steps', 'pressurised']),
  rig: { x: -16, z: -1, heading: 0.6, deployed: false, depositId: null, hopper: {} },
  prospected: new Set(),
  fab: { queue: [], t: 0, out: {} },
};

// 1. round-trip: what was lived is what wakes up
{
  const back = acceptSave(snapshotSave(state));
  check('round-trip accepts', back !== null);
  check('clock survives', back.simMillis === state.simMillis);
  check('walker survives', back.pos.x === 12.5 && back.pos.z === -3.25 && back.heading === 1.2);
  check('bags survive', back.suit['alloy-panel'] === 1 && back.rover.regolith === 4);
  check('lander stock survives', back.lander['airlock-ring'] === 0 && back.lander.cable === 3);
  check('stead survives', back.stead.length === 3 && back.stead[2][1] === 'airlock');
  check('fog survives', back.exploration.length === 3);
  check('flags survive', back.everPressurised === true && back.saidFirsts.includes('wake'));
}

// 2. forward-refuse: a newer client's save is politely declined
{
  const meta = snapshotSave(state);
  meta.version = SAVE_VERSION + 1;
  check('future save refused', acceptSave(meta) === null);
  check('garbage refused', acceptSave('nonsense') === null && acceptSave(null) === null);
  check('clockless refused', acceptSave({ version: 1, pos: { x: 0, z: 0 } }) === null);
}

// 3. the launderer: junk fields come out playable, not exploitable
{
  const meta = snapshotSave(state);
  meta.suit = { 'alloy-panel': 5e9, stolen_gold: 40, 'window-pane': -3 };
  meta.lander = { 'alloy-panel': 999, cable: 'lots' };
  meta.stead = [['4,0,3,0', 'panel'], ['bad key', 'panel'], ['1,0,1,0', 'castle'], 'junk'];
  meta.exploration = ['0,0', 'not-a-cell', 42, '3,4'];
  meta.saidFirsts = ['wake', 'made-up-event'];
  meta.air = 99; meta.buggy = { x: NaN, z: 2 };
  const back = acceptSave(meta);
  check('counts capped', back.suit['alloy-panel'] <= 999);
  check('unknown items dropped', !('stolen_gold' in back.suit) && !('window-pane' in back.suit));
  const full = LANDER_STOCK.find((r) => r.id === 'alloy-panel').count;
  check('lander bins clamped to the hull', back.lander['alloy-panel'] === full && back.lander.cable === 0);
  check('stead junk dropped', back.stead.length === 1);
  check('fog junk dropped', back.exploration.length === 2);
  check('event junk dropped', back.saidFirsts.length === 1);
  check('air clamped', back.air === 1);
  check('lame buggy re-parked', Number.isFinite(back.buggy.x));
}

// 4. the expedition rides (additive): rig, prospected ore, the fabricator —
//    and an OLD save without them wakes with sane defaults, not a crash
{
  const { depositsNear } = await import('../src/mine.js');
  const dep = depositsNear(0, 0, 2500)[0];
  const rich = {
    ...state,
    rig: { x: dep.x, z: dep.z, heading: 0.2, deployed: true, depositId: dep.id, hopper: { [dep.type]: 3 } },
    prospected: [dep.id],
    fab: { queue: ['iron-ore', 'ice'], t: 4, out: { 'steel-panel': 2 } },
  };
  const back = acceptSave(snapshotSave(rich));
  check('rig survives deployed on real ore', back.rig.deployed && back.rig.depositId === dep.id
    && back.rig.hopper[dep.type] === 3);
  check('prospects survive', back.prospected.length === 1);
  check('fab survives mid-cook', back.fab.queue.length === 2 && back.fab.out['steel-panel'] === 2);

  // laundering: a deployment on ore that doesn't exist stands down
  const meta = snapshotSave(rich);
  meta.rig.depositId = '9999,9999';
  meta.rig.hopper = { 'steel-panel': 4, [dep.type]: 99 };
  meta.prospected = [dep.id, 'not-ore', '8888,8888'];
  meta.fab.queue = ['iron-ore', 'alloy-panel', 'nonsense'];
  const clean = acceptSave(meta);
  check('phantom deployment stands down', clean.rig.deployed === false && clean.rig.depositId === null);
  check('hopper laundered to raw ore', !('steel-panel' in clean.rig.hopper)
    && clean.rig.hopper[dep.type] <= 8);
  check('phantom prospects dropped', clean.prospected.length === 1);
  check('fab queue laundered', clean.fab.queue.length === 1);

  // a pre-expedition save: no rig fields at all
  const old = snapshotSave(state);
  delete old.rig; delete old.prospected; delete old.fab;
  const woke = acceptSave(old);
  check('old save parks the rig by the lander', woke.rig.x === -16 && !woke.rig.deployed);
  check('old save has cold fab, no prospects', woke.fab.queue.length === 0 && woke.prospected.length === 0);
}

if (failed) { console.error(`verify-save: ${failed} FAILED`); process.exit(1); }
console.log('verify-save: all green');
