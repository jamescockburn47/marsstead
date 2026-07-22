// The muster book — the Marsstead ledger's pure maths: per-browser dedupe, play
// tracking, and the public / house / bot partition that keeps James's own
// dogfooding and the crawlers out of the headline "real audience" numbers.
//
// No http, no fs, no THREE/DOM — the server shell (server/mars-ledger.mjs) and
// scripts/verify-musterbook.mjs drive these same functions, so the counting is
// proven headlessly (identity invariant 3). node:crypto is Node-only and never
// imported by the browser client.
//
// Ported faithfully from Saltstead's harbourmaster ledger: the {days, seen,
// ever} bitmask model. A refresh inflates raw hits (v/p) but never the uniques
// (uv/up), and a lost beacon only ever undercounts. Then extended with a stable
// per-browser class so every metric can be shown as real / house / bot.

import { createHash } from 'node:crypto';

export const SEEN_KEEP_DAYS = 45; // per-day dedupe sets kept this long; day totals kept forever
export const EVER_CAP = 20000;    // lifetime distinct-browser table cap (oldest last-seen evicted)
export const CLASSES = ['pub', 'house', 'bot']; // pub = a real stranger (the headline)

const PID_RE = /^[a-z0-9-]{4,40}$/;

// Crawlers announce themselves in the UA; the big ones also sit in known nets.
const BOT_UA_RE = /bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternal|embedly|preview|monitor|headless|phantom|lighthouse|python-requests|curl\/|wget|axios|node-fetch|okhttp|semrush|ahrefs|petalbot/i;
// A handful of well-known crawler nets — a prefix match is plenty for a filter.
const BOT_IP_PREFIXES = ['66.249.', '66.102.', '64.233.', '40.77.', '157.55.', '207.46.', '17.58.', '54.236.', '2a01:4f8:'];

export function utcDay(now) {
  return Math.floor((now == null ? Date.now() / 1000 : now) / 86400);
}

// A stable per-browser id: the persistent localStorage pid if it looks real,
// else a hash of ip+ua so a pidless/blocked caller still dedupes coarsely.
export function visitUid(pid, ip, ua) {
  const basis = PID_RE.test(pid || '')
    ? 'pid:' + pid
    : 'ip:' + (ip || '') + '|' + String(ua || '').slice(0, 80);
  return createHash('sha1').update(basis).digest('hex').slice(0, 12);
}

// ---- clean-numbers classification -----------------------------------------
// HOUSE (James): an insider-tagged browser, or a local/tailnet address (his own
// dev + testing). BOT: a crawler UA or IP. PUB: a real stranger. Insider beats
// bot beats local-ip — an explicit tag always wins.
export function isLocalIp(ip) {
  ip = String(ip || '').trim();
  if (!ip) return false;
  if (ip === '::1' || ip.startsWith('127.')) return true;         // loopback
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true; // RFC1918
  const m = ip.match(/^172\.(\d+)\./); if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  const t = ip.match(/^100\.(\d+)\./); if (t && +t[1] >= 64 && +t[1] <= 127) return true; // tailnet CGNAT
  return false;
}
export function isBotIp(ip) {
  ip = String(ip || '').trim();
  return BOT_IP_PREFIXES.some((p) => ip.startsWith(p));
}
export function isBotUa(ua) {
  return BOT_UA_RE.test(String(ua || ''));
}
export function hasInsider(insiders, uid) {
  if (!insiders) return false;
  return typeof insiders.has === 'function' ? insiders.has(uid) : !!insiders[uid];
}
export function classify(uid, ip, ua, insiders) {
  if (hasInsider(insiders, uid)) return 'house';
  if (isBotUa(ua) || isBotIp(ip)) return 'bot';
  if (isLocalIp(ip)) return 'house';
  return 'pub';
}

