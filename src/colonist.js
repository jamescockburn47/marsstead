// The colonist, third cut — a suited figure built the way real suits are
// built: hard rings, lathe shells, tapered soft-goods limbs and accordion
// convolute joints. A spacesuit is the best possible zero-asset subject —
// segmented engineering that would read "robot" on bare anatomy reads
// CORRECT on a pressure suit. Proportions follow the EMU/xEMU record
// (PLSS 0.66x0.52x0.27 m scaled to the figure; limb bulk 1.4-1.6x
// anatomy; 3-ring convolutes at knee/elbow/shoulder) with the SpaceX-EVA
// streamlined read: white soft suit, dark bronze mirror visor.
//
// Materials are MeshPhysicalMaterial — sheen gives the grazing-angle
// cloth bloom, clearcoat the shell gloss, and a tiny PROCEDURAL
// equirect (a DataTexture painted in code — zero assets) run through
// PMREMGenerator gives the visor and rings a Martian sky to mirror.
// Per-pixel fbm detail rides onBeforeCompile, the family pattern
// (terrain.js). All pose math lives in colonistrig.js (pure, verified);
// this file only builds flesh and applies the numbers.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FBM_GLSL } from './glsl.js';
import { BONES, ColonistRig } from './colonistrig.js';

const FABRIC = 0xe3dccd;  // dust-white soft goods
const SHELL = 0xefe9dd;   // hard composite
const RUST = 0xb34a2a;    // the family rust — accents and pads
const METAL = 0xcfd0d4;   // bearing rings
const VISOR = 0xc9772e;   // smoked bronze-gold mirror
const RUBBER = 0x232326;  // soles, palms, seals

// per-pixel suit detail: fbm roughness variation (the strongest fabric
// cue at gameplay distance) and a faint albedo mottle — object-space, so
// merged geometry needs no UVs. Multiplicative: the colour law survives.
function suitDetail(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSuitPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSuitPos = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec3 vSuitPos;
${FBM_GLSL}`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  float suitR = fbm(vSuitPos.xy * 16.0 + vSuitPos.zx * 5.0);
  roughnessFactor = clamp(roughnessFactor + (suitR - 0.5) * 0.18, 0.05, 1.0);`)
    .replace('#include <color_fragment>', `#include <color_fragment>
  float suitA = fbm(vSuitPos.xz * 11.0 + vSuitPos.yy * 4.0 + 3.7) - 0.5;
  diffuseColor.rgb *= 1.0 + suitA * 0.10;`);
}

// a painted Martian sky for the reflections: tiny equirect, code only.
// Butterscotch horizon, dark zenith, rust ground — enough for a visor.
function makeEnvTexture() {
  const W = 64, H = 32;
  const data = new Uint8Array(W * H * 4);
  const mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);                     // 0 zenith -> 1 nadir
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      let r, g, bl;
      if (v < 0.5) {                           // sky: dark brown -> glow
        const t = Math.pow(v / 0.5, 1.6);
        r = mix(18, 175, t); g = mix(10, 105, t); bl = mix(7, 58, t);
        // a soft sun smear on one bearing
        const sun = Math.exp(-(Math.pow((u - 0.5) * 9, 2) + Math.pow((v - 0.42) * 14, 2)));
        r += 80 * sun; g += 55 * sun; bl += 30 * sun;
      } else {                                 // ground: rust falling dark
        const t = (v - 0.5) / 0.5;
        r = mix(120, 24, t); g = mix(58, 12, t); bl = mix(30, 7, t);
      }
      const i = (y * W + x) * 4;
      data[i] = Math.min(255, r); data[i + 1] = Math.min(255, g);
      data[i + 2] = Math.min(255, bl); data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

// a tapered soft-goods limb segment: cylinder + sphere caps, origin at
// the TOP (the pivot), body hanging down -y. Smooth-shaded, no seams.
function limbGeo(rTop, rBot, len) {
  const cyl = new THREE.CylinderGeometry(rTop, rBot, len, 18, 1, true);
  cyl.translate(0, -len / 2, 0);
  const capT = new THREE.SphereGeometry(rTop, 18, 10);
  const capB = new THREE.SphereGeometry(rBot, 18, 10);
  capB.translate(0, -len, 0);
  return mergeGeometries([cyl, capT, capB]);
}

