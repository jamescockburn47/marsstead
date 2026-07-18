// The post stack — Moorstead's composer, ported for Mars (DESIGN.md "The
// look": the light-rig heritage). Order is the asserted contract:
//   RenderPass -> UnrealBloom (HDR, before tone mapping) -> OutputPass
//   (ACES + sRGB out) -> Grade (display space: CAS sharpen, split-tone,
//   vignette, luminance-scaled grain, temporal dither — and the DREAD
//   channel, wired now so the mystery can drive it later).
// Fine tier only. Plain never builds a composer and renders direct — the
// untouched legacy pipeline is the safety net, per the family idiom.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Final full-screen pass, after tone mapping so it works in display sRGB.
// The split-tone: cool shadows, warm highlights — on Mars the warm lean IS
// the butterscotch; uWarmth (driven by the dusk halo) leans it amber at the
// blue hour. uDread desaturates toward luma and tightens the vignette: the
// deep's grading, idle at 0 until the mystery reaches for it.
export const GradeShader = {
  name: 'MarsGradeShader',
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 },
    uSharp: { value: 0 },                                      // CAS strength; 0 at full res
    uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },  // 1 / render-target pixel
    uDread: { value: 0 },                                      // the mystery's knob
    uGrain: { value: 0.012 },                                  // film grain, stronger in shadow
    uWarmth: { value: 0 },                                     // dusk warmth: amber split-tone lean
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSharp;
    uniform vec2 uTexel;
    uniform float uDread;
    uniform float uGrain;
    uniform float uWarmth;
    varying vec2 vUv;
    float hash12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // CAS-shaped sharpen: 4 cross-taps, local min/max, contrast-adaptive
      // weight — puts crispness back if the pixel ratio ever steps down
      vec3 nN = texture2D(tDiffuse, vUv + vec2(0.0, -uTexel.y)).rgb;
      vec3 nS = texture2D(tDiffuse, vUv + vec2(0.0,  uTexel.y)).rgb;
      vec3 nW = texture2D(tDiffuse, vUv + vec2(-uTexel.x, 0.0)).rgb;
      vec3 nE = texture2D(tDiffuse, vUv + vec2( uTexel.x, 0.0)).rgb;
      vec3 mn = min(c, min(min(nN, nS), min(nW, nE)));
      vec3 mx = max(c, max(max(nN, nS), max(nW, nE)));
      vec3 w = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0)) * uSharp;
      c = max(vec3(0.0), c * (1.0 + 4.0 * w) - (nN + nS + nW + nE) * w);
      // corner fringe — a whisper of chromatic aberration at the extreme
      // corners only, the visor's own optics; the centre is untouched
      vec2 qf = vUv - 0.5;
      vec2 fr = qf * dot(qf, qf) * 0.0015;
      c.r = texture2D(tDiffuse, vUv + fr).r;
      c.b = texture2D(tDiffuse, vUv - fr).b;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      // cool shadows, warm highlights; uWarmth leans the highlights amber
      vec3 hiTone = mix(vec3(1.045, 1.005, 0.955), vec3(1.07, 1.01, 0.92), uWarmth);
      c = mix(c, c * vec3(0.965, 0.99, 1.055), (1.0 - smoothstep(0.0, 0.45, lum)) * 0.5);
      c = mix(c, c * hiTone, smoothstep(0.55, 1.0, lum) * 0.5);
      // dread: colour bleeds toward luma — the deep taking the palette away
      c = mix(c, vec3(lum), uDread * 0.35);
      // gently lifted blacks
      c = c * 0.965 + 0.014;
      // vignette — soft, corners only; dread TIGHTENS it (the walls close in)
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q, q) * (0.4 + uDread * 0.22);
      // film grain, luminance-scaled (stronger in shadow)
      c += (hash12(vUv * 913.7 + fract(uTime) * 61.0) - 0.5) * uGrain * (1.0 - lum * 0.7);
      // ordered-ish temporal dither (±0.5 LSB) — kills sky banding
      c += (hash12(vUv * vec2(3141.59, 2718.28) + fract(uTime) * 17.0) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// Build the Fine-tier stack. The scene target is explicit: half-float so
// bloom reads HDR, 4x MSAA so the composer path keeps the crisp edges the
// direct path got from the canvas's own antialiasing.
export function buildComposer(renderer, scene, cam) {
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(
    Math.max(1, Math.round(size.x * pr)), Math.max(1, Math.round(size.y * pr)),
    { type: THREE.HalfFloatType, samples: 4 },
  );
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, cam));
  // subtle threshold — only genuine lights bloom: the lamps, lit ports,
  // the sun's disc, and the dusk halo's heart
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // tone mapping + sRGB out
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.setPixelRatio(pr);
  composer.setSize(size.x, size.y);
  grade.uniforms.uTexel.value.set(1 / (size.x * pr), 1 / (size.y * pr));
  return { composer, bloom, grade };
}

export function resizeComposer(stack, w, h, pr) {
  stack.composer.setPixelRatio(pr);
  stack.composer.setSize(w, h);
  stack.grade.uniforms.uTexel.value.set(1 / (w * pr), 1 / (h * pr));
}

export function disposeComposer(stack) {
  stack.bloom.dispose();
  stack.grade.dispose();
  stack.composer.dispose();
}
