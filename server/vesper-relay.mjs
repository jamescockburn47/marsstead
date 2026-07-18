// VESPER's relay — the only process that ever holds the MiniMax key. Runs
// on the EVO (marsstead-brain.service), fronted by Caddy at
// marsstead.sovren.xyz/brain/*, reached by the client only as same-origin
// /brain/* (Vercel rewrite in prod, Vite proxy in dev). Zero dependencies:
// Node's http + fetch. The Moorstead worldsvc shape: rate-limited,
// canned-fallback pass-through (every failure is a clean non-200 so the
// client's floor speaks), and the prompt is composed HERE from the same
// pure contract the client verifies — this door cannot be repurposed as a
// general proxy, it only speaks VESPER.
//
// Deploy keeps the repo layout (server/ beside src/) so this import holds
// on both ends:
import {
  buildMessages, buildBarkMessages, BARK_MOMENTS, sanitizeState, clampLine,
  moodFor, moodForEvent, ttsPlan,
  CHAT_PARAMS, LIMITS, MOODS, VOICE_ID, cleanStr,
} from '../src/vesperbrain.js';

const KEY = process.env.MINIMAX_API_KEY;
if (!KEY) {
  console.error('vesper-relay: MINIMAX_API_KEY is not set; refusing to start');
  process.exit(1);
}
const PORT = Number(process.env.PORT || 8012);
const BASE = process.env.MINIMAX_BASE || 'https://api.minimax.io';
// M3's reasoning pass is skipped by default — a companion answers at radio
// speed. Set MINIMAX_THINKING=adaptive to let it think on hard questions.
const THINKING = process.env.MINIMAX_THINKING || 'disabled';

const ORIGIN_OK = /^(https:\/\/(www\.)?marsstead\.app|http:\/\/(localhost|127\.0\.0\.1):\d+)$/;

// ------------------------------------------------------------ rate limits
// token buckets per client ip (behind Caddy/cloudflared: first XFF hop)
const buckets = new Map(); // ip -> { chat, tts, stamp }
const RATES = { chat: { cap: 6, perMin: 8 }, tts: { cap: 10, perMin: 30 } };
function allow(ip, kind) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) { b = { chat: RATES.chat.cap, tts: RATES.tts.cap, stamp: now }; buckets.set(ip, b); }
  const mins = (now - b.stamp) / 60000;
  b.chat = Math.min(RATES.chat.cap, b.chat + mins * RATES.chat.perMin);
  b.tts = Math.min(RATES.tts.cap, b.tts + mins * RATES.tts.perMin);
  b.stamp = now;
  if (b[kind] < 1) return false;
  b[kind] -= 1;
  return true;
}
setInterval(() => { // drop idle buckets so the map never grows unbounded
  const cut = Date.now() - 30 * 60000;
  for (const [ip, b] of buckets) if (b.stamp < cut) buckets.delete(ip);
}, 10 * 60000).unref();

let inflightChat = 0;
let inflightTts = 0;

// --------------------------------------------------------------- tts cache
// canned lines repeat; cache their audio so a repeated line is free
const ttsCache = new Map(); // key -> Buffer (LRU by re-insertion)
const TTS_CACHE_MAX = 150;
function cachePut(key, buf) {
  ttsCache.delete(key);
  ttsCache.set(key, buf);
  while (ttsCache.size > TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
}

// ---------------------------------------------------------------- helpers
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim().slice(0, 64);
  return req.socket.remoteAddress || 'unknown';
}
function readBody(req, max = 32768) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function send(res, code, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', ...extra });
  res.end(body);
}
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGIN_OK.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

