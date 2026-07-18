// The graphics rig's pure decisions — no THREE, no DOM. verify-gfx.mjs
// guards it. Ported from the siblings (the family light-rig import,
// DESIGN.md "The look"): Saltstead's gfxprobe decides the opening TIER,
// Saltstead's lightrig owns the deterministic EXPOSURE drive.
//
//   fine  — ACES tone mapping, adaptive exposure, the post stack, PCFSoft
//           shadows, per-pixel terrain detail at full amplitude.
//   plain — the untouched legacy pipeline: NoToneMapping, direct render,
//           detail amps parked at 0. Old metal must never stutter while
//           the game insists it shouldn't.

// ---- exposure: deterministic eye adaptation --------------------------------
// The renderer eases toneMappingExposure toward this pure target each frame
// (no luminance readback, so it is verifiable and identical on every client).
// Bright midday sits low; night opens the iris. Values are Saltstead's,
// proven on the sea; the contact sheet retunes them if Mars disagrees.
export const EXPOSURE_BASE = 1.25;

export function exposureTarget(dayness) {
  return 1.15 + 0.17 * (1 - dayness);
}

// ---- the opening tier (Saltstead's gfxprobe, marsstead keys) ---------------
// signals: {
//   stored:      'fine' | 'plain' | 'auto-plain' | null   (localStorage)
//   touchPrimary: bool        (coarse pointer is the primary input)
//   webgpu:      true | false | null   (adapter probe; null = not yet known)
//   rendererStr: string|null  (WEBGL_debug_renderer_info UNMASKED_RENDERER)
//   deviceMemory: number|null (navigator.deviceMemory, GB)
//   cores:       number|null  (navigator.hardwareConcurrency)
// }
// Returns { tier: 'fine'|'plain', why }. The player's own hand always wins;
// the watchdog's downgrades store as 'auto-plain' so the next boot starts
// easy WITHOUT locking the player out of choosing fine again.
export function decideTier(sig = {}) {
  if (sig.stored === 'fine' || sig.stored === 'plain') {
    return { tier: sig.stored, why: 'chosen' };       // the player said so
  }
  if (sig.stored === 'auto-plain') {
    return { tier: 'plain', why: 'remembered-slow' }; // this kit lagged before
  }
  if (isSoftwareGL(sig.rendererStr)) {
    return { tier: 'plain', why: 'software-gl' };     // no GPU at all — the hard floor
  }
  if (Number.isFinite(sig.deviceMemory) && sig.deviceMemory <= 2) {
    return { tier: 'plain', why: 'low-memory' };
  }
  if (Number.isFinite(sig.cores) && sig.cores <= 2) {
    return { tier: 'plain', why: 'few-cores' };
  }
  if (sig.touchPrimary) {
    return { tier: 'plain', why: 'touch' };           // tablets open easy
  }
  if (sig.webgpu === true) return { tier: 'fine', why: 'webgpu' };
  if (sig.webgpu === false) return { tier: 'plain', why: 'no-webgpu' };
  return { tier: 'fine', why: 'unprobed' }; // optimistic until the adapter answers
}

// the software renderers that mean "no GPU": SwiftShader (Chrome's CPU
// fallback), llvmpipe/softpipe (Mesa's), and Windows' Basic Render Driver
export function isSoftwareGL(rendererStr) {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(rendererStr || '');
}

// ---- the fps watchdog ------------------------------------------------------
// Sampled median fps over a settled window (the opening seconds are ignored —
// terrain streaming and shader warm-up lie about steady state). Only ever
// eases DOWN; upgrades are the player's.
export const SETTLE_S = 10;   // ignore the opening seconds
export const WINDOW_S = 6;    // judge on windows this long
export const SLOW_FINE = 27;  // fine below this is a stutter, not a style
export const SLOW_PLAIN = 22; // plain below this needs fewer pixels

// verdict for one settled window: 'hold' | 'drop-plain' | 'drop-pixels'
export function fpsVerdict(tier, medianFps) {
  if (!Number.isFinite(medianFps)) return 'hold';
  if (tier === 'fine' && medianFps < SLOW_FINE) return 'drop-plain';
  if (tier === 'plain' && medianFps < SLOW_PLAIN) return 'drop-pixels';
  return 'hold';
}

export function median(xs) {
  if (!xs || !xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
