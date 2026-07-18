// verify-trailer: the tow is honest — trails at drawbar length, cuts in
// on corners, sways at speed, and jackknifes when geometry says so.

import {
  DRAWBAR, JACKKNIFE_RAD, createTrailer, stepTrailer,
} from '../src/trailer.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// drive a virtual tractor and keep the trailer on its pin
function tow(t, path, dt = 1 / 60) {
  let flags = { phi: 0, sway: false, jackknife: false }, ever = { sway: false, jackknife: false };
  for (const p of path) {
    flags = stepTrailer(t, p.hx, p.hz, p.heading, p.u, dt);
    ever.sway ||= flags.sway; ever.jackknife ||= flags.jackknife;
  }
  return { flags, ever };
}

// 1. the straight pull: trailer settles dead behind at drawbar length
{
  const t = createTrailer(0, -DRAWBAR, 0);
  const path = [];
  for (let i = 1; i <= 300; i++) path.push({ hx: 0, hz: i * 0.1, heading: 0, u: 6 });
  const { flags } = tow(t, path);
  const dist = Math.hypot(0 - t.x, 30 - t.z);
  check('trails at drawbar length', Math.abs(dist - DRAWBAR) < 0.01, `${dist}`);
  check('runs true behind', Math.abs(t.x) < 0.01 && Math.abs(flags.phi) < 0.01);
}

// 2. the circle: steady articulation, and the axle cuts INSIDE the pin's path
{
  const t = createTrailer(0, -DRAWBAR, 0);
  const R = 9;
  let phi = 0, rMax = 0;
  for (let i = 0; i <= 1200; i++) {
    const a = i * 0.01;
    const f = stepTrailer(t, Math.sin(a) * R, Math.cos(a) * R, a + Math.PI / 2, 5, 1 / 60);
    if (i > 600) { phi = f.phi; rMax = Math.max(rMax, Math.hypot(t.x, t.z)); }
  }
  check('steady hitch angle on a circle', Math.abs(phi) > 0.1 && Math.abs(phi) < 0.6, `${phi}`);
  check('cuts in on the corner', rMax < R - 0.05, `${rMax} vs ${R}`);
}

// 3. sway: the same circle taken fast trips the flag
{
  const t = createTrailer(0, -DRAWBAR, 0);
  const R = 7.5;
  let ever = false;
  for (let i = 0; i <= 900; i++) {
    const a = i * 0.02;
    ever ||= stepTrailer(t, Math.sin(a) * R, Math.cos(a) * R, a + Math.PI / 2, 11, 1 / 60).sway;
  }
  check('speed + articulation = sway', ever);
}

// 4. the jackknife: reversing with the trailer crooked folds the pin —
//    but PULLING from the same crook self-straightens and never shears
{
  const t = createTrailer(0.9, -DRAWBAR, 0.5); // parked crooked
  let ever = false;
  for (let i = 0; i <= 600 && !ever; i++) {
    // tractor backs straight down -z; the pin pushes the crooked trailer
    ever = stepTrailer(t, 0, -i * 0.02, 0, -2, 1 / 60).jackknife;
  }
  check('reversing crooked jackknifes', ever);

  const p = createTrailer(DRAWBAR * Math.sin(1.0), -DRAWBAR * Math.cos(1.0), 1.0);
  let sheared = false, phiEnd = 9;
  for (let i = 0; i <= 900; i++) {
    // tractor pulls hard straight up +z from a 1-radian crook
    const f = stepTrailer(p, 0, i * 0.15, 0, 9, 1 / 60);
    sheared ||= f.jackknife;
    phiEnd = f.phi;
  }
  check('a hard pull never shears', !sheared);
  check('the pull self-straightens', Math.abs(phiEnd) < 0.05, `${phiEnd}`);
}

// 5. deterministic
{
  const a = createTrailer(0, -DRAWBAR, 0), b = createTrailer(0, -DRAWBAR, 0);
  for (let i = 0; i < 200; i++) {
    stepTrailer(a, Math.sin(i * 0.03) * 4, i * 0.1, 0, 4, 1 / 60);
    stepTrailer(b, Math.sin(i * 0.03) * 4, i * 0.1, 0, 4, 1 / 60);
  }
  check('deterministic', a.x === b.x && a.z === b.z && a.heading === b.heading);
}

if (failed) { console.error(`verify-trailer: ${failed} FAILED`); process.exit(1); }
console.log('verify-trailer: all green');
