// The refinery on screen — THREE layer for base machines. Every station
// has its own honest silhouette (James's rule: no blocky shite): the
// smelter is a kiln, the mill a drum on stands, the assembler a ring
// gantry, the array a tilted dark PV face on a mast, the battery a rack
// of cells, the landing pad a sintered apron with edge lights. Smooth
// lathe/cylinder work throughout; glows where the queues cook. Zero
// assets; one ghost previews placement in build mode.

import * as THREE from 'three';
import { MACHINE_TYPES } from './machines.js';
import { machineFittings } from './industry-fittings.js';

const FRAME = 0x3a3430, STEEL = 0x9aa2ab, FROST = 0xb8cfd8;
const RUST = 0xc45a2e, TEAL = 0x3fd0c9, PV = 0x18222e, PAD = 0x64432a;

function mat(color, extra = {}) {
  return new THREE.MeshPhongMaterial({ color, shininess: 14, ...extra });
}
function cyl(rT, rB, h, seg, colour, extra) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat(colour, extra));
}
function lit(color) {
  return new THREE.MeshBasicMaterial({ color, fog: false });
}

// the smelter: a rounded kiln — body, dome, chimney, and a mouth that
// glows while the queue cooks
function buildSmelter() {
  const g = new THREE.Group();
  const body = cyl(0.78, 0.92, 1.15, 20, FRAME); body.position.y = 0.58;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(FRAME));
  dome.position.y = 1.15;
  const collar = cyl(0.95, 1.0, 0.28, 20, STEEL); collar.position.y = 0.2;
  const chimney = cyl(0.13, 0.2, 1.5, 12, STEEL);
  chimney.position.set(0.45, 1.9, -0.3);
  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.1, 14, 1, false, 0, Math.PI), lit(0xff7a30));
  mouth.rotation.z = Math.PI / 2; mouth.rotation.y = Math.PI / 2;
  mouth.position.set(0, 0.5, 0.82);
  g.add(body, dome, collar, chimney, mouth);
  g.userData.glow = mouth;
  return g;
}

function buildElectrolyser() {
  const g = new THREE.Group();
  const tank = cyl(0.55, 0.55, 1.7, 18, FROST);
  tank.rotation.z = Math.PI / 2;
  tank.position.y = 0.85;
  for (const s of [-0.55, 0.55]) {
    const cradle = cyl(0.09, 0.12, 0.85, 10, FRAME);
    cradle.position.set(s, 0.42, 0.3);
    const cradle2 = cyl(0.09, 0.12, 0.85, 10, FRAME);
    cradle2.position.set(s, 0.42, -0.3);
    g.add(cradle, cradle2);
  }
  const dome1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 10), mat(FROST));
  dome1.position.set(0.85, 0.85, 0); dome1.scale.x = 0.6;
  const dome2 = dome1.clone(); dome2.position.x = -0.85;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lit(0x7fd1c9));
  glow.position.set(0, 1.0, 0.58);
  g.add(tank, dome1, dome2, glow);
  g.userData.glow = glow;
  return g;
}

// the mill: a horizontal drum on A-stands, feed cone above, drive at one
// end — the drum face glows while it turns steel to parts
function buildMill() {
  const g = new THREE.Group();
  const drum = cyl(0.5, 0.5, 1.6, 20, STEEL);
  drum.rotation.z = Math.PI / 2; drum.position.y = 0.85;
  const drive = cyl(0.34, 0.38, 0.5, 16, FRAME);
  drive.rotation.z = Math.PI / 2; drive.position.set(1.0, 0.85, 0);
  const feed = cyl(0.42, 0.12, 0.6, 14, FRAME);
  feed.position.set(-0.35, 1.55, 0);
  for (const sx of [-0.7, 0.7]) {
    for (const sz of [-0.3, 0.3]) {
      const leg = cyl(0.05, 0.07, 0.85, 8, FRAME);
      leg.position.set(sx, 0.42, sz);
      leg.rotation.x = sz * 0.35;
      g.add(leg);
    }
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), lit(0xffa050));
  glow.position.set(-1.16, 0.85, 0); glow.rotation.y = -Math.PI / 2;
  g.add(drum, drive, feed, glow);
  g.userData.glow = glow;
  return g;
}