// ------------------------------------------------------------------- chat
async function handleChat(req, res, ip) {
  if (!allow(ip, 'chat')) return send(res, 429, { ok: false, why: 'breathe' });
  if (inflightChat >= 4) return send(res, 503, { ok: false, why: 'busy' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { ok: false }); }

  const state = sanitizeState(body.state);
  const history = Array.isArray(body.history) ? body.history.slice(-LIMITS.historyMax) : [];
  const text = cleanStr(body.text || '', LIMITS.playerMax);
  // barks: the settler said nothing — the client names a known moment and
  // the mind offers one unprompted line (same contract, same phase)
  const bark = typeof body.bark === 'string' && BARK_MOMENTS[body.bark] ? body.bark : '';
  if (!text && !bark) return send(res, 400, { ok: false, why: 'nothing heard' });

  const payload = {
    ...CHAT_PARAMS,
    messages: bark
      ? buildBarkMessages(state, history, bark)
      : buildMessages(state, history, text),
    stream: false,
  };
  if (THINKING === 'disabled') payload.thinking = { type: 'disabled' };

  inflightChat += 1;
  try {
    const r = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`minimax ${r.status}`);
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content;
    const line = clampLine(raw);
    if (!line) throw new Error('empty completion');
    send(res, 200, { ok: true, line, mood: bark ? moodForEvent(bark, state) : moodFor(state) });
  } catch (err) {
    console.error('chat:', err.message);
    send(res, 502, { ok: false });
  } finally {
    inflightChat -= 1;
  }
}

// -------------------------------------------------------------------- tts
async function handleTts(req, res, ip) {
  if (!allow(ip, 'tts')) return send(res, 429, { ok: false, why: 'breathe' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { ok: false }); }

  const text = cleanStr(body.text || '', LIMITS.lineMax);
  if (!text) return send(res, 400, { ok: false });
  const mood = MOODS.includes(body.mood) ? body.mood : 'calm';
  const key = `${mood}|${text}`;

  const hit = ttsCache.get(key);
  if (hit) {
    cachePut(key, hit); // refresh recency
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': hit.length, 'X-Vesper-Cache': 'hit' });
    return res.end(hit);
  }

  if (inflightTts >= 4) return send(res, 503, { ok: false, why: 'busy' });
  const plan = ttsPlan(mood);
  inflightTts += 1;
  try {
    const r = await fetch(`${BASE}/v1/t2a_v2`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: plan.model,
        text,
        voice_setting: {
          voice_id: plan.voice_id, speed: plan.speed, vol: plan.vol,
          pitch: plan.pitch, emotion: plan.emotion,
        },
        audio_setting: { sample_rate: 32000, bitrate: 64000, format: 'mp3', channel: 1 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`minimax ${r.status}`);
    const data = await r.json();
    if (data?.base_resp?.status_code !== 0 || !data?.data?.audio) {
      throw new Error(`t2a ${data?.base_resp?.status_code}: ${data?.base_resp?.status_msg}`);
    }
    const buf = Buffer.from(data.data.audio, 'hex');
    cachePut(key, buf);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length, 'X-Vesper-Cache': 'miss' });
    res.end(buf);
  } catch (err) {
    console.error('tts:', err.message);
    send(res, 502, { ok: false });
  } finally {
    inflightTts -= 1;
  }
}

// ------------------------------------------------------------------ serve
const { createServer } = await import('node:http');
createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = (req.url || '').split('?')[0];
  const ip = clientIp(req);
  try {
    if (req.method === 'GET' && path === '/brain/health') {
      return send(res, 200, {
        ok: true, model: CHAT_PARAMS.model, voice: VOICE_ID,
        cache: ttsCache.size, uptime: Math.round(process.uptime()),
      });
    }
    if (req.method === 'POST' && path === '/brain/chat') return await handleChat(req, res, ip);
    if (req.method === 'POST' && path === '/brain/tts') return await handleTts(req, res, ip);
    send(res, 404, { ok: false });
  } catch (err) {
    console.error('serve:', err.message);
    if (!res.headersSent) send(res, 500, { ok: false });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`vesper-relay listening on 127.0.0.1:${PORT} — model ${CHAT_PARAMS.model}, voice ${VOICE_ID}`);
});
