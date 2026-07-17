// The rover-buggy on screen — designed after the real article: NASA's LTV
// class of unpressurised crew rover (four large wheels, passive
// spring-damped suspension on visible wishbone arms, a sensor mast with a
// camera head, a rear solar deck, one open seat). Family facet look, zero
// assets. The rear wheels roostertail dust from the SAME skid flag the
// physics raises, and the body sits on the terrain via the four
// wheel-contact heights main.js samples (no floating on slopes).

import * as THREE from 'three';
import { hash2 } from './noise.js';
import { speckTexture } from './dustlayer.js';

const PANEL = 0xd8cec0;   // dust-white body panels
const RUST = 0xb34a2a;    // the family rust accent
const FRAME = 0x3a3430;   // structure, arms, mast
const TYRE = 0x2c2620;    // mesh wheels
const CELL = 0x232a33;    // solar deck — the cool tech accent (colour law)

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 8 });
}
function box(w, h, d, colour) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
}

export const TRACK = 0.95;      // half-width to wheel centres
export const WHEELBASE = 1.05;  // half-length to axle centres
const WHEEL_R = 0.5;

const ROOST = 240;

export class BuggyLayer {
  constructor(scene) {
    this.group = new THREE.Group();

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

    // ---- wheels: LARGE open-mesh drums with spokes, on wishbone arms
    const rimGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.36, 10);
    rimGeo.rotateZ(Math.PI / 2);
    this.wheels = [];
    this.steerPivots = [];
    for (const [x, z, front] of [[-TRACK, WHEELBASE, true], [TRACK, WHEELBASE, true],
      [-TRACK, -WHEELBASE, false], [TRACK, -WHEELBASE, false]]) {
      const wheel = new THREE.Group();
      const drum = new THREE.Mesh(rimGeo, new THREE.MeshPhongMaterial({
        color: TYRE, flatShading: true, shininess: 4,
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

    // roostertails (unchanged): dust off the rear wheels when the rear skids
    const rpos = new Float32Array(ROOST * 2 * 3);
    this.roostAge = new Float32Array(ROOST * 2).fill(9);
    this.roostVel = new Float32Array(ROOST * 2 * 3);
    this.roostGeo = new THREE.BufferGeometry();
    this.roostGeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    this.roostMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.66, 0.44, 0.28), size: 0.14, map: speckTexture(),
      transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false,
    });
    this.roost = new THREE.Points(this.roostGeo, this.roostMat);
    this.roost.frustumCulled = false;
    scene.add(this.roost);
    this.roostNext = 0;
  }

  setLamps(on) {
    this.lampL.intensity = this.lampR.intensity = on ? 46 : 0;
    this.barMat.emissive.setHex(on ? 0xffe9b0 : 0x000000);
  }

  // place + pose from the dynamics state each frame. groundPitch/groundRoll
  // come from the four wheel-contact heights (main.js samples them) so the
  // body RIDES the slope instead of hovering flat over it.
  update(dt, s, flags, groundY, groundPitch = 0, groundRoll = 0) {
    this.group.position.set(s.x, s.y, s.z);
    this.group.rotation.set(0, s.heading, 0);
    if (flags.airborne) {
      // in the air the flip axes own the attitude
      this.group.rotation.x = s.pitch;
      this.group.rotation.z = s.roll;
    } else {
      // on the ground: terrain attitude + a body lean under drive/corner
      this.group.rotation.x = groundPitch + s.pitch - s.u * 0.002;
      this.group.rotation.z = groundRoll + s.roll + s.r * Math.min(1, Math.abs(s.u) / 6) * 0.06;
    }

    for (const p of this.steerPivots) p.rotation.y = s.steer;
    for (const w of this.wheels) w.rotation.x = s.wheelSpin;

    const spawn = (flags.skidR && Math.abs(s.u) > 2) || flags.landed;
    const sin = Math.sin(s.heading), cos = Math.cos(s.heading);
    if (spawn) {
      for (let n = 0; n < 6; n++) {
        const i = this.roostNext = (this.roostNext + 1) % (ROOST * 2);
        const side = i % 2 === 0 ? -TRACK : TRACK;
        const k = i * 3;
        const p = this.roostGeo.attributes.position.array;
        p[k] = s.x + side * cos - WHEELBASE * sin;
        p[k + 1] = s.y + 0.2;
        p[k + 2] = s.z - side * sin - WHEELBASE * cos;
        const kick = 2 + hash2(i, Math.floor(s.wheelSpin * 7)) * 3;
        this.roostVel[k] = -sin * -kick * 0.6 + (hash2(i, 3) - 0.5) * 2;
        this.roostVel[k + 1] = 1.2 + hash2(i, 5) * 1.6;
        this.roostVel[k + 2] = -cos * -kick * 0.6 + (hash2(i, 7) - 0.5) * 2;
        this.roostAge[i] = 0;
      }
    }
    const p = this.roostGeo.attributes.position.array;
    for (let i = 0; i < ROOST * 2; i++) {
      if (this.roostAge[i] > 2.2) continue;
      this.roostAge[i] += dt;
      const k = i * 3;
      this.roostVel[k + 1] -= 3.72 * dt * 0.5;
      p[k] += this.roostVel[k] * dt;
      p[k + 1] = Math.max(groundY + 0.05, p[k + 1] + this.roostVel[k + 1] * dt);
      p[k + 2] += this.roostVel[k + 2] * dt;
    }
    this.roostGeo.attributes.position.needsUpdate = true;
  }
}
