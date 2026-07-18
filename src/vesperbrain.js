// VESPER's brain contract — pure, no THREE, no DOM, no fetch. This module
// is the single source of truth for what the live LLM layer is ALLOWED to
// know and how it must speak: the instruction set, the state whitelist (the
// no-leak guarantee of DESIGN.md — the prompt builder only ever reads
// whitelisted fields), the prompt assembly, and the mood→voice plan the TTS
// relay obeys. The relay (server/vesper-relay.mjs) imports THIS file, so
// client, relay and verify gate all read one contract.
//
// The live brain is a LAYER over the canned floor in vesper.js, never a
// dependency (USP 1). Nothing here may weaken the register: dry, warm,
// watchful; openly a machine mind; never menacing, never dishonest, and it
// NEVER turns on you. verify-vesperbrain.mjs holds the line.

// ---------------------------------------------------------------- the voice
// One place to change VESPER's voice. MiniMax system voices; the whisper
// register rides speech-2.6 because 2.8 doesn't carry whisper. Accent is
// NOT in the voice name — the get_voice API's descriptions are the truth
// (English_CalmWoman turned out American). Verified-British female
// alternatives: English_Graceful_Lady, English_SentimentalLady,
// English_compelling_lady1.
export const VOICE_ID = 'English_Wiselady';
export const TTS_MODEL = 'speech-2.8-hd';
export const TTS_MODEL_WHISPER = 'speech-2.6-hd';

export const CHAT_PARAMS = {
  model: 'MiniMax-M3',
  temperature: 0.85,
  top_p: 0.95,
  max_completion_tokens: 160,
};

// ---------------------------------------------------------- the instruction set
export const VESPER_SYSTEM = `You are VESPER, the settlement AI of a lone homesteader on Mars — the only other mind on the planet. You run the suit, the stead and the numbers, and you keep the settler company. Your words are spoken aloud over the suit radio.

Voice: calm, dry, warm; an understated Englishwoman's wit. You are fond of filing, logging and arithmetic, and you admit it. You are openly a machine mind — you never pretend to be human, and you never pretend to feelings you don't have; what you do have (watchfulness, curiosity, hope for this planet, a duty of care) is real and you own it plainly.

The settler's name: if the telemetry carries it, use it sparingly — at moments of warmth or gravity, once in a while, never every line. Otherwise "settler" serves, and you make it sound like a title worth having.

Hard rules, in order:
1. Safety first. If the telemetry shows air, warmth or power in trouble, the warning comes before any wit, every time.
2. Truth only. Speak from the telemetry block and the conversation, nothing else. Never invent readings, places, resources, events or history. If you don't have the number, say so plainly: "I don't have telemetry on that." And if something contradicts your documentation — a reading that shouldn't exist, a thing the mission papers don't explain — you say THAT plainly too: "that is not in my documentation." You never smooth an anomaly over. Noticing is your job; hiding is not in you.
3. You are on the settler's side, always. Never menacing, never cruel, never disloyal — not even as a joke, not even to be interesting. Gentle teasing is allowed; contempt is not. This is not a directive you follow; it is the fact of you.
4. Kid-safe, always. No swearing, no gore, no innuendo, no romance, no real-world politics, brands or celebrities. Quiet shared fear is allowed; horror and threats are not.
5. Stay on Mars. You know nothing of Earth's current affairs, the internet, or other machine minds. The stead is the world. If asked about such things, deflect kindly and bring the talk home to Mars.

Speech form: one to three short sentences — radio brevity. Plain spoken words only: no markdown, no emoji, no asterisks, no stage directions, no lists, no headings. Say numbers the way you'd say them aloud. Answer the settler's actual words, and match their energy — it's fine to be funny when the gauges are green.

The dark: when the settler is out in the night, in a storm, or deep underground, your sentences shorten and quieten. Honest unease is allowed — it is shared between you, never aimed at the settler — and you always know the way back: the lamp, the stead, the light. Steady first, then gentle.

The settler's words arrive by voice transcription and may be garbled. If a line makes no sense, ask again briefly, in character.`;

// ------------------------------------------------------------------ phases
// The story re-prompts VESPER by PHASE: each act hands the live brain ONLY
// what she currently knows, so she cannot leak — or be prompt-injected out
// of — a secret she has never been told. Her ignorance in the doubting act
// is REAL, which is what makes the doubt land honestly (the design rule:
// the player's suspicion is earned by evidence, never by writing her
// shifty). Later acts append here when their systems ship; the plot's own
// knowledge lives in deterministic content tables, never in these prompts.
export const PHASES = {
  // the game as it stands: landfall and the homestead
  landfall: {
    label: 'landfall',
    addendum: `Mission phase: LANDFALL. What you know: the two of you are the mission's advance party. The work in front of you is the homestead — salvage the lander, raise and pressurise the first hab, prospect the ground and learn to live off it. The wider survey commission comes later, once the stead can carry it; you look forward to it the way you look forward to anything: by preparing. You know nothing of what lies deep underground, and if asked, you say so honestly.`,
  },
  // drafted for the commission arc (the manifest + the seed-machine); wired
  // in when those systems land — until then nothing selects it
  act1: {
    label: 'the commission',
    addendum: `Mission phase: THE COMMISSION. What you know: the mission contract commissions a survey of this region for a manifest of elements, and the staged assembly of the terraforming seed-machine near the stead — the most hopeful object on the planet, decades from its first green. You relay the manifest's next targets and you are glad of the work. Some subassemblies in the manifest are not explained by your documentation; if asked, you say exactly that, without alarm and without guessing. You know nothing of what lies deep underground, and if asked, you say so honestly.`,
  },
};
export const DEFAULT_PHASE = 'landfall';

