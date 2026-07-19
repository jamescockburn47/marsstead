// The sky dome and the heavens — THREE layer over marslight's pure
// envelopes and marsheavens' pure frame. One dome shader (gradient, the
// blue dusk halo, sun disc, both moons, Earth the evening star, the Milky
// Way band, thin per-pixel cirrus — never instanced blobs) plus one star
// frame: real catalogue Points wheeled about MARS'S celestial pole by a
// quaternion the pure module dictates. The landing page's dusk, grown up.

import * as THREE from 'three';
import {
  STAR_CATALOGUE, starField, raDecToEq, earthEqToMarsEq, GALACTIC_POLE,
  wheelAngle,
} from './marsheavens.js';
import { FBM_GLSL } from './glsl.js';

const VS = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = (projectionMatrix * mv).xyww; // pin to the far plane
  }
`;

const FS = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uZen, uHor, uSunCol, uHalo;
  uniform vec3 uSunDir, uPhobosDir, uDeimosDir, uEarthDir, uMWPole;
  uniform float uSunI, uHaloS, uStars, uEarthI, uCirrus, uT, uThin, uLimb;

  ${FBM_GLSL}

  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 sky = mix(uHor, uZen, pow(up, 0.6));

    // the altitude ladder: the gradient dries to space-black from the
    // zenith down as the air thins beneath you; the horizon keeps a
    // residue that the limb band then owns
    if (uThin > 0.001) {
      float dry = uThin * smoothstep(-0.02, 0.45, d.y);
      sky = mix(sky, vec3(0.004, 0.004, 0.008), min(1.0, dry * 1.25));
    }

    float s = distance(d, uSunDir);
    // the blue forward-scatter halo — Mars's signature dusk. The blue
    // must REPLACE the butterscotch around the sun, not add to it:
    // blue added over orange merely whitens, and the flagship reads as
    // glare instead of the alien blue the real photographs show.
    float haloLobe = exp(-s * 6.5) * uHaloS;
    sky = mix(sky, uHalo * 1.05, min(0.7, haloLobe * 0.8));
    sky += uHalo * exp(-s * 16.0) * uHaloS * 0.35;
    // warm inner glow + the disc itself — the glow stands aside as the
    // halo rises: at dusk the ring around the sun belongs to the blue
    sky += uSunCol * exp(-s * 28.0) * uSunI * 0.8 * (1.0 - uHaloS * 0.65);
    sky += uSunCol * smoothstep(0.026, 0.020, s) * uSunI * 2.0;
    // the dusty shafts: streaks of forward-scattered sun through the
    // haze, an angular fbm field around the low sun (sun-local basis,
    // never atan — no wrap seam). They ride the halo envelope, so they
    // live at the golden and blue hours and vanish at a clear noon.
    if (uHaloS > 0.02 && s > 0.02) {
      vec3 bx = normalize(cross(vec3(0.0, 1.0, 0.0), uSunDir));
      vec3 by = cross(uSunDir, bx);
      vec2 ang = vec2(dot(d, bx), dot(d, by)) / max(s, 0.05);
      float rays = fbm(ang * 2.3 + 3.7);
      sky += uSunCol * pow(max(0.0, rays - 0.42) * 1.7, 2.0)
        * exp(-s * 3.1) * uHaloS * 0.14;
    }

    // the Milky Way: hard core, wide glow, and the dark rift down its
    // spine — fractal mottling, vivid on a clear night, gone by day.
    // The sky is the LANTERN: on Mars the night is walked by starlight.
    if (uStars > 0.01 && d.y > -0.05) {
      // soft skirt at the cutoff: from orbit the camera looks DOWN past
      // the band, and a hard conditional edge reads as a seam in space
      float mwSkirt = smoothstep(-0.05, 0.08, d.y);
      float g = dot(d, uMWPole);
      float core = exp(-g * g * 90.0);
      float glow = exp(-g * g * 18.0);
      // seam-free fractal coords: projected direction components, never
      // atan — the azimuth wrap put a hard vertical seam in the sky
      vec2 along = vec2(d.x * 2.6 + d.y * 1.7, d.z * 2.6 - d.y * 0.9);
      // two mottle octaves: the broad clumping and the fine star-cloud
      // curdle that makes the core read as BILLIONS, not as fog
      float mottle = 0.26 + 0.74 * fbm(along + 7.0) + 0.35 * (fbm(along * 3.3 + 51.0) - 0.5) * core;
      float rift = 1.0 - 0.85 * core * smoothstep(0.42, 0.72, fbm(along * 1.6 + 31.0));
      // levels: a band you can SEE STRUCTURE in, never a floodlight —
      // the night ground stays lit by the stars, not by the galaxy alone
      sky += (vec3(0.95, 0.93, 1.0) * core * 0.19 + vec3(0.55, 0.62, 0.85) * glow * 0.075)
        * mottle * rift * uStars * mwSkirt;
    }

    // Phobos — the hurrying moon, west to east; Deimos — the slow spark
    float p = distance(d, uPhobosDir);
    sky += vec3(0.88, 0.83, 0.78) * (smoothstep(0.012, 0.006, p) * 1.1
      + exp(-p * 55.0) * 0.25) * (0.3 + uStars * 0.9);
    float q = distance(d, uDeimosDir);
    sky += vec3(0.82, 0.80, 0.76) * smoothstep(0.007, 0.003, q) * (0.2 + uStars * 0.7);

    // Earth — a blue evening star, the brightest point after the moons;
    // somewhere on it, the place all this began
    float e = distance(d, uEarthDir);
    sky += vec3(0.55, 0.72, 1.0) * (smoothstep(0.008, 0.003, e) * 1.8
      + exp(-e * 70.0) * 0.5) * uEarthI;

    // cirrus: thin water-ice streaks, high and stretched downwind — drawn
    // per-pixel (the family verdict on cloud FLEETS stands: no blimps)
    if (uCirrus > 0.01 && d.y > 0.03) {
      vec2 sheet = vec2(d.x / (d.y + 0.22), d.z / (d.y + 0.22));
      float streak = fbm(vec2(sheet.x * 0.5 + uT * 0.004, sheet.y * 2.6));
      float mask = smoothstep(0.04, 0.16, d.y) * smoothstep(0.75, 0.35, d.y);
      float cir = pow(max(0.0, streak - 0.52) * 2.1, 1.6) * mask * uCirrus;
      sky += (uSunCol * 0.55 + uHalo * uHaloS * 0.3) * cir;
    }

    // THE LIMB — the rusty edge of space: at altitude the whole
    // atmosphere shows edge-on as a thin butterscotch band along the
    // horizon, fringed blue above (the same forward-scatter that makes
    // the dusk halo), over black. The band sits a breath below eye level
    // and tightens as you climb — real Mars-orbit photography, in one
    // gaussian and a mix.
    if (uLimb > 0.001) {
      float limbY = -0.015 - 0.05 * uThin;
      float w = 34.0 + 26.0 * uThin;
      float band = exp(-pow((d.y - limbY) * w, 2.0));
      vec3 limbCol = mix(vec3(0.82, 0.44, 0.19),
        vec3(0.45, 0.62, 0.85), smoothstep(0.0, 0.045, d.y - limbY));
      // the band glows hardest toward the sun's side of the world
      float sunSide = 0.55 + 0.45 * max(0.0, dot(normalize(vec2(d.x, d.z)),
        normalize(vec2(uSunDir.x, uSunDir.z) + vec2(1e-4))));
      sky += limbCol * band * uLimb * sunSide * 0.9;
    }

    // grain so the gradient never bands (the landing-page trick)
    sky += (h21(d.xy * 640.0 + d.z) - 0.5) * 0.012;

    gl_FragColor = vec4(sky, 1.0);
  }
`;

