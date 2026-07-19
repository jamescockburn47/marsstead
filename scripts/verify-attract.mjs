// verify-attract: the reel's contract — the loop covers every shot with
// fades at every cut, the camera maths is finite and deterministic, the
// descent genuinely descends the whole ladder, and the drive inputs are
// bounded (the buggy is driven, never teleported).

import {
  SHOTS, FADE_S, LOOP_S, reelAt, shotCam, driveInput,
} from '../src/attract.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the table: real shots, sane hours and weather, fades that fit
{
  check('the reel has enough shots to sell a world', SHOTS.length >= 4);
  check('every shot is named and timed', SHOTS.every((s) => s.id && s.dur >= 8));
  check('hours are hours, tau is weather',
    SHOTS.every((s) => s.hour >= 0 && s.hour < 24.66 && s.tau >= 0 && s.tau <= 5));
  check('the fade fits inside every shot', SHOTS.every((s) => s.dur > FADE_S * 2.5));
  check('the loop is the sum of its shots',
    Math.abs(LOOP_S - SHOTS.reduce((a, s) => a + s.dur, 0)) < 1e-9);
}

// 2. the clock: coverage, wrap, veils at the cuts
{
  const seen = new Set();
  for (let t = 0; t < LOOP_S; t += 0.25) seen.add(reelAt(t).shot.id);
  check('every shot plays', seen.size === SHOTS.length);
  check('the loop wraps clean', reelAt(LOOP_S + 3).shot.id === reelAt(3).shot.id);
  check('negative time is not a crash', Number.isFinite(reelAt(-5).k));
  check('every cut wears a veil', (() => {
    let edge = 0;
    for (const [i] of SHOTS.entries()) {
      const start = SHOTS.slice(0, i).reduce((a, s) => a + s.dur, 0);
      if (reelAt(start + 0.01).veil > 0.9) edge++;
    }
    return edge === SHOTS.length;
  })());
  check('mid-shot runs clear', reelAt(SHOTS[0].dur / 2).veil < 0.05);
}

// 3. the camera maths: finite, deterministic, and honest per shot
{
  for (const s of SHOTS) {
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const c = shotCam(s.id, k, [120, -40]);
      const nums = [...c.cam, ...c.look, c.alt];
      if (!nums.every(Number.isFinite)) check(`finite ${s.id}@${k}`, false);
    }
  }
  check('all shot cameras are finite', true);
  const a = shotCam('descent', 0.4), b = shotCam('descent', 0.4);
  check('the maths is deterministic', JSON.stringify(a) === JSON.stringify(b));
  check('the descent starts in the black and lands in the haze',
    shotCam('descent', 0).alt > 9000 && shotCam('descent', 1).alt < 150);
  check('the descent only ever descends', (() => {
    let last = Infinity;
    for (let k = 0; k <= 1.001; k += 0.02) {
      const { alt } = shotCam('descent', k);
      if (alt > last + 1e-6) return false;
      last = alt;
    }
    return true;
  })());
  check('the drive shot tracks its subject',
    Math.abs(shotCam('drive', 0.5, [500, 300]).look[0] - 500) < 1e-9
    && shotCam('drive', 0.5, [500, 300]).world === true);
  check('the stead orbit closes in', (() => {
    const r0 = Math.hypot(shotCam('stead', 0).cam[0], shotCam('stead', 0).cam[2]);
    const r1 = Math.hypot(shotCam('stead', 1).cam[0], shotCam('stead', 1).cam[2]);
    return r1 < r0;
  })());
}

// 4. the drive inputs: bounded, deterministic, always moving forward
{
  for (const k of [0, 0.3, 0.6, 0.9]) {
    const d = driveInput(k);
    if (!(d.throttle > 0.4 && d.throttle <= 1 && Math.abs(d.steer) <= 0.5
      && d.brake === 0)) check(`drive input sane @${k}`, false, JSON.stringify(d));
  }
  check('drive inputs are bounded and forward', true);
  check('the wheel actually turns across the run',
    driveInput(0.1).steer !== driveInput(0.4).steer);
}

if (failed) { console.error(`verify-attract: ${failed} FAILED`); process.exit(1); }
console.log('verify-attract: all green');
