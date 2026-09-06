// One spatial interpretation of the actual finished 2D burrow cells. No renderer.
import { BURROW_PIECES, COLS, DEPTHS } from './burrow.js';

export const HABITAT_SPACING = 8;
export const HABITAT_HEIGHT = 3.6;
export const HABITAT_DOOR_HALF = 1.3;

export function habitatLayout(burrow) {
  const rooms = [];
  for (const [key, cell] of burrow.cells) {
    const [col, depth] = key.split(',').map(Number);
    if (!Number.isInteger(col) || !Number.isInteger(depth) || Math.abs(col) > COLS
      || depth < 1 || depth > DEPTHS || !BURROW_PIECES[cell.piece] || cell.dug < 1) continue;
    rooms.push({ key, piece: cell.piece, col, depth, x: col * HABITAT_SPACING,
      y: -(depth - 1) * 4, z: 0, width: 8, length: 8 });
  }
  rooms.sort((a, b) => a.depth - b.depth || a.col - b.col);
  const byKey = new Map(rooms.map(room => [room.key, room]));
  for (const room of rooms) {
    room.left = byKey.has(`${room.col - 1},${room.depth}`);
    room.right = byKey.has(`${room.col + 1},${room.depth}`);
    room.above = room.piece === 'shaft' && byKey.get(`${room.col},${room.depth - 1}`)?.piece === 'shaft';
    room.below = room.piece === 'shaft' && byKey.get(`${room.col},${room.depth + 1}`)?.piece === 'shaft';
  }
  return { rooms, byKey };
}

export const roomByKey = (layout, key) => layout.byKey.get(key) || null;

export function roomAt(layout, x, z, depth) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(z) > 4) return null;
  return layout.rooms.find(room => room.depth === depth && Math.abs(x - room.x) <= 4) || null;
}

// Furniture shares these occupied footprints with the visible room furnishing.
export function habitatObstacles(room) {
  if (room.piece === 'bunk') return [{ x: room.x - 1.3, z: -2.65, w: 3.8, l: 1.7 },
    { x: room.x + 1.9, z: -3.3, w: .8, l: .7 }];
  if (room.piece === 'garden') return [-1, 1].flatMap(side => [-1, 1].map(bank =>
    ({ x: room.x + bank * 1.55, z: side * 2.75, w: 2.9, l: 1.5 })));
  if (room.piece === 'store') return [{ x: room.x, z: -3.15, w: 5.9, l: 1.05 }];
  if (room.piece === 'bay') return [{ x: room.x, z: -2.75, w: 5.4, l: 1.65 }];
  if (room.piece === 'shaft') return [{ x: room.x, z: -3.55, w: 1.5, l: .35 }];
  if (room.piece === 'corridor') return [{ x: room.x, z: 3.53, w: 3.1, l: .45 }];
  return [];
}

function freeAt(layout, x, z, depth, radius) {
  const room = roomAt(layout, x, z, depth);
  if (!room || Math.abs(z) > 3.84 - radius) return false;
  const local = x - room.x;
  for (const side of [-1, 1]) {
    if (side * local < 3.84 - radius) continue;
    if (!(side < 0 ? room.left : room.right) || Math.abs(z) > HABITAT_DOOR_HALF - radius) return false;
  }
  return !habitatObstacles(room).some(o => Math.abs(x - o.x) < o.w / 2 + radius
    && Math.abs(z - o.z) < o.l / 2 + radius);
}

// Swept small steps prevent tunnelling through walls even after a slow frame.
export function constrainHabitat(layout, from, to, depth, radius = .28) {
  if (![from.x, from.z, to.x, to.z, radius].every(Number.isFinite) || radius <= 0)
    return { x: from.x, z: from.z };
  const dx = to.x - from.x, dz = to.z - from.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
  let { x, z } = from;
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps, nz = z + dz / steps;
    if (freeAt(layout, nx, nz, depth, radius)) { x = nx; z = nz; }
    else if (freeAt(layout, nx, z, depth, radius)) x = nx;
    else if (freeAt(layout, x, nz, depth, radius)) z = nz;
  }
  return { x, z };
}