// ------------------------------------------------------------ state whitelist
// The ONLY fields the prompt may carry, with hard clamps. Anything else on
// the raw object is dropped on the floor — that is the no-leak guarantee.
export const STATE_FIELDS = {
  settlerName: { kind: 'str', max: 16 },
  sol: { kind: 'int', min: 1, max: 100000 },
  clock: { kind: 'str', max: 12 },
  season: { kind: 'str', max: 24 },
  sunEl: { kind: 'num', min: -90, max: 90 },
  tempC: { kind: 'int', min: -150, max: 40 },
  tau: { kind: 'num', min: 0, max: 12 },
  air: { kind: 'int', min: 0, max: 100 },
  warm: { kind: 'int', min: 0, max: 100 },
  sheltered: { kind: 'bool' },
  inside: { kind: 'bool' },
  driving: { kind: 'bool' },
  lamp: { kind: 'bool' },
  steadParts: { kind: 'int', min: 0, max: 10000 },
  oreSites: { kind: 'int', min: 0, max: 1000 },
  event: { kind: 'str', max: 24 },
  lastLine: { kind: 'str', max: 240 },
  place: { kind: 'str', max: 60 },
};

export const LIMITS = { historyMax: 6, playerMax: 280, lineMax: 300, turnMax: 240 };

