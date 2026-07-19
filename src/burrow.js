// The Burrow — the underground warren and the hands that dig it. Pure, no
// THREE, no DOM. verify-burrow.mjs guards it. STRUCTURE.md doctrines 1-3:
// the player never walks the hab — this model IS the home, drawn by the
// Burrow console and dug by the drones; the surface only shows the crown.
// Digging a room and digging ore are the same verb: SPOIL IS ORE — the
// house pays for itself as it is dug.
//
// Geometry: a side-view lattice. Columns -COLS..COLS, depths 1..DEPTHS.
// The shaft descends at column 0; corridors run laterally off dug shaft;
// rooms hang off dug corridors. The salvaged airlock ring caps the shaft:
// rock seals everything else, so pressure is the ring plus dug ground —
// no flood-fill required, by construction.

import { hash2 } from './noise.js';

export const COLS = 6;      // lateral reach each side of the shaft
export const DEPTHS = 8;    // how deep the warren may go
export const DIG_RATE = 1;  // cost-units per second per drone on a cell

// piece catalogue (append-only, family style). cost in cost-units; a cell
// two levels down digs slower (harder ground, longer haul).
export const BURROW_PIECES = {
  shaft: { name: 'Shaft', cost: 30, kind: 'shaft' },
  corridor: { name: 'Corridor', cost: 24, kind: 'corridor' },
  bunk: { name: 'Bunk Room', cost: 45, kind: 'room', bedworthy: true },
  store: { name: 'Store Room', cost: 40, kind: 'room' },
  bay: { name: 'Works Bay', cost: 60, kind: 'room' },
  garden: { name: 'Garden Room', cost: 60, kind: 'room', lightPipe: true },
};

export function createBurrow() {
  return {
    ringInstalled: false,
    cells: new Map(),   // "col,depth" -> { piece, dug: 0..1, planned }
    queue: [],          // keys in plan order (drones take the oldest)
    spoil: { regolith: 0, ore: 0 },
  };
}

const key = (col, depth) => `${col},${depth}`;
export function parseKey(k) { const [c, d] = k.split(',').map(Number); return { col: c, depth: d }; }

function depthFactor(depth) { return 1 + (depth - 1) * 0.25; }
export function digCost(piece, depth) {
  return BURROW_PIECES[piece].cost * depthFactor(depth);
}

// socket rules: where a piece may be planned. Shaft: column 0 only, one
// cell below the deepest shaft (or depth 1 to start). Corridor: laterally
// adjacent to DUG shaft/corridor at the same depth. Room: laterally
// adjacent to a DUG corridor. Nothing plans onto an occupied cell.
export function canPlan(b, piece, col, depth) {
  const p = BURROW_PIECES[piece];
  if (!p) return false;
  if (col < -COLS || col > COLS || depth < 1 || depth > DEPTHS) return false;
  if (b.cells.has(key(col, depth))) return false;
  const dugAt = (c, d) => { const cell = b.cells.get(key(c, d)); return cell && cell.dug >= 1; };
  const dugKind = (c, d, kinds) => {
    const cell = b.cells.get(key(c, d));
    return cell && cell.dug >= 1 && kinds.includes(BURROW_PIECES[cell.piece].kind);
  };
  if (p.kind === 'shaft') {
    if (col !== 0) return false;
    return depth === 1 ? true : dugKind(0, depth - 1, ['shaft']);
  }
  if (p.kind === 'corridor') {
    return dugKind(col - 1, depth, ['shaft', 'corridor'])
      || dugKind(col + 1, depth, ['shaft', 'corridor']);
  }
  // rooms hang off corridors, never directly off the shaft
  return dugKind(col - 1, depth, ['corridor']) || dugKind(col + 1, depth, ['corridor']);
}

export function plan(b, piece, col, depth) {
  if (!canPlan(b, piece, col, depth)) return false;
  const k = key(col, depth);
  b.cells.set(k, { piece, dug: 0, planned: true });
  b.queue.push(k);
  return true;
}

export function cancelPlan(b, col, depth) {
  const k = key(col, depth);
  const cell = b.cells.get(k);
  if (!cell || cell.dug > 0) return false; // started digs are dug
  b.cells.delete(k);
  b.queue = b.queue.filter((q) => q !== k);
  return true;
}

