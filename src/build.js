// The build grammar — pure, no THREE, no DOM. verify-build.mjs guards it.
// Panel-by-panel construction (PHASE2.md, James's call): the world is a
// grid of 2 m cells and parts occupy the FACES between them. The stead is
// pure data over this grammar — a Map of face keys to parts — so it rides
// the save (and later the relay) and every client rebuilds identical
// geometry (invariant 4). Airtightness is judged by pressure.js on exactly
// this data; nothing else needs to know what a wall is.

export const CELL = 2; // metres

// part types and what builds them (append-only)
export const PART_TYPES = {
  panel: { name: 'Panel', seals: true, passable: false, costs: [['alloy-panel', 1]] },
  'steel-panel-part': { name: 'Steel panel', seals: true, passable: false, costs: [['steel-panel', 1]] },
  window: { name: 'Window', seals: true, passable: false, costs: [['window-pane', 1]] },
  airlock: { name: 'Airlock', seals: true, passable: true, costs: [['airlock-ring', 1], ['seal-kit', 1]] },
};

// ---- face addressing -------------------------------------------------------
// A face is BETWEEN two cells. Canonical form: the face on the NEGATIVE
// side of cell (x,y,z) along axis a (0=x, 1=y, 2=z) — so the face between
// (x,y,z) and (x+1,y,z) is keyed at (x+1,y,z,axis 0). One face, one key.
export function faceKey(x, y, z, axis) { return `${x},${y},${z},${axis}`; }

export function parseFaceKey(k) {
  const [x, y, z, axis] = k.split(',').map(Number);
  return { x, y, z, axis };
}

// the two cells a face separates: lo = (x,y,z) minus one step on axis, hi = (x,y,z)
export function faceCells(x, y, z, axis) {
  const lo = [x, y, z]; lo[axis] -= 1;
  return { lo, hi: [x, y, z] };
}

// the 6 faces of cell (x,y,z), canonical keys
export function cellFaces(x, y, z) {
  return [
    faceKey(x, y, z, 0), faceKey(x + 1, y, z, 0),
    faceKey(x, y, z, 1), faceKey(x, y + 1, z, 1),
    faceKey(x, y, z, 2), faceKey(x, y, z + 1, 2),
  ];
}

// world position of a face centre + its normal axis (for the layer/ghost)
export function faceCentre(x, y, z, axis) {
  const c = [(x + 0.5) * CELL, (y + 0.5) * CELL, (z + 0.5) * CELL];
  c[axis] -= CELL / 2;
  return c;
}

// ---- the stead -------------------------------------------------------------
export function createStead() {
  return { parts: new Map() }; // faceKey -> { type }
}

export function partAt(stead, key) { return stead.parts.get(key) || null; }

// two faces are edge-adjacent if they share a grid edge; we accept the
// cheap-and-honest version: faces of the same cell, or the same face slot
// of a neighbouring cell
export function facesTouch(a, b) {
  const A = parseFaceKey(a), B = parseFaceKey(b);
  const d = Math.abs(A.x - B.x) + Math.abs(A.y - B.y) + Math.abs(A.z - B.z);
  if (A.axis === B.axis) return d === 1;         // same orientation, neighbours
  return d <= 1;                                  // different orientation, same corner
}

// placement law: the part must ROOT — a ground-level floor face (y=0,
// horizontal) or edge-contact with an existing part. No floating walls.
export function canPlace(stead, key) {
  if (stead.parts.has(key)) return false;
  const f = parseFaceKey(key);
  if (f.axis === 1 && f.y === 0) return true;    // on the ground
  for (const existing of stead.parts.keys()) {
    if (facesTouch(key, existing)) return true;
  }
  return false;
}

// place returns true on success; costs are the CALLER's job (inventory)
export function place(stead, key, type) {
  if (!PART_TYPES[type] || !canPlace(stead, key)) return false;
  stead.parts.set(key, { type });
  return true;
}

export function removePart(stead, key) { return stead.parts.delete(key); }

// serialise / restore — the save's contract
export function serialize(stead) {
  return [...stead.parts.entries()].map(([k, v]) => [k, v.type]);
}
export function deserialize(data) {
  const stead = createStead();
  for (const [k, type] of data) stead.parts.set(k, { type });
  return stead;
}
