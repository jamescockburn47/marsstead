import * as THREE from 'three';
import { FIELD_SITE } from './fieldwork.js';

// The survey equipment landed with the mission: ceramic, brushed metal and light.
export class FieldLayer {
  constructor(scene, groundAt) {
    this.group = new THREE.Group();
    this.group.position.set(FIELD_SITE.x, groundAt(FIELD_SITE.x, FIELD_SITE.z), FIELD_SITE.z);
    scene.add(this.group);
    const ceramic = new THREE.MeshStandardMaterial({ color: 0xd3c6ae, roughness: 0.68, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x283b40, roughness: 0.45, metalness: 0.6 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xae6d42, roughness: 0.65 });
    this.signal = new THREE.MeshStandardMaterial({ color: 0x87e3d3, emissive: 0x3bb6a3,
      emissiveIntensity: 0.8, roughness: 0.3 });
    const add = (geo, mat, x, y, z, parent = this.group) => {
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z);
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      add(new THREE.CylinderGeometry(0.1, 0.22, 0.85, 12), dark, Math.sin(a) * 1.1, 0.4, Math.cos(a) * 1.1);
    }
    add(new THREE.CylinderGeometry(1.28, 1.48, 0.22, 48), ceramic, 0, 0.85, 0);
    add(new THREE.CylinderGeometry(0.8, 1.05, 0.62, 48), dark, 0, 1.18, 0);
    add(new THREE.CylinderGeometry(0.88, 0.88, 0.12, 48), trim, 0, 1.52, 0);
    add(new THREE.CylinderGeometry(0.1, 0.15, 3.6, 16), ceramic, 0, 2.4, 0);
    this.lens = add(new THREE.SphereGeometry(0.16, 20, 12), this.signal, 0, 4.25, 0);
    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = add(new THREE.TorusGeometry(0.48 + i * 0.08, 0.035, 8, 48),
        i === 1 ? this.signal : ceramic, 0, 3.15, 0);
      ring.rotation.x = i * Math.PI / 3; this.rings.push(ring);
    }
    this.wing = new THREE.Group(); this.group.add(this.wing);
    this.wing.position.set(1.7, 1.55, 0); this.wing.rotation.z = -0.25;
    add(new THREE.BoxGeometry(2.8, 0.1, 1.9), ceramic, 0, 0, 0, this.wing);
    for (let c = 0; c < 6; c++) for (let r = 0; r < 4; r++) {
      add(new THREE.BoxGeometry(0.42, 0.03, 0.42), dark,
        -1.1 + c * 0.44, 0.07, -0.66 + r * 0.44, this.wing);
    }
    this.light = new THREE.PointLight(0x75d9c9, 1.4, 12, 2);
    this.light.position.set(0, 2.1, 0); this.group.add(this.light);
  }
  update(t, state, night, reducedMotion = false) {
    this.wing.visible = !state.claimed;
    for (let i = 0; i < 3; i++) this.rings[i].rotation.y = state.dials[i] * Math.PI / 4;
    this.signal.emissiveIntensity = state.claimed ? 0.25
      : 0.7 + (reducedMotion ? 0 : Math.sin(t * 1.4) * 0.15);
    this.light.intensity = night ? 1.6 : 0;
  }
}
