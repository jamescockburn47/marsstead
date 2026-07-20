// Dust scene layer: skins THREE points onto the pure drives in dust.js.
// Two populations — drifting motes riding the wind field (bent by the
// swirl register near the colonist), and the devils: coherent columns of
// spinning grains you can see coming from half a kilometre.

import * as THREE from 'three';
import { windAt, swirl, devilState, devilSpin, hazeDensity, DEVIL_COUNT } from './dust.js';
import { hash2 } from './noise.js';
import { FBM_GLSL } from './glsl.js';

// the dust dome: an inverted sphere around the lens whose alpha is scrolling
// fbm weighted to the horizon — the whole sky-to-ground air gains a moving
// grain of suspended dust for one draw call. Fractal maths, not particles.
const DOME_VS = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const DOME_FS = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uCol, uSunDir;
  uniform float uT, uHaze, uSunI;
  uniform vec2 uWind;
  ${FBM_GLSL}
  void main() {
    vec3 d = normalize(vDir);
    // project the view ray onto the dust sheet: rays near the horizon cross
    // more of it (the same 1/(y+e) foreshortening the sky shader's stars use)
    vec2 sheet = d.xz / (abs(d.y) + 0.28);
    float n = fbm(sheet * 2.2 - uWind * uT * 0.010);
    n = 0.55 * n + 0.45 * fbm(sheet * 5.1 - uWind * uT * 0.024 + 31.7);
    // horizon weighting mirrors the pure hazeDensity envelope
    float horiz = 1.0 - clamp(sin(max(0.0, asin(clamp(d.y, -1.0, 1.0)))), 0.0, 1.0);
    float w = pow(horiz, 2.4);
    float a = uHaze * (0.2 + 0.8 * w) * (0.35 + 0.65 * n);
    // the veil thins after dark: dust is sunlit matter, and the night
    // sky is the lantern — the stars must win a clear night
    a *= mix(0.3, 1.0, clamp(uSunI * 1.6, 0.0, 1.0));
    // THE GLARE (2026-07-20): sunlight through dust forward-scatters —
    // looking sunward, the air itself ignites: a wide warm veil and a
    // tight white-hot core, both PAID FOR by the dust (no haze, no
    // glare) and fiercest at a grazing sun crossing the most air
    vec3 sn = normalize(uSunDir);
    float sunDot = max(0.0, dot(d, sn));
    float lowSun = 1.0 - clamp(sn.y * 2.4, 0.0, 1.0);
    float veil = pow(sunDot, 6.0);
    float core = pow(sunDot, 55.0);
    float pay = uHaze * uSunI * (0.7 + 0.9 * lowSun);
    vec3 col = uCol
      + vec3(0.85, 0.52, 0.26) * veil * pay * 1.4
      + vec3(1.0, 0.88, 0.66) * core * pay * 2.2;
    // the glare also THICKENS the veil sunward: contrast washes out
    // exactly where the light is coming from
    a += (veil * 0.30 + core * 0.45) * pay;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.62));
  }
`;

// low haze sheets: three camera-following planes whose alpha is wind-blown
// fbm in WORLD space (no swim) — the rivers of dust that hug the plain
const SHEET_VS = /* glsl */`
  attribute float aMask;
  varying vec3 vWorld;
  varying float vMask;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vMask = aMask;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const SHEET_FS = /* glsl */`
  precision highp float;
  varying vec3 vWorld;
  varying float vMask;
  uniform vec3 uCol;
  uniform float uT, uAlpha;
  uniform vec2 uWind;
  ${FBM_GLSL}
  void main() {
    vec2 p = vWorld.xz * 0.055 - uWind * uT * 0.06;
    float n = fbm(p) * 0.6 + fbm(p * 3.1 + 17.0) * 0.4;
    // patchier than before (0.45 floor): rivers with real gaps between
    // them, not a film — and the vertex mask thins dust over rocky and
    // steep ground (the REAL rockiness field, carried by the mesh)
    float a = uAlpha * smoothstep(0.45, 0.82, n) * vMask;
    gl_FragColor = vec4(uCol, a);
  }
`;

const MOTES = 1800;
const MOTE_RANGE = 45;       // motes live in a box around the colonist
const GRAINS_PER_DEVIL = 340;

