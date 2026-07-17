// Pressure — the airtightness judge. Pure, no THREE, no DOM.
// verify-pressure.mjs guards it.
//
// Enclosure is COMPUTED, never declared (PHASE2.md): flood-fill the cell
// grid from the outside; any cells the outside cannot reach form enclosed
// volumes. A volume pressurises only when it is closed, has an airlock
// (the door), and is fed air. The leak finder answers the builder's real
// question — "where is my seam?" — by walking the escape path from a room
// and reporting the exact open faces it slipped through. "Well designed"
// means the game shows you your gaps.

import { faceKey, cellFaces, parseFaceKey, PART_TYPES } from './build.js';

const cellKey = (x, y, z) => `${x},${y},${z}`;

// a face blocks air if it holds any sealing part (airlocks seal shut)
function sealed(stead, fk) {
  const part = stead.parts.get(fk);
  return !!part && PART_TYPES[part.type].seals;
}

// the six neighbours of a cell with the face that separates each
function neighbours(x, y, z) {
  return [
    { c: [x - 1, y, z], f: faceKey(x, y, z, 0) },
    { c: [x + 1, y, z], f: faceKey(x + 1, y, z, 0) },
    { c: [x, y - 1, z], f: faceKey(x, y, z, 1) },
    { c: [x, y + 1, z], f: faceKey(x, y + 1, z, 1) },
    { c: [x, y, z - 1], f: faceKey(x, y, z, 2) },
    { c: [x, y, z + 1], f: faceKey(x, y, z + 1, 2) },
  ];
}

// the working set: every cell touching a part, padded one cell out —
// beyond it, everything is definitionally outside
function domain(stead) {
  const cells = new Set();
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const k of stead.parts.keys()) {
    const f = parseFaceKey(k);
    const { lo, hi } = { lo: [f.x, f.y, f.z], hi: [f.x, f.y, f.z] };
    lo[f.axis] -= 1;
    for (const c of [lo, hi]) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], c[i] - 1);
        max[i] = Math.max(max[i], c[i] + 1);
      }
    }
  }
  return { min, max, empty: stead.parts.size === 0 };
}

// ---- the flood -------------------------------------------------------------
// Returns { volumes: [{ cells: [[x,y,z]...], airlocks: n }], outside: Set }
export function analyse(stead) {
  const { min, max, empty } = domain(stead);
  if (empty) return { volumes: [], outside: new Set() };

  const inBounds = (c) => c.every((v, i) => v >= min[i] && v <= max[i]);
  // below-ground cells never carry air (the ground seals them): the world
  // floor is treated as solid at y < 0
  const isAir = (c) => c[1] >= 0;

  // flood from every boundary cell of the domain box: all of it is outside
  const outside = new Set();
  const queue = [];
  for (let x = min[0]; x <= max[0]; x++) {
    for (let y = Math.max(0, min[1]); y <= max[1]; y++) {
      for (let z = min[2]; z <= max[2]; z++) {
        const onEdge = x === min[0] || x === max[0] || y === max[1]
          || z === min[2] || z === max[2];
        if (onEdge) { const k = cellKey(x, y, z); if (!outside.has(k)) { outside.add(k); queue.push([x, y, z]); } }
      }
    }
  }
  while (queue.length) {
    const [x, y, z] = queue.pop();
    for (const { c, f } of neighbours(x, y, z)) {
      if (!inBounds(c) || !isAir(c)) continue;
      const k = cellKey(...c);
      if (outside.has(k) || sealed(stead, f)) continue;
      outside.add(k);
      queue.push(c);
    }
  }

  // whatever the outside never reached, grouped into volumes
  const volumes = [];
  const seen = new Set();
  for (let x = min[0]; x <= max[0]; x++) {
    for (let y = Math.max(0, min[1]); y <= max[1]; y++) {
      for (let z = min[2]; z <= max[2]; z++) {
        const k = cellKey(x, y, z);
        if (outside.has(k) || seen.has(k)) continue;
        // flood this volume
        const cells = [];
        let airlocks = 0;
        const q = [[x, y, z]];
        seen.add(k);
        while (q.length) {
          const c = q.pop();
          cells.push(c);
          for (const { c: n, f } of neighbours(...c)) {
            const part = stead.parts.get(f);
            if (part && part.type === 'airlock') airlocks++;
            if (!inBounds(n) || !isAir(n)) continue;
            const nk = cellKey(...n);
            if (seen.has(nk) || outside.has(nk) || sealed(stead, f)) continue;
            seen.add(nk);
            q.push(n);
          }
        }
        volumes.push({ cells, airlocks });
      }
    }
  }
  return { volumes, outside };
}

// is the cell containing world position (wx, wy, wz) inside a sealed volume?
export function volumeAtCell(analysis, x, y, z) {
  for (const v of analysis.volumes) {
    if (v.cells.some((c) => c[0] === x && c[1] === y && c[2] === z)) return v;
  }
  return null;
}

// a volume PRESSURISES when closed (it is, by construction), doored (>= 1
// airlock — you must be able to get in and out without venting), and fed
export function canPressurise(volume, airSupply = true) {
  return !!volume && volume.airlocks >= 1 && airSupply;
}

// ---- the leak finder -------------------------------------------------------
// From a start cell, walk the shortest escape to the outside and report the
// open faces crossed — the builder's "your seam is HERE". Returns [] if the
// start cell is already enclosed (no leak), or null if start is silly.
export function findLeaks(stead, startCell, maxReport = 3) {
  const a = analyse(stead);
  const startK = cellKey(...startCell);
  if (!a.outside.has(startK)) return []; // enclosed: nothing leaks

  // BFS from the start, tracking the first open face crossed on each path;
  // when we hit the domain edge we've escaped — report the crossings
  const { min, max } = domain(stead);
  const inBounds = (c) => c.every((v, i) => v >= min[i] && v <= max[i]);
  const prev = new Map(); // cellKey -> { cell, face }
  const q = [startCell];
  const seen = new Set([startK]);
  let escape = null;
  while (q.length && !escape) {
    const c = q.shift();
    for (const { c: n, f } of neighbours(...c)) {
      if (n[1] < 0 || sealed(stead, f)) continue;
      const nk = cellKey(...n);
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, { cell: c, face: f });
      if (!inBounds(n)) { escape = nk; break; }
      q.push(n);
    }
  }
  if (!escape) return [];

  // walk the path back; report faces that COULD seal (adjacent to any part
  // - the frontier of your build), nearest the escape first
  const leaks = [];
  let cursor = escape;
  while (prev.has(cursor) && leaks.length < maxReport) {
    const { cell, face } = prev.get(cursor);
    const f = parseFaceKey(face);
    // report faces on the boundary of the built shell: at least one part
    // shares a cell with this face
    const { x, y, z, axis } = f;
    const touchesBuild = cellFaces(x, y, z).some((k) => stead.parts.has(k))
      || (() => { const lo = [x, y, z]; lo[axis] -= 1; return cellFaces(...lo).some((k) => stead.parts.has(k)); })();
    if (touchesBuild && !leaks.includes(face)) leaks.push(face);
    cursor = cellKey(...cell);
  }
  return leaks;
}
