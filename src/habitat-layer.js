// The finished burrow diagram becomes a walkable, furnished pressure shell.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { habitatLayout, HABITAT_HEIGHT, HABITAT_DOOR_HALF } from './habitat-model.js';
import { foliageMaterial } from './habitat-plants.js';
import { textileMaterial } from './habitat-textiles.js';
import { furnishHabitat } from './habitat-furniture.js';
import { underRockMaterial, underMachineMaterial } from './under-material.js';

export class HabitatLayer {
  constructor(scene, burrow) {
    this.scene = scene;
    this.layout = habitatLayout(burrow);
    this.group = new THREE.Group(); this.group.name = 'walkable-habitat';
    this.rooms = new Map(); this.pending = []; this.customGeometries = new Set(); this.materials = this.makeMaterials();
    this.boxGeometry = new RoundedBoxGeometry(1, 1, 1, 1, .035);
    this.cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
    this.sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
    scene.add(this.group);
    const draw = { custom: this.custom.bind(this), box: this.box.bind(this), cylinder: this.cylinder.bind(this), sphere: this.sphere.bind(this) };
    for (const room of this.layout.rooms) {
      this.pending = []; this.shell(room); furnishHabitat(room, draw, this.materials);
      this.batchRoom(room);
    }
    for (const geometry of this.customGeometries) geometry.dispose();
    this.customGeometries.clear();
    this.boxGeometry.dispose(); this.cylinderGeometry.dispose(); this.sphereGeometry.dispose();
    this.ambient = new THREE.HemisphereLight(0xc2d2dd, 0x555344, 1.3);
    this.group.add(this.ambient);
    this.lights = [0, 1, 2].map(() => {
      const light = new THREE.SpotLight(0xffd9a3, 65, 12, 1.24, .8, 2);
      this.group.add(light, light.target); return light;
    });
    // One close ceiling lamp casts furniture shadows; neighbours only fill.
    this.lights[0].castShadow = true;
    this.lights[0].shadow.mapSize.set(1024, 1024);
    this.lights[0].shadow.bias = -.002;
    this.lights[0].shadow.normalBias = .04;
    this.lights[0].shadow.camera.near = .1;
    this.lights[0].shadow.camera.far = 12;
    this.update(0, { position: { x: 0, z: 0 }, depth: 1, sealed: burrow.ringInstalled });
  }

