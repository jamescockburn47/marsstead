// The homestead save — the family's one-slot IndexedDB structure (Moorstead
// via Saltstead), ported to Mars. snapshot/accept are PURE and verify-save
// guards them, including the forward-refuse rule: never load a save from a
// NEWER client. Everything else about the world is deterministic (terrain,
// weather, light all re-derive from the clock), so the save carries only
// the authored facts: the clock, the walker, the machines, the bags, the
// stead, the cleared fog, and the flags the story has already spent.

export const SAVE_VERSION = 1;
const DB = 'marsstead', STORE = 'meta', KEY = 'game';

import { ITEMS } from './inventory.js';
import { LANDER_STOCK } from './salvage.js';
import { PART_TYPES } from './build.js';
import { EVENTS } from './vesper.js';

const clamp01 = (v, dflt) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : dflt);
const fin = (v, dflt) => (Number.isFinite(v) ? v : dflt);

// slots: keep only real items, whole non-negative counts, bounded
function vetSlots(slots, cap = 999) {
  const out = {};
  if (!slots || typeof slots !== 'object') return out;
  for (const [id, n] of Object.entries(slots)) {
    if (!ITEMS[id]) continue;
    const k = Math.round(n);
    if (Number.isFinite(k) && k > 0) out[id] = Math.min(cap, k);
  }
  return out;
}

// ---- pure ------------------------------------------------------------------
// state: { simMillis, pos:{x,z}, heading, air, warm, buggy:{x,z,heading},
//   suit, rover, lander, stead, steadBaseY, steadOrigin, exploration,
//   everPressurised, saidFirsts }
export function snapshotSave(state) {
  return {
    version: SAVE_VERSION,
    simMillis: state.simMillis,
    pos: { x: state.pos.x, z: state.pos.z },
    heading: state.heading,
    air: clamp01(state.air, 1),
    warm: clamp01(state.warm, 1),
    buggy: { x: state.buggy.x, z: state.buggy.z, heading: state.buggy.heading },
    suit: { ...state.suit },
    rover: { ...state.rover },
    lander: { ...state.lander },
    stead: state.stead,               // [[faceKey, type], ...] from build.js
    steadBaseY: state.steadBaseY,     // null until the first part went down
    steadOrigin: state.steadOrigin,   // {x,z} | null
    exploration: state.exploration,   // ["cx,cz", ...] from explore.js
    everPressurised: !!state.everPressurised,
    saidFirsts: [...state.saidFirsts],
    savedAt: Date.now(),
  };
}

// null unless the meta is a well-formed save THIS client can carry
export function acceptSave(meta) {
  if (!meta || typeof meta !== 'object') return null;
  if (typeof meta.version !== 'number' || meta.version > SAVE_VERSION) return null;
  if (!Number.isFinite(meta.simMillis)) return null;
  const p = meta.pos, b = meta.buggy;
  if (!p || ![p.x, p.z].every(Number.isFinite)) return null;

  // lander stock: only declared bins, clamped to each bin's full count
  const lander = {};
  for (const { id, count } of LANDER_STOCK) {
    const n = Math.round(meta.lander?.[id]);
    lander[id] = Number.isFinite(n) ? Math.max(0, Math.min(count, n)) : 0;
  }

  // stead parts: canonical-looking keys, known types, bounded
  const stead = [];
  if (Array.isArray(meta.stead)) {
    for (const row of meta.stead.slice(0, 4096)) {
      if (!Array.isArray(row) || row.length !== 2) continue;
      const [key, type] = row;
      if (typeof key !== 'string' || !PART_TYPES[type]) continue;
      const nums = key.split(',');
      if (nums.length !== 4 || nums.some((v) => !Number.isFinite(Number(v)))) continue;
      stead.push([key, type]);
    }
  }

  const exploration = Array.isArray(meta.exploration)
    ? meta.exploration.slice(0, 500000)
      .filter((k) => typeof k === 'string' && /^-?\d+,-?\d+$/.test(k))
    : [];

  const saidFirsts = Array.isArray(meta.saidFirsts)
    ? meta.saidFirsts.filter((e) => EVENTS.includes(e))
    : [];

  return {
    version: meta.version,
    simMillis: meta.simMillis,
    pos: { x: p.x, z: p.z },
    heading: fin(meta.heading, 0),
    air: clamp01(meta.air, 1),
    warm: clamp01(meta.warm, 1),
    buggy: b && [b.x, b.z].every(Number.isFinite)
      ? { x: b.x, z: b.z, heading: fin(b.heading, 0) }
      : { x: 14, z: 6, heading: -0.8 },
    suit: vetSlots(meta.suit),
    rover: vetSlots(meta.rover),
    lander,
    stead,
    steadBaseY: Number.isFinite(meta.steadBaseY) ? meta.steadBaseY : null,
    steadOrigin: meta.steadOrigin
      && [meta.steadOrigin.x, meta.steadOrigin.z].every(Number.isFinite)
      ? { x: meta.steadOrigin.x, z: meta.steadOrigin.z } : null,
    exploration,
    everPressurised: !!meta.everPressurised,
    saidFirsts,
    savedAt: meta.savedAt || 0,
  };
}

// ---- IndexedDB plumbing (browser only) --------------------------------------
function openDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

export async function saveGame(meta) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(meta, KEY);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function loadGame() {
  const db = await openDB();
  const meta = await new Promise((res, rej) => {
    const rq = db.transaction(STORE).objectStore(STORE).get(KEY);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  db.close();
  return acceptSave(meta);
}

export async function clearSave() {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
}
