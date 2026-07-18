// The colonist, second cut — a humanoid on the classic figure canon
// (7.5 heads; suit bulk worn over it), rigged the animator's way: a
// hierarchy of pivot groups as bones — hip→knee, shoulder→elbow — driven
// by the standard walk-cycle grammar (Muybridge via Richard Williams):
// opposing arm/leg swing, the knee flexing as the leg passes, elbows
// carrying a standing bend, pelvis bobbing at twice stride, shoulders
// counter-rotating the hips. Zero assets, flat-shaded facets, boots at
// y = 0 so figure and shadow stay planted.
//
// Head unit H = 0.23 m -> ~1.72 m suited. Hips at 3.75H, shoulders at
// 5.9H, span ~= height, elbows at the waist, fingertips mid-thigh.

import * as THREE from 'three';
import { strideBob } from './physics.js';

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, shininess: 6 });
}

const SUIT = 0xdfd5c5;   // dust-white shell
const RUST = 0xb34a2a;   // the family rust — bands and pack
const DARK = 0x4a3a2e;   // gloves, boots, joints
const GOLD = 0xd8a944;   // the visor's gold

const H = 0.23;          // the head unit
const HIP_Y = H * 3.75;  // 0.8625
const THIGH = H * 1.9;   // hip to knee
const SHIN = H * 1.7;    // knee to ankle (boot sole makes up the rest)
const SHOULDER_Y = H * 5.9 - HIP_Y; // in upper-body space
const UPPER_ARM = H * 1.5;
const FOREARM = H * 1.4;

// a bone: geometry hangs below the pivot; returns { pivot, end } where
// end is a child group at the segment's far tip (the next joint's seat)
function bone(w, len, colour, d = w) {
  const pivot = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat(colour));
  seg.position.y = -len / 2;
  pivot.add(seg);
  const end = new THREE.Group();
  end.position.y = -len;
  pivot.add(end);
  return { pivot, end };
}

