// The expedition's ground truth — deposits and the drill rig, pure, no
// THREE, no DOM. verify-mine.mjs guards it. PHASE2: Mars provides bulk,
// only the mine provides ore, and the ore is WHERE IT IS — deposits are
// deterministic from the world seed (invariant 4: hash, never random),
// far enough from the drop site that reaching one is an expedition, and
// the rig only produces while anchored on top of one.

import { hash2 } from './noise.js';

export const DEPOSIT_GRID = 260;    // m between candidate sites
export const DEPOSIT_CHANCE = 0.22; // fraction of candidates that hold ore
export const MIN_HOME_DIST = 240;   // m — no ore under the doormat
export const PROSPECT_RADIUS = 60;  // m — close enough to read the ground
export const DEPLOY_RADIUS = 14;    // m — anchor this near the ore body
export const MAX_DEPLOY_SLOPE = 0.18; // rise/run — the rig must level
export const HOPPER_CAP = 8;        // units aboard before the drill idles
export const DRILL_SECONDS = 18;    // one unit every this many seconds

// iron-weighted: steel is the homestead's hunger
const TYPES = ['iron-ore', 'iron-ore', 'ice', 'silica'];

// the deposit owned by candidate grid cell (gx, gz), or null
export function depositAt(gx, gz) {
  if (hash2(gx * 3 + 11, gz * 3 - 7) > DEPOSIT_CHANCE) return null;
  const ox = (hash2(gx * 5 + 1, gz * 5 + 2) - 0.5) * DEPOSIT_GRID * 0.6;
  const oz = (hash2(gx * 7 + 3, gz * 7 + 4) - 0.5) * DEPOSIT_GRID * 0.6;
  const x = gx * DEPOSIT_GRID + DEPOSIT_GRID / 2 + ox;
  const z = gz * DEPOSIT_GRID + DEPOSIT_GRID / 2 + oz;
  if (Math.hypot(x, z) < MIN_HOME_DIST) return null;
  const type = TYPES[Math.floor(hash2(gx * 13 + 5, gz * 13 + 6) * TYPES.length)];
  return { id: `${gx},${gz}`, x, z, type };
}

export function depositById(id) {
  if (typeof id !== 'string') return null;
  const [gx, gz] = id.split(',').map(Number);
  if (!Number.isFinite(gx) || !Number.isFinite(gz)) return null;
  return depositAt(gx, gz);
}

// every deposit within radius of (x, z)
export function depositsNear(x, z, radius) {
  const g0x = Math.floor((x - radius) / DEPOSIT_GRID);
  const g1x = Math.floor((x + radius) / DEPOSIT_GRID);
  const g0z = Math.floor((z - radius) / DEPOSIT_GRID);
  const g1z = Math.floor((z + radius) / DEPOSIT_GRID);
  const out = [];
  for (let gx = g0x; gx <= g1x; gx++) {
    for (let gz = g0z; gz <= g1z; gz++) {
      const d = depositAt(gx, gz);
      if (d && Math.hypot(d.x - x, d.z - z) <= radius) out.push(d);
    }
  }
  return out;
}

// ---- the rig ---------------------------------------------------------------
export function createRig(x, z, heading = 0) {
  return {
    x, z, heading,
    hitched: false,
    deployed: false, depositId: null,
    drill: 0,          // seconds toward the next unit
    hopper: {},        // ore type -> count
  };
}

export function hopperCount(rig) {
  return Object.values(rig.hopper).reduce((a, b) => a + b, 0);
}

// anchor law: unhitched, undeployed, on tolerable ground, on the ore
export function canDeploy(rig, deposit, slope) {
  return !!deposit && !rig.hitched && !rig.deployed
    && slope <= MAX_DEPLOY_SLOPE
    && Math.hypot(rig.x - deposit.x, rig.z - deposit.z) <= DEPLOY_RADIUS;
}

export function deploy(rig, deposit) {
  rig.deployed = true;
  rig.depositId = deposit.id;
  rig.drill = 0;
}

export function packUp(rig) {
  rig.deployed = false;
  rig.depositId = null;
  rig.drill = 0;
}

// the drill's patient arithmetic: returns the ore type when a unit lands
// in the hopper, null otherwise. A full hopper idles the drill (and its
// progress — nothing accrues against a wall).
export function drillTick(rig, dt) {
  const deposit = rig.deployed ? depositById(rig.depositId) : null;
  if (!deposit || hopperCount(rig) >= HOPPER_CAP) { rig.drill = 0; return null; }
  rig.drill += dt;
  if (rig.drill >= DRILL_SECONDS) {
    rig.drill -= DRILL_SECONDS;
    rig.hopper[deposit.type] = (rig.hopper[deposit.type] || 0) + 1;
    return deposit.type;
  }
  return null;
}

// take up to n units of one type out of the hopper (first bin by default)
export function hopperTake(rig, type = null, n = 1) {
  const id = type || Object.keys(rig.hopper)[0];
  if (!id || !rig.hopper[id]) return null;
  const k = Math.min(n, rig.hopper[id]);
  rig.hopper[id] -= k;
  if (rig.hopper[id] === 0) delete rig.hopper[id];
  return { id, n: k };
}
