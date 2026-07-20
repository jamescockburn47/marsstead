// The hopper on screen — Stage 3's craft, built to be LOOKED at: the
// ascent is the showreel and this is its star. Smooth lathe-and-capsule
// geometry only (the colonist's grammar, never a box), MeshPhysical
// materials with the family's painted-sky PMREM in the visor band and
// the metals, per-pixel fbm micro-detail on the hull, and mechanical
// truth made visible: the methane tanks on the rack ARE the fuel state,
// the cradle rails ARE where the buggy rides. Zero assets.
//
// The layer renders; hopper.js owns every number. setPose() places the
// craft along a flight the pure module dictated — the layer cannot fly.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeEnvTexture } from './colonist.js';
import { FBM_GLSL } from './glsl.js';
import { MAX_TANKS, TANK_FUEL_KG } from './hopper.js';
import { meshGroundHeight } from './marschunk.js';

const SHELL = 0xe8e2d6;   // the suit family's warm white
const RUST = 0xc45a2e;    // mission orange
const METAL = 0x8a8f96;
const DARKMETAL = 0x3c3a38;
const VISOR = 0xd8a748;   // bronze mirror
const RUBBER = 0x24211f;
const FROST = 0xdce8ea;   // methane tanks wear pale frost
const TEAL = 0x3fd0c9;    // the colour law: cool is for life and signal

// hull micro-detail: panel-line-scale fbm on roughness and a whisper on
// albedo — the same discipline as the suit's weave
function hullDetail(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vHullPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHullPos = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec3 vHullPos;
${FBM_GLSL}`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  float hullR = fbm(vHullPos.xy * 9.0 + vHullPos.zx * 4.0);
  roughnessFactor = clamp(roughnessFactor + (hullR - 0.5) * 0.16, 0.05, 1.0);`)
    .replace('#include <color_fragment>', `#include <color_fragment>
  float hullA = fbm(vHullPos.xz * 7.0 + vHullPos.yy * 3.0 + 9.2) - 0.5;
  diffuseColor.rgb *= 1.0 + hullA * 0.08;`);
}

// a tapered strut: cylinder with sphere caps, origin at the top pivot
function strut(rTop, rBot, len) {
  const cyl = new THREE.CylinderGeometry(rTop, rBot, len, 16, 1, true);
  cyl.translate(0, -len / 2, 0);
  const a = new THREE.SphereGeometry(rTop, 16, 8);
  const b = new THREE.SphereGeometry(rBot, 16, 8);
  b.translate(0, -len, 0);
  return mergeGeometries([cyl, a, b]);
}

export class HopperLayer {
  static BASE = 1.35;   // the merged ship stands half again the old craft

  constructor(scene, renderer) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.scale.setScalar(HopperLayer.BASE);
    scene.add(this.group);