// ---- the ledger maths ------------------------------------------------------
// Record one beacon into a per-site store {days, seen, ever} (mutates + returns
// the class used). `kind` is 'visit'|'play'; `cls` is 'pub'|'house'|'bot'; the
// class is stamped on the lifetime row so a browser later tagged insider moves
// class on its next beacon (the headline uses the current class, not history).
export function recordVisit(store, kind, uid, cls, day) {
  day = String(day == null ? utcDay() : day);
  cls = CLASSES.includes(cls) ? cls : 'pub';
  const days = store.days || (store.days = {});
  const seen = store.seen || (store.seen = {});
  const ever = store.ever || (store.ever = {});
  const rec = days[day] || (days[day] = { v: 0, uv: 0, p: 0, up: 0 });
  const bucket = seen[day] || (seen[day] = {});
  const prev = bucket[uid] | 0;
  if (kind === 'play') {
    rec.p += 1;
    if (!(prev & 2)) rec.up += 1;
    bucket[uid] = prev | 2;
  } else {
    rec.v += 1;
    if (!(prev & 1)) rec.uv += 1;
    bucket[uid] = prev | 1;
  }
  const e = ever[uid] || [+day, +day, 0, cls];
  e[1] = +day;
  if (kind === 'play') e[2] += 1;
  e[3] = cls;
  ever[uid] = e;
  // evict the oldest lifetime rows past the cap
  const ekeys = Object.keys(ever);
  if (ekeys.length > EVER_CAP) {
    ekeys.sort((a, b) => ever[a][1] - ever[b][1]);
    for (const k of ekeys.slice(0, ekeys.length - EVER_CAP)) delete ever[k];
  }
  // day totals live forever; the per-day dedupe sets are pruned to the window
  const cutoff = utcDay(day * 86400) - SEEN_KEEP_DAYS;
  for (const d of Object.keys(seen)) if (+d < cutoff) delete seen[d];
  return cls;
}

// Add a browser (by uid) to the insider set and flip its lifetime class to
// house so it drops out of the real-audience headline immediately.
export function tagInsider(store, uid) {
  const ever = store.ever || (store.ever = {});
  if (ever[uid]) ever[uid][3] = 'house';
}

function classOf(ever, uid) {
  const c = ever[uid] && ever[uid][3];
  return CLASSES.includes(c) ? c : 'pub';
}

function dateStr(day) {
  const dt = new Date(day * 86400 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

// Aggregate a per-site store into today / week / ever, each split real (pub) /
// house / bot. Uniques (the headline) are recomputed from the dedupe sets using
// each browser's CURRENT class, so tagging a device insider re-partitions the
// history correctly. Raw v/p are all-class context. `today` overridable for tests.
export function summarize(store, today) {
  today = today == null ? utcDay() : today;
  const days = store.days || {}, seen = store.seen || {}, ever = store.ever || {};
  const range = (from, to) => { const a = []; for (let d = from; d <= to; d++) a.push(String(d)); return a; };

  const uniquesOver = (r) => {
    const vis = { pub: new Set(), house: new Set(), bot: new Set() };
    const play = { pub: new Set(), house: new Set(), bot: new Set() };
    for (const d of r) {
      const b = seen[d]; if (!b) continue;
      for (const uid of Object.keys(b)) {
        const cls = classOf(ever, uid), bit = b[uid] | 0;
        if (bit & 1) vis[cls].add(uid);
        if (bit & 2) play[cls].add(uid);
      }
    }
    return { vis, play };
  };
  const rawSum = (r, k) => r.reduce((s, d) => s + ((days[d] && days[d][k]) || 0), 0);
  const pack = (u) => ({
    real: { uniques: u.vis.pub.size, playUniques: u.play.pub.size },
    house: { uniques: u.vis.house.size, playUniques: u.play.house.size },
    bot: { uniques: u.vis.bot.size, playUniques: u.play.bot.size },
  });

  const todayR = range(today, today), weekR = range(today - 6, today);
  const tu = uniquesOver(todayR), wu = uniquesOver(weekR);

  const everCls = { pub: { browsers: 0, players: 0 }, house: { browsers: 0, players: 0 }, bot: { browsers: 0, players: 0 } };
  for (const uid of Object.keys(ever)) {
    const cls = classOf(ever, uid);
    everCls[cls].browsers += 1;
    if ((ever[uid][2] | 0) > 0) everCls[cls].players += 1;
  }

  const recentDays = [];
  for (let d = today - 13; d <= today; d++) {
    const r = days[String(d)];
    if (r) recentDays.push({ date: dateStr(d), v: r.v || 0, uv: r.uv || 0, p: r.p || 0, up: r.up || 0 });
  }

  return {
    today: { visits: rawSum(todayR, 'v'), plays: rawSum(todayR, 'p'), ...pack(tu) },
    week: { visits: rawSum(weekR, 'v'), plays: rawSum(weekR, 'p'), ...pack(wu) },
    ever: {
      visits: Object.values(days).reduce((s, r) => s + (r.v || 0), 0),
      plays: Object.values(days).reduce((s, r) => s + (r.p || 0), 0),
      real: everCls.pub, house: everCls.house, bot: everCls.bot,
    },
    recentDays,
  };
}