  makeMaterials() {
    const standard = (color, roughness = .7, metalness = .05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const glow = (color, intensity) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });
    return {
      cream: standard(0x9c9e96, .83), floor: standard(0x343e40, .78, .17),
      rock: underRockMaterial(), metal: underMachineMaterial(0x829592),
      bronze: underMachineMaterial(0x746b5c), dark: standard(0x172827, .48, .2),
      linen: textileMaterial(0xc5bca8), teal: textileMaterial(0x527e76), rust: textileMaterial(0xb16b49),
      foliage: foliageMaterial(), stem: standard(0x687443, .95), fruit: standard(0xb54127, .65),
      unripe: standard(0x9f9c42, .87), soil: standard(0x332b23, 1),
      glow: glow(0xf3d6ac, .9), mint: glow(0x9de3cd, 1.3),
    };
  }

  primitive(geometry, x, y, z, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    this.pending.push(mesh); return mesh;
  }
  custom(geometry, x, y, z, material) {
    this.customGeometries.add(geometry); return this.primitive(geometry, x, y, z, 1, 1, 1, material);
  }
  box(x, y, z, w, h, d, mat) { return this.primitive(this.boxGeometry, x, y, z, w, h, d, mat); }
  cylinder(x, y, z, r, h, mat) { return this.primitive(this.cylinderGeometry, x, y, z, r, h, r, mat); }
  sphere(x, y, z, r, mat) { return this.primitive(this.sphereGeometry, x, y, z, r, r, r, mat); }

  shell(room) {
    const x = room.x, y = room.y, h = HABITAT_HEIGHT, m = this.materials;
    const b = (px, py, pz, w, ph, d, mat = m.cream) => this.box(x + px, y + py, pz, w, ph, d, mat);
    b(0, -.13, 0, 8, .25, 8, m.dark);
    for (let col = 0; col < 8; col++) for (let row = 0; row < 8; row++)
      b(-3.5 + col, -.015, -3.5 + row, .972, .055, .972, m.floor);
    b(0, h + .08, 0, 8, .16, 8, m.dark);
    for (const px of [-2.4, 0, 2.4]) for (const pz of [-2.6, 0, 2.6])
      b(px, h-.025, pz, 2.32, .08, 2.52, m.cream);
    for (const side of [-1, 1]) {
      b(0, h / 2, side * 3.94, 8, h, .2, m.rock);
      // Ceramic wainscot over native rock. Seams, sill and floor lighting catch
      // warm light at grazing angles, preserving geological enclosure above.
      for (let panel = 0; panel < 4; panel++) b(-3 + panel * 2, 1.13, side * 3.79, 1.94, 2.1, .12);
      b(0, .14, side * 3.68, 7.8, .13, .14, m.bronze);
      b(0, .29, side * 3.66, 7.5, .035, .025, m.glow);
      b(0, 2.3, side * 3.71, 7.8, .09, .14, m.bronze);
      for (const py of [2.72, 2.98]) {
        const pipe = this.cylinder(x, y + py, side * 3.66, .045, 7.8, m.bronze);
        pipe.rotation.z = Math.PI / 2;
      }
      const connected = side < 0 ? room.left : room.right;
      if (!connected) {
        b(side * 3.94, h / 2, 0, .2, h, 8, m.dark);
        for (const pz of [-2.6, 0, 2.6]) {
          b(side * 3.81, 1.83, pz, .12, 3.42, 2.5);
          b(side * 3.73, 1.05, pz, .03, .045, 2.35, m.bronze);
          for (const py of [.24, 3.37]) for (const dz of [-1.09, 1.09])
            b(side * 3.73, py, pz+dz, .04, .045, .045, m.dark);
        }
        // Recessed utility cabinet makes this a pressure shell, not a blank room.
        b(side * 3.68, 1.9, -.3, .14, 1.2, 1.2, m.bronze);
        b(side * 3.58, 1.9, -.3, .05, 1.08, 1.08, m.dark);
        for (let i = 0; i < 5; i++) b(side * 3.53, 1.65+i*.12, -.43, .026, .035, .65, m.metal);
        b(side * 3.52, 2.26, .04, .028, .08, .06, m.mint);
      }
      else {
        const span = 4 - HABITAT_DOOR_HALF;
        for (const zside of [-1, 1]) {
          b(side * 3.94, h / 2, zside * (HABITAT_DOOR_HALF + span / 2), .2, h, span);
          b(side * 3.77, 1.38, zside * 1.37, .24, 2.76, .13, m.bronze);
          b(side * 3.62, 1.38, zside * 1.4, .03, 2.63, .04, m.glow);
        }
        b(side * 3.94, 3.17, 0, .2, .86, 2.6);
        b(side * 3.77, 2.77, 0, .24, .15, 2.86, m.bronze);
        b(side * 3.62, 2.66, 0, .03, .035, 2.58, m.glow);
        b(side * 3.8, .025, 0, .34, .06, 2.6, m.bronze);
      }
    }
    // Repeating overhead ribs establish scale and connect every room's style.
    for (const px of [-3.6, 0, 3.6]) {
      b(px, 3.45, 0, .12, .22, 7.55, m.bronze);
      for (const pz of [-3.64, 3.64]) b(px, 2.94, pz, .12, 1.02, .15, m.bronze);
    }
    b(0, 3.33, 0, 3.0, .11, .64, m.dark);
    b(0, 3.255, 0, 2.75, .035, .45, m.glow);
    // A pair of guide lanes links actual side doorways, rather than fake exits.
    for (const pz of [-.9, .9]) b(0, .022, pz, 7.7, .014, .035, m.bronze);
  }

  batchRoom(room) {
    const group = new THREE.Group(); group.name = `habitat:${room.key}:${room.piece}`;
    const byMaterial = new Map();
    for (const mesh of this.pending) {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
      byMaterial.get(mesh.material).push(geometry);
    }
    for (const [material, geometries] of byMaterial) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error(`Cannot batch habitat room ${room.key}`);
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = material !== this.materials.glow && material !== this.materials.mint;
      mesh.receiveShadow = true; group.add(mesh);
      for (const geometry of geometries) geometry.dispose();
    }
    this.group.add(group); this.rooms.set(room.key, group); this.pending = [];
  }

  update(_t, { position = { x: 0, z: 0 }, depth = 1, sealed = true } = {}) {
    const nearby = this.layout.rooms.filter(room => room.depth === depth)
      .sort((a, b) => Math.abs(a.x - position.x) - Math.abs(b.x - position.x));
    for (const room of this.layout.rooms) this.rooms.get(room.key).visible = room.depth === depth;
    this.ambient.intensity = sealed ? 1.3 : .25;
    this.lights.forEach((light, index) => {
      const room = index === 2 && nearby[1] ? nearby[1] : nearby[0]; light.visible = !!room;
      if (room) {
        light.position.set(room.x, room.y + 3.02, .15);
        light.target.position.set(room.x, room.y + .4, 0);
        light.color.set(room.piece === 'bunk' ? 0xffd7b2 : 0xdbe7f2);
        light.intensity = sealed ? (room.piece === 'bunk' ? 46 : 65) : 18;
        light.angle = 1.24;
        if (index === 1 || index === 2 && !nearby[1]) {
          if (room.piece === 'garden') {
            const side = index === 1 ? -1 : 1;
            light.position.z = side * 2.75; light.target.position.set(room.x,room.y+1,side*2.75);
            light.intensity = sealed ? 8 : 2;
            light.color.set(0xf1e6cf); light.angle = 1.4;
          } else if (index === 1 && room.piece === 'bunk') {
            light.position.set(room.x+1.9,room.y+1.27,-3.3);
            light.target.position.set(room.x+.5,room.y+.5,-2.65);
            light.color.set(0xffbc79); light.intensity = sealed ? 9 : 0; light.angle=1.5;
          } else {
            // Low indirect spill from the luminaire keeps the pressure lining readable.
            light.position.set(room.x,room.y+3.4,0);
            light.target.position.set(room.x,room.y+3.6,0);
            light.color.set(0xb6cbdb); light.intensity = sealed ? 2.8 : 0; light.angle=1.5;
          }
        }
      }
    });
  }

  dispose() {
    this.group.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    for (const material of Object.values(this.materials)) material.dispose();
    for (const light of this.lights) light.dispose();
    this.group.removeFromParent(); this.rooms.clear();
  }
}
