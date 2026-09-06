// The rover-buggy on screen — designed after the real article: NASA's LTV
// class of unpressurised crew rover (four large wheels, passive
// spring-damped suspension on visible wishbone arms, a sensor mast with a
// camera head, a rear solar deck, one open seat). Family facet look, zero
// assets. Roostertails and landing thumps spawn into the shared PuffCloud
// (dustlayer.js) from the SAME skid flag the physics raises — fine grains
// that fly, settle and vanish; and the body sits on the terrain via the
// four wheel-contact heights main.js samples (no floating on slopes).

import * as THREE from 'three';
import { hash2 } from './noise.js';
import { WHEEL_R, SUSP_STATIC, WHEELBASE_F, WHEELBASE_R } from './buggy.js';
import { createBuggyFinish } from './buggy-finish.js';

const PANEL = 0xd8cec0;   // dust-white body panels
const RUST = 0xb34a2a;    // the family rust accent
const FRAME = 0x3a3430;   // structure, arms, mast
const TYRE = 0x2c2620;    // mesh wheels
const CELL = 0x232a33;    // solar deck — the cool tech accent (colour law)

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, shininess: 8 });
}
function box(w, h, d, colour) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
}

export const TRACK = 1.02;     // half-width to wheel centres (physics HALF_TRACK)
export const WHEELBASE = 1.05;  // half-length to the front axle (rear is 1.15)

