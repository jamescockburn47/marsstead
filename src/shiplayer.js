// THE SHIP on screen — one hull, ~9 m of it (2026-07-20, James's eye:
// "single, snazzier, larger, more modern"). A sleek biconic tower in
// the house grammar: smooth lathe-and-capsule only, warm white with the
// mission-orange chine, a wrap of bronze canopy glass, the WORKSHOP bay
// with its warm interior glow (the bench lives behind that door), six
// conformal tank sockets whose frost-white tanks ARE the fuel gauge,
// three gimballed bells under an engine skirt, four angular legs, the
// airlock ring and ladder at the base. Zero assets; per-pixel fbm
// micro-detail; MeshPhysical with the family PMREM.
//
// The layer renders; hopper.js still owns every number. Same channel
// API the old craft had: setPlaced / setPose / setFuel / setFlame /
// setScour / setSquash / hide / update.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeEnvTexture } from './colonist.js';
import { FBM_GLSL } from './glsl.js';
import { MAX_TANKS, TANK_FUEL_KG } from './hopper.js';
import { meshGroundHeight } from './marschunk.js';

const SHELL = 0xe8e2d6;
const RUST = 0xc45a2e;
const METAL = 0x8a8f96;
const DARKMETAL = 0x3c3a38;
const VISOR = 0xd8a748;
const RUBBER = 0x24211f;
const FROST = 0xdce8ea;
const TEAL = 0x3fd0c9;
const GLOW = 0xffc87e;    // the workshop's warm interior

function hullDetail(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vHullPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHullPos = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec3 vHullPos;
${FBM_GLSL}`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  float hullR = fbm(vHullPos.xy * 6.0 + vHullPos.zx * 3.0);
  roughnessFactor = clamp(roughnessFactor + (hullR - 0.5) * 0.16, 0.05, 1.0);`)
    .replace('#include <color_fragment>', `#include <color_fragment>
  float hullA = fbm(vHullPos.xz * 5.0 + vHullPos.yy * 2.0 + 9.2) - 0.5;
  diffuseColor.rgb *= 1.0 + hullA * 0.07;`);
}

export class ShipLayer {
  constructor(scene, renderer) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    const shell = new THREE.MeshPhysicalMaterial({
      color: SHELL, roughness: 0.38, metalness: 0,
      clearcoat: 0.7, clearcoatRoughness: 0.28,
    });
    const accent = new THREE.MeshPhysicalMaterial({
      color: RUST, roughness: 0.55, metalness: 0,
      sheen: 0.5, sheenRoughness: 0.6, sheenColor: 0xffd9c0,
    });
    const metal = new THREE.MeshPhysicalMaterial({ color: METAL, roughness: 0.34, metalness: 1 });
    const dark = new THREE.MeshPhysicalMaterial({ color: DARKMETAL, roughness: 0.5, metalness: 1 });
    const visor = new THREE.MeshPhysicalMaterial({ color: VISOR, roughness: 0.07, metalness: 1 });
    const rubber = new THREE.MeshPhysicalMaterial({ color: RUBBER, roughness: 0.92, metalness: 0 });
    const frost = new THREE.MeshPhysicalMaterial({
      color: FROST, roughness: 0.55, metalness: 0,
      sheen: 0.7, sheenRoughness: 0.5, sheenColor: 0xffffff,
    });
    const dusty = new THREE.MeshPhysicalMaterial({ color: 0x91785f, roughness: 0.6, metalness: 0.8 });
    shell.onBeforeCompile = hullDetail;
    accent.onBeforeCompile = hullDetail;
    frost.onBeforeCompile = hullDetail;
    this.mats = [shell, accent, metal, dark, visor, rubber, frost, dusty];
    if (renderer) {
      const pm = new THREE.PMREMGenerator(renderer);
      const eq = makeEnvTexture();
      const env = pm.fromEquirectangular(eq).texture;
      eq.dispose(); pm.dispose();
      for (const m of this.mats) { m.envMap = env; m.envMapIntensity = 0.65; }
    }

    const g = this.group;

