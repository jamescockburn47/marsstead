// The rig and the ore on screen — THREE layer. The trailer is a flatbed
// on two wire wheels with the drill folded flat; deployment plants four
// anchor legs and raises the mast. Deposits render as rock clusters in
// the deposit's colour with a low ore mound — landmarks you can read
// from the buggy, which IS the prospecting. Family facet look, no assets.

import * as THREE from 'three';
import { hash2 } from './noise.js';
import { depositsNear, HOPPER_CAP, hopperCount } from './mine.js';

const FRAME = 0x3a3430, DECK = 0x6e5f4c, GOLD = 0xc9974a;
const ORE_COLOURS = {
  'iron-ore': 0x8a3c22,   // rust nodules
  ice: 0xcfe0e8,          // pale ground ice
  silica: 0xd8c9a8,       // light sand
};

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, shininess: 8 });
}
function box(w, h, d, colour) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
}

export class RigLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // flatbed + drawbar
    const deck = box(1.7, 0.16, 2.6, DECK); deck.position.y = 0.62;
    const drawbar = box(0.12, 0.1, 1.6, FRAME);
    drawbar.position.set(0, 0.55, 2.0);
    this.group.add(deck, drawbar);
    // two wire wheels
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), mat(FRAME));
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 0.95, 0.5, -0.3);
      this.group.add(w);
    }
    // the mast: folded flat when travelling, raised when deployed
    this.mast = new THREE.Group();
    const tower = box(0.3, 2.2, 0.3, FRAME); tower.position.y = 1.1;
    const head = box(0.5, 0.4, 0.5, GOLD); head.position.y = 2.3;
    this.mast.add(tower, head);
    this.mast.position.set(0, 0.72, -0.5);
    this.mast.rotation.x = Math.PI / 2 - 0.06; // travelling: lying on the deck
    this.group.add(this.mast);
    // anchor legs, tucked until deployment
    this.legs = [];
    for (let i = 0; i < 4; i++) {
      const leg = box(0.1, 0.9, 0.1, FRAME);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      leg.position.set(Math.cos(a) * 1.0, 0.55, Math.sin(a) * 1.2 - 0.3);
      leg.visible = false;
      this.legs.push(leg);
      this.group.add(leg);
    }
    // hopper fill: one block per unit aboard
    this.load = [];
    for (let i = 0; i < HOPPER_CAP; i++) {
      const b = box(0.34, 0.3, 0.34, 0x8a3c22);
      b.position.set((i % 4 - 1.5) * 0.4, 0.9, Math.floor(i / 4) * 0.45 + 0.2);
      b.visible = false;
      this.load.push(b);
      this.group.add(b);
    }
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // ---- the ore bodies: clusters rebuilt as the walker ranges ------------
    this.oreGroup = new THREE.Group();
    scene.add(this.oreGroup);
    this.oreAnchor = null; // where the current cluster set was built
  }

  // rig pose + deployment dressing
  update(rig, groundY, deployAnim) {
    this.group.position.set(rig.x, groundY, rig.z);
    this.group.rotation.y = rig.heading;
    const up = rig.deployed ? 1 : 0;
    // mast eases upright; legs appear planted
    const target = rig.deployed ? 0 : Math.PI / 2 - 0.06;
    this.mast.rotation.x += (target - this.mast.rotation.x) * Math.min(1, (deployAnim ?? 6) * 0.08);
    for (const leg of this.legs) leg.visible = up === 1;
    const n = hopperCount(rig);
    this.load.forEach((b, i) => { b.visible = i < n; });
  }

  // rebuild the visible ore clusters when the walker has moved far enough
  syncOre(x, z, groundAt) {
    if (this.oreAnchor && Math.hypot(x - this.oreAnchor.x, z - this.oreAnchor.z) < 120) return;
    this.oreAnchor = { x, z };
    this.oreGroup.clear();
    for (const d of depositsNear(x, z, 500)) {
      const colour = ORE_COLOURS[d.type] ?? 0x8a3c22;
      const cluster = new THREE.Group();
      const gy = groundAt(d.x, d.z);
      // a low pan of ore, mostly buried, and a handful of hashed boulders
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 0.9, 9), mat(colour));
      mound.position.y = -0.25;
      cluster.add(mound);
      for (let i = 0; i < 7; i++) {
        const h1 = hash2(d.x + i * 17, d.z + i * 31), h2 = hash2(d.z + i * 13, d.x + i * 7);
        const rock = box(0.5 + h1 * 0.9, 0.4 + h2 * 0.8, 0.5 + h2 * 0.9, colour);
        const a = h1 * Math.PI * 2, r = 1.5 + h2 * 4.5;
        rock.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
        rock.rotation.y = h2 * 2;
        cluster.add(rock);
      }
      cluster.position.set(d.x, gy, d.z);
      cluster.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.oreGroup.add(cluster);
    }
  }
}
