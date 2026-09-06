// Fitted dust covers, tension bands and settled regolith. State is supplied by
// the weather model; this layer never secures equipment or changes performance.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const hash = text => [...String(text)].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const shapeFor = target => {
  if (target.kind === 'rover') return { width: .70, depth: .72, bottom: .76, top: 1.25, z: -.15, radius: 1.55 };
  if (target.kind === 'rig') return { width: 1.18, depth: .78, bottom: .72, top: .96, z: .70, radius: 1.65 };
  if (target.type === 'battery') return { width: 1.32, depth: .94, bottom: .27, top: .88, z: 0, radius: 1.10 };
  if (target.type === 'solar-array') return { width: .35, depth: .32, bottom: .50, top: .79, z: .10, radius: 1.42, solar: true };
  // A service hood on the front of larger processing equipment leaves hot
  // exhausts, feed hoppers and rotating machinery exposed and recognisable.
  return { width: .65, depth: .44, bottom: .23, top: .78, z: .74, radius: 1.35 };
};

function canopy(shape) {
  const { width: w, depth: d, bottom, top, z } = shape;
  const positions = [], indices = [];
  const cross = [[-.5, bottom], [-.44, top - .06], [0, top], [.44, top - .06], [.5, bottom]];
  for (let row = 0; row < 5; row++) {
    const along = row / 4;
    for (let col = 0; col < cross.length; col++) {
      const [x, y] = cross[col];
      const fold = col > 0 && col < 4 ? .016 * Math.cos(along * Math.PI * 4 + col * .9) : 0;
      positions.push(x * w, y + fold, z + (along - .5) * d);
      if (row < 4 && col < 4) {
        const a = row * 5 + col, b = a + 5;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  if (!shape.solar) return geometry;
  // Securing an array takes it off line: its entire PV face is capped by a
  // thin fitted sheet, following the existing -0.6 rad panel tilt exactly.
  const sheet = new THREE.PlaneGeometry(2.40, 1.60, 12, 8);
  sheet.deleteAttribute('uv');
  const vertices = sheet.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    vertices.setZ(i, .006 * Math.cos(vertices.getX(i) * 13) + .004 * Math.sin(vertices.getY(i) * 17));
  }
  sheet.rotateX(-Math.PI / 2); sheet.rotateX(-.6); sheet.translate(0, 1.322, -.029);
  sheet.computeVertexNormals();
  const merged = mergeGeometries([geometry, sheet], false);
  geometry.dispose(); sheet.dispose();
  return merged;
}

function bindings(shape) {
  const pieces = [], transform = new THREE.Object3D();
  const box = (x, y, z, w, h, d, roll = 0) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    transform.position.set(x, y, z); transform.rotation.set(0, 0, roll); transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix); pieces.push(geometry);
  };
  const { width: w, depth: d, bottom, top, z } = shape;
  for (const side of [-1, 1]) {
    const bandZ = z + side * d * .31;
    box(0, top + .018, bandZ, w * .89, .024, .05);
    for (const end of [-1, 1]) {
      box(end * w * .49, (top + bottom) / 2, bandZ, .025, top - bottom, .05, end * -.08);
      box(end * w * .50, bottom + .08, bandZ, .045, .085, .09);
    }
  }
  if (shape.solar) {
    // Two bands retain the full-face dust cap; mast braces resist the wind.
    for (const x of [-.82, .82]) {
      const geometry = new THREE.BoxGeometry(.05, .023, 1.63);
      geometry.rotateX(-.6); geometry.translate(x, 1.337, -.039); pieces.push(geometry);
    }
    const up = new THREE.Vector3(0, 1, 0);
    for (const side of [-1, 1]) {
      const start = new THREE.Vector3(side * .84, .06, .40);
      const end = new THREE.Vector3(0, 1.07, 0), delta = end.clone().sub(start);
      const geometry = new THREE.CylinderGeometry(.014, .014, delta.length(), 5);
      transform.position.copy(start).add(end).multiplyScalar(.5);
      transform.quaternion.setFromUnitVectors(up, delta.normalize()); transform.updateMatrix();
      geometry.applyMatrix4(transform.matrix); pieces.push(geometry);
      box(start.x, .04, start.z, .20, .08, .15);
    }
  }
  const merged = mergeGeometries(pieces, false); pieces.forEach(piece => piece.dispose());
  return merged;
}

