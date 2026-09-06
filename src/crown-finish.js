import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Applied to the existing buried shaft head, in CrownLayer's local coordinates.
// These are shallow engineering fittings, not another building or a new hatch.
export function createCrownFinish() {
  const group = new THREE.Group();
  group.name = 'Crown pressure fittings';
  const material = (color, shininess, specular = 0x34312c) =>
    new THREE.MeshPhongMaterial({ color, shininess, specular });
  const finishes = {
    iron: material(0x414548, 25),
    enamel: material(0xafa899, 20),
    rust: material(0x79604c, 9),
    rubber: material(0x242626, 3, 0x0a0a09),
    steel: material(0x969996, 65),
  };
  const batches = Object.fromEntries(Object.keys(finishes).map(key => [key, []]));
  const transform = new THREE.Object3D();
  let components = 0;
  function add(geometry, finish, x, y, z, rx = 0, ry = 0, rz = 0) {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.updateMatrix();
    let baked = geometry;
    if (geometry.index) { baked = geometry.toNonIndexed(); geometry.dispose(); }
    baked.applyMatrix4(transform.matrix);
    batches[finish].push(baked);
    components++;
  }
  const block = (w, h, d, finish, x, y, z, yaw = 0) =>
    add(new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * .16), finish, x, y, z, 0, yaw);
  const ring = (r, tube, finish, y) =>
    add(new THREE.TorusGeometry(r, tube, 6, 80), finish, 0, y, 0, Math.PI / 2);
  const bolt = (x, y, z) => {
    add(new THREE.CylinderGeometry(.033, .033, .014, 6), 'steel', x, y, z);
    add(new THREE.CylinderGeometry(.012, .012, .002, 6), 'rubber', x, y + .0075, z);
  };

  // Concentric gasket and retaining lip sit on, and inside, the original plate.
  ring(1.305, .012, 'rubber', .704);
  ring(1.267, .012, 'steel', .704);
  ring(1.38, .018, 'rubber', .617);

  // Thin inspection-panel joints; the original grey pressure plate stays visible.
  block(1.64, .006, .013, 'rubber', 0, .704, -.40);
  block(.013, .006, 1.0, 'rubber', -.82, .704, .1);
  block(.013, .006, 1.0, 'rubber', .82, .704, .1);
  block(1.64, .006, .013, 'rubber', 0, .704, .60);
  for (const x of [-.75, .75]) for (const z of [-.33, .53]) bolt(x, .713, z);

  // Ten independently seated dogs bridge the plate and its buried collar.
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10 + .12;
    const x = Math.sin(a), z = Math.cos(a);
    block(.22, .055, .34, 'rust', x * 1.48, .582, z * 1.48, a);
    block(.145, .045, .30, 'iron', x * 1.43, .71, z * 1.43, a);
    block(.105, .026, .19, 'enamel', x * 1.43, .743, z * 1.43, a);
    // Pivot is inboard of the bolted foot and leaves the central walk area clear.
    bolt(x * 1.52, .765, z * 1.52);
    block(.085, .105, .10, 'iron', x * 1.57, .652, z * 1.57, a);
  }

  // Recess-like black pockets make the two low lifting grips visually legible.
  for (const x of [-.52, .52]) {
    block(.15, .007, .40, 'rubber', x, .705, .02);
    for (const z of [-.12, .16]) block(.105, .057, .055, 'steel', x, .733, z);
    block(.06, .045, .32, 'steel', x, .772, .02);
  }

  // A protected hinge on the back edge; compact enough to retain the low crown.
  for (const x of [-.26, .26]) {
    block(.15, .10, .26, 'iron', x, .68, -1.24);
    add(new THREE.CylinderGeometry(.065, .065, .21, 12), 'steel', x, .743, -1.24, 0, 0, Math.PI / 2);
    block(.18, .028, .24, 'enamel', x, .812, -1.24);
  }

  // Collar cable penetrations have strain relief, not glowing decorative sockets.
  for (const [x, z, a] of [[1.51, -.63, 1.97], [.97, 1.30, .64]]) {
    block(.17, .16, .13, 'iron', x, .36, z, a);
    for (let n = 0; n < 4; n++) {
      const r = .065 + n * .025;
      add(new THREE.TorusGeometry(.044, .01, 5, 10), 'rubber',
        x + Math.sin(a) * r, .36, z + Math.cos(a) * r, 0, a);
    }
  }

  for (const [finish, pieces] of Object.entries(batches)) {
    const geometry = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, finishes[finish]);
    mesh.name = `Crown ${finish}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.components = components;
  group.userData.drawCalls = group.children.length;
  return group;
}
