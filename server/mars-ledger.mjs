// The Marsstead ledger — marsstead-dash. Zero-dependency Node (node:http + JSON
// files), the sibling of Saltstead's harbourmaster ledger but Marsstead's own,
// so Mars stops being a tenant of the salt ledger. Runs on the EVO
// (marsstead-dash.service, :8098, LAN/Tailscale only); the Cloudflare tunnel
// (marsstead.sovren.xyz -> Caddy :8092) routes only the public /dash/* beacons.
//
// The counting maths + the real/house/bot partition live in the pure, headless
// ../src/musterbook.js (proven by verify-musterbook). This file is the http+fs
// shell: rate limits, the invite/token mint (ported from the salt ledger),
// play/ping telemetry, VESPER-meter codes, and the /api/summary the Admiralty
// Board reads. Deploy keeps src/ beside server/ so the import holds (as the
// VESPER relay does).

import { createServer } from 'node:http';
import { createHash, createHmac, randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  utcDay, visitUid, classify, recordVisit, tagInsider, summarize,
} from '../src/musterbook.js';

const PORT = Number(process.env.PORT || 8098);
const DIR = process.env.MARS_DASH_DIR || '/home/james/marsstead/dash';
const BRAIN_URL = process.env.BRAIN_URL || 'http://127.0.0.1:8012';
const INSIDER_SECRET = process.env.MARS_INSIDER_SECRET || '';   // gate for "mark my device"
const ADMIN_BEARER = process.env.MARS_ADMIN_BEARER || '';       // mutating house endpoints
const VERSION = process.env.MARS_VERSION || '';
const LIVE_WINDOW = 180;   // a session is "on Mars now" if pinged within this many seconds
const SESSIONS_KEEP = 4000;
mkdirSync(DIR, { recursive: true });

// Clint: tell Clawd (the WhatsApp agent) when a real stranger shows up, files a
// bug, etc. Fire-and-forget, HMAC-signed with the shared STEADS_WEBHOOK_SECRET;
// if Clawd is down the ledger never notices. A visit pings at most once per
// browser per hour so a page-refresh can't spam.
const CLAWD_URL = process.env.CLAWD_URL || 'http://127.0.0.1:3000';
const STEADS_SECRET = process.env.STEADS_WEBHOOK_SECRET || '';
const VISIT_PING_WINDOW = 3600;
const pinged = new Map(); // uid -> last visit-ping ts
function emitClint(type, extra = {}) {
  if (!STEADS_SECRET) return;
  try {
    const body = JSON.stringify({ game: 'marsstead', type, ts: Date.now() / 1000, ...extra });
    const sig = createHmac('sha256', STEADS_SECRET).update(body).digest('hex');
    fetch(CLAWD_URL + '/api/steads-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-steads-signature': sig },
      body, signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  } catch { /* fire-and-forget */ }
}

const PID_RE = /^[a-z0-9-]{4,40}$/;
const CODE_RE = /^[a-z]+-[a-z]+-\d{2}$/;
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;

// Mars-themed mint words — the code is the account key, so keep them memorable.
const W1 = ['dust', 'sol', 'dune', 'crater', 'rille', 'mesa', 'basalt', 'olympus', 'jezero',
  'ares', 'phobos', 'deimos', 'rover', 'oxide', 'iron', 'frost', 'aeon', 'regolith', 'storm', 'aurora'];
const W2 = ['mast', 'dome', 'vent', 'core', 'ridge', 'plain', 'cairn', 'drift', 'spire', 'basin',
  'dawn', 'dusk', 'relay', 'beacon', 'hatch', 'seal', 'tank', 'lamp', 'watch', 'span'];

// ---------------------------------------------------------------- json store
function load(name, fallback) {
  try { return JSON.parse(readFileSync(join(DIR, name), 'utf8')); } catch { return fallback; }
}
function save(name, data) {
  const tmp = join(DIR, name + '.tmp');
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, join(DIR, name));
}

// ---------------------------------------------------------------- helpers
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || String(req.headers['cf-connecting-ip'] || '').trim() || req.socket.remoteAddress || '?';
}
function insiderSet() { return new Set(load('insiders.json', [])); }

function rateOk(ip, limit, file) {
  const day = utcDay();
  const rates = load(file, {});
  let rec = rates[ip];
  if (!rec || rec.day !== day) rec = { day, n: 0 };
  if (rec.n >= limit) return false;
  rec.n += 1; rates[ip] = rec; save(file, rates);
  return true;
}
function readBody(req, max = 32768) {
  return new Promise((resolve) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) req.destroy(); else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(body);
}
const acctId = (code) => createHash('sha1').update('mars:' + code).digest('hex').slice(0, 10);