export class BuggyLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    // vehicle Euler order: yaw, THEN pitch, THEN roll — with the default
    // XYZ order, pitch applies about the WORLD x-axis and on any slope not
    // aligned north-south the body tilts about the wrong axis and digs its
    // flank into the ground
    this.group.rotation.order = 'YXZ';

    // ---- the body: a low angular wedge, panels over a visible frame
    const belly = box(1.15, 0.16, 2.4, FRAME); belly.position.y = 0.52;
    const deck = box(1.25, 0.14, 1.5, PANEL); deck.position.set(0, 0.66, 0.15);
    const noseTop = box(1.1, 0.1, 0.7, PANEL);
    noseTop.position.set(0, 0.62, 1.15); noseTop.rotation.x = 0.18; // the wedge
    const noseTip = box(1.0, 0.22, 0.18, RUST); noseTip.position.set(0, 0.5, 1.42);
    const stripe = box(1.26, 0.05, 1.5, RUST); stripe.position.set(0, 0.74, 0.15);

    // open cockpit: seat + console + a slim roll hoop
    const seat = box(0.5, 0.08, 0.5, FRAME); seat.position.set(0, 0.74, -0.1);
    const back = box(0.5, 0.44, 0.08, FRAME); back.position.set(0, 0.98, -0.36);
    const console_ = box(0.5, 0.16, 0.1, FRAME);
    console_.position.set(0, 0.86, 0.5); console_.rotation.x = -0.4;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 10, Math.PI),
      mat(FRAME));
    hoop.position.set(0, 1.02, -0.42);

    // the sensor mast: front-right, camera head + lidar puck (the LTV cue)
    const mast = box(0.05, 0.75, 0.05, FRAME); mast.position.set(0.48, 1.05, 0.95);
    const camHead = box(0.16, 0.1, 0.1, PANEL); camHead.position.set(0.48, 1.46, 0.95);
    const camEye = box(0.05, 0.05, 0.02, 0x1a1a1a); camEye.position.set(0.48, 1.46, 1.01);
    const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 8), mat(CELL));
    lidar.position.set(0.48, 1.55, 0.95);

    // the rear solar deck, tilted like it means it
    const solar = box(1.1, 0.03, 0.8, CELL);
    solar.position.set(0, 0.82, -0.95); solar.rotation.x = -0.22;
    const solarRim = box(1.16, 0.05, 0.86, FRAME);
    solarRim.position.set(0, 0.80, -0.95); solarRim.rotation.x = -0.22;

    // ---- wheels: LARGE open-mesh drums with spokes, on wishbone arms —
    // order FL, FR, RL, RR to match the physics' s.susp array, and each
    // pivot's y rides its spring travel every frame (rocks kick wheels)
    const rimGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.42, 12);
    rimGeo.rotateZ(Math.PI / 2);
    this.wheels = [];
    this.steerPivots = [];
    this.pivots = [];
    for (const [x, z, front] of [[-TRACK, WHEELBASE_F, true], [TRACK, WHEELBASE_F, true],
      [-TRACK, -WHEELBASE_R, false], [TRACK, -WHEELBASE_R, false]]) {
      const wheel = new THREE.Group();
      const drum = new THREE.Mesh(rimGeo, new THREE.MeshPhongMaterial({
        color: TYRE, shininess: 4,
        transparent: true, opacity: 0.92,
      }));
      wheel.add(drum);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.38, 8), mat(RUST));
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      for (let sp = 0; sp < 3; sp++) { // open-mesh spokes
        const spoke = box(0.05, WHEEL_R * 1.9, 0.05, FRAME);
        spoke.rotation.x = (sp / 3) * Math.PI;
        wheel.add(spoke);
      }
      const pivot = new THREE.Group();
      pivot.position.set(x, WHEEL_R, z);
      pivot.add(wheel);
      // the wishbone arm reaching in to the belly (the LTV suspension cue)
      const armLen = Math.abs(x) - 0.45;
      const arm = box(armLen, 0.07, 0.1, FRAME);
      arm.position.set(-Math.sign(x) * armLen / 2, 0.08, 0);
      arm.rotation.z = Math.sign(x) * 0.28;
      pivot.add(arm);
      this.wheels.push(wheel);
      this.pivots.push(pivot);
      if (front) this.steerPivots.push(pivot);
      this.group.add(pivot);
    }

    // ---- lights: a full-width LED bar + twin driving spots, automatic
    this.lampL = new THREE.SpotLight(0xffe9c8, 0, 70, Math.PI / 7, 0.5, 1.2);
    this.lampR = this.lampL.clone();
    this.lampL.position.set(-0.4, 0.62, 1.45);
    this.lampR.position.set(0.4, 0.62, 1.45);
    this.lampTarget = new THREE.Object3D();
    this.lampTarget.position.set(0, 0.2, 16);
    this.lampL.target = this.lampTarget;
    this.lampR.target = this.lampTarget;
    this.barMat = new THREE.MeshPhongMaterial({ color: 0xfff2d0, emissive: 0x000000 });
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.04), this.barMat);
    lightBar.position.set(0, 0.58, 1.52);

    this.group.add(belly, deck, noseTop, noseTip, stripe, seat, back, console_,
      hoop, mast, camHead, camEye, lidar, solar, solarRim,
      this.lampL, this.lampR, this.lampTarget, lightBar);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);
    this.finish = createBuggyFinish(this, {seat, back});
    this.finish.setEnabled(true);
  }

  setLamps(on) {
    this.lampL.intensity = this.lampR.intensity = on ? 46 : 0;
    this.barMat.emissive.setHex(on ? 0xffe9b0 : 0x000000);
  }

  // place + pose from the dynamics state each frame. The body's attitude
  // IS the sprung chassis now — s.pitch/s.roll carry terrain, brake dive,
  // squat and cornering lean in one honest number — and each wheel drops
  // or tucks with its own spring (s.susp), so rocks visibly kick wheels.
  // puffs is the shared fine-dust PuffCloud: roostertails and landing
  // thumps spawn into it — nothing hangs forever.
  update(dt, s, flags, puffs = null) {
    this.group.position.set(s.x, s.y, s.z);
    this.group.rotation.set(s.pitch, s.heading, s.roll);

    for (const p of this.steerPivots) p.rotation.y = s.steer;
    for (let i = 0; i < 4; i++) {
      const susp = s.susp ? s.susp[i] : SUSP_STATIC;
      this.pivots[i].position.y = WHEEL_R + (susp - SUSP_STATIC);
      this.wheels[i].rotation.x = s.wheelSpin;
    }

    if (puffs) {
      const sin = Math.sin(s.heading), cos = Math.cos(s.heading);
      // roostertails: a fine, numerous spray off the rear wheels while the
      // rear skids — kicked back along the wake, arcing, then settling
      if (flags.skidR && Math.abs(s.u) > 2) {
        for (let n = 0; n < 14; n++) {
          const side = (n % 2 === 0 ? -TRACK : TRACK) * (0.8 + hash2(n, this.seed | 0) * 0.3);
          const j = this.seed = ((this.seed || 0) + 1) % 4096;
          const kick = 1.5 + hash2(j, 11) * 3.5;
          puffs.spawn(
            s.x + side * cos - WHEELBASE * sin,
            s.y + 0.15 + hash2(j, 13) * 0.2,
            s.z - side * sin - WHEELBASE * cos,
            sin * kick * 0.7 + (hash2(j, 3) - 0.5) * 2.2,
            0.8 + hash2(j, 5) * 1.5,
            cos * kick * 0.7 + (hash2(j, 7) - 0.5) * 2.2,
          );
        }
      }
      // a landing thump blooms a ring of dust at all four wheels
      if (flags.landed) {
        for (let n = 0; n < 26; n++) {
          const j = this.seed = ((this.seed || 0) + 1) % 4096;
          const a = hash2(j, 17) * Math.PI * 2;
          const rr = 0.8 + hash2(j, 19) * 1.2;
          puffs.spawn(
            s.x + Math.cos(a) * rr, s.y + 0.12, s.z + Math.sin(a) * rr,
            Math.cos(a) * (1 + hash2(j, 23) * 2), 0.6 + hash2(j, 29) * 1.2,
            Math.sin(a) * (1 + hash2(j, 23) * 2),
          );
        }
      }
    }
  }
}