export class Colonist {
  constructor(scene, renderer) {
    this.group = new THREE.Group();
    this.rig = new ColonistRig();
    this.bellows = [];   // { rings: [Mesh], read: () => angle }

    // ---- materials --------------------------------------------------------
    const fabric = new THREE.MeshPhysicalMaterial({
      color: FABRIC, roughness: 0.88, metalness: 0,
      sheen: 1.0, sheenRoughness: 0.5, sheenColor: 0xfff6e8,
    });
    const shell = new THREE.MeshPhysicalMaterial({
      color: SHELL, roughness: 0.42, metalness: 0,
      clearcoat: 0.6, clearcoatRoughness: 0.3,
    });
    const accent = new THREE.MeshPhysicalMaterial({
      color: RUST, roughness: 0.7, metalness: 0,
      sheen: 0.6, sheenRoughness: 0.6, sheenColor: 0xffd9c0,
    });
    const metal = new THREE.MeshPhysicalMaterial({
      color: METAL, roughness: 0.35, metalness: 1.0,
    });
    const visor = new THREE.MeshPhysicalMaterial({
      color: VISOR, roughness: 0.08, metalness: 1.0,
    });
    const rubber = new THREE.MeshPhysicalMaterial({
      color: RUBBER, roughness: 0.9, metalness: 0,
    });
    fabric.onBeforeCompile = suitDetail;
    shell.onBeforeCompile = suitDetail;
    accent.onBeforeCompile = suitDetail;
    this.mats = [fabric, shell, accent, metal, visor, rubber];

    // the painted-sky reflections (zero-asset PMREM); metals are black
    // without one — this is what makes the visor a mirror of Mars
    if (renderer) {
      const pm = new THREE.PMREMGenerator(renderer);
      const eq = makeEnvTexture();
      this.env = pm.fromEquirectangular(eq).texture;
      eq.dispose(); pm.dispose();
      for (const m of this.mats) { m.envMap = this.env; m.envMapIntensity = 0.7; }
    }

    // ---- pelvis root: everything rides here -------------------------------
    this.pelvisPos = new THREE.Group();  // height + lateral sway
    this.pelvisRot = new THREE.Group();  // lean, roll, counter-yaw
    this.pelvisPos.add(this.pelvisRot);
    this.group.add(this.pelvisPos);

    // ---- legs: hip -> thigh -> knee(bellows) -> shin -> ankle -> boot -----
    const mkLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * BONES.FOOT_LAT, 0, 0);
      const hipRing = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.017, 8, 22), metal);
      hipRing.rotation.x = Math.PI / 2;
      const thigh = new THREE.Mesh(limbGeo(0.128, 0.108, BONES.THIGH), fabric);
      const pad = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.14, 0.08, 3, 0.03), accent);
      pad.position.set(0, -BONES.THIGH + 0.02, 0.075);   // knee pad
      const knee = new THREE.Group();
      knee.position.y = -BONES.THIGH;
      const shinPivot = new THREE.Group();
      const shin = new THREE.Mesh(limbGeo(0.102, 0.086, BONES.SHIN), fabric);
      const ankle = new THREE.Group();
      ankle.position.y = -BONES.SHIN;
      // the boot: body, hard toe, lugged sole
      const boot = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.13, 0.29, 3, 0.05), fabric);
      boot.position.set(0, -0.045, 0.05);
      const toe = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.09, 0.11, 3, 0.035), shell);
      toe.position.set(0, -0.06, 0.155);
      const sole = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.035, 0.32, 2, 0.012), rubber);
      sole.position.set(0, -BONES.ANKLE_H + 0.017, 0.055);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.015, 8, 20), metal);
      cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.02;
      ankle.add(boot, toe, sole, cuff);
      // knee convolutes: rings that fan through the bend
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.021, 8, 20), fabric);
        ring.rotation.x = Math.PI / 2;
        knee.add(ring); rings.push(ring);
      }
      shinPivot.add(shin, ankle);
      knee.add(shinPivot);
      hip.add(hipRing, thigh, pad, knee);
      this.pelvisPos.add(hip);
      return { hip, shinPivot, ankle, rings };
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);
    this.bellows.push(
      { rings: this.legL.rings, read: () => this.legL.shinPivot.rotation.x },
      { rings: this.legR.rings, read: () => this.legR.shinPivot.rotation.x });

    // ---- torso: brief, HUT lathe, chest box, waist ring -------------------
    // lathe profile (r, y) in pelvis space; z squashed 0.74 — the HUT is a
    // rounded wedge, wider at the shoulders, never a cylinder
    const prof = [
      [0.001, -0.16], [0.15, -0.15], [0.205, -0.02], [0.195, 0.12],
      [0.225, 0.30], [0.25, 0.44], [0.245, 0.50], [0.20, 0.57],
      [0.135, 0.60], [0.001, 0.605],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 30), fabric);
    torso.scale.z = 0.74;
    this.chest = torso;   // breathing scales this
    const waist = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.018, 8, 26), metal);
    waist.rotation.x = Math.PI / 2; waist.position.y = 0.06;
    waist.scale.z = 0.8;
    const dcm = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.15, 0.08, 3, 0.02), accent);
    dcm.position.set(0, 0.33, 0.165);
    const dcmFace = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.09, 0.02, 2, 0.008), rubber);
    dcmFace.position.set(0, 0.34, 0.207);

    // ---- helmet: bubble shell + proud bronze visor + brow -----------------
    const helmet = new THREE.Group();
    helmet.position.y = BONES.SHOULDER_Y + 0.185;
    const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.02, 10, 24), metal);
    neckRing.rotation.x = Math.PI / 2; neckRing.position.y = -0.145;
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.16, 26, 18), shell);
    const vis = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), visor);
    vis.rotation.x = Math.PI / 2 - 0.12;   // face forward, tipped a little down
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.012, 8, 26), rubber);
    frame.position.z = 0.075; frame.rotation.x = -0.12;
    const brow = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.05, 0.12, 2, 0.02), accent);
    brow.position.set(0, 0.135, 0.06); brow.rotation.x = 0.35;
    helmet.add(neckRing, bubble, vis, frame, brow);

    // headlamp at the brow
    this.lamp = new THREE.SpotLight(0xfff2dd, 0, 38, Math.PI / 7.5, 0.7, 1.4);
    this.lamp.position.set(0, BONES.SHOULDER_Y + 0.24, 0.16);
    this.lampTarget = new THREE.Object3D();
    this.lampTarget.position.set(0, 0.2, 5);
    this.lamp.target = this.lampTarget;

    // ---- the PLSS pack (EMU record, scaled) + hoses + antenna -------------
    this.pack = new THREE.Group();
    this.pack.position.set(0, 0.30, -0.26);
    const packBody = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.52, 0.19, 3, 0.04), shell);
    const packPanel = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.18, 0.06, 2, 0.02), accent);
    packPanel.position.set(0, -0.12, -0.08);
    const tankGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12);
    const tankL = new THREE.Mesh(tankGeo, metal); tankL.position.set(-0.1, 0.33, -0.02);
    const tankR = new THREE.Mesh(tankGeo, metal); tankR.position.set(0.1, 0.33, -0.02);
    const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 5), rubber);
    aerial.position.set(-0.16, 0.42, 0);
    this.pack.add(packBody, packPanel, tankL, tankR, aerial);
    // umbilicals: pack shoulders -> helmet sides, static in torso space
    const hosePts = (s) => new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.13, 0.5, -0.3),
      new THREE.Vector3(s * 0.17, 0.62, -0.2),
      new THREE.Vector3(s * 0.11, 0.6, -0.05),
    ]);
    const hoseL = new THREE.Mesh(new THREE.TubeGeometry(hosePts(-1), 16, 0.018, 8), rubber);
    const hoseR = new THREE.Mesh(new THREE.TubeGeometry(hosePts(1), 16, 0.018, 8), rubber);

    // ---- arms: shoulder(bellows) -> elbow(bellows) -> forearm -> glove ----
    const mkArm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * BONES.SHOULDER_X, BONES.SHOULDER_Y - 0.06, 0);
      const scye = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.016, 8, 20), metal);
      scye.rotation.z = Math.PI / 2 + side * 0.2;
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), accent);
      pauldron.position.set(side * 0.01, 0.015, 0);
      pauldron.scale.set(1, 0.85, 1);
      const upper = new THREE.Mesh(limbGeo(0.08, 0.068, BONES.UPPER_ARM), fabric);
      const elbow = new THREE.Group();
      elbow.position.y = -BONES.UPPER_ARM;
      const forePivot = new THREE.Group();
      const fore = new THREE.Mesh(limbGeo(0.066, 0.054, BONES.FOREARM), fabric);
      const wristRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 18), metal);
      wristRing.rotation.x = Math.PI / 2; wristRing.position.y = -BONES.FOREARM + 0.02;
      const glove = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.07, 6, 14), rubber);
      glove.position.y = -BONES.FOREARM - 0.045;
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.035, 4, 8), rubber);
      thumb.position.set(side * -0.045, -BONES.FOREARM - 0.03, 0.03);
      thumb.rotation.z = side * -0.5;
      forePivot.add(fore, wristRing, glove, thumb);
      if (side < 0) {   // the wrist display VESPER keeps being checked on
        const pad = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.025, 0.08, 2, 0.008), rubber);
        pad.position.set(0, -BONES.FOREARM + 0.07, 0.055);
        const face = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.012, 0.06, 2, 0.005),
          new THREE.MeshPhysicalMaterial({ color: 0x1c2a33, roughness: 0.2,
            metalness: 0, emissive: 0x0d2f3a, emissiveIntensity: 0.7 }));
        face.position.set(0, -BONES.FOREARM + 0.083, 0.055);
        forePivot.add(pad, face);
      }
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 18), fabric);
        ring.rotation.x = Math.PI / 2;
        elbow.add(ring); rings.push(ring);
      }
      elbow.add(forePivot);
      shoulder.add(scye, pauldron, upper, elbow);
      return { shoulder, forePivot, rings };
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    this.bellows.push(
      { rings: this.armL.rings, read: () => this.armL.forePivot.rotation.x },
      { rings: this.armR.rings, read: () => this.armR.forePivot.rotation.x });

    this.pelvisRot.add(torso, waist, dcm, dcmFace, helmet, this.pack,
      hoseL, hoseR, this.armL.shoulder, this.armR.shoulder,
      this.lamp, this.lampTarget);

    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);
  }

  setLamp(on) { this.lamp.intensity = on ? 30 : 0; }

  // reflections follow the day: the visor mustn't blaze at midnight
  setDaylight(dayness) {
    if (!this.env) return;
    const k = 0.12 + 0.75 * Math.max(0, Math.min(1, dayness));
    for (const m of this.mats) m.envMapIntensity = k;
  }

  // inp: { x, z, heading, vx, vz, speed, airborne, vy, groundAt, simT }
  pose(dt, inp) {
    const p = this.rig.step(dt, inp);
    this.group.rotation.y = inp.heading;

    this.pelvisPos.position.set(p.sway, p.hipY + BONES.ANKLE_H, 0);
    this.pelvisRot.rotation.set(p.pelvisPitch * 0.4 + p.torsoPitch,
      p.pelvisYaw + p.torsoYaw, p.pelvisRoll);

    // legs (semantic -> THREE: forward swing is -x here)
    for (const [leg, out] of [[this.legL, p.legL], [this.legR, p.legR]]) {
      leg.hip.rotation.x = -out.hipPitch;
      leg.shinPivot.rotation.x = out.kneeFlex;
      leg.ankle.rotation.x = -out.anklePitch;
    }

    // arms
    this.armL.shoulder.rotation.x = -p.armL.shoulderPitch;
    this.armL.shoulder.rotation.z = p.armL.abduct;
    this.armL.forePivot.rotation.x = -p.armL.elbowFlex;
    this.armR.shoulder.rotation.x = -p.armR.shoulderPitch;
    this.armR.shoulder.rotation.z = -p.armR.abduct;
    this.armR.forePivot.rotation.x = -p.armR.elbowFlex;

    // convolute rings fan through half the joint they serve
    for (const b of this.bellows) {
      const a = b.read();
      b.rings.forEach((ring, i) => {
        const f = (i + 1) / (b.rings.length + 1);
        ring.rotation.set(Math.PI / 2 + a * f, 0, 0);
        ring.position.set(0, Math.sin(a * f) * 0.012, -Math.abs(Math.sin(a * f)) * 0.01);
      });
    }

    // the pack floats on its own sloppy spring — low-g mass made visible
    this.pack.position.y = 0.30 + p.packOff;
    this.pack.rotation.x = p.packOff * 1.6;

    // breathing: the chest swells, just barely
    const s = 1 + p.breath * 0.008;
    this.chest.scale.set(s, 1, 0.74 * s);
  }

  // in the buggy's saddle: thighs up, shins down, hands to the wheel
  poseSeated() {
    this.rig.first = true;   // next ground frame replants cleanly
    this.pelvisPos.position.set(0, BONES.HIP_Y, 0);
    this.pelvisRot.rotation.set(0.08, 0, 0);
    for (const leg of [this.legL, this.legR]) {
      leg.hip.rotation.x = -1.35;
      leg.shinPivot.rotation.x = 1.15;
      leg.ankle.rotation.x = 0.15;
    }
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]]) {
      arm.shoulder.rotation.x = -0.75;
      arm.shoulder.rotation.z = side * -0.12;
      arm.forePivot.rotation.x = -0.55;
    }
    for (const b of this.bellows) {
      const a = b.read();
      b.rings.forEach((ring, i) => {
        const f = (i + 1) / (b.rings.length + 1);
        ring.rotation.set(Math.PI / 2 + a * f, 0, 0);
      });
    }
  }
}
