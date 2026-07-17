// The colonist — built on the family's captain rig (saltstead captain.js):
// a readable low-poly figure you look DOWN on, so SILHOUETTE beats detail.
// The captain's tricorn becomes the colonist's oversized helmet dome + the
// chunky life-support pack — unmistakable from any angle, top-down included.
// Flat-shaded Phong (the family facet look), stocky proportions, and — an
// upgrade on the rig — limbs hang from PIVOT groups at hip and shoulder so
// the swing reads as a joint, and the boots stand at y=0 so figure and
// shadow are planted on the ground they walk (no floating, no drift).

import * as THREE from 'three';
import { strideBob } from './physics.js';

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 6 });
}

const SUIT = 0xdfd5c5;   // dust-white shell
const RUST = 0xb34a2a;   // the family rust — bands and pack
const DARK = 0x4a3a2e;   // gloves, boots, joints
const GOLD = 0xc9974a;   // the visor

// a limb whose geometry hangs BELOW the pivot origin
function limb(w, len, colour, d = w) {
  const pivot = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat(colour));
  seg.position.y = -len / 2;
  pivot.add(seg);
  return pivot;
}

export class Colonist {
  constructor(scene) {
    this.group = new THREE.Group();

    // ---- legs: captain-chunky, pivoted at the hips, boots at y = 0
    const HIP = 0.50, LEGLEN = 0.42;
    this.hipL = limb(0.16, LEGLEN, SUIT, 0.18);
    this.hipR = limb(0.16, LEGLEN, SUIT, 0.18);
    this.hipL.position.set(-0.12, HIP, 0);
    this.hipR.position.set(0.12, HIP, 0);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), mat(DARK));
    bootL.position.set(0, -LEGLEN - 0.04, 0.04);
    const bootR = bootL.clone();
    this.hipL.add(bootL); this.hipR.add(bootR);

    // ---- the upper body rides one group so the stride bob moves it whole
    this.upper = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.30), mat(SUIT));
    torso.position.y = 0.22;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.11, 0.31), mat(RUST));
    band.position.y = 0.05;                               // the rust waistband
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.03), mat(DARK));
    chest.position.set(0, 0.34, 0.16);                    // the suit's panel

    // the helmet IS the hat: an oversized faceted dome, gold visor forward
    this.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat(SUIT));
    this.helmet.position.y = 0.64;
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 10, 8, 0, Math.PI),
      new THREE.MeshPhongMaterial({ color: GOLD, flatShading: true, shininess: 30, emissive: 0x1a0e02 }));
    visor.rotation.y = -Math.PI / 2;                      // dome faces +z (forward)
    visor.position.z = 0.045;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.08, 8), mat(DARK));
    collar.position.y = 0.48;
    this.helmet.add(visor);

    // the pack: chunky, rust — the second half of the silhouette
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.44, 0.20), mat(RUST));
    pack.position.set(0, 0.26, -0.26);
    const tankMat = mat(SUIT);
    const tankGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.24, 7);
    const tankL = new THREE.Mesh(tankGeo, tankMat);
    const tankR = new THREE.Mesh(tankGeo, tankMat);
    tankL.position.set(-0.10, 0.53, -0.26);
    tankR.position.set(0.10, 0.53, -0.26);
    const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 4), mat(DARK));
    aerial.position.set(-0.17, 0.70, -0.26);

    // arms: pivots at the shoulders, gloved
    this.shL = limb(0.13, 0.4, SUIT, 0.15);
    this.shR = limb(0.13, 0.4, SUIT, 0.15);
    this.shL.position.set(-0.31, 0.42, 0);
    this.shR.position.set(0.31, 0.42, 0);
    const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.14), mat(DARK));
    gloveL.position.y = -0.44;
    const gloveR = gloveL.clone();
    this.shL.add(gloveL); this.shR.add(gloveR);

    this.upper.add(torso, band, chest, collar, this.helmet, pack, tankL, tankR,
      aerial, this.shL, this.shR);
    this.upper.position.y = HIP; // upper-body space sits on the hips

    // headlamp — the underground's one light, and dusk's little friend
    this.lamp = new THREE.SpotLight(0xfff2dd, 0, 38, Math.PI / 7.5, 0.7, 1.4);
    this.lamp.position.set(0, 0.70, 0.16);
    this.lampTarget = new THREE.Object3D();
    this.lampTarget.position.set(0, 0.20, 5);
    this.lamp.target = this.lampTarget;
    this.upper.add(this.lamp, this.lampTarget);

    this.group.add(this.hipL, this.hipR, this.upper);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);
    this.phase = 0;
  }

  setLamp(on) { this.lamp.intensity = on ? 30 : 0; }

  // speed (m/s), airborne flag, heading (rad), stride frequency (Hz)
  pose(dt, speed, airborne, heading, hz) {
    this.group.rotation.y = heading;
    if (speed > 0.2 && !airborne) this.phase += dt * hz * Math.PI * 2;

    const amp = Math.min(1, speed / 4);
    if (airborne) {
      // the tuck: legs trail, arms lift — a body in flight, not mid-stride
      this.hipL.rotation.x += (0.55 - this.hipL.rotation.x) * 10 * dt;
      this.hipR.rotation.x += (0.35 - this.hipR.rotation.x) * 10 * dt;
      this.shL.rotation.x += (-0.6 - this.shL.rotation.x) * 10 * dt;
      this.shR.rotation.x += (-0.6 - this.shR.rotation.x) * 10 * dt;
    } else {
      const sw = Math.sin(this.phase) * amp * 0.7;
      this.hipL.rotation.x = sw;
      this.hipR.rotation.x = -sw;
      this.shL.rotation.x = -sw * 0.75;
      this.shR.rotation.x = sw * 0.75;
    }

    // the bound: the upper-body bob rides physics.strideBob — 0.38 g on show
    const bob = airborne ? 0.04 : Math.abs(Math.sin(this.phase)) * strideBob(speed);
    this.upper.position.y = 0.50 + bob;
    // a forward lean into the lope
    this.upper.rotation.x = Math.min(0.2, speed * 0.028) + (airborne ? -0.1 : 0);
  }
}
