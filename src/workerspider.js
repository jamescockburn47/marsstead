// A shared articulated worker for the surface and underground work planes.
// Static body geometry is merged by finish; legs are four instanced batches.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { spiderPose } from './spider-rig.js';
import { machineFinish } from './machine-finish.js';

const VARIANTS = ['dig', 'fabricate', 'repair'];
let resources = null, owners = 0;
function createResources() {
  const materials = {
    shell: machineFinish(0xb7b9ac, .58, .2),
    frame: machineFinish(0x3c494d, .5, .52),
    copper: machineFinish(0x8b8171, .47, .6),
    piston: new THREE.MeshStandardMaterial({ color: 0xa9b9b8, roughness: 0.2, metalness: 0.92 }),
    optic: new THREE.MeshStandardMaterial({ color: 0x8fbfbb, emissive: 0x4ba99e,
      emissiveIntensity: 0.45, roughness: 0.24, metalness: 0.2 }),
  };
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  const body = {};
  for (const variant of VARIANTS) {
    const parts = Object.fromEntries(Object.keys(materials).map(k => [k, []]));
    const add = (finish, geometry, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => {
      geometry.scale(sx, sy, sz); geometry.rotateX(rx); geometry.translate(x, y, z);
      parts[finish].push(geometry);
    };
    const box = (finish, x, y, z, sx, sy, sz) => add(finish, new THREE.BoxGeometry(sx, sy, sz), x, y, z);
    // Broad protected centre, separate side cheeks, and visible undercarriage.
    add('frame', sphere.clone(), 0, 0.01, 0, 0.165, 0.078, 0.215);
    add('shell', new THREE.SphereGeometry(1, 24, 12), 0, 0.061, -0.005, 0.15, 0.09, 0.204);
    for (const side of [-1, 1]) {
      add('shell', sphere.clone(), side * 0.133, 0.026, -0.005, 0.04, 0.052, 0.15);
      box('copper', side * 0.075, 0.136, -0.045, 0.009, 0.006, 0.11);
      // Rear heat exchanger, with slots cut by dark gaps between fins.
      for (let i = 0; i < 4; i++) box('piston', side * 0.092, 0.052 + i * 0.013, -0.187, 0.057, 0.005, 0.04);
      box('frame', side * 0.065, 0.047, 0.184, 0.078, 0.043, 0.035);
      box('optic', side * 0.065, 0.047, 0.204, 0.038, 0.009, 0.008);
      box('frame', side * 0.098, -0.043, 0.176, 0.025, 0.027, 0.13);
      box('copper', side * 0.092, -0.052, 0.244, 0.023, 0.028, 0.025);
    }
    // Small calibrated rear status bar and a recessed central camera.
    box('frame', 0, 0.06, -0.207, 0.072, 0.022, 0.018);
    // A recessed service seam and tactile latch distinguish the pressure cover
    // from its load-bearing chassis at normal close working distance.
    box('frame',0,.146,-.02,.014,.008,.21);
    for(const side of [-1,1]) {
      box('piston',side*.11,.11,.08,.025,.02,.047);
      box('frame',side*.15,.022,-.05,.012,.047,.16);
      box('shell',side*.12,.06,.185,.05,.035,.045);
    }
    box('optic', 0, 0.061, -0.218, 0.042, 0.006, 0.004);
    add('frame', cylinder.clone(), 0, 0.025, 0.205, 0.026, 0.035, 0.026, Math.PI / 2);
    add('optic', cylinder.clone(), 0, 0.025, 0.224, 0.009, 0.003, 0.009, Math.PI / 2);
    // One / two / three raised copper index marks identify the tool kit.
    for (let i = 0; i <= VARIANTS.indexOf(variant); i++) box('copper', -0.023 + i * 0.023, 0.143, 0.06, 0.012, 0.005, 0.042);
    if (variant === 'dig') {
      box('frame',0,.10,-.17,.31,.16,.18);
      box('shell',0,.17,-.18,.29,.035,.17);
      for(const side of [-1,1]) {
        add('copper',cylinder.clone(),side*.17,.075,-.1,.045,.17,.045,Math.PI/2);
        box('piston',side*.11,-.01,.25,.032,.035,.20);
      }
    } else if (variant === 'fabricate') {
      // Tall wire spool and cantilever printer boom make a distinct silhouette.
      add('copper',cylinder.clone(),0,.22,-.12,.095,.20,.095,Math.PI/2);
      box('frame',0,.12,.24,.06,.055,.32);
      box('shell',0,.20,.10,.095,.055,.18);
      box('piston',0,.06,.37,.026,.12,.026);
    } else {
      box('shell',0,.16,-.07,.13,.13,.19);
      box('frame',.09,.30,-.13,.014,.29,.014);
      add('optic',sphere.clone(),.09,.45,-.13,.028,.028,.028);
      for(const side of [-1,1]) box('piston',side*.15,.02,.25,.022,.022,.23);
    }
    body[variant] = Object.fromEntries(Object.entries(parts).filter(([, p]) => p.length)
      .map(([k, p]) => { const merged = mergeGeometries(p); p.forEach(g => g.dispose()); return [k, merged]; }));
  }
  const tools = {};
  for (const variant of VARIANTS) {
    const p = [];
    const shape = (g, x, y, z) => { g.translate(x, y, z); p.push(g); };
    if (variant === 'dig') {
      const barrel = new THREE.CylinderGeometry(0.07, 0.07, 0.09, 12); barrel.rotateX(Math.PI / 2);
      shape(barrel, 0, 0, 0);
      const bit = new THREE.ConeGeometry(.036,.34,12); bit.rotateX(Math.PI/2);
      shape(bit,0,0,.17);
      const helix = Array.from({length:81},(_,i)=>{
        const f=i/80,a=f*Math.PI*8,r=.066*(1-f*.72);
        return new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,.035+f*.275);
      });
      shape(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix),80,.011,6,false),0,0,0);
    } else {
      shape(new THREE.BoxGeometry(0.065, 0.04, 0.07), 0, 0, 0);
      for (const side of [-1, 1]) {
        shape(new THREE.BoxGeometry(0.013, 0.026, variant === 'repair' ? 0.10 : 0.065), side * 0.035, 0, 0.06);
        shape(new THREE.BoxGeometry(0.027, 0.018, 0.013), side * 0.028, 0, 0.10);
      }
      if (variant === 'fabricate') shape(new THREE.ConeGeometry(0.017, 0.045, 8), 0, -0.025, 0.08);
    }
    tools[variant] = mergeGeometries(p); p.forEach(g => g.dispose());
  }
  return { materials, cylinder, sphere, body, tools };
}