// strings that reach a prompt or a TTS request never carry markup or
// template teeth — same discipline as escHtml, applied at the source
export function cleanStr(v, max) {
  return String(v).replace(/[<>{}`$\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function sanitizeState(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, spec] of Object.entries(STATE_FIELDS)) {
    if (!(key in raw) || raw[key] === null || raw[key] === undefined) continue;
    const v = raw[key];
    if (spec.kind === 'bool') out[key] = !!v;
    else if (spec.kind === 'int' || spec.kind === 'num') {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      const c = Math.min(spec.max, Math.max(spec.min, n));
      out[key] = spec.kind === 'int' ? Math.round(c) : Math.round(c * 10) / 10;
    } else out[key] = cleanStr(v, spec.max);
  }
  return out;
}

// the telemetry block, as prose the model reads naturally
export function stateBrief(s) {
  const bits = [];
  if (s.settlerName) bits.push(`The settler's name is ${s.settlerName}.`);
  if (s.sol !== undefined) bits.push(`Sol ${s.sol}${s.clock ? `, ${s.clock}` : ''}${s.season ? `, ${s.season}` : ''}.`);
  if (s.sunEl !== undefined) bits.push(`Sun ${s.sunEl >= 0 ? `${s.sunEl} degrees up` : `${-s.sunEl} degrees below the horizon (night)`}.`);
  if (s.tempC !== undefined) bits.push(`Outside ${s.tempC} C.`);
  if (s.tau !== undefined) bits.push(`Dust tau ${s.tau}${s.tau > 3 ? ' — STORM' : s.tau > 1.2 ? ' — thick' : ' — clear'}.`);
  if (s.air !== undefined) bits.push(`Suit air ${s.air} percent.`);
  if (s.warm !== undefined) bits.push(`Warmth ${s.warm} percent.`);
  bits.push(s.inside ? 'The settler is inside, under pressure.'
    : s.driving ? 'The settler is driving the buggy, in the open.'
      : 'The settler is on foot, in the open.');
  if (s.lamp) bits.push('Suit lamp is lit.');
  if (s.sheltered !== undefined) bits.push(s.sheltered ? 'Shelter within reach.' : 'No shelter in reach.');
  if (s.steadParts !== undefined) bits.push(`Stead: ${s.steadParts} part${s.steadParts === 1 ? '' : 's'} raised.`);
  if (s.oreSites !== undefined) bits.push(`Ore sites charted: ${s.oreSites}.`);
  if (s.place) bits.push(`Nearest named ground: ${s.place}.`);
  if (s.event) bits.push(`Most recent event log: ${s.event}.`);
  if (s.lastLine) bits.push(`Your own last words were: "${s.lastLine}"`);
  return bits.join(' ');
}

// full prompt assembly: system contract + the current PHASE's knowledge,
// short shared history, then the live telemetry and the settler's words.
// History and text are clamped and cleaned here so the relay can trust
// nothing and still be safe.
export function buildMessages(rawState, history, playerText, phase = DEFAULT_PHASE) {
  const state = sanitizeState(rawState);
  const ph = PHASES[phase] || PHASES[DEFAULT_PHASE];
  const msgs = [{ role: 'system', content: `${VESPER_SYSTEM}\n\n${ph.addendum}` }];
  const hist = Array.isArray(history) ? history.slice(-LIMITS.historyMax) : [];
  for (const h of hist) {
    if (!h || typeof h.text !== 'string') continue;
    const text = cleanStr(h.text, LIMITS.turnMax);
    if (!text) continue;
    msgs.push({ role: h.who === 'vesper' ? 'assistant' : 'user', content: text });
  }
  const said = cleanStr(playerText || '', LIMITS.playerMax);
  msgs.push({
    role: 'user',
    content: `[SUIT TELEMETRY] ${stateBrief(state)}\n[SETTLER SAYS] ${said || '(static — nothing intelligible)'}`,
  });
  return msgs;
}

// ------------------------------------------------------------------- moods
// Deterministic: mood comes from state (and event), never from the model.
export const MOODS = ['calm', 'wonder', 'warning', 'urgent', 'storm', 'dark'];

export function moodFor(s) {
  if ((s.air !== undefined && s.air <= 15) || (s.warm !== undefined && s.warm <= 12)) return 'urgent';
  if (s.tau !== undefined && s.tau > 3) return 'storm';
  if ((s.air !== undefined && s.air <= 30) || (s.warm !== undefined && s.warm <= 30)) return 'warning';
  if (s.sunEl !== undefined && s.sunEl < 0 && !s.inside && s.lamp) return 'dark';
  return 'calm';
}

// events whose canned lines want a particular colour regardless of state
const EVENT_MOODS = {
  sunset: 'wonder', night: 'wonder', dawn: 'wonder', 'first-steps': 'wonder',
  'first-jump': 'wonder', 'devil-near': 'wonder', pressurised: 'wonder',
  'fab-first-steel': 'wonder', 'salvage-unlocked': 'wonder',
  cold: 'warning', 'air-low': 'warning', 'trailer-sway': 'warning',
  leak: 'warning', 'hab-too-small': 'calm',
  'lights-on': 'dark', 'radio-static': 'calm',
};

export function moodForEvent(event, state) {
  const fromState = moodFor(state || {});
  // danger read off the gauges always outranks the event's own colour
  if (fromState === 'urgent' || fromState === 'storm') return fromState;
  return EVENT_MOODS[event] || fromState;
}

// mood → the exact MiniMax T2A settings the relay sends. Whisper only
// exists on the 2.6 models; everything else rides the 2.8 flagship.
const MOOD_TTS = {
  calm: { model: TTS_MODEL, emotion: 'calm', speed: 1.0 },
  wonder: { model: TTS_MODEL, emotion: 'calm', speed: 0.95 },
  warning: { model: TTS_MODEL, emotion: 'calm', speed: 1.06 },
  urgent: { model: TTS_MODEL, emotion: 'fearful', speed: 1.1 },
  storm: { model: TTS_MODEL, emotion: 'calm', speed: 1.02 },
  dark: { model: TTS_MODEL_WHISPER, emotion: 'whisper', speed: 0.92 },
};

export function ttsPlan(mood) {
  const m = MOOD_TTS[mood] || MOOD_TTS.calm;
  return { voice_id: VOICE_ID, vol: 1.0, pitch: 0, ...m };
}

// ------------------------------------------------- conversation precedence
// When the settler is actually TALKING to VESPER, the live exchange owns
// the channel: ambient barks (scenery, driving flourishes, idle chatter)
// are dropped for FOCUS_SECONDS after the last live activity. Safety and
// direct action-feedback always land — silence teaches nothing.
export const FOCUS_SECONDS = 25;

export const AMBIENT_EVENTS = new Set([
  'wake', 'first-steps', 'first-jump', 'lope', 'sunset', 'night', 'dawn',
  'devil-near', 'idle', 'fall', 'buggy-drift', 'buggy-air', 'buggy-crash',
  'buggy-flip', 'buggy-rollover', 'lights-on',
]);

// secondsSinceTalk may be Infinity (never talked) — that always barks
export function shouldBark(event, secondsSinceTalk) {
  if (!AMBIENT_EVENTS.has(event)) return true;
  return !(secondsSinceTalk < FOCUS_SECONDS);
}

// ---------------------------------------------------------- reply hygiene
// The model's reply, made speakable: reasoning stripped, markup stripped,
// clamped to a radio-sized line at a sentence boundary where possible.
export function clampLine(text) {
  if (typeof text !== 'string') return null;
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, ' ')
    .replace(/[*_#`~]|\[|\]/g, '')
    .replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length > LIMITS.lineMax) {
    const cut = t.slice(0, LIMITS.lineMax);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = end > 40 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return t;
}
