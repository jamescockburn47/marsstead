// Marsstead diagnostics — the pure beacon builders + ping cadence for the
// ledger. No DOM, no localStorage, no fetch: main.js owns the pid and the wire,
// this owns the SHAPE, so the payloads and the cadence are proven headlessly by
// verify-diagnostics. The attract reel never reaches these (main.js fires play
// only from a real title choice and ping only when !this.attract).

export const FIRST_PING_SEC = 5;
export const PING_INTERVAL_SEC = 60;

const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(n) || 0)));
const str = (s, max) => String(s == null ? '' : s).slice(0, max);

export function visitBody(pid) {
  return { site: 'marsstead', kind: 'visit', pid: str(pid, 40) };
}
export function playBody(pid, choice) {
  return { site: 'marsstead', kind: 'play', pid: str(pid, 40), choice: choice === 'continue' ? 'continue' : 'new' };
}
export function insiderBody(pid, secret) {
  return { pid: str(pid, 40), secret: str(secret, 128) };
}
export function pingBody(pid, s = {}) {
  return {
    pid: str(pid, 40),
    name: str(s.name, 24),
    sol: clampInt(s.sol, 0, 99999),
    depth: clampInt(s.depth, 0, 100000),
    o2: clampInt(s.o2, 0, 100),
    vesperTurns: clampInt(s.vesperTurns, 0, 100000),
    loc: str(s.loc, 36),
  };
}

// The ping cadence: first at FIRST_PING_SEC, then every PING_INTERVAL_SEC.
// tSec is elapsed seconds; nextSec is when the next ping is due (null until the
// first fires). Returns the new nextSec when it is time to fire, else null.
export function duePing(tSec, nextSec) {
  if (nextSec == null) return tSec >= FIRST_PING_SEC ? tSec + PING_INTERVAL_SEC : null;
  return tSec >= nextSec ? tSec + PING_INTERVAL_SEC : null;
}