// a soft round speck, drawn in code at boot (zero assets): PointsMaterial
// renders square sprites; this radial-alpha map rounds every grain off
export function speckTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export class DustLayer {
  constructor(scene, groundHeight) {
    this.ground = groundHeight;

    // --- drifting motes
    // biased toward the ground: most dust lives below the knee, a thin
    // minority rides higher — the plain wears a visible skin of motion
    const mpos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      mpos[i * 3] = (hash2(i, 1) - 0.5) * 2 * MOTE_RANGE;
      mpos[i * 3 + 1] = Math.pow(hash2(i, 2), 2.2) * 4 + 0.05;
      mpos[i * 3 + 2] = (hash2(i, 3) - 0.5) * 2 * MOTE_RANGE;
    }
    this.moteGeo = new THREE.BufferGeometry();
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
    const speck = speckTexture();
    this.moteMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.62, 0.40, 0.24), size: 0.07, map: speck,
      transparent: true, opacity: 0.5, sizeAttenuation: true, depthWrite: false,
    });
    this.motes = new THREE.Points(this.moteGeo, this.moteMat);
    this.motes.frustumCulled = false;
    scene.add(this.motes);

    // --- the devils
    const dpos = new Float32Array(DEVIL_COUNT * GRAINS_PER_DEVIL * 3);
    this.devilGeo = new THREE.BufferGeometry();
    this.devilGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.devilMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.66, 0.46, 0.32), size: 0.28, map: speck,
      transparent: true, opacity: 0.28, sizeAttenuation: true, depthWrite: false,
    });
    this.devils = new THREE.Points(this.devilGeo, this.devilMat);
    this.devils.frustumCulled = false;
    scene.add(this.devils);

    // --- the dust dome (one draw call of fractal air)
    this.domeUniforms = {
      uCol: { value: new THREE.Color(0.8, 0.5, 0.3) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uWind: { value: new THREE.Vector2(1, 0) },
      uT: { value: 0 }, uHaze: { value: 0.3 }, uSunI: { value: 1 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 12),
      new THREE.ShaderMaterial({
        vertexShader: DOME_VS, fragmentShader: DOME_FS,
        uniforms: this.domeUniforms, side: THREE.BackSide,
        transparent: true, depthWrite: false, depthTest: false,
      }));
    this.dome.scale.setScalar(300);
    this.dome.renderOrder = 50;      // the veil draws over the world
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // --- three low haze sheets riding the wind over the plain — DRAPED
    // over the real ground (2026-07-20 revamp: the dust wears the land),
    // segmented so each vertex carries its height and the true rockiness
    // mask; conform() refills as the camera travels
    this.sheets = [];
    const SEG = 40;
    for (const [height, alpha] of [[0.5, 0.10], [1.8, 0.07], [4.5, 0.045]]) {
      const geo = new THREE.PlaneGeometry(240, 240, SEG, SEG);
      geo.rotateX(-Math.PI / 2);
      geo.setAttribute('aMask',
        new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
      const uniforms = {
        uCol: { value: new THREE.Color(0.8, 0.5, 0.3) },
        uWind: { value: new THREE.Vector2(1, 0) },
        uT: { value: 0 }, uAlpha: { value: alpha },
      };
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: SHEET_VS, fragmentShader: SHEET_FS, uniforms,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }));
      mesh.renderOrder = 49;
      mesh.frustumCulled = false;
      this.sheets.push({ mesh, uniforms, height, alpha });
      scene.add(mesh);
    }
    this._conformAt = null;
  }

  // drape the sheets over the true land: vertex y follows the ground at
  // its own height, and the mask thins the dust where the REAL rockiness
  // field puts rock. Throttled: refills only after ~6 m of travel.
  conform(px, pz, rockinessAt) {
    if (this._conformAt
      && Math.hypot(px - this._conformAt[0], pz - this._conformAt[1]) < 6) return;
    this._conformAt = [px, pz];
    for (const s of this.sheets) {
      const pos = s.mesh.geometry.attributes.position;
      const mask = s.mesh.geometry.attributes.aMask;
      for (let i = 0; i < pos.count; i++) {
        const wx = px + pos.getX(i), wz = pz + pos.getZ(i);
        pos.setY(i, this.ground(wx, wz) + s.height);
        mask.setX(i, Math.max(0, 1 - rockinessAt(wx, wz) * 0.85));
      }
      pos.needsUpdate = true;
      mask.needsUpdate = true;
      s.mesh.position.set(px, 0, pz);
    }
  }

  // the atmosphere pass: fed each frame from the pure light + haze envelopes
  setAtmos(light, sunDir, tau, windX, windZ, t, camPos, groundY) {
    const du = this.domeUniforms;
    du.uCol.value.setRGB(...light.fogColour);
    du.uSunDir.value.copy(sunDir);
    du.uWind.value.set(windX, windZ);
    du.uT.value = t;
    // the pure envelope, sampled at a mid-sky ray, scaled by daylight —
    // dust is sunlit matter (storms keep a floor so brown-out still veils)
    const day = 0.15 + 0.85 * light.sunIntensity + light.storm * 0.6;
    this.dome.position.copy(camPos);
    du.uHaze.value = hazeDensity(0.18, tau) * Math.min(1, day);
    du.uSunI.value = light.sunIntensity;
    // the surface dust is EPISODIC now, not a film (2026-07-20): calm
    // clear days run nearly clean; it takes real dust in the sky AND
    // real wind on the ground to raise the rivers
    const windK = 0.25 + 0.75 * Math.min(1, Math.hypot(windX, windZ) / 2.2);
    const tauK = Math.min(1, Math.max(0, (tau - 0.3) / 0.55)); // <0.3 sleeps
    for (const s of this.sheets) {
      s.uniforms.uCol.value.setRGB(...light.fogColour);
      s.uniforms.uWind.value.set(windX, windZ);
      s.uniforms.uT.value = t;
      s.uniforms.uAlpha.value = s.alpha * Math.min(1, day) * tauK * windK;
    }
  }

  // px/pz/pvx/pvz: colonist position + velocity (the swirl register's body)
  update(dt, t, px, pz, pvx, pvz) {
    // motes: advect by wind + the colonist's vortex wake; recycle out-of-box
    const a = this.moteGeo.attributes.position.array;
    for (let i = 0; i < MOTES; i++) {
      const k = i * 3;
      let x = a[k] + px * 0 + 0, y = a[k + 1], z = a[k + 2];
      const wx = x + px, wz = z + pz; // world position (motes stored local)
      const w = windAt(wx, wz, t);
      const s = swirl(pvx, pvz, x, z);
      x += (w.x * 0.35 + s.x) * dt;
      z += (w.z * 0.35 + s.z) * dt;
      y += (Math.sin(t * 0.7 + i) * 0.08 + (hash2(i, 9) - 0.45) * 0.3) * dt;
      // keep motes hugging the ground plane band
      const g = 0.1 + Math.pow(hash2(i, 4), 2.2) * 3.5;
      y += (g - y) * 0.02;
      // recycle: drifted out of the box -> respawn on the windward edge
      if (Math.abs(x) > MOTE_RANGE || Math.abs(z) > MOTE_RANGE) {
        x = (hash2(i, Math.floor(t)) - 0.5) * 2 * MOTE_RANGE;
        z = (hash2(i + 7, Math.floor(t)) - 0.5) * 2 * MOTE_RANGE;
      }
      a[k] = x; a[k + 1] = y; a[k + 2] = z;
    }
    this.motes.position.set(px, this.ground(px, pz), pz);
    this.moteGeo.attributes.position.needsUpdate = true;

    // devils: place each column's grains on a spinning, rising helix
    const d = this.devilGeo.attributes.position.array;
    this.nearestDevil = Infinity;
    for (let i = 0; i < DEVIL_COUNT; i++) {
      const st = devilState(i, t);
      const gy = this.ground(st.x, st.z);
      const dist = Math.hypot(st.x - px, st.z - pz);
      if (st.intensity > 0.3 && dist < this.nearestDevil) this.nearestDevil = dist;
      for (let g = 0; g < GRAINS_PER_DEVIL; g++) {
        const k = (i * GRAINS_PER_DEVIL + g) * 3;
        const f = g / GRAINS_PER_DEVIL;             // height fraction
        const rad = st.radius * (0.5 + f * 1.6);    // column flares upward
        const spin = devilSpin(rad, st.radius, st.intensity);
        const ang = hash2(g, i) * Math.PI * 2 + t * (0.4 + spin * 0.25);
        d[k] = st.x + Math.cos(ang) * rad * (0.7 + 0.3 * hash2(g, 5));
        d[k + 1] = gy + f * st.height * st.intensity;
        d[k + 2] = st.z + Math.sin(ang) * rad * (0.7 + 0.3 * hash2(g, 6));
      }
    }
    this.devilGeo.attributes.position.needsUpdate = true;
    this.devilMat.opacity = 0.4;
  }
}

