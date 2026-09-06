// The crown — the Burrow's surface presence: the shaft head the ring caps,
// the drones working the cut, the spoil heap that grows as the warren
// deepens. This is what the underground home shows the sky — a settlement at a
// glance (HANDOFF: glow, wear, cables, dust banks): the worked apron of
// trampled ground, light-pipe heads burning warm after dark (the buried
// lantern in the plain), sagging cable runs, drift banked on the lee side.
// Smooth-shaded procedural per the amended invariant; no particles anywhere.

import * as THREE from 'three';
import { FBM_GLSL } from './glsl.js';
import { homeGrowth } from './home-model.js';
import { HomeSurface } from './home-surface.js';
import { WorkerSpider } from './workerspider.js';
import { FlyingDrone } from './flyingdrone.js';
import { droneClass } from './dronefleet.js';
import { flyingJob } from './fleet-job.js';
import { createCrownFinish } from './crown-finish.js';
import { crewMode, crewDock, crewTarget, moveCrew, crewIdentity } from './crew-control.js';

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
    this.finish = createCrownFinish();
    this.group.add(this.finish);
    scene.add(this.group);
    this.homeSurface = new HomeSurface(this.group, (dx,dz) => groundHeight(x+dx,z+dz)-y);

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

    // One deployed fleet: two ground workers for every survey / light-haul flyer.
    this.groundHeight = (dx, dz) => groundHeight(x + dx, z + dz) - y;
    this.workers = Array.from({ length: 24 }, (_, i) => droneClass(i) === 'flying'
      ? new FlyingDrone({ seed: i + 31, variant: i === 2 || Math.floor(i/3)%2?'survey':'cargo', scale: i === 2 || Math.floor(i/3)%2?.82:1.08 })
      : new WorkerSpider({ seed: i + 31, variant: ['dig', 'fabricate', 'repair'][i % 3 === 0 ? Math.floor(i/3)%3 : (Math.floor(i/3)+1)%3] }));
    this.drones = this.workers.map(worker => worker.group);
    this.drones.forEach((drone, i) => {
      drone.userData.droneClass = droneClass(i);
      drone.userData.crewIdentity = crewIdentity(i);
      drone.visible = i < 3; this.group.add(drone);
    });
    // Real work-face dressing at the drilling stations and a receiving pad.
    this.workFaces = this.drones.map((drone, i) => {
      if (drone.userData.droneClass !== 'spider') return null;
      const a = i * 2.39996, r = 3.30 + Math.floor(i / 8) * .8;
      const face = new THREE.Mesh(new THREE.TorusGeometry(.12,.028,8,24), mat(0x39291f));
      face.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
      face.position.y = this.groundHeight(face.position.x,face.position.z) + .018;
      face.rotation.x=Math.PI/2; face.visible = false; this.group.add(face); return face;
    });
    const supplyPad = new THREE.Mesh(new THREE.CylinderGeometry(.85,.92,.14,24),mat(0x545954));
    supplyPad.position.set(5.7,this.groundHeight(5.7,-4.4)+.07,-4.4); this.group.add(supplyPad);
    this.workerUp = new THREE.Vector3(); this.workerForward = new THREE.Vector3();
    this.workerRight = new THREE.Vector3(); this.workerBasis = new THREE.Matrix4();
    this.group.add(collar, this.hatch, this.ringMesh, mast, this.beacon, this.heap);
    this.group.traverse((o) => { if (o.isMesh && o !== apron) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // Digging workers shuttle between the hatch and apron, then brace to work.
  // The heap tracks dug cells; the ring seat turns gold when the
  // ring goes in; after dark the light-pipes burn with the warren's life.
  update(t, digging, dugCells, ringInstalled, night, home = null) {
    const growth = home ? homeGrowth(home.burrow, home.droneCount) : null;
    if (growth) this.homeSurface.update(growth,t,night,home.discovery,home.reducedMotion);
    const now = home?.reducedMotion ? 0 : t;
    const mode = crewMode(home?.opening), controlled = mode !== 'auto';
    const crewDt = Math.max(0, Math.min(.1, t - (this.crewTime ?? t))); this.crewTime = t;
    const working = digging && (mode === 'auto' || mode === 'work');
    this.drones.forEach((d, i) => {
      d.visible = i < (growth?.drones ?? 3);
      if (this.workFaces[i]) this.workFaces[i].visible = d.visible && working;
      if (!d.visible) return;
      if (controlled && !d.userData.crewMode) {
        const dock = crewDock(i); d.position.set(dock.x, this.groundHeight(dock.x, dock.z), dock.z);
      }
      if (mode === 'park' && d.userData.crewMode !== 'park') d.userData.crewPark = { x: d.position.x, z: d.position.z };
      d.userData.crewMode = mode;
      if (controlled && mode !== 'work') {
        const target = crewTarget(mode, i, home?.player, d.userData.crewPark);
        const flight = d.userData.droneClass === 'flying';
        const travel = moveCrew(d.position, target, crewDt, flight ? 2.5 : 1.4);
        d.position.set(travel.x, this.groundHeight(travel.x, travel.z) + (flight ? .8 : 0), travel.z);
        d.userData.workPhase = mode === 'park' ? 'holding' : travel.speed > .02 ? 'following' : 'waiting';
        d.userData.carrying = false;
        if (flight) {
          d.rotation.set(0, travel.heading ?? d.rotation.y, 0);
          this.workers[i].update(now, { carrying: false, reducedMotion: !!home?.reducedMotion });
        } else this.poseGroundWorker(d, i, now, travel.heading ?? d.userData.crewHeading ?? 0,
          travel.speed, false, !!home?.reducedMotion);
        return;
      }
      if (d.userData.droneClass === 'flying') {
        const job = flyingJob(now, i, working, !!home?.reducedMotion);
        d.userData.workPhase = job.phase; d.userData.carrying = job.carrying;
        const travel = controlled ? moveCrew(d.position, job, crewDt, 2.5) : job;
        d.position.set(travel.x, this.groundHeight(travel.x, travel.z) + job.clearance, travel.z);
        d.rotation.set(0, job.heading, job.bank);
        this.workers[i].update(now, { carrying: job.carrying, reducedMotion: !!home?.reducedMotion });
        return;
      }
      const a = i * 2.39996;
      const phase = ((now + i * 3.1) % 24) / 24;
      // Shuttle toward a work face, stop to operate, then return to the apron.
      const travel = phase < .3 ? phase / .3 : phase < .65 ? 1 : phase < .95 ? (1-phase-.05)/.3 : 0;
      const smooth = travel * travel * (3 - 2 * travel);
      const radius = 5.15 + Math.floor(i / 8) * .8 - (working ? smooth * 1.35 : 0);
      const target = { x: Math.cos(a) * radius, z: Math.sin(a) * radius };
      const motion = controlled ? moveCrew(d.position, target, crewDt, 1.4) : null;
      const dx = motion?.x ?? target.x, dz = motion?.z ?? target.z;
      const moving = working && (phase < .3 || (phase >= .65 && phase < .95)) && !home?.reducedMotion;
      const operating = working && phase >= .3 && phase < .65 && (!controlled || Math.hypot(dx-target.x,dz-target.z) < .2);
      d.userData.workPhase = !working ? 'standby' : operating ? 'excavating' : phase < .3 ? 'approaching' : 'returning';
      const speed = moving ? 1.35 * 6 * travel * (1-travel) / 7.2 : 0;
      const heading = -a - Math.PI / 2 + (moving && phase >= .65 ? Math.PI : 0);
      d.position.set(dx, this.groundHeight(dx, dz), dz);
      this.poseGroundWorker(d, i, now, motion?.heading ?? heading, motion?.speed ?? speed,
        operating, !!home?.reducedMotion);
      // Contact patch follows the actual articulated tip, exposing the cut.
      if(operating) {
        const tip=this.workers[i].toolTip.clone().applyQuaternion(d.quaternion).add(d.position);
        this.workFaces[i].position.copy(tip); this.workFaces[i].position.y=this.groundHeight(tip.x,tip.z)+.015;
        this.workFaces[i].scale.setScalar(1+Math.min(1,(phase-.3)/.35)*.4);
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
  poseGroundWorker(drone, index, t, heading, speed, working, reducedMotion) {
    const { x, z } = drone.position, h = .15;
    this.workerUp.set(-(this.groundHeight(x+h,z)-this.groundHeight(x-h,z))/(2*h), 1,
      -(this.groundHeight(x,z+h)-this.groundHeight(x,z-h))/(2*h)).normalize();
    this.workerForward.set(Math.sin(heading), 0, Math.cos(heading));
    this.workerRight.crossVectors(this.workerUp, this.workerForward).normalize();
    this.workerForward.crossVectors(this.workerRight, this.workerUp).normalize();
    this.workerBasis.makeBasis(this.workerRight, this.workerUp, this.workerForward);
    drone.quaternion.setFromRotationMatrix(this.workerBasis); drone.userData.crewHeading = heading;
    this.workers[index].update(t, { moving: speed, working, reducedMotion });
  }
}
