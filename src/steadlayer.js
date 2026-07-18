// The stead on screen — THREE layer over build.js's pure grammar. Every
// placed part is one flat-shaded mesh on its face; the ghost previews the
// cursor (green places, red refuses); leak markers point at the seams the
// pressure judge names. The grid's world anchor is a single Y (set at the
// first placement): the pure grammar keeps its flat y=0 plane, the layer
// drops skirts from ground-level walls to the real terrain beneath them.

import * as THREE from 'three';
import { CELL, parseFaceKey, faceCentre, PART_TYPES } from './build.js';

const PANEL = 0xcfc5b6, STEEL = 0x9aa2ab, GLASS = 0x9fc4e0, LOCK = 0xb34a2a;
const THICK = 0.14;      // panel thickness, m
const SKIRT_MAX = 0.9;   // how far a wall reaches down to meet the terrain

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 10 });
}

// box dimensions for a face on the given axis (normal direction is thin)
function faceDims(axis) {
  if (axis === 0) return [THICK, CELL, CELL];
  if (axis === 1) return [CELL, THICK, CELL];
  return [CELL, CELL, THICK];
}

export class SteadLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = new Map();   // faceKey -> mesh
    this.baseY = null;         // world Y of the grid's y=0 plane

    // one ghost, retinted and reshaped as the cursor moves
    this.ghostMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.38, depthWrite: false,
    });
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.ghostMat);
    this.ghost.visible = false;
    scene.add(this.ghost);

    // leak markers: small hot beacons on the open faces
    this.leakMat = new THREE.MeshBasicMaterial({
      color: 0xff5a3c, transparent: true, opacity: 0.85, depthWrite: false,
    });
    this.leakMarkers = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), this.leakMat);
      m.visible = false;
      scene.add(m);
      this.leakMarkers.push(m);
    }
  }

  setBase(y) {
    this.baseY = y;
    this.group.position.y = y;
  }

  // world-space centre of a face (needs the base set)
  faceWorld(key) {
    const f = parseFaceKey(key);
    const c = faceCentre(f.x, f.y, f.z, f.axis);
    return { x: c[0], y: c[1] + (this.baseY ?? 0), z: c[2], axis: f.axis, gy: f.y };
  }

  buildMesh(key, type, groundAt) {
    const f = parseFaceKey(key);
    const c = faceCentre(f.x, f.y, f.z, f.axis);
    let [w, h, d] = faceDims(f.axis);
    let yOff = 0;
    // ground-level walls drop a skirt to the terrain under their centre
    if (f.axis !== 1 && f.y === 0 && groundAt) {
      const gap = (this.baseY ?? 0) - groundAt(c[0], c[2]);
      if (gap > 0.02) {
        const skirt = Math.min(SKIRT_MAX, gap);
        h += skirt; yOff = -skirt / 2;
      }
    }
    let mesh;
    if (type === 'window') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshPhongMaterial({
          color: GLASS, flatShading: true, shininess: 60,
          transparent: true, opacity: 0.45,
        }));
    } else if (type === 'airlock') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(LOCK));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 6, 12),
        mat(0xc9974a));
      if (f.axis === 0) ring.rotation.y = Math.PI / 2;
      if (f.axis === 1) ring.rotation.x = Math.PI / 2;
      mesh.add(ring);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        mat(type === 'steel-panel-part' ? STEEL : PANEL));
    }
    mesh.position.set(c[0], c[1] + yOff + (f.axis === 1 ? 0 : CELL / 2), c[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // reconcile meshes with the stead (add-only diffs both ways)
  sync(stead, groundAt) {
    for (const [key, mesh] of this.meshes) {
      if (!stead.parts.has(key)) {
        this.group.remove(mesh);
        this.meshes.delete(key);
      }
    }
    for (const [key, part] of stead.parts) {
      if (!this.meshes.has(key)) {
        const mesh = this.buildMesh(key, part.type, groundAt);
        this.group.add(mesh);
        this.meshes.set(key, mesh);
      }
    }
  }

  // the cursor ghost: null hides it
  showGhost(key, ok, baseY) {
    if (!key) { this.ghost.visible = false; return; }
    const f = parseFaceKey(key);
    const c = faceCentre(f.x, f.y, f.z, f.axis);
    const [w, h, d] = faceDims(f.axis);
    this.ghost.geometry.dispose();
    this.ghost.geometry = new THREE.BoxGeometry(w, h, d);
    this.ghost.position.set(
      c[0], c[1] + baseY + (f.axis === 1 ? 0 : CELL / 2), c[2]);
    this.ghostMat.color.setHex(ok ? 0x7fd18a : 0xd1685a);
    this.ghost.visible = true;
  }

  // point at up to three open faces on the escape path
  showLeaks(keys, baseY, t) {
    for (let i = 0; i < this.leakMarkers.length; i++) {
      const m = this.leakMarkers[i];
      const key = keys[i];
      if (!key) { m.visible = false; continue; }
      const f = parseFaceKey(key);
      const c = faceCentre(f.x, f.y, f.z, f.axis);
      m.position.set(c[0], c[1] + baseY + (f.axis === 1 ? 0.3 : CELL / 2), c[2]);
      m.rotation.y = t;
      m.scale.setScalar(0.85 + 0.25 * Math.sin(t * 4));
      m.visible = true;
    }
  }

  clearLeaks() {
    for (const m of this.leakMarkers) m.visible = false;
  }
}
