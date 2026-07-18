// The lander on screen — the descent stage you rode down: an octagonal
// deck on four splayed legs, engine bell beneath, tank cluster and the
// crew hatch with its ring. Family facet look, zero assets. Salvageable
// parts are REAL meshes: as salvage.takenCount rises, the corresponding
// panels/panes/kit boxes disappear — the hull visibly strips to a frame,
// which is the commitment PHASE2.md wants you to feel.

import * as THREE from 'three';
import { LANDER_STOCK, takenCount } from './salvage.js';

const HULL = 0xcfc5b6, RUST = 0xb34a2a, FRAME = 0x3a3430, GOLD = 0xc9974a;
const CELLBLUE = 0x232a33;

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, shininess: 8 });
}
function box(w, h, d, colour) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
}

export class LanderLayer {
  constructor(scene, x, z, groundY) {
    this.group = new THREE.Group();
    this.group.position.set(x, groundY, z);

    // deck: an octagonal slab 2.2 m up, engine bell under it
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 8), mat(FRAME));
    deck.position.y = 2.1;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 0.9, 10), mat(FRAME));
    bell.position.y = 1.2;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.7, 8), mat(HULL));
    body.position.y = 3.2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.9, 0.8, 8), mat(HULL));
    cap.position.y = 4.45;

    // four splayed legs with pad feet
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = box(0.14, 2.9, 0.14, FRAME);
      leg.position.set(Math.cos(a) * 2.6, 1.25, Math.sin(a) * 2.6);
      leg.rotation.z = Math.cos(a) * 0.5;
      leg.rotation.x = -Math.sin(a) * 0.5;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.12, 8), mat(FRAME));
      pad.position.set(Math.cos(a) * 3.3, 0.08, Math.sin(a) * 3.3);
      this.group.add(leg, pad);
    }

    // the ladder down from the hatch side
    for (let r = 0; r < 5; r++) {
      const rung = box(0.5, 0.05, 0.05, FRAME);
      rung.position.set(0, 0.5 + r * 0.45, 2.32);
      this.group.add(rung);
    }

    // the RTG: the fin-cased cylinder slung under the deck — future power
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 8), mat(CELLBLUE));
    rtg.rotation.z = Math.PI / 2;
    rtg.position.set(-1.5, 1.7, -0.8);

    this.group.add(deck, bell, body, cap, rtg);

    // ---- the salvage: real meshes, hidden as they're unbolted ------------
    this.salvageMeshes = {}; // id -> [mesh...] hidden in takenCount order
    const put = (id, mesh) => {
      (this.salvageMeshes[id] ||= []).push(mesh);
      this.group.add(mesh);
    };

    // 10 alloy side panels ringing the body
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.31;
      const p = box(1.15, 1.5, 0.09, HULL);
      p.position.set(Math.cos(a) * 1.98, 3.2, Math.sin(a) * 1.98);
      p.rotation.y = -a + Math.PI / 2;
      put('alloy-panel', p);
    }
    // 2 window panes on the cap
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI * 0.7 + 0.6;
      const w = box(0.5, 0.4, 0.06, GOLD);
      w.position.set(Math.cos(a) * 1.45, 4.35, Math.sin(a) * 1.45);
      w.rotation.y = -a + Math.PI / 2;
      put('window-pane', w);
    }
    // 4 seal-kit boxes clipped round the deck rim
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.9;
      const k = box(0.34, 0.24, 0.24, RUST);
      k.position.set(Math.cos(a) * 2.15, 2.5, Math.sin(a) * 2.15);
      put('seal-kit', k);
    }
    // 3 cable drums under the deck
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), mat(FRAME));
      c.rotation.x = Math.PI / 2;
      c.position.set(-0.8 + i * 0.7, 1.75, 1.3);
      put('cable', c);
    }
    // 2 electronics crates on the deck
    for (let i = 0; i < 2; i++) {
      const e = box(0.4, 0.3, 0.3, CELLBLUE);
      e.position.set(1.2 - i * 2.4, 2.5, -1.2);
      put('electronics', e);
    }
    // THE airlock ring: the hatch surround
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 6, 10), mat(RUST));
    ring.position.set(0, 3.2, 1.95);
    put('airlock-ring', ring);

    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);
  }

  // hide exactly as many meshes of each type as have been taken
  sync(lander) {
    for (const { id } of LANDER_STOCK) {
      const taken = takenCount(lander, id);
      const meshes = this.salvageMeshes[id] || [];
      meshes.forEach((m, i) => { m.visible = i >= taken; });
    }
  }
}