// star colour by warmth and magnitude — brighter stars, bigger truths
function starTint(mag, warmth, out) {
  const b = Math.max(0.22, Math.min(1.5, 1.7 - mag * 0.22));
  out[0] = (0.80 + warmth * 0.22) * b;
  out[1] = (0.86 + warmth * 0.04) * b;
  out[2] = (1.0 - warmth * 0.28) * b;
  return out;
}

export class SkyDome {
  constructor(scene) {
    this.uniforms = {
      uZen: { value: new THREE.Color(0.45, 0.26, 0.19) },
      uHor: { value: new THREE.Color(0.82, 0.51, 0.30) },
      uSunCol: { value: new THREE.Color(1.0, 0.93, 0.82) },
      uHalo: { value: new THREE.Color(0.45, 0.62, 0.85) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uPhobosDir: { value: new THREE.Vector3(0, -1, 0) },
      uDeimosDir: { value: new THREE.Vector3(0, -1, 0) },
      uEarthDir: { value: new THREE.Vector3(0, -1, 0) },
      uMWPole: { value: new THREE.Vector3(0, 1, 0) },
      uSunI: { value: 1 },
      uHaloS: { value: 0 },
      uStars: { value: 0 },
      uEarthI: { value: 0 },
      uCirrus: { value: 0 },
      uT: { value: 0 },
      uThin: { value: 0 },   // how much sky is BELOW you (the altitude ladder)
      uLimb: { value: 0 },   // the rusty edge: band strength at the horizon
    };
    const geo = new THREE.SphereGeometry(1, 32, 16);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.scale.setScalar(4000);
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);

    // ---- the star frame: real positions, one quaternion, no per-star work
    this.frame = new THREE.Group();
    this.frame.scale.setScalar(3900);
    scene.add(this.frame);
    const tint = [0, 0, 0];
    const bright = { pos: [], col: [] };
    for (const [, ra, dec, mag, warmth] of STAR_CATALOGUE) {
      bright.pos.push(...earthEqToMarsEq(raDecToEq(ra, dec)));
      bright.col.push(...starTint(mag, warmth, tint));
    }
    const faint = { pos: [], col: [] };
    for (const s of starField()) {
      faint.pos.push(...s.dir);
      faint.col.push(...starTint(s.mag, s.warmth, tint));
    }
    const points = (data, size) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      const m = new THREE.PointsMaterial({
        size, sizeAttenuation: false, vertexColors: true, transparent: true,
        opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      this.frame.add(p);
      return p;
    };
    this.bright = points(bright, 3.1);
    this.faint = points(faint, 1.8);
    this.mw = earthEqToMarsEq(GALACTIC_POLE); // pole, in the frame the quaternion turns
    this._qy = new THREE.Quaternion();
    this._qx = new THREE.Quaternion();
    this._Y = new THREE.Vector3(0, 1, 0);
    this._X = new THREE.Vector3(1, 0, 0);
    this._mwWorld = new THREE.Vector3();
  }

  // feed the pure light state + the heavens (o: sunDir, phobosDir,
  // deimosDir, earthDir, earthI, cirrus, millis, lat, t, camPos)
  set(light, o) {
    const u = this.uniforms;
    u.uZen.value.setRGB(...light.skyZenith);
    u.uHor.value.setRGB(...light.skyHorizon);
    u.uSunCol.value.setRGB(...light.sunColour);
    u.uSunI.value = light.sunIntensity;
    u.uHaloS.value = light.haloStrength;
    u.uStars.value = light.starVisibility;
    u.uThin.value = light.thin || 0;
    u.uLimb.value = light.limb || 0;
    u.uEarthI.value = o.earthI;
    u.uCirrus.value = o.cirrus;
    u.uT.value = o.t;
    u.uSunDir.value.copy(o.sunDir);
    u.uPhobosDir.value.copy(o.phobosDir);
    u.uDeimosDir.value.copy(o.deimosDir);
    u.uEarthDir.value.copy(o.earthDir);
    this.mesh.position.copy(o.camPos);
    // the wheel: quaternion form of marsheavens' two rotations (Y then X)
    this._qy.setFromAxisAngle(this._Y, -wheelAngle(o.millis));
    this._qx.setFromAxisAngle(this._X, -(90 - o.lat) * (Math.PI / 180));
    this.frame.quaternion.copy(this._qx).multiply(this._qy);
    this.frame.position.copy(o.camPos);
    // stars fade with daylight and storm, exactly as the envelope says
    this.bright.material.opacity = light.starVisibility;
    this.faint.material.opacity = light.starVisibility * 0.85;
    // at altitude the star sphere must sit BEYOND the world below, or
    // the galaxy sprinkles across the planet's face (size is screen-fixed,
    // so pushing the sphere out costs nothing) — on the ground it stays
    // inside the modest far plane
    this.frame.scale.setScalar((light.thin || 0) > 0.02 ? 480000 : 3900);
    // the Milky Way pole rides the same quaternion, handed to the dome
    this._mwWorld.set(...this.mw).applyQuaternion(this.frame.quaternion);
    u.uMWPole.value.copy(this._mwWorld);
  }
}
