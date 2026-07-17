// verify-dust: the swirl register is a character, not a crash — vortices
// bounded and centred on motion, devils live and die on schedule, the haze
// breathes within limits. All deterministic.

import {
  windAt, tauAt, swirl, devilState, devilSpin, DEVIL_COUNT, DEVIL_LIFE, DEVIL_RANGE,
} from '../src/dust.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. wind: bounded speed, deterministic
{
  let ok = true, worst = 0;
  for (let i = 0; i < 500; i++) {
    const w = windAt(i * 17.3, i * -9.1, i * 0.7);
    worst = Math.max(worst, w.speed);
    if (!(w.speed > 0 && w.speed < 8)) ok = false;
    const w2 = windAt(i * 17.3, i * -9.1, i * 0.7);
    if (w.x !== w2.x || w.z !== w2.z) ok = false;
  }
  check('wind bounded + deterministic', ok, `max=${worst.toFixed(2)}`);
}

// 2. tau: clear-sol envelope, afternoon rise, bounded
{
  let ok = true;
  for (let h = 0; h < 24; h += 0.25) {
    const t = tauAt(h);
    if (!(t >= 0.35 && t <= 0.75)) ok = false;
  }
  check('tau envelope bounded', ok);
  check('tau rises in the afternoon', tauAt(15) > tauAt(6));
}

// 3. swirl: no singularity at the core, dies with distance, off when still
{
  const still = swirl(0, 0, 0.5, 0.5);
  check('no swirl when still', still.x === 0 && still.z === 0);
  let worst = 0, ok = true;
  for (let i = 0; i < 400; i++) {
    const dx = (i % 20 - 10) * 0.3, dz = (Math.floor(i / 20) - 10) * 0.3;
    const s = swirl(6, 0, dx, dz);
    const mag = Math.hypot(s.x, s.z);
    worst = Math.max(worst, mag);
    if (!Number.isFinite(mag) || mag > 20) ok = false;
  }
  check('swirl bounded incl. core', ok, `max=${worst.toFixed(2)}`);
  const near = Math.hypot(...Object.values(swirl(6, 0, 0.5, 0.5)));
  const far = Math.hypot(...Object.values(swirl(6, 0, 8, 8)));
  check('swirl dies with distance', near > far * 5, `near=${near.toFixed(2)} far=${far.toFixed(3)}`);
}

// 4. devils: bounded wander, life envelope rises and dies, deterministic
{
  let ok = true;
  for (let i = 0; i < DEVIL_COUNT; i++) {
    for (let t = 0; t < DEVIL_LIFE * 3; t += 7) {
      const d = devilState(i, t);
      if (Math.abs(d.x) > DEVIL_RANGE * 1.2 || Math.abs(d.z) > DEVIL_RANGE * 1.2) ok = false;
      if (d.intensity < 0 || d.intensity > 1) ok = false;
      if (d.height < 10 || d.height > 90 || d.radius < 1 || d.radius > 6) ok = false;
    }
  }
  check('devil state bounded', ok);
  const mid = devilState(0, DEVIL_LIFE * 0.45);
  const end = devilState(0, DEVIL_LIFE * 0.999);
  check('devil life envelope', mid.intensity > 0.8 && end.intensity < 0.2,
    `mid=${mid.intensity.toFixed(2)} end=${end.intensity.toFixed(2)}`);
  const a = devilState(1, 100), b = devilState(1, 100);
  check('devils deterministic', a.x === b.x && a.z === b.z);
}

// 5. devil spin: Rankine shape — grows to the core radius, decays outside
{
  const inside = devilSpin(1, 2, 1), core = devilSpin(2, 2, 1), out = devilSpin(8, 2, 1);
  check('devil spin peaks at core', core >= inside && core > out && out > 0);
  check('devil spin bounded', devilSpin(0.001, 2, 1) < 10 && Number.isFinite(devilSpin(1e6, 2, 1)));
}

if (failed) { console.error(`verify-dust: ${failed} FAILED`); process.exit(1); }
console.log('verify-dust: all green');
