// verify-marslight: the backwards light of Mars holds its signature facts —
// warm noon, blue-peaked dusk, dark night, sepia storm — and every channel
// stays bounded.

import { lightState, surfaceTempC, TAU_CLEAR, TAU_STORM } from '../src/marslight.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

const chans = ['skyZenith', 'skyHorizon', 'sunColour', 'haloBlue', 'ambientColour', 'fogColour'];

// 1. everything bounded [0..1] across the whole envelope
{
  let ok = true;
  for (let el = -30; el <= 90; el += 2) {
    for (const tau of [0.3, 0.7, 1.5, 3, 5]) {
      const L = lightState(el, tau);
      for (const c of chans) if (L[c].some((v) => v < 0 || v > 1.0001)) ok = false;
      for (const s of ['sunIntensity', 'haloStrength', 'ambientIntensity', 'shadowSoftness', 'starVisibility', 'storm']) {
        if (L[s] < 0 || L[s] > 1.0001) ok = false;
      }
      if (!(L.fogDensity > 0 && L.fogDensity < 0.2)) ok = false;
    }
  }
  check('all channels bounded', ok);
}

// 2. the blue halo peaks at the horizon — the signature dusk
{
  const dusk = lightState(0, TAU_CLEAR).haloStrength;
  const noon = lightState(60, TAU_CLEAR).haloStrength;
  const night = lightState(-20, TAU_CLEAR).haloStrength;
  check('blue halo peaks at dusk', dusk > noon * 3 && dusk > 0.5 && night < 0.05,
    `dusk=${dusk.toFixed(2)} noon=${noon.toFixed(2)} night=${night.toFixed(2)}`);
  const L = lightState(0, TAU_CLEAR);
  check('halo is blue', L.haloBlue[2] > L.haloBlue[0], `${L.haloBlue}`);
}

// 3. day sky is warm (butterscotch: R > G > B), night sky is dark
{
  const day = lightState(45, TAU_CLEAR);
  check('day horizon warm-ordered', day.skyHorizon[0] > day.skyHorizon[1] && day.skyHorizon[1] > day.skyHorizon[2]);
  const night = lightState(-25, TAU_CLEAR);
  check('night is dark', Math.max(...night.skyZenith) < 0.06 && night.starVisibility > 0.9);
  // the playable floor: night ambient keeps the ground legible (a gameplay
  // number), yet stays well under half the day fill so night still reads
  const dayA = lightState(45, TAU_CLEAR).ambientIntensity;
  check('night ambient playable but subordinate',
    night.ambientIntensity >= 0.12 && night.ambientIntensity < dayA * 0.5,
    `night=${night.ambientIntensity.toFixed(3)} day=${dayA.toFixed(3)}`);
}

// 4. the storm: sun dies to a pale coin, stars vanish, fog thickens
{
  const clear = lightState(45, TAU_CLEAR), storm = lightState(45, TAU_STORM);
  check('storm kills the sun', storm.sunIntensity < clear.sunIntensity * 0.2,
    `${storm.sunIntensity.toFixed(3)} vs ${clear.sunIntensity.toFixed(3)}`);
  check('storm thickens fog', storm.fogDensity > clear.fogDensity * 4);
  check('storm hides stars at night', lightState(-25, TAU_STORM).starVisibility < 0.05);
  check('storm softens shadows', storm.shadowSoftness > clear.shadowSoftness);
}

// 5. ambient never black by day — shadows are dusty rose, not void
{
  const L = lightState(40, TAU_CLEAR);
  check('day ambient present', L.ambientIntensity > 0.3 && L.ambientColour[0] > L.ambientColour[2]);
}

// 6. temperature: brutal night, survivable day, monotone with sun
{
  const night = surfaceTempC(-20), noon = surfaceTempC(60);
  check('night ~-84C', night < -80, `${night}`);
  check('noon survivable-ish', noon > -35 && noon < 5, `${noon}`);
  check('temp rises with sun', surfaceTempC(30) > surfaceTempC(5));
}

// ---- the altitude ladder: butterscotch -> violet -> black-at-noon ----------
{
  const { altitudeLight, lightState } = await import('../src/marslight.js');
  const noon = lightState(60, 0.4);
  const ground = altitudeLight(noon, 0);
  const mid = altitudeLight(noon, 8000);
  const high = altitudeLight(noon, 40000);
  const ch = (L) => Object.values(L).every((v) => (Array.isArray(v)
    ? v.every((n) => Number.isFinite(n) && n >= 0 && n <= 1.01)
    : typeof v !== 'number' || Number.isFinite(v)));
  check('the ladder returns finite bounded channels', ch(ground) && ch(mid) && ch(high));
  check('sea level is the surface state (ladder starts at zero)',
    ground.skyZenith[0] === noon.skyZenith[0] && ground.fogDensity === noon.fogDensity
    && ground.limb === 0 && ground.thin === 0);
  check('the zenith blackens on the way up',
    high.skyZenith[0] < mid.skyZenith[0] && mid.skyZenith[0] < ground.skyZenith[0]);
  check('black at noon: stars come out in daytime',
    noon.starVisibility === 0 && high.starVisibility > 0.85);
  check('aerial perspective dies with the air', high.fogDensity < noon.fogDensity * 0.01);
  check('the sun hardens (vacuum key light)',
    high.sunIntensity >= noon.sunIntensity && high.shadowSoftness < noon.shadowSoftness + 1e-9);
  check('the dust fill dies with the dust',
    high.ambientIntensity < noon.ambientIntensity * 0.4);
  check('the limb reads only from altitude',
    ground.limb === 0 && altitudeLight(noon, 2000).limb === 0 && high.limb > 0.9);
  check('the halo is a surface phenomenon', high.haloStrength < noon.haloStrength + 1e-9);
  // the ladder holds at night too: no NaN, limb dims but exists over dusk
  const dusk = altitudeLight(lightState(-2, 0.4), 30000);
  check('the ladder survives the dusk', ch(dusk) && dusk.limb > 0);
}

if (failed) { console.error(`verify-marslight: ${failed} FAILED`); process.exit(1); }
console.log('verify-marslight: all green');
