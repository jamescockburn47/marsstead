import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Mechanical seams and textile panels follow existing joints, never the IK targets.
export function finishSuit(colonist, parts) {
  const { fabric, shell, accent, metal, rubber, helmet } = parts;
  const buckets = new Map();
  function put(parent, geometry, material, position, rotation = [0, 0, 0]) {
    if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.updateMatrix();
    geometry.applyMatrix4(mesh.matrix);
    if (!buckets.has(parent)) buckets.set(parent, new Map());
    const set = buckets.get(parent);
    if (!set.has(material)) set.set(material, []);
    set.get(material).push(geometry);
  }
  const box = (p, w, h, d, mat, pos, r = .015) =>
    put(p, new RoundedBoxGeometry(w, h, d, 2, r), mat, pos);
  const pipe = (p, points, radius, mat) => put(p,
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v))), 20, radius, 6), mat, [0, 0, 0]);
  const torso = colonist.pelvisRot;
  for (const s of [-1, 1]) {
    // Fabric load straps and small metal strap keepers, not floating armour.
    pipe(torso, [[s * .15, .52, .12], [s * .19, .43, .15], [s * .17, .26, .155], [s * .14, .12, .13]], .014, accent);
    box(torso, .035, .07, .02, metal, [s * .172, .24, .174], .004);
    box(torso, .1, .15, .065, fabric, [s * .115, .12, .157]);
    box(torso, .11, .035, .072, shell, [s * .115, .178, .162], .005);
    // Lower oxygen connections wrap around the pressure torso to its pack.
    pipe(torso, [[s * .135, .245, .19], [s * .235, .18, .19], [s * .27, .12, -.05], [s * .22, .27, -.27]], .018, rubber);
    put(torso, new THREE.CylinderGeometry(.028, .028, .04, 12), metal, [s * .135, .245, .19], [Math.PI / 2, 0, 0]);
    // Helmet cheeks, brow hardware and visible recessed hinge joints.
    box(helmet, .065, .14, .13, shell, [s * .15, -.015, -.018], .025);
    put(helmet, new THREE.CylinderGeometry(.046, .046, .021, 20), rubber, [s * .18, .005, .01], [0, 0, Math.PI / 2]);
    put(helmet, new THREE.CylinderGeometry(.026, .026, .024, 16), metal, [s * .193, .005, .01], [0, 0, Math.PI / 2]);
  }
  box(helmet, .12, .037, .065, rubber, [0, .151, .1], .01);
  box(helmet, .076, .022, .01, shell, [0, .153, .136], .004);
  // Pack radiator slats, replaceable cover, protection rails and latches.
  for (let i = 0; i < 7; i++) box(colonist.pack, .28, .012, .016, rubber, [0, .17 - i * .033, -.103], .003);
  for (const s of [-1, 1]) {
    pipe(colonist.pack, [[s * .17, -.22, -.1], [s * .215, -.2, -.13], [s * .215, .21, -.13], [s * .17, .245, -.09]], .013, metal);
    box(colonist.pack, .027, .055, .02, metal, [s * .12, -.135, -.12], .004);
  }
  for (const [leg, s] of [[colonist.legL, -1], [colonist.legR, 1]]) {
    box(leg.hip, .065, .18, .14, fabric, [s * .123, -.19, 0]);
    box(leg.hip, .075, .04, .145, accent, [s * .126, -.12, 0], .007);
    pipe(leg.hip, [[s * .097, -.07, .04], [s * .12, -.2, .075], [s * .09, -.34, .06]], .0045, shell);
    for (let i = 0; i < 4; i++) box(leg.ankle, .165, .017, .035, rubber, [0, -.091, -.067 + i * .073], .003);
    box(leg.shinPivot, .105, .16, .04, accent, [0, -.17, .092]);
    pipe(leg.shinPivot, [[s * .081, -.06, .06], [s * .087, -.16, .06], [s * .07, -.31, .055]], .0045, shell);
  }
  for (const arm of [colonist.armL, colonist.armR]) {
    box(arm.shoulder, .09, .12, .027, shell, [0, -.1, .077]);
    box(arm.shoulder, .06, .022, .03, accent, [0, -.095, .083], .004);
    // White back of glove, dark palm and independently suggested fingers.
    box(arm.forePivot, .083, .082, .033, fabric, [0, -.328, .036]);
    for (let i = 0; i < 3; i++) box(arm.forePivot, .007, .033, .008, shell, [-.024 + i * .024, -.351, .054], .002);
  }
  colonist.finishGroups = [];
  for (const [parent, set] of buckets) {
    const group = new THREE.Group(); group.name = 'Pressure suit fittings';
    for (const [material, geometries] of set) {
      const merged = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; group.add(mesh);
    }
    parent.add(group); colonist.finishGroups.push(group);
  }
}
