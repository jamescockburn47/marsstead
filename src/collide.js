// Shared surface collision — pure, no THREE, no DOM. verify-collide.mjs
// guards it. Everything solid that stands on the regolith resolves the
// same way: as a DISC (or a short row of discs for long bodies). Boots,
// wheels, hulls, machines — one rule, one module, no walking through
// the rover you just parked.
//
// The resolution is positional pushout: move the probe circle to the
// disc's surface along the centre line. Deliberately velocity-free —
// the walker's easing and the buggy's deflectBuggy() handle momentum;
// this module only guarantees NO OVERLAP survives a frame.

// resolve a circle of radius r at (x, z) against solid discs
// [{ x, z, r }...]. Returns { x, z, hit } — the pushed-out position.
// Iterates: pushing out of one disc can land the probe inside a
// neighbour (machines cluster, the buggy parks against the lander), so
// passes repeat until the position is clean or the pass budget runs out.
export function resolveCircle(x, z, r, discs) {
  let hit = false;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const c of discs) {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const ring = c.r + r;
      if (d >= ring) continue;
      hit = true; moved = true;
      if (d > 1e-6) {
        x = c.x + (dx / d) * ring;
        z = c.z + (dz / d) * ring;
      } else {
        x = c.x + ring; // dead-centre degenerate: push east, deterministically
      }
    }
    if (!moved) break;
  }
  return { x, z, hit };
}

// the buggy's solid footprint for OTHERS to collide with: two discs along
// the heading (nose and tail), covering body + wheels without one huge
// circle that would block walking near the flanks.
export function buggyDiscs(bx, bz, heading, r = 1.05, spread = 0.85) {
  const sin = Math.sin(heading), cos = Math.cos(heading);
  return [
    { x: bx + sin * spread, z: bz + cos * spread, r },
    { x: bx - sin * spread, z: bz - cos * spread, r },
  ];
}
