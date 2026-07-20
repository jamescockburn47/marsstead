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
      // a squat body on splayed legs, a dish that stopped turning
      box(1.5, 0.55, 1.5, M.foil, 0, 0.75, 0);
      box(1.2, 0.16, 1.2, M.panel, 0, 1.1, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        cyl(0.05, 0.07, 0.9, M.worn, Math.cos(a) * 0.95, 0.42, Math.sin(a) * 0.95,
          Math.cos(a) * 0.55);
        cyl(0.18, 0.2, 0.06, M.rust, Math.cos(a) * 1.25, 0.05, Math.sin(a) * 1.25);
      }
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8,
        0, Math.PI * 2, 0, Math.PI * 0.4), M.worn);
      dish.position.set(0.35, 1.45, 0.2);
      dish.rotation.x = Math.PI * 0.9;
      g.add(dish);
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