// ---------------------------------------------------------------------------
// PuffCloud — the ONE fine-dust system every kicked-up grain uses (rover
// roostertails, landing thumps, footsteps). Grains are small and numerous,
// fly under half-g (fine dust settles slow in thin air), touch down, sit a
// beat, and are GONE — nothing ever hangs in the air or freezes mid-frame.
export class PuffCloud {
  constructor(scene, count = 2200, size = 0.05) {
    this.count = count;
    const pos = new Float32Array(count * 3).fill(-9999);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count).fill(99);
    this.settledAt = new Float32Array(count).fill(-1);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({
      color: new THREE.Color(0.64, 0.43, 0.27), size, map: speckTexture(),
      transparent: true, opacity: 0.5, sizeAttenuation: true, depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.next = 0;
  }

  spawn(x, y, z, vx, vy, vz) {
    const i = this.next = (this.next + 1) % this.count;
    const p = this.geo.attributes.position.array;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.settledAt[i] = -1;
  }

  update(dt, ground) {
    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      if (this.age[i] > 4) continue;
      this.age[i] += dt;
      const k = i * 3;
      if (this.settledAt[i] < 0) {
        this.vel[k + 1] -= 3.72 * 0.6 * dt;   // fine dust: slowed settling
        p[k] += this.vel[k] * dt;
        p[k + 1] += this.vel[k + 1] * dt;
        p[k + 2] += this.vel[k + 2] * dt;
        const g = ground(p[k], p[k + 2]);
        if (p[k + 1] <= g + 0.03) {           // touchdown: SETTLE
          p[k + 1] = g + 0.03;
          this.settledAt[i] = this.age[i];
        }
        if (this.age[i] > 3.5) { p[k + 1] = -9999; this.age[i] = 99; }
      } else if (this.age[i] - this.settledAt[i] > 0.55) {
        p[k + 1] = -9999;                     // settled long enough: gone
        this.age[i] = 99;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// Footprints — boots write on the four-billion-year page. A ring buffer of
// flat dark stamps pressed into the regolith, oriented to the local slope;
// old prints fade out of the buffer as new ones land.
export class Footprints {
  constructor(scene, cap = 240) {
    this.cap = cap;
    const geo = new THREE.CircleGeometry(0.085, 6);
    geo.rotateX(-Math.PI / 2);
    geo.scale(1, 1, 1.7); // boot-long
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
      color: 0x3a2014, transparent: true, opacity: 0.3,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }), cap);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    // park all instances out of sight until stamped
    const hide = new THREE.Matrix4().makeTranslation(0, -9999, 0);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, hide);
    scene.add(this.mesh);
    this.next = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._n = new THREE.Vector3();
  }

  // side: -1 left boot, +1 right; ground: the drawn-surface sampler
  stamp(x, z, heading, side, ground) {
    const px = x + Math.cos(heading) * side * 0.13;
    const pz = z - Math.sin(heading) * side * 0.13;
    const e = 0.4;
    const gy = ground(px, pz);
    this._n.set(
      (ground(px - e, pz) - ground(px + e, pz)) / (2 * e), 1,
      (ground(px, pz - e) - ground(px, pz + e)) / (2 * e),
    ).normalize();
    this._q.setFromUnitVectors(this._up, this._n);
    const yq = new THREE.Quaternion().setFromAxisAngle(this._up, heading);
    this._q.multiply(yq);
    this._m.compose(
      new THREE.Vector3(px, gy + 0.02, pz), this._q, new THREE.Vector3(1, 1, 1),
    );
    this.mesh.setMatrixAt(this.next = (this.next + 1) % this.cap, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
