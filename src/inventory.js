// Inventory — pure, no THREE, no DOM. verify-inventory.mjs guards it.
// Hard mass limits are the logistics game (PHASE2.md, James's call): the
// suit carries about one panel; the rover deck carries a build's worth.
// Mass is the currency of movement — the rover earns its keep hauling.

// ---- the item catalogue (append-only, the family way) ----------------------
// kg is MASS (invariant everywhere); Mars only changes its weight.
export const ITEMS = {
  // salvage — finite, unbolted from the lander
  'alloy-panel': { name: 'Alloy panel', kg: 28, tier: 'salvage' },
  'window-pane': { name: 'Window pane', kg: 22, tier: 'salvage' },
  'seal-kit': { name: 'Seal kit', kg: 4, tier: 'salvage' },
  cable: { name: 'Cable spool', kg: 9, tier: 'salvage' },
  electronics: { name: 'Electronics', kg: 6, tier: 'salvage' },
  'airlock-ring': { name: 'Airlock ring', kg: 65, tier: 'salvage' },
  // bulk — free, heavy
  regolith: { name: 'Regolith', kg: 20, tier: 'bulk' }, // per sack
  // mined — the expedition pays in these
  'iron-ore': { name: 'Iron ore', kg: 30, tier: 'mined' },
  ice: { name: 'Ice block', kg: 25, tier: 'mined' },
  silica: { name: 'Silica', kg: 24, tier: 'mined' },
  // refined — power + time at the base
  'steel-panel': { name: 'Steel panel', kg: 26, tier: 'refined' },
  glass: { name: 'Glass sheet', kg: 18, tier: 'refined' },
  water: { name: 'Water', kg: 10, tier: 'refined' },
  // worked — the Works' upper tiers (Stage 2): the expedition is built
  // from these, and Stage 3's hopper drinks from the tanks
  'machine-parts': { name: 'Machine parts', kg: 12, tier: 'worked' },
  'methane-tank': { name: 'Methane tank', kg: 16, tier: 'worked' },
  'winch-rig': { name: 'Winch rig', kg: 14, tier: 'worked' },
};

// carry capacities, kg of MASS handled (suited human ~1 panel; the deck
// takes a first hab's worth in one careful load)
export const SUIT_CAPACITY = 35;
export const ROVER_CAPACITY = 420;

export function createStore(capacity) {
  return { capacity, slots: {} }; // slots: itemId -> count
}

export function massOf(store) {
  let kg = 0;
  for (const [id, n] of Object.entries(store.slots)) kg += ITEMS[id].kg * n;
  return kg;
}

export function canAdd(store, id, n = 1) {
  if (!ITEMS[id] || n < 1) return false;
  return massOf(store) + ITEMS[id].kg * n <= store.capacity + 1e-9;
}

// returns how many were actually added (0..n)
export function add(store, id, n = 1) {
  let added = 0;
  while (added < n && canAdd(store, id, 1)) {
    store.slots[id] = (store.slots[id] || 0) + 1;
    added++;
  }
  return added;
}

export function count(store, id) { return store.slots[id] || 0; }

// returns how many were actually removed (0..n)
export function remove(store, id, n = 1) {
  const have = count(store, id);
  const taken = Math.min(have, n);
  if (taken > 0) {
    store.slots[id] = have - taken;
    if (store.slots[id] === 0) delete store.slots[id];
  }
  return taken;
}

// move up to n of id between stores (bounded by supply and capacity)
export function transfer(from, to, id, n = 1) {
  const available = Math.min(count(from, id), n);
  let moved = 0;
  while (moved < available && canAdd(to, id, 1)) {
    remove(from, id, 1);
    add(to, id, 1);
    moved++;
  }
  return moved;
}

// the HUD line: "142 / 420 kg"
export function loadLabel(store) {
  return `${Math.round(massOf(store))} / ${store.capacity} kg`;
}
