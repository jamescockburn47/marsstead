// The attract reel — pure, no THREE, no DOM. verify-attract.mjs guards
// it. The landing page's moving picture (James's ask: show how big and
// beautiful the world is): a looping table of authored shots behind the
// title — the descent from space down the whole sky ladder, the stead
// glowing at dusk, the buggy running a boulder ridge under the Milky
// Way, a dust-gilded golden hour. This module owns the clock and the
// camera maths; main.js merely obeys it, the same pure-drive/THREE-apply
// split as everything else. Deterministic: same t, same frame, always.

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function ease(t) { return t * t * (3 - 2 * t); }        // smoothstep
function lerp(a, b, t) { return a + (b - a) * t; }

// the shots: local hour sets the light, tau sets the weather. AGL means
// "above ground level" — the applier adds real terrain height.
export const SHOTS = [
  // the whole scale: from the black, down the ladder, into the haze
  { id: 'descent', dur: 22, hour: 16.4, tau: 0.4 },
  // the settlement at blue hour: the buried lantern against the violet
  { id: 'stead', dur: 16, hour: 17.5, tau: 0.5 },
  // the night drive: lamps, boulders, the galaxy overhead
  { id: 'drive', dur: 18, hour: 23.6, tau: 0.25 },
  // the weather: a thick golden hour, looking into the low sun
  { id: 'gold', dur: 14, hour: 15.6, tau: 1.2 },
];
export const FADE_S = 1.1;             // crossfade shoulder at each cut
export const LOOP_S = SHOTS.reduce((a, s) => a + s.dur, 0);

// where are we in the loop: the shot, its local 0..1, and the veil
// opacity (1 = black) that wraps every cut
export function reelAt(t) {
  let u = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    if (u < s.dur) {
      const fadeIn = clamp01(u / FADE_S);
      const fadeOut = clamp01((s.dur - u) / FADE_S);
      return { i, shot: s, k: u / s.dur, veil: 1 - Math.min(fadeIn, fadeOut) };
    }
    u -= s.dur;
  }
  return { i: 0, shot: SHOTS[0], k: 0, veil: 1 };
}

// camera maths per shot, in anchor-relative metres. Returns
// { cam: [dx, aglY, dz], look: [dx, aglY, dz], alt } — alt is the height
// the LIGHT ladder should read (the descent re-lights the whole world).
// `target` is the moving subject (the buggy) for the drive shot.
export function shotCam(id, k, target = null) {
  const e = ease(clamp01(k));
  if (id === 'descent') {
    // 11 km down to 90 m, sliding in from the south-east. The frame
    // HOLDS THE HORIZON: look well ahead and a shade below level, so the
    // limb band rides the upper third while the world scrolls beneath —
    // black sky first, colour flooding back on the way down
    const alt = 90 + 11000 * (1 - e) * (1 - e);
    const back = 300 + 2600 * (1 - e);
    return {
      cam: [back * 0.66, alt, back],
      look: [-back * 0.6, alt * 0.62, -back * 1.9],
      alt,
    };
  }
  if (id === 'stead') {
    // a settling crane orbit around the crown's yard
    const a = 2.4 + k * 1.35;
    const r = lerp(34, 17, e);
    const h = lerp(17, 7.5, e);
    return { cam: [Math.cos(a) * r, h, Math.sin(a) * r], look: [0, 1.6, 0], alt: 0 };
  }
  if (id === 'drive') {
    // the classic night tracking shot: camera ahead-right of the NOSE
    // (target carries [x, z, heading]) so the lamps blaze toward the
    // lens and the lit dust leads the buggy through the frame
    const t = target || [0, 0, 0];
    const h = t[2] || 0;
    const ax = Math.sin(h), az = Math.cos(h);           // ahead
    const rx = Math.cos(h), rz = -Math.sin(h);          // right
    const drift = Math.sin(k * Math.PI * 2) * 1.6;      // a gentle float
    return {
      cam: [t[0] + ax * 8.2 + rx * (4.6 + drift), 2.7,
        t[1] + az * 8.2 + rz * (4.6 + drift)],
      look: [t[0], 1.15, t[1]],
      alt: 0,
      world: true,     // cam/look are world coords (they follow the subject)
    };
  }
  // gold: a low dolly over the dunes, gazing WEST into the dusty sun —
  // the surface raked in gilded relief, the pale coin in frame
  const dx = lerp(720, 300, e);
  return {
    cam: [dx, lerp(15, 9, e), lerp(240, 110, e)],
    look: [dx - 700, 26, lerp(150, 40, e)],
    alt: 0,
  };
}

// the drive shot's scripted inputs: steady throttle, a long lazy S so
// the chassis rolls and the lamps sweep — deterministic in k
export function driveInput(k) {
  return { throttle: 0.85, steer: Math.sin(k * Math.PI * 2.6) * 0.28, brake: 0, handbrake: false };
}
