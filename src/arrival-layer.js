// Mission-installed wayfinding and a fixed maintenance station. Decoration
// carries no salvage, power or interaction state; the playable equipment does.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class ArrivalLayer {
  constructor(scene, groundAt, { home, field }) {
    this.group = new THREE.Group();
    this.group.name = 'Arrival wayfinding and maintenance';
    this.anchors = [];
    const finishes = {
      metal: new THREE.MeshStandardMaterial({ color: 0x656b69, roughness: .66, metalness: .55 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x333b3b, roughness: .87, metalness: .15 }),
      shell: new THREE.MeshStandardMaterial({ color: 0xb7b1a0, roughness: .76, metalness: .18 }),
      paint: new THREE.MeshStandardMaterial({ color: 0xa87d45, roughness: .9 }),
      reflector: new THREE.MeshStandardMaterial({ color: 0xd9b574, emissive: 0xb27e3a,
        emissiveIntensity: .28, roughness: .56, metalness: .12 }),
    };
    this.materials = Object.values(finishes);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
    const transform = new THREE.Object3D();
    const clusters = [];
    let batches, componentCount = 0;
    const cluster = name => {
      const group = new THREE.Group(); group.name = name;
      batches = new Map(); clusters.push({ group, batches }); this.group.add(group);
    };
    // Ground sheets follow the drawn height at every vertex. Rigid pieces are
    // seated at their own anchor, rather than the crown's distant root height.
    const put = (source, finish, x, y, z, scale, rotation = [0, 0, 0], conform = false) => {
      transform.position.set(x, y + (conform ? 0 : groundAt(x, z)), z);
      transform.rotation.set(...rotation); transform.scale.set(...scale); transform.updateMatrix();
      const geometry = source.index ? source.toNonIndexed() : source.clone();
      geometry.applyMatrix4(transform.matrix);
      if (conform) {
        const p = geometry.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + groundAt(p.getX(i), p.getZ(i)));
        geometry.computeVertexNormals();
      }
      if (!batches.has(finish)) batches.set(finish, []);
      batches.get(finish).push(geometry); componentCount++;
    };
    const block = (finish, x, y, z, w, h, d, yaw = 0) =>
      put(box, finish, x, y, z, [w, h, d], [0, yaw, 0]);
    const anchor = (kind, x, z, height) => this.anchors.push({ kind, x, z, y: groundAt(x, z), height });
    const post = (kind, x, z, height, yaw) => {
      anchor(kind, x, z, height);
      // Buried stake with a narrow abrasion sleeve and passive amber reflector.
      put(cylinder, 'dark', x, .025, z, [.115, .05, .115]);
      block('metal', x, height * .5, z, .055, height, .055, yaw);
      block('shell', x, height - .11, z, .115, .24, .10, yaw);
      block('reflector', x, height - .10, z, .121, .095, .107, yaw);
      block('dark', x, height + .023, z, .14, .026, .12, yaw);
    };
    const paintStrip = (x, z, length, yaw, width = .075) => {
      const sheet = new THREE.PlaneGeometry(width, length, 1, Math.max(1, Math.ceil(length / .22)));
      sheet.rotateX(-Math.PI / 2);
      put(sheet, 'paint', x, .018, z, [1, 1, 1], [0, yaw, 0], true);
      sheet.dispose();
    };
    const groundArrow = (x, z, heading, size) => {
      const fx = Math.sin(heading), fz = Math.cos(heading), rx = fz, rz = -fx;
      for (const side of [-1, 1]) {
        // Each sloping bar ends at the forward tip, with open space behind.
        const px = x - fx * size * .22 + rx * side * size * .17;
        const pz = z - fz * size * .22 + rz * side * size * .17;
        paintStrip(px, pz, size * .56, heading - side * .66, .075);
      }
    };

    cluster('Fixed maintenance mat');
    const dock = { x: home.x + 8.6, z: home.z + 1.3 };
    anchor('service mat', dock.x, dock.z, .035);
    const mat = new THREE.PlaneGeometry(2.8, 2.0, 14, 10); mat.rotateX(-Math.PI / 2);
    put(mat, 'dark', dock.x, .010, dock.z, [1, 1, 1], [0, 0, 0], true); mat.dispose();
    // Segmented edge tabs and slat seams leave the terrain visible around it.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) paintStrip(dock.x + side * 1.28, dock.z - .70 + i * .46, .22, 0, .06);
    }
    for (let i = -3; i <= 3; i++) paintStrip(dock.x + i * .32, dock.z, 1.65, 0, .012);
    // Low secured cases, bolted footplates and a stowed tool rail read as one
    // service fixture, not scattered containers promising collectible rewards.
    const railX = dock.x + 1.04;
    for (const dz of [-.66, .66]) {
      block('metal', railX, .045, dock.z + dz, .32, .07, .24);
      block('metal', railX, .23, dock.z + dz, .06, .36, .06);
    }
    block('shell', railX, .43, dock.z, .30, .065, 1.6);
    for (const dz of [-.47, .32]) {
      block('shell', railX, .235, dock.z + dz, .39, .29, .52);
      block('dark', railX, .387, dock.z + dz, .395, .018, .525);
      block('metal', railX - .205, .27, dock.z + dz, .025, .085, .21);
      for (const side of [-1, 1]) block('metal', railX - .205, .23, dock.z + dz + side * .17, .03, .12, .025);
    }
    // Two visibly retained hand tools lie flat on the rack.
    for (const dz of [-.36, .30]) {
      block('metal', railX, .476, dock.z + dz, .055, .035, .34);
      block('dark', railX, .488, dock.z + dz - .10, .073, .05, .12);
      block('metal', railX, .474, dock.z + dz + .16, .19, .045, .055);
      block('shell', railX, .512, dock.z + dz + .02, .12, .014, .045);
    }
    anchor('fixed tool rail', railX, dock.z, .53);

    cluster('Home approach markers');
    const homeLength = Math.hypot(home.x, home.z);
    const hx = home.x / homeLength, hz = home.z / homeLength;
    const homeYaw = Math.atan2(hx, hz);
    // Keep the colony's existing worker apron open: the last stake remains
    // over seven metres from the crown, whose own warm mast finishes the route.
    for (const along of [2.2, 5.4, 8.6]) {
      if (along > homeLength - 7.2) continue;
      const x = hx * along + hz * 1.35, z = hz * along - hx * 1.35;
      post('home marker', x, z, .40, homeYaw);
      groundArrow(hx * along, hz * along, homeYaw, .62);
    }

    const dx = field.x - home.x, dz = field.z - home.z, routeLength = Math.hypot(dx, dz);
    const fx = dx / routeLength, fz = dz / routeLength, heading = Math.atan2(fx, fz);
    // Survey stakes delineate the outgoing route, offset from its clear driving
    // line. Small back-to-back plates remain readable on the return journey.
    for (const [index, fraction] of [.20, .47, .74].entries()) {
      cluster(`Survey route marker ${index + 1}`);
      const cx = home.x + dx * fraction, cz = home.z + dz * fraction;
      const x = cx + fz * 2.5, z = cz - fx * 2.5;
      post('survey marker', x, z, 1.05, heading);
      for (const side of [-1, 1]) {
        const px = x - fx * .065 + fz * side * .095;
        const pz = z - fz * .065 - fx * side * .095;
        put(box, 'shell', px, .84 + side * .01, pz, [.075, .075, .28], [0, heading - side * .67, 0]);
      }
      groundArrow(cx, cz, heading, 1.05);
    }
    box.dispose(); cylinder.dispose();
    for (const { group, batches: piecesByFinish } of clusters) {
      for (const [finish, pieces] of piecesByFinish) {
        const geometry = mergeGeometries(pieces, false);
        pieces.forEach(piece => piece.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, finishes[finish]);
        mesh.name = `${group.name}: ${finish}`;
        mesh.castShadow = finish !== 'paint' && finish !== 'reflector'; mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
    this.group.userData.components = componentCount;
    scene.add(this.group);
  }

  update(game) {
    this.group.visible = !game.inLander && !game.hopFlight;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    this.materials.forEach(material => material.dispose());
    this.group.clear();
  }
}