// the assembler: a ring gantry over a low bed — the ring's inner face
// glows while it works
function buildAssembler() {
  const g = new THREE.Group();
  const bed = cyl(0.85, 0.95, 0.22, 22, FRAME); bed.position.y = 0.11;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.09, 12, 26), mat(STEEL));
  ring.position.y = 1.05;
  const arm = cyl(0.05, 0.05, 0.7, 10, FRAME);
  arm.position.set(0, 1.05, 0); arm.rotation.x = Math.PI / 2.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat(RUST));
  head.position.set(0, 0.78, 0.3);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.02, 8, 26), lit(TEAL));
  glow.position.y = 1.05;
  g.add(bed, ring, arm, head, glow);
  g.userData.glow = glow;
  return g;
}

// the solar array: the founding loop's product — a dark thin-film face
// tilted at the sun on a lathe mast, cable dropping to the dirt
function buildSolarArray() {
  const g = new THREE.Group();
  const mast = cyl(0.06, 0.09, 1.1, 10, STEEL); mast.position.y = 0.55;
  const bracket = cyl(0.05, 0.05, 0.4, 8, FRAME);
  bracket.position.y = 1.15; bracket.rotation.x = -0.6;
  const face = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 1.5),
    mat(PV, { shininess: 90, specular: 0x3a5a80 }));
  face.position.y = 1.28; face.rotation.x = -0.6;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.03, 1.56), mat(STEEL));
  rim.position.y = 1.265; rim.rotation.x = -0.6;
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.1, 0.9, 0.1), new THREE.Vector3(0.35, 0.3, 0.3),
      new THREE.Vector3(0.6, 0.02, 0.5),
    ]), 8, 0.02, 6), mat(0x2e2a26));
  g.add(mast, bracket, rim, face, cable);
  return g;
}

// the battery bank: four capsule cells racked on a sled, teal charge eye
function buildBattery() {
  const g = new THREE.Group();
  const sled = cyl(0.75, 0.85, 0.14, 18, FRAME); sled.position.y = 0.07;
  for (let i = 0; i < 4; i++) {
    const cell = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.75, 6, 12), mat(STEEL));
    cell.rotation.z = Math.PI / 2;
    cell.position.set(0, 0.3 + Math.floor(i / 2) * 0.36, (i % 2 - 0.5) * 0.4);
    g.add(cell);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), lit(TEAL));
  eye.position.set(0.5, 0.75, 0);
  g.add(sled, eye);
  return g;
}

// (buildPad died with the landing-pad machine, 2026-07-20 — every
// landing is exact now; old saves launder their pads away)

const BUILDERS = {
  smelter: buildSmelter,
  electrolyser: buildElectrolyser,
  mill: buildMill,
  assembler: buildAssembler,
  'solar-array': buildSolarArray,
  battery: buildBattery,
};

export class MachineLayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = []; // parallel to the machines array

    this.ghostMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.38, depthWrite: false,
    });
    this.ghostType = null;
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
      machineFittings(mesh,m.type);
      mesh.position.set(m.x, groundAt(m.x, m.z), m.z);
      mesh.rotation.y = m.heading;
      mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
  }

  // the working glow: lit while the queue cooks, breathing slightly —
  // stations without a queue (arrays, banks, pads) carry no glow
  update(machines, t) {
    for (let i = 0; i < this.meshes.length; i++) {
      const glow = this.meshes[i].userData.glow;
      if (!glow) continue;
      const busy = machines[i] && machines[i].queue.length > 0
        && !machines[i].exposure?.secured && (machines[i].exposure?.dust ?? 0) < .6;
      glow.visible = !!busy;
      if (busy) glow.scale.setScalar(0.9 + 0.15 * Math.sin(t * 5 + i));
    }
  }

  // the ghost previews the TYPE's real silhouette, tinted go/no-go
  showGhost(x, groundY, z, ok, type = null) {
    if (x === null) { this.ghost.visible = false; return; }
    if (type !== this.ghostType) {
      this.ghostType = type;
      this.ghost.removeFromParent();
      this.ghost = (BUILDERS[type] || buildSmelter)();
      this.ghost.traverse((o) => {
        if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; }
      });
      this.scene.add(this.ghost);
    }
    this.ghost.position.set(x, groundY, z);
    this.ghostMat.color.setHex(ok ? 0x7fd18a : 0xd1685a);
    this.ghost.visible = true;
  }
}
