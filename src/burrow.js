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

// ---- the point of it all: the WARREN REPORT --------------------------------
// Layout is a design problem with survival-sim consequences (James's rule:
// a hab designed correctly must pay). Three scores, all 0..1, all legible:
//   shelter — the best bunk: depth is regolith over your head (radiation,
//     thermal mass), a garden next door runs an air loop (+), a works bay
//     next door is noise (−). Waking in a good bunk leaves you RESTED:
//     slower warmth and air drain for hours of sol.
//   air — lit gardens scrub and top the suit up at the crown. Light-pipes
//     only reach LIGHT_REACH deep, so gardens want shallow while bunks
//     want deep: the warren's founding tension.
//   haul — a store beside the shaft stages the drones' spoil runs: the
//     whole warren digs faster. Logistics, made spatial.
export const LIGHT_REACH = 2; // deepest level a light-pipe still feeds

function adjacentPieces(b, col, depth) {
  const out = [];
  for (const [dc, dd] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const cell = b.cells.get(key(col + dc, depth + dd));
    if (cell && cell.dug >= 1) out.push(cell.piece);
  }
  return out;
}

export function gardenLit(depth) { return depth <= LIGHT_REACH; }

export function warrenReport(b) {
  const notes = [];
  let shelter = 0, lit = 0, loops = 0, haul = 0;
  for (const [k, cell] of b.cells) {
    if (cell.dug < 1) continue;
    const { col, depth } = parseKey(k);
    const near = adjacentPieces(b, col, depth);
    if (cell.piece === 'bunk') {
      // depth alone never perfects a bunk: the last step is the air loop
      let q = depth >= 3 ? 0.85 : depth === 2 ? 0.6 : 0.3;
      if (near.includes('garden')) { q += 0.15; loops++; notes.push({ key: k, kind: 'bonus', why: 'air loop — garden next door' }); }
      if (near.includes('bay')) { q -= 0.3; notes.push({ key: k, kind: 'penalty', why: 'workshop noise next door' }); }
      if (depth < 2) notes.push({ key: k, kind: 'penalty', why: 'shallow — thin regolith overhead' });
      else if (depth >= 3 && !near.includes('bay')) notes.push({ key: k, kind: 'bonus', why: 'deep — metres of shielding' });
      shelter = Math.max(shelter, Math.max(0, Math.min(1, q)));
    }
    if (cell.piece === 'garden') {
      if (gardenLit(depth)) { lit++; notes.push({ key: k, kind: 'bonus', why: 'light-pipe reaches — growing' }); }
      else notes.push({ key: k, kind: 'penalty', why: 'too deep — the pipe cannot feed it' });
    }
    if (cell.piece === 'store' && Math.abs(col) <= 2) {
      haul = Math.min(0.5, haul + 0.25);
      notes.push({ key: k, kind: 'bonus', why: 'stages the shaft — drones haul faster' });
    }
  }
  const air = Math.max(0, Math.min(1, lit * 0.55 + loops * 0.2));
  return { shelter, air, haul, notes };
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