export class Colonist {
  constructor(scene) {
    this.group = new THREE.Group();

    // ---- legs: thigh -> knee -> shin -> boot, both joints live
    const mkLeg = (side) => {
      const thigh = bone(0.15, THIGH, SUIT, 0.17);
      thigh.pivot.position.set(side * 0.115, HIP_Y, 0);
      const shin = bone(0.12, SHIN, SUIT, 0.14);
      const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.16), mat(DARK));
      shin.pivot.add(kneeCap);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), mat(DARK));
      boot.position.set(0, -SHIN - 0.03, 0.05);
      shin.pivot.add(boot);
      thigh.end.add(shin.pivot);
      return { hip: thigh.pivot, knee: shin.pivot };
    };
    const legL = mkLeg(-1), legR = mkLeg(1);
    this.hipL = legL.hip; this.kneeL = legL.knee;
    this.hipR = legR.hip; this.kneeR = legR.knee;

    // ---- the upper body rides one group (bob, lean, counter-twist)
    this.upper = new THREE.Group();

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.24), mat(RUST));
    pelvis.position.y = 0.02;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.28), mat(SUIT));
    torso.position.y = 0.36;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.03), mat(DARK));
    chest.position.set(0, 0.5, 0.15);
    const bandArm = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.06, 0.29), mat(RUST));
    bandArm.position.y = 0.16;

    // the helmet: a finer dome (16x12 facets keeps the family look but
    // reads round), collar ring, and a REAL faceplate — gold cap seated
    // in a dark bezel, glassy-shiny against the matte shell
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.09, 10), mat(DARK));
    neck.position.y = SHOULDER_Y + 0.12;
    this.helmet = new THREE.Group();
    this.helmet.position.y = SHOULDER_Y + 0.38;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12), mat(SUIT));
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.022, 8, 20),
      mat(DARK));
    bezel.position.z = 0.155;
    const plate = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshPhongMaterial({
        color: GOLD, flatShading: false, shininess: 90,
        specular: 0xfff2cc, emissive: 0x2a1a04,
      }));
    plate.rotation.x = Math.PI / 2; // cap faces +z: the gold looks forward
    plate.position.z = 0.035;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.2), mat(RUST));
    crown.position.set(0, 0.2, -0.05);
    this.helmet.add(dome, bezel, plate, crown);

    // the pack, snug between the shoulder blades
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.16), mat(RUST));
    pack.position.set(0, 0.4, -0.23);
    const tankGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.24, 8);
    const tankL = new THREE.Mesh(tankGeo, mat(SUIT));
    const tankR = new THREE.Mesh(tankGeo, mat(SUIT));
    tankL.position.set(-0.09, 0.64, -0.23);
    tankR.position.set(0.09, 0.64, -0.23);
    const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.3, 4), mat(DARK));
    aerial.position.set(-0.15, 0.8, -0.23);

    // ---- arms: shoulder -> elbow -> forearm -> glove
    const mkArm = (side) => {
      const up = bone(0.11, UPPER_ARM, SUIT, 0.13);
      up.pivot.position.set(side * 0.27, SHOULDER_Y + 0.02, 0);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.16), mat(RUST));
      pad.position.y = 0.02;
      up.pivot.add(pad);
      const fore = bone(0.095, FOREARM, SUIT, 0.11);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.13), mat(DARK));
      glove.position.y = -FOREARM - 0.02;
      fore.pivot.add(glove);
      up.end.add(fore.pivot);
      return { shoulder: up.pivot, elbow: fore.pivot };
    };
    const armL = mkArm(-1), armR = mkArm(1);
    this.shL = armL.shoulder; this.elL = armL.elbow;
    this.shR = armR.shoulder; this.elR = armR.elbow;

    this.upper.add(pelvis, torso, chest, bandArm, neck, this.helmet, pack,
      tankL, tankR, aerial, this.shL, this.shR);
    this.upper.position.y = HIP_Y;

    // headlamp at the brow
    this.lamp = new THREE.SpotLight(0xfff2dd, 0, 38, Math.PI / 7.5, 0.7, 1.4);
    this.lamp.position.set(0, SHOULDER_Y + 0.44, 0.16);
    this.lampTarget = new THREE.Object3D();
    this.lampTarget.position.set(0, 0.2, 5);
    this.lamp.target = this.lampTarget;
    this.upper.add(this.lamp, this.lampTarget);

    this.group.add(this.hipL, this.hipR, this.upper);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);
    this.phase = 0;
  }

  setLamp(on) { this.lamp.intensity = on ? 30 : 0; }

  // the walk-cycle grammar, procedurally: speed (m/s), airborne, heading,
  // stride frequency (Hz)
  pose(dt, speed, airborne, heading, hz) {
    this.group.rotation.y = heading;
    if (speed > 0.2 && !airborne) this.phase += dt * hz * Math.PI * 2;
    const amp = Math.min(1, speed / 4);

    if (airborne) {
      // the tuck: a body in flight
      const ease = Math.min(1, 10 * dt);
      this.hipL.rotation.x += (0.5 - this.hipL.rotation.x) * ease;
      this.hipR.rotation.x += (0.3 - this.hipR.rotation.x) * ease;
      this.kneeL.rotation.x += (0.9 - this.kneeL.rotation.x) * ease;
      this.kneeR.rotation.x += (0.7 - this.kneeR.rotation.x) * ease;
      this.shL.rotation.x += (-0.7 - this.shL.rotation.x) * ease;
      this.shR.rotation.x += (-0.7 - this.shR.rotation.x) * ease;
      this.elL.rotation.x = this.elR.rotation.x = -0.5;
    } else {
      const swL = Math.sin(this.phase), swR = -swL;
      this.hipL.rotation.x = swL * 0.62 * amp;
      this.hipR.rotation.x = swR * 0.62 * amp;
      // the knee flexes as its leg passes and recovers — a quarter turn
      // behind the hip, never hyper-extending (max(0,...))
      this.kneeL.rotation.x = Math.max(0, Math.sin(this.phase + 2.1)) * 0.85 * amp;
      this.kneeR.rotation.x = Math.max(0, Math.sin(this.phase + Math.PI + 2.1)) * 0.85 * amp;
      // arms oppose the legs and keep the standing elbow bend
      this.shL.rotation.x = swR * 0.42 * amp;
      this.shR.rotation.x = swL * 0.42 * amp;
      this.elL.rotation.x = -0.3 - Math.max(0, swR) * 0.35 * amp;
      this.elR.rotation.x = -0.3 - Math.max(0, swL) * 0.35 * amp;
      // shoulders counter-rotate the pelvis
      this.upper.rotation.y = swL * 0.09 * amp;
    }

    // pelvis bob at twice stride (each footfall lifts) — 0.38 g on show
    const bob = airborne ? 0.05 : Math.abs(Math.sin(this.phase)) * strideBob(speed);
    this.upper.position.y = HIP_Y + bob;
    this.upper.rotation.x = Math.min(0.18, speed * 0.025) + (airborne ? -0.1 : 0);
  }

  // in the saddle: thighs up, shins down, hands to the wheel
  poseSeated() {
    this.hipL.rotation.x = this.hipR.rotation.x = -1.35;
    this.kneeL.rotation.x = this.kneeR.rotation.x = 1.15;
    this.shL.rotation.x = this.shR.rotation.x = -0.75;
    this.elL.rotation.x = this.elR.rotation.x = -0.45;
    this.upper.rotation.x = 0.08;
    this.upper.rotation.y = 0;
    this.upper.position.y = HIP_Y;
  }
}
