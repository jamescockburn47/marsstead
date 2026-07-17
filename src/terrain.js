// Terrain scene layer: streams low-poly Mars around the colonist. There is
// NO cheap tile — every chunk in radius builds (the hard-sibling rule), so
// LOD carries the load: near rings at full resolution, far rings coarse,
// skirts hiding the seams. One shared material; geometries are disposed
// when out of range. A chunk whose ring tier changes is rebuilt at the new
// resolution.

import * as THREE from 'three';
import { CHUNK, buildChunkData, resForRing } from './marschunk.js';

const RADIUS = 9;            // chunks kept loaded around the colonist
const BUILDS_PER_FRAME = 3;

export class TerrainLayer {
  constructor(scene) {
    this.scene = scene;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.chunks = new Map();   // key -> { mesh, res }
    this.queue = [];
  }

  key(cx, cz) { return `${cx},${cz}`; }

  update(wx, wz) {
    const ccx = Math.floor(wx / CHUNK), ccz = Math.floor(wz / CHUNK);

    // enqueue missing or wrong-res chunks, nearest ring first
    for (let r = 0; r <= RADIUS; r++) {
      const res = resForRing(r);
      for (let cz = ccz - r; cz <= ccz + r; cz++) {
        for (let cx = ccx - r; cx <= ccx + r; cx++) {
          if (Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz)) !== r) continue;
          const k = this.key(cx, cz);
          const have = this.chunks.get(k);
          if (have && have.res === res) continue;
          if (this.queue.some((q) => q.k === k)) continue;
          this.queue.push({ k, cx, cz, res, r });
        }
      }
    }

    // build a few per frame, nearest first
    this.queue.sort((a, b) => a.r - b.r);
    for (let i = 0; i < BUILDS_PER_FRAME && this.queue.length; i++) {
      const { k, cx, cz, res } = this.queue.shift();
      const prev = this.chunks.get(k);
      if (prev) { this.scene.remove(prev.mesh); prev.mesh.geometry.dispose(); }
      const { pos, col, idx } = buildChunkData(cx, cz, res);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.chunks.set(k, { mesh, res });
    }

    // dispose chunks out of range (invariant 7: geometry never leaks)
    for (const [k, c] of this.chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz)) > RADIUS + 1) {
        this.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        this.chunks.delete(k);
      }
    }
  }
}
