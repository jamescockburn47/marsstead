// verify-vesper: the canned voice is whole — every event speaks, picks are
// deterministic, the cycle covers the table, and no line can smuggle HTML
// (the escHtml discipline starts at the source).

import { EVENTS, LINES, vesperSay } from '../src/vesper.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. every declared event has lines; every line table is declared
check('every event voiced', EVENTS.every((e) => Array.isArray(LINES[e]) && LINES[e].length >= 2),
  EVENTS.filter((e) => !LINES[e] || LINES[e].length < 2).join(','));
check('no orphan tables', Object.keys(LINES).every((k) => EVENTS.includes(k)));

// 2. lines are clean strings: no HTML, no template syntax, sane length
{
  let ok = true;
  for (const table of Object.values(LINES)) {
    for (const line of table) {
      if (typeof line !== 'string') ok = false;
      if (/[<>]|\$\{/.test(line)) ok = false;
      if (line.length < 10 || line.length > 220) ok = false;
    }
  }
  check('lines clean + sized', ok);
}

// 3. deterministic pick, and the cycle walks the whole table without repeats
{
  check('pick deterministic', vesperSay('sunset', 2) === vesperSay('sunset', 2));
  for (const e of EVENTS) {
    const n = LINES[e].length;
    const seen = new Set();
    for (let i = 0; i < n; i++) seen.add(vesperSay(e, i));
    check(`cycle covers ${e}`, seen.size === n, `${seen.size}/${n}`);
  }
}

// 4. unknown events return null, never throw
check('unknown event is silence', vesperSay('no-such-event', 0) === null);

// 5. the register holds: VESPER never menaces the player. A word-list
// tripwire, not a censor — additions that trip it deserve a second look.
{
  const banned = /\b(kill you|hate you|obey|worthless|stupid human)\b/i;
  let ok = true;
  for (const table of Object.values(LINES)) {
    for (const line of table) if (banned.test(line)) ok = false;
  }
  check('the register holds', ok);
}

if (failed) { console.error(`verify-vesper: ${failed} FAILED`); process.exit(1); }
console.log('verify-vesper: all green');
