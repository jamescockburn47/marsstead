// The crown — the Burrow's surface presence: the shaft head the ring caps,
// the drones working the cut, the spoil heap that grows as the warren
// deepens. The home itself is never walked (STRUCTURE.md doctrine 1); this
// is what it shows the sky — and it must read as a LIVED settlement at a
// glance (HANDOFF: glow, wear, cables, dust banks): the worked apron of
// trampled ground, light-pipe heads burning warm after dark (the buried
// lantern in the plain), sagging cable runs, drift banked on the lee side.
// Smooth-shaded procedural per the amended invariant; no particles anywhere.

import * as THREE from 'three';
import { FBM_GLSL } from './glsl.js';

function mat(color, extra = {}) {
  return new THREE.MeshPhongMaterial({ color, shininess: 12, ...extra });
}

// prevailing wind on the surface layers (matches the terrain's ripple set)
const WIND = new THREE.Vector2(0.879, 0.477);

export class CrownLayer {
  constructor(scene, x, z, groundHeight) {
    this.group = new THREE.Group();
    const y = groundHeight(x, z);
    this.group.position.set(x, y, z);
    scene.add(this.group);

    // THE WEAR: the worked apron — trampled, machine-stained ground
    // around the collar. A ground-conformed sheet MULTIPLIED over the
    // framebuffer (unlit, fog-free): whatever the terrain wears beneath
    // is the same dirt, worked darker — never a decal of other dirt.
    // Fragment 1.0 at the rim so the multiply vanishes with no edge.
    const apronGeo = new THREE.PlaneGeometry(13, 13, 22, 22);
    apronGeo.rotateX(-Math.PI / 2);
    {
      const p = apronGeo.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vz = p.getZ(i);
        p.setY(i, groundHeight(x + vx, z + vz) - y + 0.04); // hug the dirt
      }
    }
    const apron = new THREE.Mesh(apronGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, blending: THREE.MultiplyBlending,
      premultipliedAlpha: true, depthWrite: false, fog: false,
    }));
    apron.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vApron;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvApron = position.xz;'); // sheet metres
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vApron;
${FBM_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float r = length(vApron) / 6.2;
  float tread = fbm(vApron * 1.9) * 0.55 + fbm(vApron * 6.3 + 4.1) * 0.45;
  // darkest where the work is: full stain at the collar easing to nothing
  float stain = (1.0 - smoothstep(0.22, 1.0, min(r, 1.0))) * (0.45 + tread * 0.55);
  diffuseColor.rgb = vec3(1.0 - stain * 0.34);
}`);
    };
    apron.renderOrder = 1;
    this.group.add(apron);

    // the shaft collar: a low ring of sintered regolith with a hatch plate
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.55, 24), mat(0x6b4226));
    collar.position.y = 0.28;
    this.hatch = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.16, 24), mat(0x8a8f96, { shininess: 45 }));
    this.hatch.position.y = 0.62;
    // the ring seat — half-sunk into the collar so it reads as a seated
    // rim, not a floating bar; turns gold once the salvaged ring is in
    this.ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.09, 10, 28), mat(0x3a3d42, { shininess: 55 }));
    this.ringMesh.rotation.x = Math.PI / 2;
    this.ringMesh.position.y = 0.58;
    // a marker mast with a warm beacon (fog:false — lights carry, the
    // family rule: a ship's lantern outlives her hull in the haze)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), mat(0x9aa0a6));
    mast.position.set(2.3, 1.3, 0);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8c46a, fog: false }));
    this.beacon.position.set(2.3, 2.65, 0);

    // THE GLOW: light-pipe heads — squat glass domes ringing the collar,
    // the warren's day brought below and, after dark, its life leaking
    // back up: the crown is a buried lantern in the plain. Emissive rides
    // dug rooms and the night (update()); off cold until there is a home.
    this.pipes = [];
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + 0.42;
      const head = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 12), mat(0x7d5a3a));
      stem.position.y = 0.17;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshPhongMaterial({
          color: 0xcfd6d2, shininess: 90,
          emissive: 0xffb45e, emissiveIntensity: 0,
        }),
      );
      dome.position.y = 0.34;
      head.add(stem, dome);
      head.position.set(Math.cos(a) * 2.75, 0, Math.sin(a) * 2.75);
      this.pipes.push(dome);
      this.group.add(head);
    }
    // one warm point light shared by the crown: the lantern itself.
    // Cheap (no shadows), zero until the warren lives.
    this.lantern = new THREE.PointLight(0xffb45e, 0, 9, 2);
    this.lantern.position.set(0, 0.9, 0);
    this.group.add(this.lantern);

    // THE CABLES: sagging runs from the collar out to the mast and to a
    // junction box — catenary-ish curves, the wiring a real yard grows
    const junction = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.22), mat(0x50565e, { shininess: 30 }));
    junction.position.set(-1.9, 0.21, 2.1);
    junction.rotation.y = 0.7;
    this.group.add(junction);
    const cableMat = mat(0x2e2a26, { shininess: 20 });
    const sag = (a, b, drop) => {
      const m = a.clone().add(b).multiplyScalar(0.5);
      m.y = Math.min(a.y, b.y) * 0.4 + drop;
      return new THREE.CatmullRomCurve3([a, m, b]);
    };
    const runs = [
      sag(new THREE.Vector3(0.9, 0.5, 1.15), new THREE.Vector3(-1.85, 0.38, 2.0), 0.10),
      sag(new THREE.Vector3(1.35, 0.45, -0.6), new THREE.Vector3(2.28, 0.5, 0), 0.08),
      sag(new THREE.Vector3(-1.75, 0.34, 2.16), new THREE.Vector3(-2.5, 0.05, -0.7), 0.05),
    ];
    for (const c of runs) {
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.022, 6), cableMat));
    }

    // THE DUST BANKS: drift wedged against the collar's lee side — the
    // wind writes its direction into the yard (squashed smooth cones,
    // dusty-bright: settled fines, not worked ground)
    const windA = Math.atan2(WIND.y, WIND.x);
    for (const [along, side, s] of [[2.4, 0.5, 1.0], [3.1, -0.7, 0.7], [2.0, -0.2, 0.55]]) {
      const bank = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 12), mat(0x9c6a3e));
      bank.position.set(
        Math.cos(windA) * along - Math.sin(windA) * side,
        0.05,
        Math.sin(windA) * along + Math.cos(windA) * side,
      );
      bank.scale.set(1.1 * s, 0.28 * s, 0.55 * s);
      bank.rotation.y = -windA;
      this.group.add(bank);
    }

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
    this.group.traverse((o) => { if (o.isMesh && o !== apron) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // digging: the hands cluster AT the hatch and dip INTO the work — heads
  // down over the cut, not orbiting above it; idle: they perch out on the
  // apron. The heap tracks dug cells; the ring seat turns gold when the
  // ring goes in; after dark the light-pipes burn with the warren's life.
  update(t, digging, dugCells, ringInstalled, night) {
    this.drones.forEach((d, i) => {
      if (digging) {
        const a = t * 0.25 + i * 2.1;         // slow shuffle around the cut
        const dip = Math.max(0, Math.sin(t * 2.3 + i * 1.7)); // work strokes
        d.position.set(Math.cos(a) * 1.05, 0.72 - dip * 0.28, Math.sin(a) * 1.05);
        d.rotation.y = -a - Math.PI / 2;
        d.rotation.x = 0.35 + dip * 0.25;     // nose down into the work
      } else {
        const a = t * 0.12 + i * 2.1;
        d.position.set(Math.cos(a) * 2.2, 0.55, Math.sin(a) * 2.2);
        d.rotation.y = -a - Math.PI / 2;
        d.rotation.x = 0;
      }
    });
    const s = Math.min(2.2, 0.001 + dugCells * 0.16);
    this.heap.scale.set(s, s * 0.75, s);
    this.heap.position.y = (s * 0.75) / 2;
    this.ringMesh.material.color.setHex(ringInstalled ? 0xc9a35a : 0x3a3d42);
    this.beacon.material.color.setHex(night ? 0xffd98a : 0xe8c46a);
    // the buried lantern: rooms below push warm light up the pipes — only
    // once the ring holds a home, and only against the dark
    const life = ringInstalled ? Math.min(1, dugCells / 6) : 0;
    const burn = night ? life : life * 0.12;   // daylight swallows it
    for (const dome of this.pipes) dome.material.emissiveIntensity = burn * 1.6;
    this.lantern.intensity = burn * 2.4;
  }
}