// spoil per completed cell: regolith always; ore by depth-weighted chance,
// deterministic in (col, depth) — the same warren pays the same everywhere
export function spoilFor(col, depth) {
  const regolith = 2 + Math.round(depthFactor(depth));
  const roll = hash2(col * 977 + 13, depth * 761 + 7);
  const ore = roll < 0.25 + depth * 0.06 ? 1 + Math.floor(roll * 8) % 2 : 0;
  return { regolith, ore };
}

// the hands: droneCount drones all work the OLDEST unfinished dig (they
// swarm one face — reads well on the surface and keeps the model simple).
// Returns events: [{ type:'dug', key, piece, spoil }] for the layer/VESPER.
export function tick(b, dt, droneCount = 0) {
  const events = [];
  if (droneCount <= 0 || dt <= 0) return events;
  let work = dt * DIG_RATE * droneCount;
  while (work > 0 && b.queue.length) {
    const k = b.queue[0];
    const cell = b.cells.get(k);
    if (!cell) { b.queue.shift(); continue; }
    const { col, depth } = parseKey(k);
    const need = digCost(cell.piece, depth) * (1 - cell.dug);
    const spend = Math.min(work, need);
    cell.dug = Math.min(1, cell.dug + spend / digCost(cell.piece, depth));
    work -= spend;
    if (cell.dug >= 1) {
      cell.planned = false;
      b.queue.shift();
      const spoil = spoilFor(col, depth);
      b.spoil.regolith += spoil.regolith;
      b.spoil.ore += spoil.ore;
      events.push({ type: 'dug', key: k, piece: cell.piece, spoil });
    }
  }
  return events;
}

export function installRing(b) {
  // the ring wants a hole to cap: the first shaft cell must be dug
  const first = b.cells.get(key(0, 1));
  if (!first || first.dug < 1 || b.ringInstalled) return false;
  b.ringInstalled = true;
  return true;
}

// pressure, by construction: the ring caps the only opening; any dug room
// behind it is home. Bedworthy needs a dug bunk under pressure.
export function isPressurised(b) {
  if (!b.ringInstalled) return false;
  for (const cell of b.cells.values()) {
    if (cell.dug >= 1 && BURROW_PIECES[cell.piece].kind === 'room') return true;
  }
  return false;
}
export function isBedworthy(b) {
  if (!isPressurised(b)) return false;
  for (const cell of b.cells.values()) {
    if (cell.dug >= 1 && BURROW_PIECES[cell.piece].bedworthy) return true;
  }
  return false;
}

export function takeSpoil(b) {
  const out = { ...b.spoil };
  b.spoil = { regolith: 0, ore: 0 };
  return out;
}

// save: cells + ring, flat and laundered on the way back in
export function serialize(b) {
  return {
    ring: b.ringInstalled,
    cells: [...b.cells.entries()].map(([k, c]) => [k, c.piece, +c.dug.toFixed(4)]),
    queue: [...b.queue],
    spoil: { ...b.spoil },
  };
}
export function deserialize(raw) {
  const b = createBurrow();
  if (!raw || typeof raw !== 'object') return b;
  if (Array.isArray(raw.cells)) {
    for (const row of raw.cells.slice(0, (COLS * 2 + 1) * DEPTHS)) {
      if (!Array.isArray(row) || row.length !== 3) continue;
      const [k, piece, dug] = row;
      if (typeof k !== 'string' || !BURROW_PIECES[piece] || !Number.isFinite(dug)) continue;
      const { col, depth } = parseKey(k);
      if (!Number.isFinite(col) || !Number.isFinite(depth)) continue;
      b.cells.set(k, { piece, dug: Math.max(0, Math.min(1, dug)), planned: dug < 1 });
    }
  }
  if (Array.isArray(raw.queue)) {
    b.queue = raw.queue.filter((k) => typeof k === 'string' && b.cells.has(k)
      && b.cells.get(k).dug < 1);
  }
  b.ringInstalled = !!raw.ring;
  if (raw.spoil) {
    b.spoil.regolith = Math.max(0, Math.round(raw.spoil.regolith) || 0);
    b.spoil.ore = Math.max(0, Math.round(raw.spoil.ore) || 0);
  }
  return b;
}