    // ---- materials (the colonist's recipe, hull-detailed) -----------------
    const shell = new THREE.MeshPhysicalMaterial({
      color: SHELL, roughness: 0.4, metalness: 0,
      clearcoat: 0.65, clearcoatRoughness: 0.3,
    });
    const accent = new THREE.MeshPhysicalMaterial({
      color: RUST, roughness: 0.6, metalness: 0,
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
    // legs and pads wear the planet a little from the first landing
    const dustyMetal = new THREE.MeshPhysicalMaterial({ color: 0x91785f, roughness: 0.6, metalness: 0.8 });
    shell.onBeforeCompile = hullDetail;
    accent.onBeforeCompile = hullDetail;
    frost.onBeforeCompile = hullDetail;
    this.mats = [shell, accent, metal, dark, visor, rubber, frost, dustyMetal];
    if (renderer) {
      const pm = new THREE.PMREMGenerator(renderer);
      const eq = makeEnvTexture();
      const env = pm.fromEquirectangular(eq).texture;
      eq.dispose(); pm.dispose();
      for (const m of this.mats) { m.envMap = env; m.envMapIntensity = 0.65; }
    }

    const g = this.group;

    // ---- the engine bell: a lathe, throat to lip, iridium-dark ------------
    const bellPts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      bellPts.push(new THREE.Vector2(
        0.16 + 0.38 * Math.pow(t, 1.6),           // the classic flare
        0.62 - 0.5 * t,
      ));
    }
    const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 28), dark);
    // the throat's fire: a slightly inset cone, lit only while burning
    this.flame = new THREE.Mesh(
      new THREE.LatheGeometry(bellPts.map((p) => new THREE.Vector2(p.x * 0.86, p.y - 0.03)), 20),
      new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, fog: false }),
    );
    this.flameLight = new THREE.PointLight(0xffb45e, 0, 26, 2);
    this.flameLight.position.set(0, 0.6, 0);
    g.add(bell, this.flame, this.flameLight);

    // ---- the thrust ring and waist ----------------------------------------
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.52, 24), metal);
    waist.position.y = 1.62;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.055, 10, 28), dark);
    rim.rotation.x = Math.PI / 2; rim.position.y = 1.36;
    g.add(waist, rim);

    // ---- the tank rack: fuel state made visible ---------------------------
    this.tanks = [];
    for (let i = 0; i < MAX_TANKS; i++) {
      const a = (i / MAX_TANKS) * Math.PI * 2 + Math.PI / MAX_TANKS;
      const tank = new THREE.Group();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), frost);
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.028, 8, 22), accent);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), metal);
      neck.position.y = 0.42;
      tank.add(sphere, strap, neck);
      tank.position.set(Math.cos(a) * 1.18, 1.66, Math.sin(a) * 1.18);
      tank.visible = false;
      this.tanks.push(tank);
      g.add(tank);
    }

    // ---- the cabin: an ogive lathe with an accent band and a visor --------
    const cabPts = [
      [0.9, 1.9], [0.99, 2.16], [1.02, 2.45], [0.97, 2.75],
      [0.84, 3.05], [0.62, 3.3], [0.34, 3.5], [0.0, 3.58],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const cabin = new THREE.Mesh(new THREE.LatheGeometry(cabPts, 30), shell);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.015, 1.02, 0.16, 30, 1, true), accent);
    band.position.y = 2.16;
    // the canopy: a forward arc of bronze mirror, the pilot's window on
    // the world — the same glass the colonist wears
    const canopy = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[0.955, 2.62], [0.925, 2.78], [0.86, 2.96], [0.78, 3.08]]
          .map(([x, y]) => new THREE.Vector2(x, y)),
        18, -Math.PI * 0.42, Math.PI * 0.84,
      ),
      visor,
    );
    g.add(cabin, band, canopy);

    // ---- RCS pods at the shoulder -----------------------------------------
    for (const a of [0.55, 2.05, Math.PI + 0.55, Math.PI + 2.05]) {
      const pod = new THREE.Group();
      for (const [dx, dy, rz] of [[0.09, 0, Math.PI / 2], [-0.09, 0, Math.PI / 2], [0, 0.1, 0]]) {
        const th = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 10), dark);
        th.position.set(dx, dy, 0); th.rotation.z = rz;
        pod.add(th);
      }
      pod.position.set(Math.cos(a) * 0.99, 3.02, Math.sin(a) * 0.99);
      pod.lookAt(0, 3.02, 0);
      g.add(pod);
    }

    // ---- legs: four splayed struts with knees and round feet --------------
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const hip = new THREE.Vector3().copy(dir).multiplyScalar(0.95).setY(1.75);
      const knee = new THREE.Vector3().copy(dir).multiplyScalar(1.85).setY(0.8);
      const foot = new THREE.Vector3().copy(dir).multiplyScalar(2.25).setY(0.1);
      const seg = (from, to, r0, r1, m) => {
        const len = from.distanceTo(to);
        const mesh = new THREE.Mesh(strut(r0, r1, len), m);
        mesh.position.copy(from);
        mesh.lookAt(to);
        mesh.rotateX(-Math.PI / 2); // strut hangs -y; aim it down the segment
        return mesh;
      };
      g.add(seg(hip, knee, 0.085, 0.065, metal));
      g.add(seg(knee, foot, 0.06, 0.05, dustyMetal));
      // a slender shock strut back up to the waist
      const shockTop = new THREE.Vector3().copy(dir).multiplyScalar(0.7).setY(1.3);
      g.add(seg(knee, shockTop, 0.035, 0.03, dark));
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 10), rubber);
      pad.scale.set(1, 0.36, 1);
      pad.position.copy(foot).setY(0.09);
      g.add(pad);
    }

    // ---- the cradle: the buggy's berth between the legs — two open
    // hoops slung under the waist, geometry-rotated so the U opens upward
    for (const s of [-0.62, 0.62]) {
      const arc = new THREE.TorusGeometry(1.16, 0.045, 10, 22, Math.PI * 0.72);
      arc.rotateZ(Math.PI + Math.PI * 0.14); // centre the opening at the top
      arc.rotateY(Math.PI / 2);              // hoop across the craft
      const rail = new THREE.Mesh(arc, metal);
      rail.position.set(s, 1.26, 0);
      g.add(rail);
    }

    // ---- the mast: signal teal above, warm beacon below (colour law) ------
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.9, 8), metal);
    mast.position.set(0.2, 3.9, 0);
    this.nav = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshBasicMaterial({ color: TEAL, fog: false }));
    this.nav.position.set(0.2, 4.38, 0);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8c46a, fog: false }));
    this.beacon.position.set(0.2, 4.22, 0);
    g.add(mast, this.nav, this.beacon);

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.flame.castShadow = false;

    // ---- the scour: ground-effect dust blasted out by a close burn — a
    // fractal ring torn at the edges, on the GROUND (scene-anchored: the
    // blast stays below while the craft rises). No particles, ever.
    this.scourMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      // the drawn far ground is COARSER than the pure height (LOD rings
      // stream in behind a landing) — bias the blast toward the camera
      // so the drawn hill can never swallow it
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
          // the ring runs outward with the blast; fbm tears its edge ragged
          float ring = smoothstep(0.1, 0.34, r)
            * (1.0 - smoothstep(0.5 + uK * 0.4, 0.98, r));
          float swirl = fbm(vec2(a * 2.3 + uT * 0.9, r * 5.0 - uT * 2.8));
          float dust = ring * (0.3 + 0.7 * swirl) * uK;
          // the colour law: the blast is Mars's own warm matter
          vec3 warm = mix(vec3(0.68, 0.42, 0.26), vec3(0.93, 0.72, 0.5), swirl);
          gl_FragColor = vec4(warm, dust * 0.85);
        }`,
    });
    // segmented so it can WEAR THE LAND: a flat ring on a hillside reads
    // as a billboard (James's eye, 2026-07-20) — the blast follows the
    // slope it is scouring
    const scourGeo = new THREE.PlaneGeometry(30, 30, 22, 22);
    scourGeo.rotateX(-Math.PI / 2);
    this.scour = new THREE.Mesh(scourGeo, this.scourMat);
    this.scour.renderOrder = 2;
    this.scour.visible = false;
    this._scourAt = null;
    scene.add(this.scour);
  }

  // ground-effect at (x, groundY, z): k 0..1 blast strength. The ring's
  // vertices conform to the true ground (throttled: re-drape after 2.5 m)
  setScour(x, groundY, z, k, t) {
    this.scour.visible = k > 0.02;
    if (!this.scour.visible) return;
    if (!this._scourAt || Math.hypot(x - this._scourAt[0], z - this._scourAt[1]) > 2.5) {
      this._scourAt = [x, z];
      const pos = this.scour.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const wx = x + pos.getX(i), wz = z + pos.getZ(i);
        // ride the HIGHEST nearby ground: a coarse streamed chunk draws
        // above the pure height on slopes, and the dust must clear it
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

  // suspension compression: 0 standing tall .. 1 fully squashed — the
  // group's origin sits at the feet, so y-scale plants the landing.
  // BASE scales the whole craft: the merged SHIP (2026-07-20) is a
  // bigger vehicle than the old hopper — lander, workshop and wings.
  setSquash(s) {
    const k = Math.max(0, Math.min(1, s));
    const B = HopperLayer.BASE;
    this.group.scale.set(B * (1 + k * 0.025), B * (1 - k * 0.09), B * (1 + k * 0.025));
  }

  // parked on the ground (or a pad): the everyday state
  setPlaced(x, z, groundY, heading = 0) {
    this.group.visible = true;
    this.group.position.set(x, groundY, z);
    this.group.rotation.set(0, heading, 0);
  }

  hide() { this.group.visible = false; }

  // fuel made visible: one frosted sphere per loaded tank
  setFuel(fuelKg) {
    const n = Math.round(fuelKg / TANK_FUEL_KG);
    this.tanks.forEach((t, i) => { t.visible = i < n; });
  }

  // flight pose: the pure module's track position + altitude; the craft
  // leans gently into the direction of travel
  setPose(x, y, z, headingRad, leanRad = 0) {
    this.group.visible = true;
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, headingRad, 0);
    this.group.rotation.z = leanRad;
  }

  // the burn: 0 quiet .. 1 full thrust — throat glow stretching into a
  // short plume, hard warm light on the apron. No particles, ever.
  setFlame(k, t = 0) {
    const f = Math.max(0, Math.min(1, k));
    const flick = f > 0 ? 0.88 + 0.12 * Math.sin(t * 37) + 0.04 * Math.sin(t * 61) : 0;
    this.flame.material.opacity = f * 0.92 * flick;
    this.flame.scale.y = 1 + f * 1.6;       // a full burn is a PLUME
    this.flame.position.y = -f * 0.6;       // reaching hard for the ground
    this.flameLight.intensity = f * 11 * flick;
  }

  update(t, night) {
    this.beacon.material.color.setHex(night ? 0xffd98a : 0xe8c46a);
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
    this.nav.scale.setScalar(pulse);
  }
}
