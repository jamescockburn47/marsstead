// verify-mine: the ore is where it is — deterministic, out of arm's reach,
// honest types; the drill fills at its rate and idles against a full hopper.

import {
  DEPOSIT_GRID, MIN_HOME_DIST, DEPLOY_RADIUS, MAX_DEPLOY_SLOPE,
  HOPPER_CAP, DRILL_SECONDS,
  depositAt, depositById, depositsNear, createRig, canDeploy, deploy,
  packUp, drillTick, hopperCount, hopperTake,
} from '../src/mine.js';
import { ITEMS } from '../src/inventory.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. deterministic and reachable: the same world every boot, with ore in it
{
  const a = depositsNear(0, 0, 2500), b = depositsNear(0, 0, 2500);
  check('deposits exist within a drive', a.length >= 3, `${a.length}`);
  check('deterministic', a.length === b.length
    && a.every((d, i) => d.id === b[i].id && d.x === b[i].x && d.type === b[i].type));
  check('none under the doormat', a.every((d) => Math.hypot(d.x, d.z) >= MIN_HOME_DIST));
  check('types are real items', a.every((d) => ITEMS[d.type]));
  check('id round-trips', a.every((d) => depositById(d.id)?.x === d.x));
  check('grid owns its cell', depositsNear(5000, 5000, DEPOSIT_GRID * 3)
    .every((d) => depositAt(...d.id.split(',').map(Number)).id === d.id));
}

// 2. the anchor law: near, level, loose — or nothing
{
  const d = depositsNear(0, 0, 2500)[0];
  const rig = createRig(d.x + 5, d.z);
  check('anchors on the ore', canDeploy(rig, d, 0.1));
  check('refuses a slope', !canDeploy(rig, d, MAX_DEPLOY_SLOPE + 0.05));
  rig.hitched = true;
  check('refuses while hitched', !canDeploy(rig, d, 0.1));
  rig.hitched = false;
  const far = createRig(d.x + DEPLOY_RADIUS + 2, d.z);
  check('refuses off the body', !canDeploy(far, d, 0.1));
}

// 3. the drill: one unit per DRILL_SECONDS, of the deposit's type, to cap
{
  const d = depositsNear(0, 0, 2500)[0];
  const rig = createRig(d.x, d.z);
  deploy(rig, d);
  let made = 0;
  for (let t = 0; t < DRILL_SECONDS * (HOPPER_CAP + 3); t += 0.5) {
    if (drillTick(rig, 0.5)) made++;
  }
  check('drill fills to the cap and idles', made === HOPPER_CAP && hopperCount(rig) === HOPPER_CAP,
    `made=${made}`);
  check('ore is the deposit\'s type', rig.hopper[d.type] === HOPPER_CAP);
  const take = hopperTake(rig, null, 3);
  check('hopper hands over', take.n === 3 && hopperCount(rig) === HOPPER_CAP - 3);
  packUp(rig);
  check('packed rig drills nothing', drillTick(rig, DRILL_SECONDS * 2) === null);
}

if (failed) { console.error(`verify-mine: ${failed} FAILED`); process.exit(1); }
console.log('verify-mine: all green');
