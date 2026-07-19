// Rock scene layer: skins THREE instances onto the pure scatter in
// rocks.js. One InstancedMesh per chunk — the same draw-call budget as
// the terrain itself — carrying every rock in that chunk; the geometry
// is one of a few displaced-icosahedron variants, chosen per chunk, and
// the instance transforms (non-uniform scale, yaw, the outcrops' shared
// tilt) do the rest of the variety. Ring LOD thins the small stuff:
// pebbles live near the boots, boulders and slabs hold the horizon.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rocksInChunk } from './rocks.js';
import { CHUNK } from './marschunk.js';
import { hash2, valueNoise2 } from './noise.js';

const RADIUS = 9;             // match the terrain's kept radius
const BUILDS_PER_FRAME = 6;   // rocks are cheaper than ground
const VARIANTS = 6;

// which kinds a ring tier draws (the LOD): every ring keeps the silhouette
// makers; only the near field pays for gravel
export function kindsForRing(r) {
  if (r <= 3) return null;                              // all kinds
  if (r <= 6) return new Set(['rock', 'boulder', 'slab']);
  return new Set(['boulder', 'slab']);
}

// a rock: an icosahedron, vertices welded, radially displaced by seeded
// value noise, squatted, base flattened — then smooth normals, per the
// amended invariant. Deterministic in (variant) — every client grows the
// same six stones.
function rockGeometry(variant) {
  let geo = new THREE.IcosahedronGeometry(1, 2);
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const bump = valueNoise2(n.x * 2.6 + variant * 43.7, (n.y * 1.7 + n.z) * 2.6 + variant * 11.3);
    const facet = valueNoise2(n.z * 5.1 + variant * 7.9, n.x * 5.1 - variant * 3.1);
    v.multiplyScalar(1 + (bump - 0.5) * 0.72 + (facet - 0.5) * 0.22);
    v.y *= 0.84;                                        // squat
    if (v.y < -0.42) v.y = -0.42 + (v.y + 0.42) * 0.25; // flattish base to bury
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export class RockLayer {
  constructor(scene) {
    this.scene = scene;
    this.geos = Array.from({ length: VARIANTS }, (_, k) => rockGeometry(k));
    this.mat = new THREE.MeshLambertMaterial();
    this.chunks = new Map();   // key -> { mesh, tier }
    this.queue = [];
    this.dummy = new THREE.Object3D();
    this.tint = new THREE.Color();
  }

  key(cx, cz) { return `${cx},${cz}`; }
  tierForRing(r) { return r <= 3 ? 0 : r <= 6 ? 1 : 2; }

  build(cx, cz, r) {
    const keep = kindsForRing(r);
    const all = rocksInChunk(cx, cz);
    const rocks = keep ? all.filter((rk) => keep.has(rk.kind)) : all;
    if (!rocks.length) return null;
    const geo = this.geos[Math.floor(hash2(cx * 389, cz * 397) * VARIANTS)];
    const mesh = new THREE.InstancedMesh(geo, this.mat, rocks.length);
    rocks.forEach((rk, i) => {
      this.dummy.position.set(rk.x, rk.y, rk.z);
      this.dummy.rotation.set(rk.tilt, rk.rot, rk.tilt * 0.6);
      this.dummy.scale.set(rk.sx, rk.sy, rk.sz);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      // basalt runs dark grey-brown to rust-dusted, by the stone's own seed
      this.tint.setRGB(
        0.30 + rk.seed * 0.14,
        0.17 + rk.seed * 0.075,
        0.115 + rk.seed * 0.045,
      );
      mesh.setColorAt(i, this.tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;    // the tight shadow box culls the far ones
    mesh.receiveShadow = true;
    return mesh;
  }

  update(wx, wz) {
    const ccx = Math.floor(wx / CHUNK), ccz = Math.floor(wz / CHUNK);

    for (let r = 0; r <= RADIUS; r++) {
      const tier = this.tierForRing(r);
      for (let cz = ccz - r; cz <= ccz + r; cz++) {
        for (let cx = ccx - r; cx <= ccx + r; cx++) {
          if (Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz)) !== r) continue;
          const k = this.key(cx, cz);
          const have = this.chunks.get(k);
          if (have && have.tier === tier) continue;
          if (this.queue.some((q) => q.k === k)) continue;
          this.queue.push({ k, cx, cz, r, tier });
        }
      }
    }

    this.queue.sort((a, b) => a.r - b.r);
    for (let i = 0; i < BUILDS_PER_FRAME && this.queue.length; i++) {
      const { k, cx, cz, r, tier } = this.queue.shift();
      const prev = this.chunks.get(k);
      if (prev && prev.mesh) { this.scene.remove(prev.mesh); prev.mesh.dispose(); }
      const mesh = this.build(cx, cz, r);
      if (mesh) this.scene.add(mesh);
      this.chunks.set(k, { mesh, tier });
    }

    // dispose out of range (invariant 7); geometry is shared, never freed
    for (const [k, c] of this.chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz)) > RADIUS + 1) {
        if (c.mesh) { this.scene.remove(c.mesh); c.mesh.dispose(); }
        this.chunks.delete(k);
      }
    }
  }

  // the hopper's arc flies over the vista, not the boulder field
  setVisible(v) {
    for (const c of this.chunks.values()) if (c.mesh) c.mesh.visible = v;
  }
}
