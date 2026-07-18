// verify-vesperbrain — the live-brain contract (USP 1's upper layer).
// Holds: the no-leak whitelist (the prompt builder only ever reads
// whitelisted fields), the clamps, the register of the instruction set,
// and the mood→voice plan the TTS relay obeys. Pure imports only.

import {
  VESPER_SYSTEM, STATE_FIELDS, LIMITS, MOODS,
  sanitizeState, stateBrief, buildMessages, cleanStr,
  moodFor, moodForEvent, ttsPlan, clampLine,
  CHAT_PARAMS, VOICE_ID, TTS_MODEL, TTS_MODEL_WHISPER,
} from '../src/vesperbrain.js';
import { EVENTS } from '../src/vesper.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok  ${name}`);
  else { failed += 1; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ---- the instruction set carries the design contract
check('system prompt is substantial', VESPER_SYSTEM.length > 900);
for (const marker of ['settler', 'Safety first', 'Truth only', 'Kid-safe', 'radio', 'no markdown']) {
  check(`system prompt carries "${marker}"`, VESPER_SYSTEM.includes(marker));
}
check('system prompt: never turns on the settler',
  /never menacing|never cruel|on the settler's side/i.test(VESPER_SYSTEM));
check('register tripwire holds on the system prompt',
  !/\b(kill you|hate you|obey|worthless|stupid human)\b/i.test(VESPER_SYSTEM));

// ---- the no-leak guarantee: unlisted fields never reach the prompt
const canary = 'CANARY-9Q4X';
const dirty = {
  air: 55, warm: 80, sol: 3, clock: '14:02', sunEl: 21.4, tempC: -40, tau: 0.6,
  sheltered: true, inside: false, driving: false, lamp: false,
  steadParts: 4, oreSites: 1, lastLine: 'It holds.', event: 'sunset',
  secret: canary, apiKey: canary, pos: { x: canary }, save: canary,
};
const clean = sanitizeState(dirty);
check('whitelist drops unlisted fields',
  !('secret' in clean) && !('apiKey' in clean) && !('pos' in clean) && !('save' in clean));
const serialized = JSON.stringify(buildMessages(dirty, [{ who: 'you', text: 'hello' }], 'how are we'));
check('no canary reaches the prompt', !serialized.includes(canary));
check('whitelisted telemetry does reach the prompt',
  serialized.includes('55 percent') && serialized.includes('Sol 3'));

// ---- clamps hold against hostile sizes and markup
const longText = 'x'.repeat(5000);
const msgs = buildMessages({}, Array.from({ length: 40 }, (_, i) => ({ who: i % 2 ? 'vesper' : 'you', text: longText })), longText);
check('history clamped', msgs.length <= 2 + LIMITS.historyMax);
check('player text clamped', msgs[msgs.length - 1].content.length < LIMITS.playerMax + 200);
check('turns clamped', msgs.slice(1, -1).every((m) => m.content.length <= LIMITS.turnMax));
check('first message is the system contract', msgs[0].role === 'system' && msgs[0].content === VESPER_SYSTEM);
check('last message is the settler', msgs[msgs.length - 1].role === 'user');
check('cleanStr pulls markup teeth', cleanStr('<b>${x}</b> {a} `q` \\', 100) === 'bx/b a q');

// ---- state clamps
const wild = sanitizeState({ air: 4000, warm: -20, sunEl: 999, tau: -3, sol: 0 });
check('numeric clamps hold',
  wild.air === 100 && wild.warm === 0 && wild.sunEl === 90 && wild.tau === 0 && wild.sol === 1);
check('stateBrief survives an empty state', typeof stateBrief({}) === 'string');

// ---- moods: deterministic, total, and honest about danger
check('urgent when air is nearly out', moodFor({ air: 10, warm: 90 }) === 'urgent');
check('urgent when freezing', moodFor({ air: 90, warm: 5 }) === 'urgent');
check('storm outranks calm', moodFor({ air: 90, warm: 90, tau: 4 }) === 'storm');
check('warning on low air', moodFor({ air: 25, warm: 90 }) === 'warning');
check('dark out at night by lamplight', moodFor({ air: 90, warm: 90, sunEl: -10, inside: false, lamp: true }) === 'dark');
check('calm by default', moodFor({}) === 'calm');
for (const ev of EVENTS) {
  const m = moodForEvent(ev, { air: 90, warm: 90 });
  if (!MOODS.includes(m)) check(`event mood valid: ${ev}`, false, m);
}
check('every event maps to a valid mood', true);
check('danger outranks the event colour', moodForEvent('sunset', { air: 5 }) === 'urgent');

// ---- the voice plan: every mood speaks a real MiniMax setting
const EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];
for (const mood of MOODS) {
  const p = ttsPlan(mood);
  check(`tts plan ${mood} is sound`,
    p.voice_id === VOICE_ID && EMOTIONS.includes(p.emotion)
    && [TTS_MODEL, TTS_MODEL_WHISPER].includes(p.model)
    && p.speed >= 0.5 && p.speed <= 2,
    JSON.stringify(p));
  // whisper only exists on the 2.6 models — 2.8 would reject it
  if (p.emotion === 'whisper') check(`whisper rides ${TTS_MODEL_WHISPER}`, p.model === TTS_MODEL_WHISPER);
}
check('unknown mood falls back to calm', ttsPlan('nonsense').emotion === 'calm');

// ---- reply hygiene
check('clampLine strips reasoning', clampLine('<think>secret plan</think>Hello, settler.') === 'Hello, settler.');
check('clampLine strips markdown', clampLine('**Hello** `settler` [ok]') === 'Hello settler ok');
const longLine = clampLine(`${'A good sentence here. '.repeat(40)}`);
check('clampLine radio-clamps', longLine.length <= LIMITS.lineMax);
check('clampLine ends at a sentence', /[.!?…]$/.test(longLine));
check('clampLine of nothing is null', clampLine('   ') === null && clampLine(undefined) === null);

// ---- the chat request the relay sends
check('brain model is MiniMax-M3', CHAT_PARAMS.model === 'MiniMax-M3');
check('completion budget is radio-sized', CHAT_PARAMS.max_completion_tokens <= 200);
check('whitelist is frozen-shaped', Object.values(STATE_FIELDS).every((s) => ['int', 'num', 'str', 'bool'].includes(s.kind)));

if (failed) { console.error(`verify-vesperbrain: ${failed} failure(s)`); process.exit(1); }
console.log('verify-vesperbrain: all green');
