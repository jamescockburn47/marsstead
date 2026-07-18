// verify-sleep: the night skip always wakes into a real, rising dawn;
// polar night refuses the bed instead of jumping a season.

import { canSleep, wakeMillis, WAKE_EL, SOL_MS } from '../src/sleep.js';
import { sunElevation, solarLongitude } from '../src/marstime.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

const HOME = { lat: 18.44, lon: 77.05 }; // Jezero, the drop site

// 1. the gate: proper night sleeps, dusk and day do not
check('deep night sleeps', canSleep(-20));
check('early dusk does not', !canSleep(-0.5));
check('day does not', !canSleep(30));

// 2. from any hour of a Jezero sol, the wake moment is a rising dawn at
//    WAKE_EL, within a sol and a quarter, strictly in the future
{
  const base = 1770000000000; // an arbitrary fixed epoch — determinism anchor
  let ok = true, detail = '';
  for (let i = 0; i < 12; i++) {
    const t0 = base + Math.round((i / 12) * SOL_MS);
    const w = wakeMillis(t0, HOME.lat, HOME.lon);
    if (w === null) { ok = false; detail = `null at i=${i}`; break; }
    const el = sunElevation(w, HOME.lat, HOME.lon);
    const rising = sunElevation(w + 600000, HOME.lat, HOME.lon) > el;
    if (!(w > t0 && w - t0 <= SOL_MS * 1.25
      && Math.abs(el - WAKE_EL) < 0.5 && rising)) {
      ok = false; detail = `i=${i} el=${el.toFixed(2)} rising=${rising}`; break;
    }
  }
  check('wake is always a rising dawn', ok, detail);
}

// 3. deterministic: same inputs, same wake, every client
{
  const t0 = 1770000000000;
  check('deterministic', wakeMillis(t0, HOME.lat, HOME.lon) === wakeMillis(t0, HOME.lat, HOME.lon));
}

// 4. polar night: at 85N in northern winter (Ls ~270) no dawn comes —
//    the module says so instead of inventing one
{
  // walk the epoch forward until the season angle reads deep northern winter
  let t = 1770000000000;
  while (Math.abs(solarLongitude(t) - 270) > 2) t += SOL_MS;
  const midwinterNight = wakeMillis(t, 85, 0);
  check('polar night refuses the bed', midwinterNight === null,
    `Ls=${solarLongitude(t).toFixed(1)} got=${midwinterNight}`);
}

if (failed) { console.error(`verify-sleep: ${failed} FAILED`); process.exit(1); }
console.log('verify-sleep: all green');
