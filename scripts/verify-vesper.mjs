// verify-vesper: the deterministic floor after the rapport amendment.
// The canned PERSONALITY is dead — the mind is live-only. What this gate
// holds now: the INSTRUMENT channel is complete for safety/mechanics and
// carries no personality events; every game event is voiced SOMEWHERE
// (instrument or bark moment — never voiceless); the register tripwire
// still holds; and the settler's name is laundered and lands.

import { EVENTS, INSTRUMENT, suitSay, cleanName } from '../src/vesper.js';
import { BARK_MOMENTS } from '../src/vesperbrain.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the split is total: every event is instrument OR bark, never both,
//    never neither — the mind and the instruments never speak over each other
{
  const uncovered = EVENTS.filter((e) => !INSTRUMENT[e] && !BARK_MOMENTS[e]);
  check('every event is voiced somewhere', uncovered.length === 0, uncovered.join(','));
  const both = EVENTS.filter((e) => INSTRUMENT[e] && BARK_MOMENTS[e]);
  check('no event speaks through both channels', both.length === 0, both.join(','));
  check('no orphan instrument tables', Object.keys(INSTRUMENT).every((k) => EVENTS.includes(k)));
}

// 2. the instrument channel is functional, never personality
{
  const PERSONALITY_EVENTS = ['wake', 'sunset', 'night', 'dawn', 'idle', 'first-steps', 'pressurised'];
  check('personality events are the mind\'s alone',
    PERSONALITY_EVENTS.every((e) => !INSTRUMENT[e]));
  let terse = true, banned = true;
  const MENACE = /\b(kill|die|dead|blood|hate|stupid|useless|abandon)\b/i;
  for (const table of Object.values(INSTRUMENT)) {
    for (const line of table) {
      if (line.length > 130) terse = false;
      if (MENACE.test(line)) banned = false;
    }
  }
  check('instrument lines are terse', terse);
  check('register tripwire holds', banned);
  check('the off-relay notice stands', Array.isArray(INSTRUMENT['radio-static'])
    && INSTRUMENT['radio-static'].length >= 2);
  check('safety events covered instantly',
    ['air-low', 'cold', 'leak', 'no-shelter'].every((e) => INSTRUMENT[e]?.length >= 2));
}

// 3. deterministic pick; silence for the mind's events
{
  check('pick deterministic', suitSay('air-low', 2) === suitSay('air-low', 2));
  const seen = new Set();
  const n = INSTRUMENT['air-low'].length;
  for (let i = 0; i < n; i++) seen.add(suitSay('air-low', i));
  check('cycle walks the whole table', seen.size === n);
  check('the mind\'s events are silence here', suitSay('sunset', 0) === null
    && suitSay('no-such-event', 0) === null);
}

// 4. the settler's name: laundered at the door, landed in the lines
{
  check('cleanName strips markup teeth', cleanName('<b>Ada</b>{x}$`\\') === 'bAdabx');
  check('cleanName caps at sixteen', cleanName('A'.repeat(40)).length === 16);
  check('cleanName keeps honest names', cleanName("Mary-Ann O'Hara") === "Mary-Ann O'Hara");
  check('cleanName of garbage is empty', cleanName('<>{}') === '' && cleanName(42) === '');
  const t = INSTRUMENT['radio-static'].length;
  let subOk = true;
  for (let i = 0; i < t; i++) {
    if (suitSay('radio-static', i, 'Ada').includes('{name}')) subOk = false;
    if (suitSay('radio-static', i, '').includes('{name}')) subOk = false;
  }
  check('{name} always lands (or "settler" serves)', subOk);
}

if (failed) { console.error(`verify-vesper: ${failed} FAILED`); process.exit(1); }
console.log('verify-vesper: all green');
