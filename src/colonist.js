// The colonist — a readable procedural figure in a pressure suit, built in
// code (invariant 1): boxy suit, glass-gold visor, backpack, headlamp. The
// object of the whole fantasy stays on screen (the third-person rule); the
// pose maths reads physics.strideBob so the low-g bound shows in the body.

import * as THREE from 'three';
import { strideBob } from './physics.js';

export class Colonist {
  constructor(scene) {
    this.group = new THREE.Group();

    const suit = new THREE.MeshLambertMaterial({ color: 0xd8cfc2 }); // dust-white
    const trim = new THREE.MeshLambertMaterial({ color: 0xb34a2a }); // rust trim
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2622 });

    // torso + hips
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.30), suit);
    this.torso.position.y = 1.05;
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.22, 0.27), trim);
    hips.position.y = 0.72;

    // helmet: sphere + gold visor plate
    this.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), suit);
    this.helmet.position.y = 1.52;
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 12, 10, -Math.PI / 3.2, Math.PI / 1.6, Math.PI / 3.4, Math.PI / 2.6),
      new THREE.MeshLambertMaterial({ color: 0xc9974a, emissive: 0x1a0e02 }),
    );
    this.helmet.add(visor);

    // backpack — the life support the whole game is about
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.16), trim);
    pack.position.set(0, 1.10, -0.22);

    // limbs (simple pivoted boxes; the bob sells the gait, not IK)
    const limbGeo = new THREE.BoxGeometry(0.11, 0.5, 0.11);
    this.armL = new THREE.Mesh(limbGeo, suit); this.armL.position.set(-0.31, 1.05, 0);
    this.armR = new THREE.Mesh(limbGeo, suit); this.armR.position.set(0.31, 1.05, 0);
    this.legL = new THREE.Mesh(limbGeo, dark); this.legL.position.set(-0.13, 0.38, 0);
    this.legR = new THREE.Mesh(limbGeo, dark); this.legR.position.set(0.13, 0.38, 0);

    // headlamp — the underground's one light, and dusk's little friend
    this.lamp = new THREE.SpotLight(0xfff2dd, 0, 22, Math.PI / 9, 0.9, 1.6);
    this.lamp.position.set(0, 1.55, 0.1);
    this.lampTarget = new THREE.Object3D();
    this.lampTarget.position.set(0, 1.2, 4);
    this.lamp.target = this.lampTarget;

    for (const m of [this.torso, hips, this.helmet, pack,
      this.armL, this.armR, this.legL, this.legR, this.lamp, this.lampTarget]) {
      this.group.add(m);
    }
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);
    this.phase = 0;
  }

  setLamp(on) { this.lamp.intensity = on ? 14 : 0; }

  // speed (m/s), airborne flag, heading (rad), stride frequency (Hz)
  pose(dt, speed, airborne, heading, hz) {
    this.group.rotation.y = heading;
    if (speed > 0.2 && !airborne) this.phase += dt * hz * Math.PI * 2;

    const sw = airborne ? 0.9 : Math.sin(this.phase) * Math.min(1, speed / 4) * 0.7;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.8;
    this.armR.rotation.x = sw * 0.8;

    // the bound: vertical bob rides physics.strideBob — low g on display
    const bob = airborne ? 0 : Math.abs(Math.sin(this.phase)) * strideBob(speed);
    this.torso.position.y = 1.05 + bob;
    this.helmet.position.y = 1.52 + bob;
    // a forward lean into the lope
    this.torso.rotation.x = Math.min(0.22, speed * 0.03) + (airborne ? -0.12 : 0);
  }
}
