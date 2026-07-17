// The buggy on screen — a procedural low-poly rover in the family facet
// look: tube chassis, roll cage, four wire wheels (front pair steers, all
// four spin), twin headlights for the night, and roostertails of dust off
// the rear wheels whenever the dynamics module says the rear is skidding —
// the skid is DRAWN from the same flag the physics raises.

import * as THREE from 'three';
import { hash2 } from './noise.js';
import { speckTexture } from './dustlayer.js';

const SUIT = 0xd8cec0, RUST = 0xb34a2a, DARK = 0x3a2e24, TYRE = 0x2c2620;

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 8 });
}
function box(w, h, d, colour) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
}

const ROOST = 240; // dust grains per roostertail cloud

export class BuggyLayer {
  constructor(scene) {
    this.group = new THREE.Group();

    // chassis tub + rust nose
    const tub = box(1.5, 0.28, 2.6, SUIT); tub.position.y = 0.55;
    const nose = box(1.3, 0.2, 0.5, RUST); nose.position.set(0, 0.62, 1.25);
    const tail = box(1.4, 0.34, 0.5, RUST); tail.position.set(0, 0.66, -1.15);

    // the roll cage: the buggy's silhouette (thin boxes as tubes)
    const tube = (x1, y1, z1, x2, y2, z2) => {
      const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
      const t = box(0.06, len, 0.06, DARK);
      t.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      t.lookAt(new THREE.Vector3(x2, y2, z2).add(t.position));
      t.rotateX(Math.PI / 2);
      return t;
    };
    const cage = new THREE.Group();
    cage.add(
      tube(-0.6, 0.7, 0.5, -0.5, 1.5, -0.2), tube(0.6, 0.7, 0.5, 0.5, 1.5, -0.2),
      tube(-0.6, 0.7, -1.0, -0.5, 1.5, -0.2), tube(0.6, 0.7, -1.0, 0.5, 1.5, -0.2),
    );
    const crossbar = box(1.1, 0.07, 0.07, DARK); crossbar.position.set(0, 1.5, -0.2);
    cage.add(crossbar);

    // seat
    const seatBase = box(0.55, 0.1, 0.55, DARK); seatBase.position.set(0, 0.75, -0.15);
    const seatBack = box(0.55, 0.5, 0.1, DARK); seatBack.position.set(0, 1.0, -0.42);

    // wheels: faceted cylinders; front pair pivots to steer
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 9);
    wheelGeo.rotateZ(Math.PI / 2);
    this.wheels = [];
    this.steerPivots = [];
    for (const [x, z, front] of [[-0.85, 1.0, true], [0.85, 1.0, true], [-0.85, -1.0, false], [0.85, -1.0, false]]) {
      const wheel = new THREE.Mesh(wheelGeo, mat(TYRE));
      const hub = box(0.32, 0.16, 0.16, RUST);
      wheel.add(hub);
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.42, z);
      pivot.add(wheel);
      this.wheels.push(wheel);
      if (front) this.steerPivots.push(pivot);
      this.group.add(pivot);
    }

    // headlights: warm cones that earn their keep after dusk
    this.lampL = new THREE.SpotLight(0xffe9c8, 0, 40, Math.PI / 8, 0.6, 1.4);
    this.lampR = this.lampL.clone();
    this.lampL.position.set(-0.5, 0.7, 1.4);
    this.lampR.position.set(0.5, 0.7, 1.4);
    this.lampTarget = new THREE.Object3D();
    this.lampTarget.position.set(0, 0.3, 14);
    this.lampL.target = this.lampTarget;
    this.lampR.target = this.lampTarget;

    this.group.add(tub, nose, tail, cage, seatBase, seatBack,
      this.lampL, this.lampR, this.lampTarget);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);

    // roostertails: one small recycled cloud per rear wheel
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

  setLamps(on) { this.lampL.intensity = this.lampR.intensity = on ? 20 : 0; }

  // place + pose from the dynamics state each frame
  update(dt, s, flags, groundY) {
    this.group.position.set(s.x, s.y, s.z);
    this.group.rotation.set(0, s.heading, 0);
    // a body lean: pitch under drive/brake, roll into the corner
    this.group.rotation.x = -s.u * 0.002 + (flags.airborne ? -0.06 : 0);
    this.group.rotation.z = s.r * Math.min(1, Math.abs(s.u) / 6) * 0.06;

    for (const p of this.steerPivots) p.rotation.y = s.steer;
    for (const w of this.wheels) w.rotation.x = s.wheelSpin;

    // roostertails: spawn grains at the rear wheels while the rear skids
    // (or on a landing thump), kick them back along the wake, let them arc
    const spawn = (flags.skidR && Math.abs(s.u) > 2) || flags.landed;
    const sin = Math.sin(s.heading), cos = Math.cos(s.heading);
    if (spawn) {
      for (let n = 0; n < 6; n++) {
        const i = this.roostNext = (this.roostNext + 1) % (ROOST * 2);
        const side = i % 2 === 0 ? -0.85 : 0.85;
        const k = i * 3;
        const p = this.roostGeo.attributes.position.array;
        p[k] = s.x + side * cos - 1.0 * sin;
        p[k + 1] = s.y + 0.2;
        p[k + 2] = s.z - side * sin - 1.0 * cos;
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
      this.roostVel[k + 1] -= 3.72 * dt * 0.5;   // half-g: fine dust settles slow
      p[k] += this.roostVel[k] * dt;
      p[k + 1] = Math.max(groundY + 0.05, p[k + 1] + this.roostVel[k + 1] * dt);
      p[k + 2] += this.roostVel[k + 2] * dt;
    }
    this.roostGeo.attributes.position.needsUpdate = true;
  }
}
