import * as THREE from 'three';
import { WorkerSpider } from './workerspider.js';
import {leafGeometry,foliageMaterial} from './habitat-plants.js';

import { RESCUE_SITE } from './habitat-activities.js';
export { RESCUE_SITE };

// Own only these local meshes; WorkerSpider maintains its own shared resources.
function kit(parent) {
  const group = new THREE.Group(); parent.add(group);
  const geometries = new Set(), materials = new Set();
  const material = (color, roughness = .7, metalness = .25) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m); return m;
  };
  const mesh = (geometry, mat, x = 0, y = 0, z = 0, host = group) => {
    geometries.add(geometry); const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; host.add(m); return m;
  };
  const box = (w, h, d, mat, x, y, z, host) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, host);
  const cylinder = (r, h, mat, x, y, z, host) => mesh(new THREE.CylinderGeometry(r, r, h, 40), mat, x, y, z, host);
  const ring = (r, tube, mat, x, y, z, host) => {
    const m = mesh(new THREE.TorusGeometry(r, tube, 8, 48), mat, x, y, z, host); m.rotation.x = Math.PI / 2; return m;
  };
  return { group, material, mesh, box, cylinder, ring, dispose() {
    group.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  } };
}

export function createRescueSite(scene, ground) {
  const k = kit(scene), { group } = k;
  group.name = 'recoverable-worker-service-hatch';
  group.position.set(RESCUE_SITE.x, ground(RESCUE_SITE.x, RESCUE_SITE.z), RESCUE_SITE.z);
  const shell = k.material(0xada68f, .68, .45), steel = k.material(0x343c3c, .52, .75);
  const copper = k.material(0x9f694b, .6, .6), rock = k.material(0x725445, .99, 0);
  const dark = k.material(0x070b0b, 1, 0);
  // An elevated pressure collar hides the uncut terrain beneath this portal.
  k.cylinder(1.4, .32, steel, 0, .16, 0);
  k.cylinder(1.18, .015, dark, 0, .327, 0);
  k.ring(1.31, .105, shell, 0, .4, 0);
  k.ring(1.18, .033, copper, 0, .41, 0);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, .43, -1.23); group.add(lidPivot);
  k.cylinder(1.2, .1, shell, 0, 0, 1.23, lidPivot);
  k.ring(.98, .025, steel, 0, .06, 1.23, lidPivot);
  for (const x of [-.42, .42]) {
    k.box(.055, .13, .4, copper, x, .11, 1.23, lidPivot);
    k.box(.08, .3, .1, steel, x, .39, .81);
  }
  for (let i = 0; i < 3; i++) k.box(.9, .055, .075, shell, 0, .34 + i * .13, .81);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    k.box(.12, .14, .2, copper, Math.sin(a) * 1.32, .4, Math.cos(a) * 1.32).rotation.y = a;
  }
  const debris = new THREE.Group(); group.add(debris);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399, r = .22 + (i % 3) * .29;
    const g = new THREE.DodecahedronGeometry(.24 + (i % 4) * .06, 1);
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const s = .86 + .14 * Math.sin(p.getX(j) * 21 + p.getZ(j) * 17 + i);
      p.setXYZ(j, p.getX(j) * s, p.getY(j) * .6 * s, p.getZ(j) * s);
    }
    g.computeVertexNormals(); k.mesh(g, rock, Math.sin(a) * r, .61, Math.cos(a) * r, debris);
  }
  const worker = new WorkerSpider({ variant: 'dig', scale: 1, seed: 37 }); group.add(worker.group);
  return { group, worker, update(t, state) {
    const deployed = state.worker === 'deployed';
    worker.group.visible = state.worker === 'stranded' || deployed;
    worker.group.position.set(deployed ? 1.18 : 2, deployed ? .49 : .01, deployed ? 0 : 1);
    worker.group.rotation.set(0, deployed ? -Math.PI / 2 : -.5, deployed ? 0 : -.19);
    worker.update(t, { working: deployed && !state.routeOpen, reducedMotion: state.reducedMotion });
    lidPivot.rotation.x = state.routeOpen ? -1.28 : 0;
    debris.visible = !state.routeOpen;
    debris.scale.y = 1 - Math.min(1, (state.routeProgress || 0) / 12) * .65;
  }, dispose() { worker.dispose(); k.dispose(); } };
}

