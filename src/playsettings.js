// Independent comfort choices. The save owner persists them; this module
// reads neither browser storage nor environment variables.
export const SURVIVAL_LEVELS = Object.freeze(['gentle', 'standard', 'expedition']);
export const FEAR_LEVELS = Object.freeze(['gentle', 'uneasy', 'intense']);
export const DEFAULT_SETTINGS = Object.freeze({
  guidance: true, survival: 'gentle', textScale: 1,
  reducedMotion: false, volume: 0.5, muted: false, fear: 'gentle',
});

export function normaliseSettings(raw) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const bool = (key) => typeof s[key] === 'boolean' ? s[key] : DEFAULT_SETTINGS[key];
  const bounded = (key, lo, hi) => Number.isFinite(s[key])
    ? Math.max(lo, Math.min(hi, s[key])) : DEFAULT_SETTINGS[key];
  return {
    guidance: bool('guidance'),
    survival: SURVIVAL_LEVELS.includes(s.survival) ? s.survival : DEFAULT_SETTINGS.survival,
    textScale: bounded('textScale', 0.9, 1.5),
    reducedMotion: bool('reducedMotion'),
    volume: bounded('volume', 0, 1), muted: bool('muted'),
    fear: FEAR_LEVELS.includes(s.fear) ? s.fear : DEFAULT_SETTINGS.fear,
  };
}

export function createSettings() { return normaliseSettings(null); }