export class WorkerSpider {
  constructor({ scale = 1, variant = 'dig', seed = 0 } = {}) {
    resources ??= createResources(); owners++;
    this.resources = resources; this.variant = VARIANTS.includes(variant) ? variant : 'dig';
    this.seed = Number.isFinite(seed) ? seed : 0; this.disposed = false;
    this.group = new THREE.Group(); this.group.name = `worker-spider-${this.variant}`;
    this.group.scale.setScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
    this.body = new THREE.Group(); this.group.add(this.body);
    for (const [finish, geometry] of Object.entries(resources.body[this.variant])) {
      this.body.add(new THREE.Mesh(geometry, resources.materials[finish]));
    }
    this.tool = new THREE.Mesh(resources.tools[this.variant], resources.materials.piston);
    this.toolPivot = new THREE.Group(); this.body.add(this.toolPivot); this.toolPivot.add(this.tool);
    this.toolTip = new THREE.Vector3();
    this.body.scale.set(this.variant==='dig'?1.16:this.variant==='repair'?.86:1,1,1);
    const batch = (geometry, finish, n) => {
      const mesh = new THREE.InstancedMesh(geometry, resources.materials[finish], n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
      this.group.add(mesh); return mesh;
    };
    this.links = batch(resources.cylinder, 'frame', 18);
    this.joints = batch(resources.sphere, 'copper', 18);
    this.pistons = batch(resources.cylinder, 'piston', 12);
    this.pads = batch(resources.sphere, 'frame', 6);
    this.matrix = new THREE.Matrix4(); this.rotation = new THREE.Quaternion();
    this.point = new THREE.Vector3(); this.direction = new THREE.Vector3();
    this.size = new THREE.Vector3(); this.axis = new THREE.Vector3(0, 1, 0);
    this.group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.update(0);
  }
  segment(batch, index, a, b, radius) {
    this.direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = this.direction.length(); this.rotation.setFromUnitVectors(this.axis, this.direction.normalize());
    this.point.set((a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2); this.size.set(radius, length, radius);
    this.matrix.compose(this.point, this.rotation, this.size); batch.setMatrixAt(index, this.matrix);
  }
  ball(batch, index, point, x, y = x, z = x) {
    this.point.fromArray(point); this.rotation.identity(); this.size.set(x, y, z);
    this.matrix.compose(this.point, this.rotation, this.size); batch.setMatrixAt(index, this.matrix);
  }
  update(t, { moving = 0, working = false, reducedMotion = false } = {}) {
    if (this.disposed) return;
    const pose = spiderPose(t, { moving, working, reducedMotion, seed: this.seed }); this.pose = pose;
    this.body.position.y = pose.bodyY;
    this.toolPivot.position.set(0,this.variant==='dig'?.02:-.063,this.variant==='fabricate'?.39:.264);
    this.toolPivot.rotation.x = this.variant==='dig' ? working ? Math.asin((pose.bodyY+.02-.025)/.34) : .14 : .12;
    this.tool.position.z = pose.tool;
    this.tool.rotation.z = this.variant === 'dig' ? pose.toolAngle : Math.sin(pose.toolAngle * 0.15) * 0.12;
    this.toolTip.set(0,0,(this.variant==='dig'?.34:.10)+pose.tool).applyEuler(this.toolPivot.rotation)
      .add(this.toolPivot.position); this.toolTip.y += pose.bodyY;
    this.group.userData.toolWorking = !!working;
    pose.legs.forEach((leg, i) => {
      const points = [leg.hip, leg.shoulder, leg.knee, leg.foot];
      for (let k = 0; k < 3; k++) {
        this.segment(this.links, i * 3 + k, points[k], points[k+1], k === 2 ? 0.012 : 0.02);
        this.ball(this.joints, i * 3 + k, points[k], k === 0 ? 0.027 : 0.023);
      }
      const offset = p => [p[0], p[1] + 0.02, p[2] + leg.side * 0.027];
      const a = offset(leg.shoulder), b = offset(leg.knee), mid = a.map((v,k) => v + (b[k]-v)*0.55);
      this.segment(this.pistons, i*2, a, mid, 0.012); this.segment(this.pistons, i*2+1, mid, b, 0.006);
      this.ball(this.pads, i, leg.foot, 0.035, 0.021, 0.045);
    });
    for (const mesh of [this.links, this.joints, this.pistons, this.pads]) mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.group.removeFromParent();
    for (const mesh of [this.links, this.joints, this.pistons, this.pads]) mesh.dispose();
    if (--owners === 0) {
      for (const variant of Object.values(resources.body)) for (const g of Object.values(variant)) g.dispose();
      Object.values(resources.tools).forEach(g => g.dispose());
      resources.cylinder.dispose(); resources.sphere.dispose();
      Object.values(resources.materials).forEach(m => m.dispose()); resources = null;
    }
  }
}
