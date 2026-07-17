// Deterministic value noise — pure, no THREE, no DOM. The sub-MOLA skin:
// everything smaller than the baked skeleton (rocks, ripples, small craters,
// dune fields) grows from these functions and a seed, so every client grows
// the same ground (invariant 4). Never Math.random().

// integer-lattice hash -> [0, 1)
export function hash2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// fractal brownian motion, 5 octaves, [0, ~1)
export function fbm2(x, y) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 5; i++) {
    s += a * valueNoise2(x, y);
    x = x * 2.03 + 11.7; y = y * 2.03 + 5.3;
    a *= 0.5;
  }
  return s;
}

// ridged multifractal, [0, ~1) — sharp crests: dune brinks, crater rims
export function ridge2(x, y) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 4; i++) {
    s += a * (1 - Math.abs(2 * valueNoise2(x, y) - 1));
    x = x * 2.13 + 7.1; y = y * 2.13 + 3.9;
    a *= 0.5;
  }
  return s;
}
