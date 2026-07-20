// verify-warden: the warden's mark — the hash gate holds, the auth blob
// round-trips, and the key itself is nowhere in the repo (only its hash).

import {
  WARDEN_HASH, sha256Hex, wardenVerify, loadAuth, saveAuth, isWarden, AUTH_KEY,
} from '../src/warden.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the hash gate — proven with a TEST pair (the real key never in git)
{
  const testKey = 'test-key-for-verify-only';
  const testHash = await sha256Hex(testKey);
  check('sha256 is well-formed', /^[0-9a-f]{64}$/.test(testHash));
  check('right key verifies', await wardenVerify(testKey, testHash) === true);
  check('wrong key refused', await wardenVerify('wrong-key', testHash) === false);
  check('empty key refused', await wardenVerify('', testHash) === false);
  check('non-string refused', await wardenVerify(null, testHash) === false
    && await wardenVerify(42, testHash) === false);
  check('no subtle crypto means no warden', await wardenVerify(testKey, testHash, null) === false);
  check('baked hash is a hash, not a key', /^[0-9a-f]{64}$/.test(WARDEN_HASH));
}

// 2. the auth blob round-trips through injected storage
{
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  check('fresh storage is not warden', loadAuth(storage) === null && !isWarden(null));
  saveAuth(storage, { warden: true });
  check('the mark persists', isWarden(loadAuth(storage)));
  check('nothing extra rides the blob', storage.getItem(AUTH_KEY) === '{"warden":true}');
  saveAuth(storage, null);
  check('renounced clean', loadAuth(storage) === null && !mem.has(AUTH_KEY));
  storage.setItem(AUTH_KEY, 'not json {');
  check('garbage blob is not warden', loadAuth(storage) === null);
  storage.setItem(AUTH_KEY, '{"warden":"yes"}');
  check('truthy-but-not-true refused', loadAuth(storage) === null);
}

if (failed) { console.error(`verify-warden: ${failed} FAILED`); process.exit(1); }
console.log('verify-warden: all green');
