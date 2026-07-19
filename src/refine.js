// The lander's fabricator — pure, no THREE, no DOM. verify-refine.mjs
// guards it. The ISRU bench every real Mars mission packs: fed raw haul,
// it cooks one unit at a time on RTG power and drops finished goods in
// the out-tray. This is the MINIMAL refining that closes PHASE2's loop
// (ore -> steel -> the hab that beats the lander); the built smelter and
// electrolyser of step 5 will out-rate it, not replace its logic.

// The rake first: Mars regolith is a few percent magnetite fines, and a
// magnetic rake pulls them — dig spoil IS ore stock, which is what makes
// "the house pays for itself" literally true. Deliberate pipeline: the
// fab both makes iron-ore (from regolith) and eats it (into steel), so
// one bench walks a sack of spoil all the way to a panel unattended.
export const RECIPES = {
  regolith: { out: 'iron-ore', seconds: 15 },
  'iron-ore': { out: 'steel-panel', seconds: 25 },
  silica: { out: 'glass', seconds: 20 },
  ice: { out: 'water', seconds: 12 },
};
export const QUEUE_CAP = 24;

export function createFab() {
  return { queue: [], t: 0, out: {} }; // queue: raw ids, FIFO; out: id -> n
}

// returns how many were actually accepted
export function fabFeed(fab, id, n = 1) {
  if (!RECIPES[id]) return 0;
  let fed = 0;
  while (fed < n && fab.queue.length < QUEUE_CAP) { fab.queue.push(id); fed++; }
  return fed;
}

// cook the head of the queue; returns the finished id when one drops
export function fabTick(fab, dt) {
  const head = fab.queue[0];
  if (!head) { fab.t = 0; return null; }
  fab.t += dt;
  if (fab.t < RECIPES[head].seconds) return null;
  fab.t = 0;
  fab.queue.shift();
  const out = RECIPES[head].out;
  fab.out[out] = (fab.out[out] || 0) + 1;
  return out;
}

// empty the out-tray one type at a time (caller pays the carry rules)
export function fabTake(fab, id, n = 1) {
  if (!fab.out[id]) return 0;
  const k = Math.min(n, fab.out[id]);
  fab.out[id] -= k;
  if (fab.out[id] === 0) delete fab.out[id];
  return k;
}

export function fabOutCount(fab) {
  return Object.values(fab.out).reduce((a, b) => a + b, 0);
}
