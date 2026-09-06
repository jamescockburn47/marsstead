// Presentation derived from the real Burrow. No persisted cosmetic state.
import { BURROW_PIECES, COLS, DEPTHS, canPlan, parseKey } from './burrow.js';

export const HOME_ACCENTS = { bunk: '#edd6a2', garden: '#7dcfa8', store: '#9fc2d1', bay: '#68c8cb', shaft: '#c9ac7d', corridor: '#e1d4bb' };
const DETAILS = {
  shaft: 'The way into your home. Dig down to reach deeper, better sheltered ground.',
  corridor: 'Connect rooms to the shaft. Choose a room, then a glowing space beside this corridor.',
  bunk: 'A place to sleep. Deeper bunks give better shelter; a nearby garden helps the air.',
  store: 'A home for your supplies. Stores close to the shaft shorten the drones’ hauling route.',
  bay: 'Room for the workshop below. Surface machines still do the refining.',
  garden: 'The first green on your Mars. Gardens need shallow ground for their light pipes.',
};
export const escapeHomeText = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function homeGrowth(b, droneCount = 3) {
  const rooms = { bunk: 0, garden: 0, store: 0, bay: 0 };
  let dug = 0;
  for (const cell of b?.cells?.values() || []) {
    if (cell.dug < 1) continue;
    dug++;
    if (Object.hasOwn(rooms, cell.piece)) rooms[cell.piece]++;
  }
  return { ...rooms, dug, sealed: !!b?.ringInstalled,
    drones: Math.max(0, Math.min(24, Math.floor(Number.isFinite(droneCount) ? droneCount : 3))),
    keepsake: !!b?.ringInstalled && rooms.bunk > 0,
    rooms: Object.values(rooms).reduce((a, v) => a + v, 0) };
}

export function homeView(b, selected = 'shaft') {
  const cells = [...b.cells].map(([key, cell]) => ({ ...parseKey(key), ...cell, key }));
  const sockets = [];
  for (let d = 1; d <= DEPTHS; d++) for (let c = -COLS; c <= COLS; c++) {
    if (canPlan(b, selected, c, d)) sockets.push({ col: c, depth: d, key: `${c},${d}` });
  }
  const points = [...cells, ...sockets, { col: 0, depth: 1 }];
  return { cells, sockets,
    // Actual legal sockets already supply the expansion ring; adding another
    // empty ring here made a small home disappear into unused geology.
    minCol: Math.max(-COLS, Math.min(-1, ...points.map(p => p.col))),
    maxCol: Math.min(COLS, Math.max(1, ...points.map(p => p.col))),
    maxDepth: Math.min(DEPTHS, Math.max(1, ...points.map(p => p.depth))) };
}

export function roomDescription(b, key) {
  const cell = b.cells.get(key);
  if (!cell || !BURROW_PIECES[cell.piece]) return null;
  const { depth } = parseKey(key);
  return { title: BURROW_PIECES[cell.piece].name, depth: depth * 3,
    state: cell.dug >= 1 ? (b.ringInstalled ? 'Sealed' : 'Waiting for the airlock ring')
      : cell.waiting ? 'Waiting for charge' : cell.dug > 0 ? `Digging · ${Math.round(cell.dug * 100)}%` : 'Queued · select to cancel',
    detail: DETAILS[cell.piece] };
}
