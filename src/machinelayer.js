// The refinery on screen — THREE layer for base machines. The smelter is
// a furnace block with a chimney whose throat glows while the queue
// cooks; the electrolyser is a frosted tank on cradles. One ghost box
// previews placement in build mode. Family facet look, zero assets.

import * as THREE from 'three';
import { MACHINE_TYPES } from './machines.js';

const FRAME = 0x3a3430, STEEL = 0x9aa2ab, FROST = 0xb8cfd8;

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 10 });
}
function box(w, h, d, colour) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
}

function buildSmelter() {
  const g = new THREE.Group();
  const body = box(1.6, 1.3, 1.2, FRAME); body.position.y = 0.65;
  const jacket = box(1.7, 0.5, 1.3, STEEL); jacket.position.y = 0.5;
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 8), mat(STEEL));
  chimney.position.set(0.5, 1.9, -0.3);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff7a30 }));
  glow.position.set(0, 0.55, 0.62);
  g.add(body, jacket, chimney, glow);
  g.userData.glow = glow;
  return g;
}

function buildElectrolyser() {
  const g = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 10), mat(FROST));
  tank.rotation.z = Math.PI / 2;
  tank.position.y = 0.85;
  for (const s of [-0.55, 0.55]) {
    const cradle = box(0.2, 0.85, 1.0, FRAME);
    cradle.position.set(s, 0.42, 0);
    g.add(cradle);
  }
  const pipe = box(0.1, 0.7, 0.1, STEEL);
  pipe.position.set(0.8, 1.4, 0.2);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x7fd1c9 }));
  glow.position.set(0, 1.0, 0.58);
  g.add(tank, pipe, glow);
  g.userData.glow = glow;
  return g;
}

const BUILDERS = { smelter: buildSmelter, electrolyser: buildElectrolyser };

export class MachineLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = []; // parallel to the machines array

    this.ghostMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.38, depthWrite: false,
    });
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.4), this.ghostMat);
    this.ghost.visible = false;
    scene.add(this.ghost);
  }

  sync(machines, groundAt) {
    while (this.meshes.length > machines.length) {
      this.group.remove(this.meshes.pop());
    }
    for (let i = this.meshes.length; i < machines.length; i++) {
      const m = machines[i];
      const mesh = (BUILDERS[m.type] || buildSmelter)();
      mesh.position.set(m.x, groundAt(m.x, m.z), m.z);
      mesh.rotation.y = m.heading;
      mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
  }

  // the working glow: lit while the queue cooks, breathing slightly
  update(machines, t) {
    for (let i = 0; i < this.meshes.length; i++) {
      const glow = this.meshes[i].userData.glow;
      const busy = machines[i] && machines[i].queue.length > 0;
      glow.visible = !!busy;
      if (busy) glow.scale.setScalar(0.9 + 0.15 * Math.sin(t * 5 + i));
    }
  }

  showGhost(x, groundY, z, ok) {
    if (x === null) { this.ghost.visible = false; return; }
    this.ghost.position.set(x, groundY + 0.8, z);
    this.ghostMat.color.setHex(ok ? 0x7fd18a : 0xd1685a);
    this.ghost.visible = true;
  }
}
