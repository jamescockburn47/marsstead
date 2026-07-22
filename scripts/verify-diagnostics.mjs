// verify-diagnostics — the Marsstead ledger beacon shapes + ping cadence. Pure.
import {
  visitBody, playBody, insiderBody, pingBody, duePing,
  FIRST_PING_SEC, PING_INTERVAL_SEC,
} from '../src/marsdiag.js';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  FAIL:', name); } };

// ---- visit / play -----------------------------------------------------------
check('visit body is site+kind+pid', (() => { const b = visitBody('abc-123'); return b.site === 'marsstead' && b.kind === 'visit' && b.pid === 'abc-123'; })());
check('play body normalises choice=new', playBody('p', 'garbage').choice === 'new' && playBody('p').kind === 'play');
check('play body keeps continue', playBody('p', 'continue').choice === 'continue');
check('pid is capped at 40 chars', visitBody('x'.repeat(60)).pid.length === 40);

// ---- insider ----------------------------------------------------------------
check('insider body carries pid + secret', (() => { const b = insiderBody('abc-123', 's3cret'); return b.pid === 'abc-123' && b.secret === 's3cret'; })());

// ---- ping clamps ------------------------------------------------------------
const p = pingBody('abc-123', { name: 'Ada', sol: 4.9, depth: -3, o2: 250, vesperTurns: 12.7, loc: 'surface' });
check('ping floors sol', p.sol === 4);
check('ping clamps depth to >= 0', p.depth === 0);
check('ping clamps o2 to <= 100', p.o2 === 100);
check('ping floors vesperTurns', p.vesperTurns === 12);
check('ping keeps name + loc', p.name === 'Ada' && p.loc === 'surface');
check('ping name truncates to 24', pingBody('p', { name: 'z'.repeat(40) }).name.length === 24);

// ---- ping cadence -----------------------------------------------------------
check('no ping before the first-ping time', duePing(FIRST_PING_SEC - 1, null) === null);
check('first ping fires at FIRST_PING_SEC and schedules the next', duePing(FIRST_PING_SEC, null) === FIRST_PING_SEC + PING_INTERVAL_SEC);
check('no ping between intervals', duePing(30, 65) === null);
check('next ping fires on time', duePing(65, 65) === 65 + PING_INTERVAL_SEC);
check('a long gap fires once and resets from now', duePing(500, 65) === 500 + PING_INTERVAL_SEC);

console.log(`\nverify-diagnostics: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