    // ---- the hull: one biconic lathe, boat-tail to nose ------------------
    const pts = [
      [1.35, 1.15], [1.62, 1.5], [1.75, 2.1], [1.78, 3.0], [1.76, 4.0],
      [1.68, 5.0], [1.52, 5.9], [1.28, 6.7], [0.98, 7.4], [0.62, 8.1],
      [0.3, 8.65], [0.0, 8.95],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const hull = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), shell);
    g.add(hull);
    // the chine: the mission-orange line the eye follows
    const chine = new THREE.Mesh(new THREE.CylinderGeometry(1.71, 1.75, 0.22, 40, 1, true), accent);
    chine.position.y = 4.7;
    const chine2 = new THREE.Mesh(new THREE.CylinderGeometry(1.77, 1.78, 0.14, 40, 1, true), accent);
    chine2.position.y = 2.5;
    g.add(chine, chine2);

    // ---- the canopy: a wrap of bronze glass under the nose ----------------
    const canopy = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[1.26, 6.55], [1.16, 6.95], [1.0, 7.3], [0.84, 7.55]]
          .map(([x, y]) => new THREE.Vector2(x + 0.015, y)),
        26, -Math.PI * 0.62, Math.PI * 1.24,
      ), visor,
    );
    g.add(canopy);

    // ---- THE WORKSHOP: the bay door and its warm interior -----------------
    const bayFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 0.16), metal);
    bayFrame.position.set(0, 2.75, 1.72);
    const bayGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.25),
      new THREE.MeshBasicMaterial({ color: GLOW, fog: false }));
    bayGlow.position.set(0, 2.75, 1.81);
    this.bayGlow = bayGlow;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 0.1), shell);
    door.position.set(0, 3.62, 1.78);
    door.rotation.x = -0.7;          // rolled up, always open for business
    this.bayLight = new THREE.PointLight(GLOW, 2.2, 9, 2);
    this.bayLight.position.set(0, 2.7, 2.6);
    g.add(bayFrame, bayGlow, door, this.bayLight);

    // ---- tanks: two conformal columns of three, the honest fuel gauge -----
    this.tanks = [];
    for (let i = 0; i < MAX_TANKS; i++) {
      const side = i < 3 ? 1 : -1;
      const row = i % 3;
      const tank = new THREE.Group();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), frost);
      sphere.scale.y = 1.25;
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.026, 8, 20), accent);
      tank.add(sphere, strap);
      const a = side * 0.92;   // flank angle
      tank.position.set(Math.sin(a) * 1.78, 1.9 + row * 1.0, Math.cos(a) * 1.78);
      tank.visible = false;
      this.tanks.push(tank);
      g.add(tank);
    }

    // ---- the engine skirt and three bells ---------------------------------
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.75, 40, 1, true), dark);
    skirt.position.y = 0.82;
    g.add(skirt);
    const bellPts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      bellPts.push(new THREE.Vector2(0.14 + 0.3 * Math.pow(t, 1.6), 0.55 - 0.5 * t));
    }
    this.flame = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 22), dark);
      bell.position.set(Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62);
      g.add(bell);
      const fl = new THREE.Mesh(
        new THREE.LatheGeometry(bellPts.map((p) => new THREE.Vector2(p.x * 0.85, p.y - 0.03)), 16),
        new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, fog: false }),
      );
      fl.position.copy(bell.position);
      this.flame.add(fl);
    }
    this.flameLight = new THREE.PointLight(0xffb45e, 0, 34, 2);
    this.flameLight.position.set(0, 0.6, 0);
    g.add(this.flame, this.flameLight);

    // ---- four angular legs -------------------------------------------------
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const seg = (from, to, w, m) => {
        const len = from.distanceTo(to);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w * 1.4), m);
        mesh.position.copy(from).lerp(to, 0.5);
        mesh.lookAt(to);
        mesh.rotateX(Math.PI / 2);
        g.add(mesh);
      };
      const hip = dir.clone().multiplyScalar(1.45).setY(1.7);
      const knee = dir.clone().multiplyScalar(2.7).setY(0.95);
      const foot = dir.clone().multiplyScalar(3.25).setY(0.12);
      seg(hip, knee, 0.17, metal);
      seg(knee, foot, 0.13, dusty);
      const shockTop = dir.clone().multiplyScalar(1.1).setY(0.95);
      seg(knee, shockTop, 0.07, dark);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.14, 14), rubber);
      pad.position.copy(foot).setY(0.07);
      g.add(pad);
    }

    // ---- the door home: airlock ring + ladder, aft ------------------------
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.075, 10, 24), accent);
    ring.position.set(0, 1.75, -1.72);
    g.add(ring);
    const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), dark);
    hatch.position.set(0, 1.75, -1.735);
    hatch.rotation.y = Math.PI;
    g.add(hatch);
    for (let r = 0; r < 4; r++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), metal);
      rung.position.set(0, 0.35 + r * 0.36, -1.78 - r * 0.02);
      g.add(rung);
    }

    // ---- the mast: dish, teal nav (signal), gold beacon -------------------
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.1, 8), metal);
    mast.position.set(0.25, 9.35, 0);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8,
      0, Math.PI * 2, 0, Math.PI * 0.42), metal);
    dish.position.set(0.25, 9.6, 0);
    dish.rotation.x = Math.PI * 0.78;
    this.nav = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8),
      new THREE.MeshBasicMaterial({ color: TEAL, fog: false }));
    this.nav.position.set(0.25, 9.98, 0);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8c46a, fog: false }));
    this.beacon.position.set(0.25, 9.82, 0);
    g.add(mast, dish, this.nav, this.beacon);

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    for (const f of this.flame.children) f.castShadow = false;

    // ---- the scour: ported unchanged from the old craft -------------------
    this.scourMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { uT: { value: 0 }, uK: { value: 0 } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uK;
        ${FBM_GLSL}
        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float a = atan(p.y, p.x);
          float ring2 = smoothstep(0.1, 0.34, r)
            * (1.0 - smoothstep(0.5 + uK * 0.4, 0.98, r));
          float swirl = fbm(vec2(a * 2.3 + uT * 0.9, r * 5.0 - uT * 2.8));
          float dust = ring2 * (0.3 + 0.7 * swirl) * uK;
          vec3 warm = mix(vec3(0.68, 0.42, 0.26), vec3(0.93, 0.72, 0.5), swirl);
          gl_FragColor = vec4(warm, dust * 0.85);
        }`,
    });
    const scourGeo = new THREE.PlaneGeometry(38, 38, 22, 22);
    scourGeo.rotateX(-Math.PI / 2);
    this.scour = new THREE.Mesh(scourGeo, this.scourMat);
    this.scour.renderOrder = 2;
    this.scour.visible = false;
    this._scourAt = null;
    scene.add(this.scour);
  }

  setPlaced(x, z, groundY, heading = 0) {
    this.group.visible = true;
    this.group.position.set(x, groundY, z);
    this.group.rotation.set(0, heading, 0);
  }

  hide() { this.group.visible = false; }

  setFuel(fuelKg) {
    const n = Math.round(fuelKg / TANK_FUEL_KG);
    this.tanks.forEach((t, i) => { t.visible = i < n; });
  }

  setPose(x, y, z, headingRad, leanRad = 0) {
    this.group.visible = true;
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, headingRad, 0);
    this.group.rotation.z = leanRad;
  }

  setFlame(k, t = 0) {
    const f = Math.max(0, Math.min(1, k));
    const flick = f > 0 ? 0.88 + 0.12 * Math.sin(t * 37) + 0.04 * Math.sin(t * 61) : 0;
    for (const fl of this.flame.children) {
      fl.material.opacity = f * 0.92 * flick;
      fl.scale.y = 1 + f * 2.1;
      fl.position.y = -f * 0.7;
    }
    this.flameLight.intensity = f * 16 * flick;
  }

  setScour(x, groundY, z, k, t) {
    this.scour.visible = k > 0.02;
    if (!this.scour.visible) return;
    if (!this._scourAt || Math.hypot(x - this._scourAt[0], z - this._scourAt[1]) > 2.5) {
      this._scourAt = [x, z];
      const pos = this.scour.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const wx = x + pos.getX(i), wz = z + pos.getZ(i);
        const h = Math.max(
          meshGroundHeight(wx, wz),
          meshGroundHeight(wx + 1.4, wz), meshGroundHeight(wx - 1.4, wz),
          meshGroundHeight(wx, wz + 1.4), meshGroundHeight(wx, wz - 1.4),
        );
        pos.setY(i, h - groundY + 0.8);
      }
      pos.needsUpdate = true;
    }
    this.scour.position.set(x, groundY, z);
    this.scourMat.uniforms.uT.value = t;
    this.scourMat.uniforms.uK.value = Math.min(1, k);
  }

  // suspension: origin at the feet, so y-scale plants the landing
  setSquash(s) {
    const k = Math.max(0, Math.min(1, s));
    this.group.scale.set(1 + k * 0.02, 1 - k * 0.07, 1 + k * 0.02);
  }

  update(t, night) {
    this.beacon.material.color.setHex(night ? 0xffd98a : 0xe8c46a);
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
    this.nav.scale.setScalar(pulse);
    this.bayLight.intensity = night ? 3.2 : 1.6;
    this.bayGlow.material.color.setHex(night ? 0xffd79a : GLOW);
  }
}
