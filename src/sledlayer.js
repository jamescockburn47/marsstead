// The cargo sled on screen — a towed flatbed in the buggy's own
// grammar: frame rails, two fat wheels, a drawbar to the pin, and the
// load itself visible as lashed crates that grow with the manifest.
// Zero assets; the trailer maths (trailer.js) owns the motion.

import * as THREE from 'three';

export class SledLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const mat = (c, m = 0.6) => new THREE.MeshLambertMaterial({ color: c });
    const steel = mat(0x8a8f96);
    const dark = mat(0x3c3a38);
    const rubber = mat(0x24211f);
    const crate = mat(0xb2a894);
    const strap = mat(0xc45a2e);

    // the bed: two rails, three cross-members, a low deck
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 2.6), steel);
    bed.position.y = 0.5;
    this.group.add(bed);
    for (const sx of [-0.78, 0.78]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 2.7), dark);
      rail.position.set(sx, 0.56, 0);
      this.group.add(rail);
    }
    // wheels
    for (const sx of [-0.92, 0.92]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), rubber);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx, 0.34, 0.3);
      this.group.add(w);
    }
    // the drawbar, reaching for the pin (forward is +z toward the tractor)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.4), dark);
    bar.position.set(0, 0.45, 1.95);
    this.group.add(bar);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 12), steel);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(0, 0.45, 2.62);
    this.group.add(eye);

    // the load: three crates that appear as the bed fills
    this.crates = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.7), crate);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.52, 0.1), strap);
      c.add(box, band);
      c.position.set(0, 0.85 + (i > 1 ? 0.5 : 0), i === 1 ? -0.78 : i === 2 ? 0 : 0.62);
      c.visible = false;
      this.crates.push(c);
      this.group.add(c);
    }
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // sled: { x, z, heading }, loadFrac 0..1, groundY at the axle
  update(sled, groundY, loadFrac) {
    this.group.position.set(sled.x, groundY, sled.z);
    this.group.rotation.y = sled.heading;
    this.crates[0].visible = loadFrac > 0.02;
    this.crates[1].visible = loadFrac > 0.4;
    this.crates[2].visible = loadFrac > 0.78;
  }
}
