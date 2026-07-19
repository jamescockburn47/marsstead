// The crown — the Burrow's surface presence: the shaft head the ring caps,
// the drones working the cut, the spoil heap that grows as the warren
// deepens. The home itself is never walked (STRUCTURE.md doctrine 1); this
// is what it shows the sky. Smooth-shaded procedural per the amended
// invariant; no particles anywhere.

import * as THREE from 'three';

function mat(color, extra = {}) {
  return new THREE.MeshPhongMaterial({ color, shininess: 12, ...extra });
}

export class CrownLayer {
  constructor(scene, x, z, groundHeight) {
    this.group = new THREE.Group();
    const y = groundHeight(x, z);
    this.group.position.set(x, y, z);
    scene.add(this.group);

    // the shaft collar: a low ring of sintered regolith with a hatch plate
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.55, 24), mat(0x6b4226));
    collar.position.y = 0.28;
    this.hatch = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.16, 24), mat(0x8a8f96, { shininess: 45 }));
    this.hatch.position.y = 0.62;
    // the ring seat — glows gold once the salvaged ring is installed
    this.ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.13, 10, 28), mat(0x3a3d42));
    this.ringMesh.rotation.x = Math.PI / 2;
    this.ringMesh.position.y = 0.72;
    // a marker mast with a warm beacon (fog:false — lights carry, the
    // family rule: a ship's lantern outlives her hull in the haze)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), mat(0x9aa0a6));
    mast.position.set(2.3, 1.3, 0);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8c46a, fog: false }));
    this.beacon.position.set(2.3, 2.65, 0);

    // the spoil heap: a cone that grows with every dug cell
    this.heap = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14), mat(0x7c4a24));
    this.heap.position.set(-2.6, 0, -0.8);
    this.heap.scale.setScalar(0.001);

    // the hands: three drones — squat boxes on downturned rotor arms
    this.drones = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.34), mat(0xd8d2c6));
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02),
        new THREE.MeshBasicMaterial({ color: 0x3fd0c9, fog: false }));
      eye.position.set(0, 0, 0.18);
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.06), mat(0x8a8f96));
        arm.position.set(sx * 0.3, 0.07, 0);
        d.add(arm);
      }
      d.add(body, eye);
      d.position.set(Math.cos(i * 2.1) * 1.2, 1.1, Math.sin(i * 2.1) * 1.2);
      this.drones.push(d);
      this.group.add(d);
    }
    this.group.add(collar, this.hatch, this.ringMesh, mast, this.beacon, this.heap);
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // digging: drones orbit the collar and dip; idle: they perch. The heap
  // tracks dug cells; the ring seat turns gold when the ring goes in.
  update(t, digging, dugCells, ringInstalled, night) {
    this.drones.forEach((d, i) => {
      const a = t * (digging ? 0.9 : 0.12) + i * 2.1;
      const r = digging ? 1.5 : 2.2;
      d.position.set(Math.cos(a) * r,
        digging ? 0.9 + Math.sin(t * 3.1 + i * 1.7) * 0.35 : 0.55,
        Math.sin(a) * r);
      d.rotation.y = -a - Math.PI / 2;
    });
    const s = Math.min(2.2, 0.001 + dugCells * 0.16);
    this.heap.scale.set(s, s * 0.75, s);
    this.heap.position.y = (s * 0.75) / 2;
    this.ringMesh.material.color.setHex(ringInstalled ? 0xe8c46a : 0x3a3d42);
    this.beacon.material.color.setHex(night ? 0xffd98a : 0xe8c46a);
  }
}
