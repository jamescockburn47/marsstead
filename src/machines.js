// Base machines — the refinery, pure, no THREE, no DOM.
// verify-machines.mjs guards it. PHASE2 step 5: the built smelter and
// electrolyser OUT-RATE the lander's fabricator (refine.js) without
// replacing its logic — same queue-and-tray shape, faster clocks, built
// where the ore comes home instead of where the lander happened to fall.
// O2 and methalox ride the electrolyser later; today it makes water.

export const MACHINE_TYPES = {
  smelter: {
    name: 'Smelter',
    costs: [['steel-panel', 1], ['electronics', 1], ['cable', 1]],
    recipes: {
      'iron-ore': { out: 'steel-panel', seconds: 12 },
      silica: { out: 'glass', seconds: 10 },
    },
  },
  electrolyser: {
    name: 'Electrolyser',
    costs: [['alloy-panel', 1], ['electronics', 1], ['seal-kit', 1]],
    recipes: {
      ice: { out: 'water', seconds: 6 },
    },
  },
};

export const MACHINE_QUEUE_CAP = 24;
export const MAX_MACHINE_SLOPE = 0.25;
export const MACHINE_SPACING = 3;   // m — machines don't stack

export function createMachine(type, x, z, heading = 0) {
  if (!MACHINE_TYPES[type]) return null;
  return { type, x, z, heading, queue: [], t: 0, out: {} };
}

// placement law: known type, tolerable ground, clear of its neighbours
export function canPlaceMachine(type, slope, machines, x, z) {
  if (!MACHINE_TYPES[type] || slope > MAX_MACHINE_SLOPE) return false;
  return machines.every((m) => Math.hypot(m.x - x, m.z - z) >= MACHINE_SPACING);
}

export function machineFeed(m, id, n = 1) {
  if (!MACHINE_TYPES[m.type].recipes[id]) return 0;
  let fed = 0;
  while (fed < n && m.queue.length < MACHINE_QUEUE_CAP) { m.queue.push(id); fed++; }
  return fed;
}

// returns the finished id when one drops (same contract as refine.fabTick)
export function machineTick(m, dt) {
  const head = m.queue[0];
  if (!head) { m.t = 0; return null; }
  m.t += dt;
  const r = MACHINE_TYPES[m.type].recipes[head];
  if (m.t < r.seconds) return null;
  m.t = 0;
  m.queue.shift();
  m.out[r.out] = (m.out[r.out] || 0) + 1;
  return r.out;
}

export function machineTake(m, id, n = 1) {
  if (!m.out[id]) return 0;
  const k = Math.min(n, m.out[id]);
  m.out[id] -= k;
  if (m.out[id] === 0) delete m.out[id];
  return k;
}

export function machineOutCount(m) {
  return Object.values(m.out).reduce((a, b) => a + b, 0);
}
