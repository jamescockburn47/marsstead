// Heritage on screen — the old machines where they truly rest. Three
// small procedural grammars (lander / rover / crash), zero assets,
// aged in the planet's own dust: pale worn alloy, dulled gold foil,
// dark panels that stopped answering decades before landfall. Built
// once at boot at their real world positions; the terrain streams in
// beneath them wherever the settler travels.

import * as THREE from 'three';
import { HERITAGE, heritageXZ } from './heritage.js';
import { meshGroundHeight } from './marschunk.js';
import { hash2 } from './noise.js';

const WORN = 0xb2a894;    // alloy under fifty years of dust
const FOIL = 0xa8894e;    // gold blanket, dulled
const PANEL = 0x2e3438;   // dead solar glass
const RUST = 0x8a5a38;    // dust-caked underside

export class HeritageLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const mat = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    this.mats = {
      worn: mat(WORN), foil: mat(FOIL), panel: mat(PANEL), rust: mat(RUST),
      dark: mat(0x4a4642),
    };
    for (const site of HERITAGE) {
      const { x, z } = heritageXZ(site);
      const g = this.build(site);
      g.position.set(x, meshGroundHeight(x, z), z);
      g.rotation.y = hash2(site.year, site.lat) * Math.PI * 2;
      this.group.add(g);
    }
  }

  build(site) {
    const g = new THREE.Group();
    const M = this.mats;
    const box = (w, h, d, m, x, y, z, ry = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z); b.rotation.y = ry;
      g.add(b); return b;
    };
    const cyl = (r0, r1, h, m, x, y, z, rz = 0) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 10), m);
      c.position.set(x, y, z); c.rotation.z = rz;
      g.add(c); return c;
    };
    if (site.kind === 'lander') {
      // VIKING-CLASS (2026-07-20, James's eye: "barely noticeable" — the
      // money machines deserve their size). The real grammar, readable
      // at fifty metres: hexagonal bus on three splayed legs, the
      // high-gain dish held skyward on its boom, RTG covers on the
      // deck, the meteorology mast, the sampler arm reaching down.
      const bus = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.62, 0.65, 6), M.foil);
      bus.position.y = 1.05;
      g.add(bus);
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.44, 0.12, 6), M.worn);
      deck.position.y = 1.44;
      g.add(deck);
      // RTG wind covers — the two humps that kept Viking warm for years
      box(0.62, 0.34, 0.85, M.worn, 0.62, 1.62, -0.42, 0.52);
      box(0.62, 0.34, 0.85, M.worn, -0.68, 1.62, 0.34, -0.35);
      // three legs, splayed wide, round feet
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        cyl(0.08, 0.11, 1.7, M.metal, Math.cos(a) * 1.95, 0.68, Math.sin(a) * 1.95,
          Math.cos(a) * 0.55);
        cyl(0.09, 0.06, 1.1, M.dark, Math.cos(a) * 1.35, 0.85, Math.sin(a) * 1.35,
          Math.cos(a) * 0.2);
        cyl(0.36, 0.42, 0.12, M.rust, Math.cos(a) * 2.5, 0.07, Math.sin(a) * 2.5);
      }
      // the high-gain dish, held to a sky it stopped hearing decades ago
      cyl(0.055, 0.055, 1.15, M.metal, -0.55, 2.15, 0.35, 0.4);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.82, 18, 12,
        0, Math.PI * 2, 0, Math.PI * 0.42), M.worn);
      dish.position.set(-0.92, 2.85, 0.62);
      dish.rotation.set(Math.PI * 0.82, 0, 0.35);
      g.add(dish);
      // the meteorology mast and the sampler arm, reaching down
      cyl(0.035, 0.045, 1.5, M.metal, 1.15, 2.1, 0.75, -0.5);
      box(0.3, 0.14, 0.1, M.panel, 1.45, 2.75, 1.0, 0.3);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 2.1), M.metal);
      arm.position.set(0.7, 0.85, 1.55);
      arm.rotation.x = 0.55; arm.rotation.y = -0.4;
      g.add(arm);
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), M.rust);
      scoop.position.set(1.05, 0.28, 2.35);
      g.add(scoop);
    } else if (site.kind === 'rover') {
      // a deck on six weary wheels, a mast still watching the horizon
      box(1.7, 0.5, 1.15, M.worn, 0, 0.72, 0);
      box(1.5, 0.1, 1.0, M.panel, 0, 1.02, 0);
      for (const sx of [-0.62, 0.05, 0.62]) {
        for (const sz of [-0.62, 0.62]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12), M.rust);
          w.rotation.x = Math.PI / 2;
          w.position.set(sx, 0.24, sz);
          g.add(w);
        }
      }
      cyl(0.035, 0.045, 0.95, M.worn, -0.55, 1.5, 0.2);
      box(0.26, 0.12, 0.1, M.panel, -0.55, 2.0, 0.2);
    } else {
      // a crash: half-buried shards, a torn ring, a drift of pieces
      for (let i = 0; i < 6; i++) {
        const h = hash2(i, site.year);
        const s = box(0.5 + h * 0.7, 0.1 + h * 0.25, 0.4 + h * 0.5, i % 2 ? M.worn : M.rust,
          (hash2(i, 3) - 0.5) * 5.5, 0.08 + h * 0.1, (hash2(i, 7) - 0.5) * 5.5,
          h * Math.PI);
        s.rotation.z = (h - 0.5) * 0.7;
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 20, Math.PI * 1.3), M.foil);
      ring.rotation.x = -Math.PI / 2 + 0.3;
      ring.position.y = 0.2;
      g.add(ring);
    }
    return g;
  }

  // the ground streams in after boot: re-seat every site on the drawn land
  reseat() {
    for (const child of this.group.children) {
      child.position.y = meshGroundHeight(child.position.x, child.position.z);
    }
  }
}
