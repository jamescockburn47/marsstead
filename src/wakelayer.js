// The rover's wake — dust as a FIELD, never particles (the house verdict).
// One ground-hugging quad trailing the buggy whose alpha is wind-blown fbm
// in WORLD space (so the cloud hangs where it was raised instead of riding
// the bumper), masked to a rooster-tail behind the rear axle. Speed feeds
// it, a skid thickens it, night thins it (dust is sunlit matter).

import * as THREE from 'three';
import { FBM_GLSL } from './glsl.js';

const VS = /* glsl */`
  varying vec3 vLocal;
  varying vec2 vWorld;
  void main() {
    vLocal = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FS = /* glsl */`
  precision highp float;
  varying vec3 vLocal;
  varying vec2 vWorld;
  uniform float uT, uAmp;
  uniform vec3 uCol;
  ${FBM_GLSL}
  void main() {
    // the tail: starts at the rear axle, dies by twelve metres back,
    // narrows at the axle and fans as it settles
    float back = -vLocal.z;
    float fan = 1.4 + back * 0.16;
    float mask = smoothstep(0.2, 2.2, back) * smoothstep(12.0, 4.5, back)
      * smoothstep(fan, fan * 0.45, abs(vLocal.x));
    // rolling fractal body: two scales, drifting slowly in world space
    float a = fbm(vWorld * 0.5 + vec2(0.0, uT * 0.5));
    float b = fbm(vWorld * 1.6 - vec2(uT * 0.35, uT * 0.2) + 13.7);
    float body = 0.25 + 0.75 * (a * 0.6 + b * 0.4);
    gl_FragColor = vec4(uCol, uAmp * mask * body);
  }
`;

export class WakeLayer {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(6.5, 12.5, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.32, -7.0); // spans z -0.75..-13.25 behind the origin
    this.uniforms = {
      uT: { value: 0 },
      uAmp: { value: 0 },
      uCol: { value: new THREE.Color(0.60, 0.37, 0.22) },
    };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms,
      transparent: true, depthWrite: false,
    }));
    this.mesh.renderOrder = 2;
    this.amp = 0;
    scene.add(this.mesh);
  }

  update(dt, buggy, flags, sunIntensity) {
    this.mesh.position.set(buggy.x, buggy.y, buggy.z);
    this.mesh.rotation.set(0, buggy.heading, 0);
    const speed = Math.abs(buggy.u);
    const skid = (flags.skidR || flags.skidF) ? 0.22 : 0;
    // dust is sunlit matter: the wake all but vanishes after dark
    const lit = 0.2 + 0.8 * Math.min(1, sunIntensity * 1.5);
    const target = (Math.min(1, speed / 9) * 0.4 + skid) * lit;
    this.amp += (target - this.amp) * Math.min(1, dt * 3);
    this.uniforms.uAmp.value = this.amp;
    this.uniforms.uT.value += dt * (0.5 + speed * 0.1);
    this.mesh.visible = this.amp > 0.01;
  }
}
