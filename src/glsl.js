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

// The frost glint — the family's sword-of-the-sun corridor (Moorstead
// mesher addWater -> Saltstead ocean glitter), ported to GROUND FROST:
// sparkle lives only along the camera->sun-azimuth corridor, broad at
// noon, a blazing blade at a low sun; per-cell pinpricks each with their
// own twinkle speed AND phase (the anti-pulse rule); frost gates it all.
// The temporal sin here is the ported twinkle idiom, not a spatial
// pattern — the no-sin ground-character rule (2026-07-19) is untouched.
export const FROST_GLINT_GLSL = /* glsl */`
  float marsFrost(float latDeg, float lineN, float lineS, float morningK) {
    float capN = smoothstep(0.0, 1.0, (latDeg - lineN) / 12.0 + 0.5);
    float capS = smoothstep(0.0, 1.0, (lineS - latDeg) / 12.0 + 0.5);
    float latBoost = 0.55 + 0.45 * smoothstep(0.0, 1.0, abs(latDeg) / 55.0);
    return clamp(max(max(capN, capS), morningK * latBoost), 0.0, 1.0);
  }
  float glintHash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  vec3 frostGlint(vec3 light, vec3 wpos, float frost, vec3 camPos,
    vec2 sunAzim, float sunLow, float glintK, float t,
    float cellScale, float nearIn, float nearFull, float farHold, float farOut) {
    if (frost < 0.015 || glintK < 0.01) return light;
    vec2 view = wpos.xz - camPos.xz;
    float vl = max(length(view), 1e-3);
    float align = max(0.0, dot(view / vl, sunAzim));
    float corr = pow(align, mix(6.0, 26.0, sunLow)) * (1.0 + sunLow);
    // CRYSTALS, not cells (James's eye, 2026-07-20: the lit-cell idiom
    // reads as Moorstead voxels — wrong for smooth-shaded Mars). Each
    // cell hosts one JITTERED POINT; only a small round neighbourhood
    // of that point lights, its size its own — a pinprick of frost
    // catching the sun, never a square of ground.
    vec2 cellF = wpos.xz * cellScale;
    vec2 cell = floor(cellF);
    float h = glintHash(cell * 0.37);
    float h2 = glintHash(cell * 0.37 + 19.19);
    vec2 pt = cell + vec2(glintHash(cell * 0.53 + 3.17), glintHash(cell * 0.53 + 7.71));
    float pr = length(cellF - pt);
    float size = 0.10 + 0.18 * h2;                 // crystals come in sizes
    float spot = 1.0 - smoothstep(size * 0.35, size, pr);
    float tw = 0.55 + 0.45 * sin(t * (1.5 + h2 * 3.0) + h2 * 6.2831);
    // sqrt lifts thin morning cover into a real field of lights while a
    // full cap still outshines it — the centrepiece must READ at dawn
    float fr = sqrt(frost);
    float g = step(1.0 - 0.6 * corr * fr, h) * spot * tw * (0.6 + 0.4 * h);
    float dist = smoothstep(nearIn, nearFull, vl) * (1.0 - smoothstep(farHold, farOut, vl));
    return light + vec3(1.0, 0.97, 0.9) * (g * corr * dist * glintK * fr * 1.6);
  }
`;
