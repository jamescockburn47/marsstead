// verify-marstime: the Mars clock holds its astronomy.
// Until the GISS worked examples are pinned (docs/DATA.md TODO), the gate
// holds invariants no wrong implementation survives: the sol's exact
// length, the tropical year, the published Mars-year epoch dates, and the
// bounded envelopes of Ls, EOT and the sun's path.

import {
  marsSolDate, mtc, solarLongitude, equationOfTime, sunElevation,
  subsolarLat, season, solClock, SOL_SECONDS,
} from '../src/marstime.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. sol length: MSD advances exactly one sol per 88775.244 s
{
  const t0 = Date.UTC(2026, 0, 1);
  const d = marsSolDate(t0 + SOL_SECONDS * 1000) - marsSolDate(t0);
  // double-precision JD arithmetic at MSD ~44800 rounds in the 9th place
  check('sol length', Math.abs(d - 1) < 1e-7, `dMSD=${d}`);
}

// 2. MTC wraps [0, 24) and advances with time
{
  const t0 = Date.UTC(2026, 5, 10);
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const h = mtc(t0 + i * 987654);
    if (!(h >= 0 && h < 24)) ok = false;
  }
  check('MTC bounded', ok);
}

// 3. the tropical year: Ls returns to itself after ~686.9726 days
{
  const t0 = Date.UTC(2024, 2, 1);
  const YEAR_DAYS = 686.9726;
  const a = solarLongitude(t0);
  const b = solarLongitude(t0 + YEAR_DAYS * 86400000);
  const dLs = Math.abs(((b - a + 540) % 360) - 180); // 0 when Ls returned home
  check('tropical year period', dLs < 0.3, `ΔLs=${dLs.toFixed(3)} after one Mars year`);
}

// 4. published Mars-year epochs: MY36 began (Ls=0) 2021-02-07,
//    MY37 began 2022-12-26. Generous tolerance: the dates are day-precision.
{
  const ls36 = solarLongitude(Date.UTC(2021, 1, 7, 12));
  const near0 = Math.min(ls36, 360 - ls36);
  check('MY36 epoch (2021-02-07 ~ Ls 0)', near0 < 1.5, `Ls=${ls36.toFixed(2)}`);
  const ls37 = solarLongitude(Date.UTC(2022, 11, 26, 12));
  const near0b = Math.min(ls37, 360 - ls37);
  check('MY37 epoch (2022-12-26 ~ Ls 0)', near0b < 1.5, `Ls=${ls37.toFixed(2)}`);
}

// 5. EOT bounded: Mars's equation of time stays within ±55 min (~13.75 deg)
{
  let ok = true, worst = 0;
  const t0 = Date.UTC(2024, 0, 1);
  for (let d = 0; d < 700; d += 3) {
    const e = Math.abs(equationOfTime(t0 + d * 86400000));
    worst = Math.max(worst, e);
    if (e > 13.75) ok = false;
  }
  check('EOT bounded', ok, `worst=${worst.toFixed(2)} deg`);
}

// 6. subsolar latitude bounded by the obliquity
{
  let ok = true;
  const t0 = Date.UTC(2024, 0, 1);
  for (let d = 0; d < 700; d += 7) {
    if (Math.abs(subsolarLat(t0 + d * 86400000)) > 25.2) ok = false;
  }
  check('subsolar |lat| <= obliquity', ok);
}

// 7. the sun rises and sets at Jezero across one sol
{
  const t0 = Date.UTC(2026, 3, 4);
  let hi = -90, lo = 90;
  for (let s = 0; s < SOL_SECONDS; s += 600) {
    const el = sunElevation(t0 + s * 1000, 18.44, 77.45);
    hi = Math.max(hi, el); lo = Math.min(lo, el);
  }
  check('sun rises and sets at Jezero', hi > 30 && lo < -30, `hi=${hi.toFixed(1)} lo=${lo.toFixed(1)}`);
}

// 8. formatting sanity
check('solClock shape', /^Sol \d+, \d{2}:\d{2} MTC$/.test(solClock(Date.UTC(2026, 0, 1))));
check('season named', ['northern spring', 'northern summer', 'northern autumn', 'northern winter'].includes(season(Date.now())));

if (failed) { console.error(`verify-marstime: ${failed} FAILED`); process.exit(1); }
console.log('verify-marstime: all green');
