// verify-marsheavens: the sky's geometry contract. Real stars in their real
// places (angular separations), Mars's own pole (near Deneb, NOT Polaris),
// a wheel that turns sidereal, moons whose rise directions EMERGE from
// their periods, and an Earth that never strays far from the sun.

import {
  SOLAR_SOL_MS, SIDEREAL_SOL_MS, P_PHOBOS_MS, P_DEIMOS_MS,
  raDecToEq, earthEqToMarsEq, wheelAngle, marsEqToWorld, starWorld,
  STAR_CATALOGUE, GALACTIC_POLE, starField,
  phobosWorld, deimosWorld, apparentRate, earthElongation,
} from '../src/marsheavens.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

const star = (name) => STAR_CATALOGUE.find((s) => s[0] === name);
const sepDeg = (a, b) => {
  const va = raDecToEq(a[1], a[2]), vb = raDecToEq(b[1], b[2]);
  return Math.acos(Math.max(-1, Math.min(1,
    va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))) * 180 / Math.PI;
};

// 1. frames produce unit vectors
{
  let ok = true;
  for (const [, ra, dec] of STAR_CATALOGUE) {
    const v = earthEqToMarsEq(raDecToEq(ra, dec));
    if (Math.abs(Math.hypot(...v) - 1) > 1e-9) ok = false;
  }
  check('frames preserve unit length', ok);
}

// 2. the catalogue is the real sky (angular separations)
{
  const belt = sepDeg(star('Mintaka'), star('Alnitak'));
  check('Orion belt span ~2.7°', belt > 2 && belt < 4, `${belt.toFixed(2)}`);
  const beltEven = Math.abs(sepDeg(star('Mintaka'), star('Alnilam'))
    - sepDeg(star('Alnilam'), star('Alnitak')));
  check('Orion belt evenly spaced', beltEven < 0.6, `${beltEven.toFixed(2)}`);
  const pointers = sepDeg(star('Alpha Cen'), star('Hadar'));
  check('the Pointers ~4.5°', pointers > 3.5 && pointers < 6, `${pointers.toFixed(2)}`);
  const plough = sepDeg(star('Dubhe'), star('Alkaid'));
  check('the Plough spans ~26°', plough > 20 && plough < 30, `${plough.toFixed(2)}`);
  const sr = sepDeg(star('Sirius'), star('Rigel'));
  check('Sirius to Rigel ~23°', sr > 18 && sr < 28, `${sr.toFixed(2)}`);
}

// 3. Mars's pole lives in Cygnus — near Deneb, and NOWHERE near Polaris
{
  const poleAsStar = ['pole', 21.1787, 52.887];
  const toDeneb = sepDeg(poleAsStar, star('Deneb'));
  const toPolaris = sepDeg(poleAsStar, star('Polaris'));
  check('Mars pole near Deneb', toDeneb < 15, `${toDeneb.toFixed(1)}°`);
  check('Polaris is nobody\'s pole star here', toPolaris > 30, `${toPolaris.toFixed(1)}°`);
}

// 4. the wheel turns sidereal — faster than the sun by the annual lap
{
  const ratio = SOLAR_SOL_MS / SIDEREAL_SOL_MS;
  check('sidereal sol shorter than solar', SIDEREAL_SOL_MS < SOLAR_SOL_MS);
  check('the gap is the annual lap (~0.15%)', ratio > 1.001 && ratio < 1.002,
    `${ratio.toFixed(6)}`);
  const a = wheelAngle(1e12), b = wheelAngle(1e12 + SIDEREAL_SOL_MS);
  check('one turn per sidereal sol', Math.abs(a - b) < 1e-6 || Math.abs(Math.abs(a - b) - Math.PI * 2) < 1e-6);
}

// 5. the pole stands at the observer's latitude, always
{
  let ok = true;
  for (const lat of [18.4, 45, 75]) {
    for (const t of [0, 3e12, 7.7e12]) {
      const [, y] = marsEqToWorld([0, 1, 0], t, lat);
      const alt = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
      if (Math.abs(alt - lat) > 0.01) ok = false;
    }
  }
  check('the pole stands at the latitude', ok);
}

// 6. the moons: rise directions EMERGE from the periods
{
  check('Phobos outruns the sky (rises west)', apparentRate(P_PHOBOS_MS) > 0);
  check('Deimos lags the sky (rises east)', apparentRate(P_DEIMOS_MS) < 0);
  const phobosCycleH = (Math.PI * 2 / apparentRate(P_PHOBOS_MS)) / 3600000;
  check('Phobos rise-to-rise ~11 h', phobosCycleH > 10.5 && phobosCycleH < 11.7,
    `${phobosCycleH.toFixed(2)} h`);
  const deimosCycleH = Math.abs(Math.PI * 2 / apparentRate(P_DEIMOS_MS)) / 3600000;
  check('Deimos rise-to-rise ~5.4 sols', deimosCycleH > 120 && deimosCycleH < 140,
    `${deimosCycleH.toFixed(1)} h`);
  // near-equatorial: from the equator Phobos should transit near the zenith
  let best = -1;
  for (let i = 0; i < 400; i++) {
    const [, y] = phobosWorld(i * P_PHOBOS_MS / 300, 0);
    best = Math.max(best, y);
  }
  check('Phobos transits high from the equator', best > 0.95, `${best.toFixed(3)}`);
}

// 7. Earth hugs the sun — an evening (and morning) star, never a midnight one
{
  let maxEl = 0, evenings = 0, mornings = 0, ok = true;
  for (let i = 0; i < 600; i++) {
    const t = 946727935816 + i * 4.2e9; // ~80 Earth-days apart, ~7 Mars years
    const e = earthElongation(t);
    if (e.rad > (43 * Math.PI) / 180) ok = false;
    maxEl = Math.max(maxEl, e.rad);
    if (e.evening) evenings++; else mornings++;
  }
  check('Earth never strays past max elongation', ok);
  check('elongation actually approaches the limit', maxEl > (30 * Math.PI) / 180,
    `${(maxEl * 180 / Math.PI).toFixed(1)}°`);
  check('both twilights get their star', evenings > 50 && mornings > 50,
    `${evenings}/${mornings}`);
}

// 8. the background field is deterministic and on the sphere
{
  const a = starField(), b = starField();
  check('star field deterministic', JSON.stringify(a) === JSON.stringify(b));
  check('star field on the unit sphere', a.every((s) =>
    Math.abs(Math.hypot(...s.dir) - 1) < 1e-9));
  check('galactic pole is a unit vector', Math.abs(Math.hypot(...GALACTIC_POLE) - 1) < 1e-9);
}

if (failed) { console.error(`verify-marsheavens: ${failed} FAILED`); process.exit(1); }
console.log('verify-marsheavens: all green');
