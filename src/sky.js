// The sky dome — THREE layer over marslight's pure envelopes. One shader:
// butterscotch-to-mauve gradient, the sun disc with its true blue dusk halo,
// hash stars after dark, Phobos hurrying the wrong way. The landing page's
// dusk, promoted to a live 3D sky.

import * as THREE from 'three';

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
  uniform vec3 uSunDir, uPhobosDir;
  uniform float uSunI, uHaloS, uStars, uStorm;

  float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23); return fract(p.x * p.y); }

  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 sky = mix(uHor, uZen, pow(up, 0.6));

    float s = distance(d, uSunDir);
    // the blue forward-scatter halo — Mars's signature dusk
    sky += uHalo * exp(-s * 6.5) * uHaloS * 0.9;
    // warm inner glow + the disc itself
    sky += uSunCol * exp(-s * 28.0) * uSunI * 0.8;
    sky += uSunCol * smoothstep(0.026, 0.020, s) * uSunI * 2.0;

    // stars: hashed points, faded by daylight and storm
    if (uStars > 0.01 && d.y > 0.0) {
      vec2 sp = d.xz / (d.y + 0.4) * 90.0;
      float st = step(0.9985, h21(floor(sp)));
      float tw = 0.7 + 0.3 * h21(floor(sp) + 7.0);
      sky += vec3(0.9, 0.92, 1.0) * st * tw * uStars;
    }

    // Phobos — a fleck that visibly moves, west to east
    float p = distance(d, uPhobosDir);
    sky += vec3(0.85, 0.8, 0.75) * smoothstep(0.008, 0.004, p) * (0.25 + uStars * 0.6);

    // grain so the gradient never bands (the landing-page trick)
    sky += (h21(d.xy * 640.0 + d.z) - 0.5) * 0.012;

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class SkyDome {
  constructor(scene) {
    this.uniforms = {
      uZen: { value: new THREE.Color(0.45, 0.26, 0.19) },
      uHor: { value: new THREE.Color(0.82, 0.51, 0.30) },
      uSunCol: { value: new THREE.Color(1.0, 0.93, 0.82) },
      uHalo: { value: new THREE.Color(0.45, 0.62, 0.85) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uPhobosDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunI: { value: 1 },
      uHaloS: { value: 0 },
      uStars: { value: 0 },
      uStorm: { value: 0 },
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
  }

  // feed the pure light state + celestial directions
  set(light, sunDir, phobosDir, camPos) {
    const u = this.uniforms;
    u.uZen.value.setRGB(...light.skyZenith);
    u.uHor.value.setRGB(...light.skyHorizon);
    u.uSunCol.value.setRGB(...light.sunColour);
    u.uSunI.value = light.sunIntensity;
    u.uHaloS.value = light.haloStrength;
    u.uStars.value = light.starVisibility;
    u.uStorm.value = light.storm;
    u.uSunDir.value.copy(sunDir);
    u.uPhobosDir.value.copy(phobosDir);
    this.mesh.position.copy(camPos);
  }
}
