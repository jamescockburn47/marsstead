// Track scene layer: instanced stamps over the pure trail store. Two
// InstancedMeshes — bootprints (small pads, offset left/right of the
// walked line) and wheel ruts (paired bars at the buggy's track width).
// Only the marks near the lens are instanced; the STORE is what persists.
// Ground stamps, not geometry: a slight lift + polygon offset keeps them
// off the terrain's depth without ever displacing the walked surface.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRACK } from './buggylayer.js';

const VISIBLE_RADIUS = 170;   // marks instanced around the lens
const MAX_EACH = 2400;        // per kind — newest win
const LIFT = 0.03;

function flatGeo(w, l) {
  const g = new THREE.PlaneGeometry(w, l);
  g.rotateX(-Math.PI / 2);
  return g;
}

export class TrackLayer {
  constructor(scene) {
    this.scene = scene;
    const mat = () => new THREE.MeshLambertMaterial({
      color: 0x3f2113, transparent: true, opacity: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.boots = new THREE.InstancedMesh(flatGeo(0.17, 0.36), mat(), MAX_EACH);
    const rut = flatGeo(0.26, 1.7);
    const ruts = mergeGeometries([
      rut.clone().translate(-TRACK, 0, 0), rut.clone().translate(TRACK, 0, 0),
    ]);
    this.wheels = new THREE.InstancedMesh(ruts, mat(), MAX_EACH);
    for (const m of [this.boots, this.wheels]) {
      m.count = 0;
      m.renderOrder = 1;
      m.frustumCulled = false; // instances span the radius; cheap either way
      scene.add(m);
    }
    this.dummy = new THREE.Object3D();
    this.lastAt = { x: 1e9, z: 1e9 };
    this.lastLen = -1;
  }

  // refresh when the lens has moved or the trail has grown; cheap otherwise
  update(px, pz, trail, groundHeight) {
    const moved = Math.hypot(px - this.lastAt.x, pz - this.lastAt.z);
    if (moved < 12 && trail.pts.length === this.lastLen) return;
    this.lastAt = { x: px, z: pz };
    this.lastLen = trail.pts.length;

    let nb = 0, nw = 0;
    // newest first: the marks that matter most are the ones just made
    for (let i = trail.pts.length - 1; i >= 0 && (nb < MAX_EACH || nw < MAX_EACH); i--) {
      const p = trail.pts[i];
      if (Math.abs(p.x - px) > VISIBLE_RADIUS || Math.abs(p.z - pz) > VISIBLE_RADIUS) continue;
      const mesh = p.k ? this.wheels : this.boots;
      const n = p.k ? nw : nb;
      if (n >= MAX_EACH) continue;
      // boots stand a little off the walked line, alternating; heading
      // convention: forward = (sin hd, cos hd), so perp = (cos hd, -sin hd)
      const off = p.k ? 0 : 0.16 * p.s;
      const x = p.x + Math.cos(p.hd) * off;
      const z = p.z - Math.sin(p.hd) * off;
      this.dummy.position.set(x, groundHeight(x, z) + LIFT, z);
      this.dummy.rotation.set(0, p.hd, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(n, this.dummy.matrix);
      if (p.k) nw++; else nb++;
    }
    this.boots.count = nb;
    this.wheels.count = nw;
    this.boots.instanceMatrix.needsUpdate = true;
    this.wheels.instanceMatrix.needsUpdate = true;
  }
}
