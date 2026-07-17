// Salvage — the lander's manifest, pure, no THREE, no DOM.
// verify-salvage.mjs guards it. The lander you arrived in is the ONLY
// source of finished materials until the refinery runs (PHASE2.md):
// unbolt its panels, panes, seals, cable, electronics and the one
// precious airlock ring. The stock is finite and the lander is also your
// shelter — every part off its hull is a commitment.

export const LANDER_STOCK = [
  // declared order = the Q-cycle order in the HUD
  { id: 'alloy-panel', count: 10, seconds: 4 },
  { id: 'window-pane', count: 2, seconds: 4 },
  { id: 'seal-kit', count: 4, seconds: 2 },
  { id: 'cable', count: 3, seconds: 2 },
  { id: 'electronics', count: 2, seconds: 3 },
  { id: 'airlock-ring', count: 1, seconds: 8 },
];

export function createLander() {
  const stock = {};
  for (const { id, count } of LANDER_STOCK) stock[id] = count;
  return { stock };
}

export function remaining(lander, id) { return lander.stock[id] || 0; }

export function remainingTotal(lander) {
  return Object.values(lander.stock).reduce((a, b) => a + b, 0);
}

// salvageable types still in stock, in declared (Q-cycle) order
export function available(lander) {
  return LANDER_STOCK.filter(({ id }) => remaining(lander, id) > 0).map((r) => r.id);
}

export function unboltSeconds(id) {
  const row = LANDER_STOCK.find((r) => r.id === id);
  return row ? row.seconds : 0;
}

// take one off the hull; false if that bin is empty
export function takeOne(lander, id) {
  if (remaining(lander, id) < 1) return false;
  lander.stock[id] -= 1;
  return true;
}

// how many of this type have come OFF the lander (the layer hides that
// many of its meshes — the hull visibly strips as you salvage)
export function takenCount(lander, id) {
  const row = LANDER_STOCK.find((r) => r.id === id);
  return row ? row.count - remaining(lander, id) : 0;
}