// ---------------------------------------------------------------- mint / tokens
function mintCode(warden = false) {
  const codes = load('codes.json', {});
  for (let i = 0; i < 80; i++) {
    const w1 = W1[randomBytes(1)[0] % W1.length];
    const w2 = W2[randomBytes(1)[0] % W2.length];
    const n = 10 + (randomBytes(1)[0] % 80);
    const code = `${w1}-${w2}-${String(n).padStart(2, '0')}`;
    if (codes[code] || !CODE_RE.test(code)) continue;
    codes[code] = { warden: !!warden, minted: Date.now() / 1000 };
    save('codes.json', codes);
    return code;
  }
  throw new Error('could not mint a unique code');
}
function pruneTokens(tokens) {
  const now = Date.now() / 1000;
  return Object.fromEntries(Object.entries(tokens).filter(([, v]) => (v.exp || 0) > now - 60));
}
function mintToken(acct, name, warden) {
  const tokens = pruneTokens(load('tokens.json', {}));
  const token = randomBytes(32).toString('base64url');
  tokens[token] = { acct, name, warden: !!warden, exp: Date.now() / 1000 + 7 * 86400 };
  save('tokens.json', tokens);
  return token;
}
// A pid is "coded" (unlimited VESPER) if it belongs to any redeemed account.
function pidIsCoded(pid) {
  if (!PID_RE.test(pid || '')) return false;
  const accounts = load('accounts.json', {});
  return Object.values(accounts).some((a) => Array.isArray(a.pids) && a.pids.includes(pid));
}

// ---------------------------------------------------------------- public doors
async function onVisit(req, res, kind) {
  const ip = clientIp(req);
  if (!rateOk(ip, 300, 'visit_rate.json')) return json(res, 200, { ok: false });
  const d = await readBody(req);
  if (!d || String(d.site || '').toLowerCase() !== 'marsstead') return json(res, 200, { ok: false });
  const pid = String(d.pid || '').slice(0, 40).toLowerCase();
  const ua = String(req.headers['user-agent'] || '');
  const uid = visitUid(pid, ip, ua);
  const cls = classify(uid, ip, ua, insiderSet());
  const store = load('visits.json', {});
  const site = store.marsstead || (store.marsstead = {});
  recordVisit(site, kind, uid, cls, utcDay());
  save('visits.json', store);
  // Clint pings only for real strangers (you + bots are filtered by class)
  if (cls === 'pub') {
    if (kind === 'play') emitClint('play');
    else {
      const t = Date.now() / 1000;
      if (t - (pinged.get(uid) || 0) > VISIT_PING_WINDOW) { pinged.set(uid, t); emitClint('visit'); }
    }
  }
  return json(res, 200, { ok: true });
}

