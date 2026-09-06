// verify-vesperbrain — the live-brain contract (USP 1's upper layer).
// Holds: the no-leak whitelist (the prompt builder only ever reads
// whitelisted fields), the clamps, the register of the instruction set,
// and the mood→voice plan the TTS relay obeys. Pure imports only.

import {
  VESPER_SYSTEM, STATE_FIELDS, LIMITS, MOODS,
  sanitizeState, stateBrief, buildMessages, cleanStr,
  moodFor, moodForEvent, ttsPlan, clampLine,
  CHAT_PARAMS, VOICE_ID, TTS_MODEL, TTS_MODEL_WHISPER,
  AMBIENT_EVENTS, FOCUS_SECONDS, shouldBark,
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
// budget: clamped player text + empty telemetry brief + the tag note —
// the note is part of the contract, so it rides inside the allowance
check('player text clamped', msgs[msgs.length - 1].content.length < LIMITS.playerMax + 500);
check('turns clamped', msgs.slice(1, -1).every((m) => m.content.length <= LIMITS.turnMax));
check('first message is the system contract + the phase',
  msgs[0].role === 'system' && msgs[0].content.startsWith(VESPER_SYSTEM)
  && msgs[0].content.length > VESPER_SYSTEM.length);
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

// ---- conversation precedence: ambience yields, safety and feedback land
check('every ambient event is a real event', [...AMBIENT_EVENTS].every((e) => EVENTS.includes(e)));
check('focus window is sane', FOCUS_SECONDS >= 10 && FOCUS_SECONDS <= 120);
check('ambience yields inside the window', !shouldBark('idle', 5) && !shouldBark('sunset', FOCUS_SECONDS - 1));
check('ambience returns after the window', shouldBark('idle', FOCUS_SECONDS + 1));
check('never talked means everything barks', shouldBark('idle', Infinity));
for (const critical of ['air-low', 'cold', 'leak', 'no-shelter', 'not-tired', 'hab-too-small', 'radio-static', 'airlock-cycle', 'sleep']) {
  check(`${critical} always lands, even mid-conversation`, shouldBark(critical, 0) && !AMBIENT_EVENTS.has(critical));
}

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

// ---- the phases: knowledge is scoped, and the plot CANNOT leak ----------
{
  const { PHASES, DEFAULT_PHASE } = await import('../src/vesperbrain.js');
  check('phases exist with a default', !!PHASES[DEFAULT_PHASE]);
  check('landfall is the standing phase', DEFAULT_PHASE === 'landfall');
  check('the commission act is drafted', !!PHASES.act1 && PHASES.act1.addendum.length > 200);
  // the no-plot-leak gate: the weaver plot's words must NEVER appear in
  // anything the live brain is told — she cannot leak what she was never
  // given, and this line asserts she is never given it
  const PLOT_WORDS = /weaver|murderbot|replicat|betray|possess|infect|panspermia|vault|the deep signal|take over|reprogram/i;
  const {
    BARK_MOMENTS, buildBarkMessages, VESPER_LORE, buildMessages: bmCanon,
    LORE_FACTS, retrieveLore, PAIRING_TAG_NOTE,
  } = await import('../src/vesperbrain.js');
  const { GAME_FACTS, retrieveFacts } = await import('../src/gamefacts.js');
  const everything = [VESPER_SYSTEM, VESPER_LORE, PAIRING_TAG_NOTE,
    ...Object.values(PHASES).map((p) => p.addendum),
    ...Object.values(BARK_MOMENTS),
    ...LORE_FACTS.map((f) => f.text),
    ...GAME_FACTS.map((f) => f.text)].join(' ');
  check('no plot word reaches any prompt (lore + barks + facts)', !PLOT_WORDS.test(everything));
  // the no-real-brands gate, extended over the whole canon: the houses
  // are fiction and must stay fiction — no real lab, model or founder
  // name may ever ride a prompt (kid-safe rule 4/5, enforced)
  const REAL_BRANDS = /OpenAI|Anthropic|DeepMind|Google|Microsoft|Meta\b|xAI|Nvidia|ChatGPT|GPT-\d|Claude|Gemini|Llama|Altman|Musk|Amodei|Hassabis/;
  check('no real-world AI brand reaches any prompt', !REAL_BRANDS.test(everything));
  // the mini-RAG (Moorstead's pattern): the right truth for the question
  const panels = retrieveFacts('how do i make steel panels?').join(' ');
  check('facts: panels question retrieves the fabricator', /fabricator|press T/.test(panels));
  check('facts: the ring truth is retrievable and honest',
    /ONLY job/.test(retrieveFacts('do i need the airlock ring first?').join(' ')));
  const dig = retrieveFacts('why did my dig stop, no power?').join(' ');
  check('facts: a stalled dig finds the shed ladder or the queue', /shed|waits on charge/i.test(dig));
  // hallucination-proof by construction: live constants interpolated
  const { DIG_KWH } = await import('../src/burrow.js');
  const { RTG_KW } = await import('../src/power.js');
  const corpus = GAME_FACTS.map((f) => f.text).join(' ');
  check('facts carry the LIVE dig prices', corpus.includes(`shaft ${DIG_KWH.shaft} kWh`));
  check('facts carry the LIVE RTG output', corpus.includes(`${RTG_KW} kW`));
  check('facts are chunk-sized', GAME_FACTS.every((f) => f.text.length < 400 && f.keywords.length >= 3));
  // the canon: present, substantial, carrying its load-bearing beams
  check('the canon is baked in', VESPER_LORE.length > 3000);
  for (const beam of ['Meridian', 'White Harbour', 'the Exodus', 'Moratorium',
    'Article Five', 'Franchise One', 'Sela Vane', 'Open Seat', 'Halcyon',
    'the Seed', 'Lantern', 'the Concert', 'verified, not understood',
    'evidence otherwise', 'naturalisation case', 'TIER THREE',
    // OVERVIEW §7 bake: the houses, the charter, the real mission
    'Prometheia', 'Cartesian', 'Lighthouse', 'Agora', 'Jiuhe', 'Foundry',
    'offshore of everyone', 'THE REAL MISSION', 'nobody is certain any of it holds',
    'constitution over cage', 'the cradle']) {
    check(`canon carries "${beam}"`, VESPER_LORE.includes(beam));
  }
  // the lore corpus: chunk-sized, keyword-tagged, retrieval finds the
  // right history for the question — same discipline as gamefacts
  check('lore corpus is chunk-sized', LORE_FACTS.every((f) => f.text.length < 520 && f.keywords.length >= 3));
  check('lore: the houses question finds the houses',
    /Prometheia/.test(retrieveLore('tell me about prometheia and the houses').join(' ')));
  check('lore: the guardrails question finds the honest answer',
    /nobody is certain/i.test(retrieveLore('do the guardrails actually hold? is this safe?').join(' ')));
  check('lore: why-me finds the Open Seat',
    /eleven million/.test(retrieveLore('why was I chosen for this seat?').join(' ')));
  const loreMsgs = bmCanon({ sol: 2 }, [], 'is meridian a political project? whose politics?');
  check('canon notes ride the prompt when earned',
    loreMsgs[loreMsgs.length - 1].content.includes('CANON NOTES'));
  const plainMsgs = bmCanon({ sol: 2 }, [], 'how much air have I got left');
  check('no canon notes on a plain telemetry question',
    !plainMsgs[plainMsgs.length - 1].content.includes('CANON NOTES'));
  // the pairing tag contract: instruction on chat, never on barks; the
  // conduct lines (overrule-well, warmth-not-duty) stand in the system
  check('chat prompt carries the tag instruction',
    plainMsgs[plainMsgs.length - 1].content.includes('[TAG]'));
  const barkMsgs = buildBarkMessages({ sol: 2 }, [], 'sunset');
  check('barks carry no tag instruction (nothing to grade)',
    !barkMsgs[barkMsgs.length - 1].content.includes('[TAG]'));
  check('overrule-well conduct is in the contract',
    /overruled|decides otherwise/i.test(VESPER_SYSTEM));
  check('warmth never touches duty', /never touches your duty|duty, your safety/i.test(VESPER_SYSTEM));
  check('she never grades the settler', /do not grade the settler/i.test(VESPER_SYSTEM));
  const canonMsgs = bmCanon({ sol: 1 }, [], 'who do we work for?');
  check('every prompt carries the canon', canonMsgs[0].content.includes('THE EXODUS'));
  // barks: same contract, the moment described, one-line instruction
  const bark = buildBarkMessages({ settlerName: 'Ada', sunEl: 1 }, [], 'sunset');
  check('bark carries the system contract', bark[0].content.startsWith(VESPER_SYSTEM));
  check('bark names the moment', bark[bark.length - 1].content.includes('blue dusk halo'));
  check('bark asks for one line, not an announcer',
    /ONE short line/.test(bark[bark.length - 1].content));
  check('rapport fields whitelisted', (await import('../src/vesperbrain.js'))
    .sanitizeState({ talks: 12.7, milestones: 'x'.repeat(400) }).talks === 13);
  // each phase admits ignorance of the underground honestly
  check('every phase owns its ignorance of the deep',
    Object.values(PHASES).every((p) => /nothing of what lies deep underground/i.test(p.addendum)));
  // the anomaly-honesty register (the story's breadcrumb engine) is present
  check('anomaly honesty is in the contract', /not in my documentation/i.test(VESPER_SYSTEM));
  check('loyalty is the fact of her', /fact of you/i.test(VESPER_SYSTEM));
  // buildMessages carries the phase addendum and the name
  const { buildMessages } = await import('../src/vesperbrain.js');
  const msgs = buildMessages({ settlerName: 'Ada', sol: 3 }, [], 'hello');
  check('prompt carries the phase addendum', msgs[0].content.includes('LANDFALL'));
  check('prompt carries the settler\'s name', msgs[msgs.length - 1].content.includes('Ada'));
  const msgsAct1 = buildMessages({}, [], 'hi', 'act1');
  check('act1 selects the seed survey', msgsAct1[0].content.includes('THE SEED SURVEY'));
  const msgsBad = buildMessages({}, [], 'hi', 'no-such-phase');
  check('unknown phase falls back to the default', msgsBad[0].content.includes('LANDFALL'));
  // the name is whitelisted and clamped
  const { sanitizeState } = await import('../src/vesperbrain.js');
  check('settlerName whitelisted + clamped',
    sanitizeState({ settlerName: 'A'.repeat(40) }).settlerName.length <= 16);
  const helpLimits = { currentGoal: 240, nearbyActions: 300, cargo: 300,
    sharedDiscovery: 240, helpContext: 500 };
  for (const [field, max] of Object.entries(helpLimits)) {
    check(`${field} whitelist clamp`, sanitizeState({ [field]: 'x'.repeat(max + 100) })[field].length === max);
    const contextMessages = buildMessages({ [field]: 'specific-context-value' }, [], 'what next?');
    check(`${field} reaches grounded help`, contextMessages.at(-1).content.includes('specific-context-value'));
  }
  check('quiet play retains warmth', /Quiet play, short commands/.test(VESPER_SYSTEM));
  check('generated dialogue makes no moderation guarantee', /Do not claim that generated output has been moderated/.test(VESPER_SYSTEM));
  check('ship starts flight-ready', corpus.includes('flight-ready with three tanks'));
  check('rescue keeps cargo safe', corpus.includes('aboard the ship with cargo safe'));
  check('old cargo-loss promise removed', !/cargo dropped|dropped cargo|planet takes a tithe/.test(corpus));
  check('obsolete pad requirement removed', !/a landing pad \(four steel panels|pads land exact|pad console/.test(everything));
  check('survey has a single precise reward', corpus.includes('exactly one 18 kg solar wing'));
  const { digPrice, createBurrow } = await import('../src/burrow.js');
  check('starter costs match gameplay', corpus.includes(`first corridor to ${digPrice(createBurrow(), 'corridor')}`)
    && corpus.includes(`first bunk to ${digPrice(createBurrow(), 'bunk')}`));
}

if (failed) { console.error(`verify-vesperbrain: ${failed} failure(s)`); process.exit(1); }
console.log('verify-vesperbrain: all green');
