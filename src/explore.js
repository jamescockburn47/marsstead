// Exploration — the cleared fog, pure, no THREE, no DOM.
// verify-explore.mjs guards it. The map is EARNED (James's call): it opens
// as rust-red fog and clears only where the settler has actually been.
// State is a set of coarse visited cells — cheap to stamp every few steps,
// cheap to save, deterministic to redraw on any client.

export const EXPLORE_CELL = 24;   // m of world per fog cell
export const REVEAL_RADIUS = 70;  // m cleared around the walker's boots

export function createExploration() {
  return { cells: new Set() }; // "cx,cz" keys in explore-cell coords
}

export function cellKeyOf(x, z) {
  return `${Math.floor(x / EXPLORE_CELL)},${Math.floor(z / EXPLORE_CELL)}`;
}

// stamp a disc of visited cells around (x, z); returns how many were new
export function visit(exp, x, z, radius = REVEAL_RADIUS) {
  const r = Math.max(1, Math.ceil(radius / EXPLORE_CELL));
  const cx = Math.floor(x / EXPLORE_CELL), cz = Math.floor(z / EXPLORE_CELL);
  let added = 0;
  for (let i = -r; i <= r; i++) {
    for (let j = -r; j <= r; j++) {
      if (i * i + j * j > r * r) continue;
      const k = `${cx + i},${cz + j}`;
      if (!exp.cells.has(k)) { exp.cells.add(k); added++; }
    }
  }
  return added;
}

export function isVisited(exp, x, z) { return exp.cells.has(cellKeyOf(x, z)); }

// the explored bounding box in WORLD metres (null while nothing is seen);
// the map view grows with it
export function bounds(exp, margin = EXPLORE_CELL * 2) {
  if (exp.cells.size === 0) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const k of exp.cells) {
    const [cx, cz] = k.split(',').map(Number);
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
    minZ = Math.min(minZ, cz); maxZ = Math.max(maxZ, cz);
  }
  return {
    minX: minX * EXPLORE_CELL - margin,
    maxX: (maxX + 1) * EXPLORE_CELL + margin,
    minZ: minZ * EXPLORE_CELL - margin,
    maxZ: (maxZ + 1) * EXPLORE_CELL + margin,
  };
}

// save contract
export function serialize(exp) { return [...exp.cells]; }
export function deserialize(data) { return { cells: new Set(data) }; }