function sediment(radius, seed) {
  const positions = [0, 0, 0], colors = [.55, .32, .19], indices = [];
  const count = 18;
  for (let ring = 1; ring <= 2; ring++) for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    const irregular = .84 + .15 * Math.sin(i * 7.7 + seed % 101);
    const r = radius * (ring === 1 ? .54 : 1) * irregular;
    positions.push(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    const shade = .92 + .10 * Math.sin(i * 3.7 + seed % 17);
    colors.push(.55 * shade, .32 * shade, .19 * shade);
    if (ring === 1) indices.push(0, 1 + (i + 1) % count, 1 + i);
    else {
      const a = 1 + i, b = 1 + (i + 1) % count, c = a + count, d = b + count;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export class WeatherLayer {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'Equipment weather protection';
    this.items = new Map(); scene.add(this.group);
    this.canvas = new THREE.MeshStandardMaterial({ color: 0x8c8874, roughness: .98, side: THREE.DoubleSide });
    this.bands = new THREE.MeshStandardMaterial({ color: 0x474b46, roughness: .86, metalness: .18 });
  }
  create(target) {
    const shape = shapeFor(target), group = new THREE.Group(); group.name = `${target.label || target.id}: weather condition`;
    const cover = new THREE.Mesh(canopy(shape), this.canvas);
    const straps = new THREE.Mesh(bindings(shape), this.bands);
    for (const mesh of [cover, straps]) { mesh.castShadow = true; mesh.receiveShadow = true; }
    const dustMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1,
      transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const dust = new THREE.Mesh(sediment(shape.radius, hash(target.id)), dustMaterial); dust.receiveShadow = true;
    group.add(cover, straps, dust);
    let panel = null;
    if (shape.solar) {
      // This is the existing array face's size, angle and mount height. The
      // tint accumulates directly on its top surface, not in a floating cloud.
      const material = new THREE.MeshStandardMaterial({ color: 0xa0643c, roughness: 1, transparent: true,
        opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const geometry = new THREE.PlaneGeometry(2.27, 1.47);
      geometry.rotateX(-Math.PI / 2); geometry.rotateX(-.6);
      panel = new THREE.Mesh(geometry, material); panel.position.set(0, 1.304, -.017);
      panel.receiveShadow = true; group.add(panel);
    }
    this.group.add(group);
    return { group, cover, straps, dust, panel, shape, signature: `${target.kind}/${target.type}` };
  }
  remove(id) {
    const item = this.items.get(id); if (!item) return;
    item.group.removeFromParent();
    item.group.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    item.dust.material.dispose(); item.panel?.material.dispose(); this.items.delete(id);
  }
  update(targets, groundAt, _t = 0) {
    const retained = new Set();
    for (const target of targets) {
      if (target.kind === 'crew') continue;
      if (!Number.isFinite(target.x) || !Number.isFinite(target.z)) continue;
      retained.add(target.id);
      let item = this.items.get(target.id);
      if (item && item.signature !== `${target.kind}/${target.type}`) { this.remove(target.id); item = null; }
      if (!item) { item = this.create(target); this.items.set(target.id, item); }
      const amount = clamp(target.condition?.dust), secured = target.condition?.secured === true;
      const heading = Number.isFinite(target.heading) ? target.heading : 0, ground = groundAt(target.x, target.z);
      item.group.position.set(target.x, ground, target.z); item.group.rotation.y = heading;
      item.cover.visible = item.straps.visible = secured;
      item.dust.visible = amount > .025; item.dust.material.opacity = Math.min(.90, amount * 1.3);
      if (item.panel) { item.panel.visible = amount > .015; item.panel.material.opacity = amount * .83; }
      // Ground-conform after pose changes; accumulated depth stays centimetres.
      const stamp = [target.x, target.z, heading, ground, Math.round(amount * 50)].join('/');
      if (stamp !== item.stamp) {
        const positions = item.dust.geometry.attributes.position, c = Math.cos(heading), s = Math.sin(heading);
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i), z = positions.getZ(i), r = Math.hypot(x, z) / item.shape.radius;
          const y = groundAt(target.x + x * c + z * s, target.z + z * c - x * s) - ground;
          positions.setY(i, y + .008 + amount * .045 * Math.max(0, 1 - r));
        }
        positions.needsUpdate = true; item.dust.geometry.computeVertexNormals();
        item.dust.geometry.computeBoundingSphere(); item.stamp = stamp;
      }
    }
    for (const id of this.items.keys()) if (!retained.has(id)) this.remove(id);
  }
  dispose() {
    for (const id of this.items.keys()) this.remove(id);
    this.canvas.dispose(); this.bands.dispose(); this.group.removeFromParent();
  }
}