export function createActivityProps(scene, layout, state = {}) {
  const k = kit(scene), { group } = k, bay = layout.rooms.find(r => r.piece === 'bay' && (!state.benchRoom || r.key === state.benchRoom));
  const garden = layout.rooms.find(r => r.piece === 'garden' && (!state.cropRoom || r.key === state.cropRoom));
  group.name = 'habitat-working-objects';
  const steel = k.material(0x566261, .5, .65), copper = k.material(0xa67650, .6, .5);
  const soil = k.material(0x302c21, 1, 0), green = k.material(0x49783c, .85, 0);
  green.side = THREE.DoubleSide;
  const red = k.material(0xbf4d31, .72, 0), cream = k.material(0xbcb49a, .83, .1);
  const foliage=foliageMaterial();
  const benchGroup = new THREE.Group(), cropGroup = new THREE.Group(); group.add(benchGroup, cropGroup);
  let worker = null, probe = null, plant = null, fruits = null;
  const targets = { bench: null, crop: null };
  if (bay) {
    targets.bench = { x: bay.x - .35, y: bay.y, z: -1.4, roomKey: bay.key, depth: bay.depth };
    benchGroup.position.set(bay.x - .35, bay.y + 1.08, -2.65);
    k.box(.86, .025, .72, cream, 0, .014, 0, benchGroup);
    worker = new WorkerSpider({ variant: 'dig', scale: .85, seed: 37 }); benchGroup.add(worker.group);
    worker.group.position.y = .035;
    // A real articulated diagnostic arm sits beside the worker, not a floating icon.
    k.cylinder(.11, .035, steel, -.48, .018, -.22, benchGroup);
    k.box(.045, .38, .045, copper, -.48, .22, -.22, benchGroup);
    probe = new THREE.Group(); probe.position.set(-.48, .4, -.22); benchGroup.add(probe);
    k.box(.34, .035, .035, steel, .15, 0, 0, probe);
    k.cylinder(.045, .09, copper, .31, -.04, 0, probe);
  }
  if (garden) {
    targets.crop = { x: garden.x + .65, y: garden.y, z: 1.25, roomKey: garden.key, depth: garden.depth };
    cropGroup.position.set(garden.x + .65, garden.y + .85, 2.26);
    k.box(.62, .07, .52, steel, 0, -.1, 0, cropGroup);
    for (const x of [-.25, .25]) k.box(.035, .83, .035, steel, x, -.43, 0, cropGroup);
    k.mesh(new THREE.CylinderGeometry(.24, .18, .22, 24), cream, 0, .01, 0, cropGroup);
    k.cylinder(.218, .015, soil, 0, .124, 0, cropGroup);
    plant = new THREE.Group(); plant.position.y = .13; cropGroup.add(plant);
    k.cylinder(.012, .62, green, 0, .31, 0, plant);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399, y = .12 + i * .049;
      const leaf = k.mesh(leafGeometry(.23+i%3*.025,.045,.38,.12,0x416532), foliage, 0, y, 0, plant);
      leaf.rotation.set(-.2+i%3*.17, a, .2 * Math.sin(a));
    }
    fruits = new THREE.Group(); plant.add(fruits);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.399;
      const x=Math.sin(a)*.11,y=.22+i*.064,z=Math.cos(a)*.11;
      const fruit=k.mesh(new THREE.SphereGeometry(.045+i%2*.007,18,12),red,x,y,z,fruits);fruit.scale.y=.85;
      for(let j=0;j<5;j++){const sepal=k.mesh(leafGeometry(.032,.008,.1,0,0x36552c),foliage,x,y+.041,z,fruits);sepal.rotation.y=j*Math.PI*2/5;}
    }
  }
  return { group, targets, update(t, state, depth) {
    benchGroup.visible = !!bay && bay.depth === depth;
    cropGroup.visible = !!garden && garden.depth === depth;
    if (worker) {
      worker.group.visible = ['bench', 'diagnosed', 'repaired'].includes(state.worker);
      worker.toolPivot.visible = false;
      worker.update(t, { reducedMotion: state.reducedMotion });
      worker.group.rotation.z = state.worker === 'bench' ? -.12 : 0;
      probe.rotation.z = state.worker === 'diagnosed' ? -.25 : .18;
    }
    if (plant) {
      const crop = state.crop || {}, phase = crop.phase;
      plant.visible = ['planted', 'watered', 'growing', 'ready'].includes(phase);
      const ripe = phase === 'ready';
      plant.scale.setScalar(ripe ? 1 : phase === 'planted' ? .28 : .55 + Math.min(1, (crop.growth || 0) / 60) * .4);
      fruits.visible = ripe;
    }
  }, dispose() { worker?.dispose(); foliage.dispose(); k.dispose(); } };
}
