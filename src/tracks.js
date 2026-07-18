// Permanent tracks — pure, no THREE, no DOM. verify-tracks.mjs guards it.
// You are writing on a four-billion-year-old page: bootprints and wheel
// ruts PERSIST (they ride the save), so the way out is always marked and
// the way home is always findable — the rule: the player must be able to
// retrace their steps while the world is still strange. The cap is the
// planet's patience: the oldest marks fade first, kilometres later.

export const TRACK_CAP = 12000;      // ~9 km of boot trail before the oldest fade
export const BOOT_SPACING = 0.75;    // metres between stamps
export const WHEEL_SPACING = 1.5;

export function createTrail() {
  return { pts: [], lastBoot: null, lastWheel: null, side: 1 };
}

// append a stamp if we've come far enough since the last one of its kind;
// boots alternate left/right by themselves. Returns true if a mark landed.
export function appendTrack(trail, x, z, heading, kind) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(heading)) return false;
  const wheel = kind === 'wheel';
  const last = wheel ? trail.lastWheel : trail.lastBoot;
  const spacing = wheel ? WHEEL_SPACING : BOOT_SPACING;
  if (last && Math.hypot(x - last.x, z - last.z) < spacing) return false;
  const pt = { x, z, hd: heading, k: wheel ? 1 : 0, s: wheel ? 0 : (trail.side = -trail.side) };
  trail.pts.push(pt);
  if (wheel) trail.lastWheel = pt; else trail.lastBoot = pt;
  if (trail.pts.length > TRACK_CAP) trail.pts.splice(0, trail.pts.length - TRACK_CAP);
  return true;
}

// flat, rounded serialization — decimetre grid, centiradian heading: the
// save stays light and the stamps still land where they fell
export function serializeTrail(trail) {
  const flat = new Array(trail.pts.length * 4);
  trail.pts.forEach((p, i) => {
    flat[i * 4] = Math.round(p.x * 10);
    flat[i * 4 + 1] = Math.round(p.z * 10);
    flat[i * 4 + 2] = Math.round(p.hd * 100);
    flat[i * 4 + 3] = p.k * 2 + (p.s > 0 ? 1 : 0);
  });
  return flat;
}

export function deserializeTrail(flat) {
  const trail = createTrail();
  if (!Array.isArray(flat)) return trail;
  const n = Math.min(Math.floor(flat.length / 4), TRACK_CAP);
  for (let i = 0; i < n; i++) {
    const X = flat[i * 4], Z = flat[i * 4 + 1], H = flat[i * 4 + 2], F = flat[i * 4 + 3];
    if (![X, Z, H, F].every(Number.isFinite)) continue;
    const k = F >= 2 ? 1 : 0;
    const pt = { x: X / 10, z: Z / 10, hd: H / 100, k, s: k ? 0 : (F % 2 ? 1 : -1) };
    trail.pts.push(pt);
    if (k) trail.lastWheel = pt; else trail.lastBoot = pt;
  }
  if (trail.lastBoot) trail.side = trail.lastBoot.s || 1;
  return trail;
}
