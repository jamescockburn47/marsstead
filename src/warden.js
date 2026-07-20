// The warden's mark — the family admin pattern (Moorstead's hashed key,
// Saltstead's auth blob), pure: no THREE, no DOM, storage and crypto
// injected so verify-warden.mjs drives it headlessly.
//
// Be clear about what this is: a CHEAT CODE, not security. Marsstead is
// single-player and client-side — any player can open devtools and grant
// themselves anything warden grants. The hash's one job is keeping the
// key itself out of the repo. When Phase 4 multiplayer lands, warden
// powers that touch SHARED state graduate to server-minted tokens
// (Saltstead's dash-claim pattern); nothing here blocks that.

export const AUTH_KEY = 'marsstead-auth';

// SHA-256 of the warden key — the FAMILY key (James, 2026-07-20): the
// simplest door is the settler's own name. Name yourself the key at
// the title screen and the mark rides the SAVE itself — no browser
// storage to lose, any device the save reaches is warden ground.
export const WARDEN_HASH = '5a19e539f87a5776ee01e7d8d603fcc7b63e810a14f23c471f94150437e854d8';

export async function sha256Hex(text, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return null; // no subtle crypto — no warden, no matter
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function wardenVerify(key, hash = WARDEN_HASH, subtle = globalThis.crypto?.subtle) {
  if (typeof key !== 'string' || !key) return false;
  const hex = await sha256Hex(key, subtle);
  return hex !== null && hex === hash;
}

// auth blob: { warden: true } | null — nothing else rides it yet
export function loadAuth(storage) {
  try {
    const a = JSON.parse(storage.getItem(AUTH_KEY));
    return a && typeof a === 'object' && a.warden === true ? { warden: true } : null;
  } catch { return null; }
}

export function saveAuth(storage, auth) {
  try {
    if (auth === null) storage.removeItem(AUTH_KEY);
    else storage.setItem(AUTH_KEY, JSON.stringify({ warden: auth.warden === true }));
  } catch { /* private mode — session-only warden */ }
}

export function isWarden(auth) {
  return !!(auth && auth.warden === true);
}

// the name-as-key door: normalised so 'Warden1981', ' warden1981 ' and
// the exact key all open it
export async function wardenNameCheck(name, hash = WARDEN_HASH, subtle = globalThis.crypto?.subtle) {
  return wardenVerify(String(name || '').trim().toLowerCase(), hash, subtle);
}