async function onPing(req, res) {
  const ip = clientIp(req);
  if (!rateOk(ip, 3000, 'visit_rate.json')) return json(res, 200, { ok: false });
  const d = await readBody(req);
  if (!d) return json(res, 200, { ok: false });
  const pid = String(d.pid || '').slice(0, 40).toLowerCase();
  const ua = String(req.headers['user-agent'] || '');
  const uid = visitUid(pid, ip, ua);
  const cls = classify(uid, ip, ua, insiderSet());
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(n) || 0)));
  const rec = {
    ts: Date.now() / 1000, uid, cls,
    name: String(d.name || '').replace(/[^\w \-']/g, '').slice(0, 24),
    sol: clamp(d.sol, 0, 99999),
    depth: clamp(d.depth, 0, 100000),
    o2: clamp(d.o2, 0, 100),
    vesperTurns: clamp(d.vesperTurns, 0, 100000),
    loc: String(d.loc || '').slice(0, 36),
  };
  const sessions = load('sessions.json', []);
  sessions.push(rec);
  save('sessions.json', sessions.slice(-SESSIONS_KEEP));
  // lifetime telemetry high-water marks (real players only)
  if (cls === 'pub') {
    const tel = load('tel.json', { maxDepth: 0, maxSol: 0, vesperTurns: 0 });
    tel.maxDepth = Math.max(tel.maxDepth, rec.depth);
    tel.maxSol = Math.max(tel.maxSol, rec.sol);
    tel.vesperTurns += 0; // per-session turns are a gauge, not a running sum here
    save('tel.json', tel);
  }
  return json(res, 200, { ok: true });
}

async function onFeedback(req, res) {
  const ip = clientIp(req);
  if (!rateOk(ip, 8, 'feedback_rate.json')) return json(res, 200, { ok: false, err: 'a few reports a day, colonist' });
  const d = await readBody(req);
  if (!d) return json(res, 200, { ok: false, err: 'bad request' });
  const message = String(d.message || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ').trim().slice(0, 2000);
  if (message.length < 8) return json(res, 200, { ok: false, err: 'Tell us a bit more.' });
  const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  if (email && !EMAIL_RE.test(email)) return json(res, 200, { ok: false, err: "That email doesn't look right." });
  const ctx = (d.context && typeof d.context === 'object') ? d.context : {};
  const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(n) || 0)));
  const entry = {
    id: randomBytes(6).toString('hex'), ts: Date.now() / 1000,
    kind: ['bug', 'feedback'].includes(String(d.kind || '').toLowerCase()) ? String(d.kind).toLowerCase() : 'feedback',
    message, email,
    name: String(d.name || '').replace(/[^\w \-']/g, '').slice(0, 24),
    pid: PID_RE.test(String(d.pid || '').toLowerCase()) ? String(d.pid).toLowerCase() : '',
    ip,
    context: { // Mars vocabulary
      page: String(ctx.page || '').slice(0, 24),
      url: String(ctx.url || '').slice(0, 240),
      ua: String(ctx.ua || '').slice(0, 240),
      loc: String(ctx.loc || '').slice(0, 36),
      sol: clampInt(ctx.sol, 0, 99999),
      depth: clampInt(ctx.depth, 0, 100000),
      o2: clampInt(ctx.o2, 0, 100),
    },
  };
  const log = load('feedback.json', []);
  log.push(entry);
  save('feedback.json', log.slice(-1000));
  emitClint(entry.kind === 'bug' ? 'bug' : 'feedback', { name: entry.name, message: entry.message });
  return json(res, 200, { ok: true, msg: 'Logged to the ledger — thank you.' });
}

async function onInsider(req, res) {
  const d = await readBody(req);
  if (!d || !INSIDER_SECRET || String(d.secret || '') !== INSIDER_SECRET) return json(res, 200, { ok: false });
  const pid = String(d.pid || '').slice(0, 40).toLowerCase();
  if (!PID_RE.test(pid)) return json(res, 200, { ok: false });
  const uid = visitUid(pid, '', ''); // pid-based uid (a tagged device always has a real pid)
  const insiders = load('insiders.json', []);
  if (!insiders.includes(uid)) { insiders.push(uid); save('insiders.json', insiders); }
  const store = load('visits.json', {});
  if (store.marsstead) { tagInsider(store.marsstead, uid); save('visits.json', store); }
  return json(res, 200, { ok: true, tagged: uid });
}

async function onRedeem(req, res) {
  const d = await readBody(req);
  if (!d) return json(res, 200, { ok: false, error: 'bad request' });
  const code = String(d.code || '').trim().toLowerCase().slice(0, 40);
  const name = String(d.name || '').replace(/[^\w \-']/g, '').trim().slice(0, 24);
  const pid = String(d.pid || '').slice(0, 40).toLowerCase();
  if (!CODE_RE.test(code)) return json(res, 200, { ok: false, error: "That code doesn't look right." });
  const codes = load('codes.json', {});
  const entry = codes[code];
  if (!entry) return json(res, 200, { ok: false, error: 'No such code. Check the spelling.' });
  const accounts = load('accounts.json', {});
  let acct = accounts[code];
  if (!acct) {
    if (!name) return json(res, 200, { ok: false, error: 'And your name, colonist?' });
    acct = { name, pids: [], created: Date.now() / 1000 };
  } else if (name) acct.name = name;
  if (PID_RE.test(pid) && !acct.pids.includes(pid)) acct.pids = [...acct.pids, pid].slice(-6);
  acct.last = Date.now() / 1000;
  accounts[code] = acct;
  save('accounts.json', accounts);
  // a warden code also insider-tags the device
  if (entry.warden && PID_RE.test(pid)) {
    const uid = visitUid(pid, '', '');
    const insiders = load('insiders.json', []);
    if (!insiders.includes(uid)) { insiders.push(uid); save('insiders.json', insiders); }
  }
  const token = mintToken(acctId(code), acct.name, !!entry.warden);
  return json(res, 200, { ok: true, name: acct.name, token, warden: !!entry.warden });
}

// ---------------------------------------------------------------- house api
async function brainHealth() {
  const grab = async (path) => {
    try {
      const r = await fetch(BRAIN_URL + path, { signal: AbortSignal.timeout(1500) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  const [health, stats] = await Promise.all([grab('/brain/health'), grab('/brain/stats')]);
  return { up: !!health, health: health || {}, stats: stats || {} };
}

function liveRoster() {
  const now = Date.now() / 1000;
  const sessions = load('sessions.json', []);
  const byUid = new Map();
  for (const s of sessions) if (now - s.ts <= LIVE_WINDOW) byUid.set(s.uid, s); // last ping per browser
  return [...byUid.values()];
}

async function onSummary(req, res) {
  const store = load('visits.json', {});
  const muster = summarize(store.marsstead || {}, utcDay());
  const roster = liveRoster();
  const brain = await brainHealth();
  const tel = load('tel.json', { maxDepth: 0, maxSol: 0 });
  const codes = load('codes.json', {});
  const accounts = load('accounts.json', {});
  json(res, 200, {
    ok: true, version: VERSION, now: Date.now() / 1000,
    muster,
    live: {
      real: roster.filter((s) => s.cls === 'pub').map((s) => ({ name: s.name, sol: s.sol, depth: s.depth, loc: s.loc })),
      house: roster.filter((s) => s.cls !== 'pub').length,
    },
    telemetry: { maxDepth: tel.maxDepth, maxSol: tel.maxSol },
    vesper: brain,
    codes: { total: Object.keys(codes).length, claimed: Object.keys(accounts).length },
    feedback: (load('feedback.json', [])).slice(-8).reverse(),
  });
}

function bearerOk(req) {
  if (!ADMIN_BEARER) return true; // if unset, fall back to network-boundary (tailnet) only
  return String(req.headers['authorization'] || '') === 'Bearer ' + ADMIN_BEARER;
}

// ---------------------------------------------------------------- server
createServer(async (req, res) => {
  const path = (req.url || '').split('?')[0];
  const m = req.method || 'GET';
  try {
    // public beacon doors
    if (m === 'POST' && path === '/dash/visit') return await onVisit(req, res, 'visit');
    if (m === 'POST' && path === '/dash/play') return await onVisit(req, res, 'play');
    if (m === 'POST' && path === '/dash/ping') return await onPing(req, res);
    if (m === 'POST' && path === '/dash/feedback') return await onFeedback(req, res);
    if (m === 'POST' && path === '/dash/insider') return await onInsider(req, res);
    if (m === 'POST' && path === '/dash/redeem') return await onRedeem(req, res);
    // relay asks whether a device is coded (loopback)
    if (m === 'POST' && path === '/api/coded') {
      const d = await readBody(req);
      return json(res, 200, { ok: true, coded: pidIsCoded(String(d?.pid || '').slice(0, 40).toLowerCase()) });
    }
    // house read
    if (m === 'GET' && path === '/api/summary') return await onSummary(req, res);
    if (m === 'GET' && path === '/api/visits') return json(res, 200, { visits: { marsstead: summarize((load('visits.json', {}).marsstead) || {}, utcDay()) } });
    if (m === 'GET' && path === '/api/feedback') return json(res, 200, { feedback: (load('feedback.json', [])).slice(-40).reverse() });
    if (m === 'GET' && path === '/api/codes') {
      const codes = load('codes.json', {}); const accounts = load('accounts.json', {});
      return json(res, 200, { codes: Object.keys(codes).sort().map((c) => ({ code: c, warden: !!codes[c].warden, name: accounts[c]?.name || null, last: accounts[c]?.last || null })) });
    }
    // house mutate (bearer-gated)
    if (m === 'POST' && path === '/api/mint') {
      if (!bearerOk(req)) return json(res, 403, { ok: false });
      const d = await readBody(req);
      return json(res, 200, { ok: true, code: mintCode(!!d?.warden) });
    }
    if (m === 'POST' && path === '/api/revoke') {
      if (!bearerOk(req)) return json(res, 403, { ok: false });
      const d = await readBody(req);
      const code = String(d?.code || '').trim().toLowerCase();
      const codes = load('codes.json', {});
      if (!codes[code]) return json(res, 200, { ok: false, error: 'no such code' });
      delete codes[code]; save('codes.json', codes);
      const accounts = load('accounts.json', {});
      if (accounts[code]) { delete accounts[code]; save('accounts.json', accounts); }
      const tokens = load('tokens.json', {});
      const live = Object.fromEntries(Object.entries(tokens).filter(([, v]) => v.acct !== acctId(code)));
      if (Object.keys(live).length !== Object.keys(tokens).length) save('tokens.json', live);
      return json(res, 200, { ok: true, code });
    }
    json(res, 404, { ok: false });
  } catch (err) {
    console.error('mars-ledger:', err.message);
    if (!res.headersSent) json(res, 500, { ok: false });
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`mars-ledger listening on 0.0.0.0:${PORT}, data ${DIR}`);
});
