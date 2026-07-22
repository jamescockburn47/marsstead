// verify-vespermeter — the "meter the voice, not the game" decision table.
// Pure, headless. Order matters: yield > ceiling > coded > free > metered.
import { decide, yieldFor, isCapSignal, capReason, METER_DEFAULTS } from '../src/vespermeter.js';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  FAIL:', name); } };

const cfg = { freeTier: 5, windowBudget: 10, windowSecs: 3600, yieldCooldownSecs: 600 };
const NOW = 1_000_000;

// within the free tier → serve, and tell the caller to count it
let d = decide({ deviceUsedToday: 0, windowUsed: 0 }, cfg, NOW);
check('fresh device serves live (free)', d.allow && d.reason === 'free' && d.count && !d.floor);

// free tier spent → metered, floor speaks, not counted
d = decide({ deviceUsedToday: 5, windowUsed: 0 }, cfg, NOW);
check('free tier exhausted → metered + floor', !d.allow && d.reason === 'metered' && d.floor && !d.count);

// a redeemed code lifts the per-device meter even past the free tier
d = decide({ deviceUsedToday: 999, deviceCoded: true, windowUsed: 0 }, cfg, NOW);
check('redeemed code serves past the free tier', d.allow && d.reason === 'coded' && d.count);

// VESPER's window budget spent → ceiling, everyone gets the floor
d = decide({ deviceUsedToday: 0, deviceCoded: true, windowUsed: 10 }, cfg, NOW);
check('window budget spent → ceiling (beats coded)', !d.allow && d.reason === 'ceiling' && d.floor);

// MiniMax cap active → yield, beats everything (even a coded device with budget)
d = decide({ deviceUsedToday: 0, deviceCoded: true, windowUsed: 0, yieldUntil: NOW + 100 }, cfg, NOW);
check('active yield beats ceiling/coded/free', !d.allow && d.reason === 'yield' && d.floor);

// yield expires → back to normal
d = decide({ deviceUsedToday: 0, windowUsed: 0, yieldUntil: NOW - 1 }, cfg, NOW);
check('expired yield no longer blocks', d.allow && d.reason === 'free');

// boundary: exactly at the free tier is metered; one below still free
check('free-tier boundary is exclusive', decide({ deviceUsedToday: 4, windowUsed: 0 }, cfg, NOW).reason === 'free');
check('window-budget boundary is inclusive', decide({ windowUsed: 10, deviceUsedToday: 0 }, cfg, NOW).reason === 'ceiling');

// cap-signal detection + cooldown
check('1002 and 2056 are cap signals', isCapSignal(1002) && isCapSignal('2056'));
check('other codes are not cap signals', !isCapSignal(429) && !isCapSignal(0) && !isCapSignal(500));
check('yieldFor adds the cooldown', yieldFor(NOW, cfg) === NOW + 600);
check('capReason names the two caps', capReason(1002).includes('rate') && capReason(2056).includes('quota'));

// defaults sane
check('defaults are sensible', METER_DEFAULTS.freeTier === 30 && METER_DEFAULTS.windowBudget > 0);

console.log(`\nverify-vespermeter: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
