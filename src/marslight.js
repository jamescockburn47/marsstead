// The light of Mars — pure envelope maths, no THREE, no DOM.
// verify-marslight.mjs guards it. DESIGN.md's rule renders here: Mars's
// light runs BACKWARDS from Earth's — suspended dust warms the whole day
// sky to butterscotch, then forward-scatters BLUE around the low sun. The
// ambient fill IS the dust, so outdoor shadows are dusty rose, never black.
//
// One function of two numbers — sun elevation (deg) and dust load tau —
// returns every colour the renderer needs. All channels bounded [0..1];
// the verify asserts the signature facts: warm noon, blue-peaked dusk,
// dark night, sepia storm.

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

export const TAU_CLEAR = 0.4;   // a fine sol
export const TAU_DUSTY = 1.2;   // a thick one
export const TAU_STORM = 5.0;   // brown-out

// the palette poles (linear-ish RGB 0..1)
const SKY_ZEN_DAY = [0.48, 0.24, 0.16];   // dusty mauve-brown zenith
const SKY_HOR_DAY = [0.85, 0.46, 0.23];   // butterscotch horizon, rust-deep
const SKY_NIGHT = [0.026, 0.024, 0.04];   // near-black, a violet memory
const SUN_HIGH = [1.0, 0.93, 0.82];       // small pale-gold disc
const SUN_LOW = [0.95, 0.87, 0.85];       // whiter at dusk (real: dust reddens the SKY, not the disc)
const HALO_BLUE = [0.45, 0.62, 0.85];     // the famous blue forward-scatter
const AMB_DAY = [0.58, 0.34, 0.24];       // dust-fill: shadows are dusty rose
const AMB_NIGHT = [0.11, 0.115, 0.16];    // the overcast-night floor (gameplay)
const STARLIT_NIGHT = [0.14, 0.155, 0.22]; // a CLEAR night: the sky is the lantern
const STORM_TINT = [0.42, 0.27, 0.14];    // the sepia of the brown noon

// daylight factor: 0 deep night -> 1 full day, twilight ramp around -6..8 deg
// (exported: the exposure drive and the post stack hang off the same number)
export function dayFactor(sunEl) { return clamp01((sunEl + 6) / 14); }

// how "dusk" it is: peaks when the sun sits on the horizon
function duskFactor(sunEl) {
  return Math.exp(-(sunEl * sunEl) / (2 * 7 * 7));
}

export function lightState(sunEl, tau = TAU_CLEAR) {
  const day = dayFactor(sunEl);
  const dusk = duskFactor(sunEl);
  const storm = clamp01((tau - TAU_DUSTY) / (TAU_STORM - TAU_DUSTY));

  // sky poles, day/night mixed, then dragged toward sepia by storm
  let zen = mix3(SKY_NIGHT, SKY_ZEN_DAY, day);
  let hor = mix3(SKY_NIGHT, SKY_HOR_DAY, day);
  zen = mix3(zen, STORM_TINT.map((v) => v * 0.55 * day), storm);
  hor = mix3(hor, STORM_TINT.map((v) => v * day), storm);

  // the sun: intensity dies with airmass at the horizon and with storm tau;
  // in a full storm the disc is a pale coin, then gone
  const sunI = clamp01(day * (0.35 + 0.65 * clamp01(sunEl / 25))) * (1 - storm * 0.92);
  const sun = mix3(SUN_LOW, SUN_HIGH, clamp01(sunEl / 30));

  // the blue halo: a dusk phenomenon with its own twilight window — it
  // peaks with the sun ON the horizon (the general day factor would halve
  // it there) and survives a few degrees below, exactly as the real one
  // lingers after sunset. Heavy dust eats it: multiple scattering kills
  // the coherent forward lobe.
  const haloWindow = clamp01((sunEl + 8) / 8);
  const halo = dusk * haloWindow * clamp01(1.2 - storm * 1.2);

  // ambient: the dust-fill, rosier by day, storm keeps it surprisingly
  // bright (light bounces everywhere) but utterly flat. The night floor is
  // a GAMEPLAY number, not a physical one — and on a CLEAR night the stars
  // themselves raise it: the vivid sky is what makes Mars walkable after
  // dark (with the headlamps), and only a dust storm takes it away.
  // stars ride the dust: full on a clear sol (tau ~0.4 and under), fading
  // through a dusty spell, gone toward a storm — the veil is WEATHER
  const stars = clamp01(1 - day * 1.4) * (1 - storm) * clamp01((1.15 - tau) / 0.75);
  const ambI = lerp(lerp(0.17, 0.26, stars), 0.55, day) * (1 - storm * 0.35);
  const amb = mix3(mix3(AMB_NIGHT, STARLIT_NIGHT, stars),
    mix3(AMB_DAY, STORM_TINT, storm), day);

  // shadow softness 0 crisp -> 1 gone: rides tau and dies at night
  const soft = clamp01(0.15 + (tau - TAU_CLEAR) / (TAU_STORM - TAU_CLEAR)) * day;

  // fog: aerial perspective — colour follows the horizon, density follows tau
  const fogDensity = 0.0015 + tau * 0.0022 + storm * 0.02;

  return {
    skyZenith: zen, skyHorizon: hor,
    sunColour: sun, sunIntensity: sunI,
    haloBlue: HALO_BLUE, haloStrength: halo,
    ambientColour: amb, ambientIntensity: ambI,
    fogColour: hor, fogDensity,
    shadowSoftness: soft, starVisibility: stars,
    storm,
  };
}

// the surface temperature the HUD reads, deg C — a shaped diurnal curve,
// not a climate model yet (Phase 1 brings Ls and latitude in properly)
export function surfaceTempC(sunEl, tau = TAU_CLEAR) {
  const day = dayFactor(sunEl);
  const peak = lerp(-12, -30, clamp01((tau - TAU_CLEAR) / TAU_STORM)); // storms cool the days
  return lerp(-84, peak, Math.pow(day, 1.4));
}
