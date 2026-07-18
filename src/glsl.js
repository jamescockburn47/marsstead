// Shared GLSL chunks — the landing page's fbm, the family's fractal
// workhorse, in one place so the sky, the dust and the terrain detail all
// speak the same noise. Decorative GPU noise: it deliberately does NOT
// match noise.js (only geometry heights carry the determinism contract).

export const FBM_GLSL = /* glsl */`
  float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1,0)), f.x),
               mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.;
    for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= .5; }
    return s; }
`;
