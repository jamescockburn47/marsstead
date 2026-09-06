// Surface survey / light-haul airframe. Same workshop finishes as the spiders,
// with four large guarded rotors so its flight class reads at a distance.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { machineFinish } from './machine-finish.js';

let resources = null, owners = 0;
function createResources() {
  const materials = {
    shell: machineFinish(0xb7b9ac, .58, .2),
    frame: machineFinish(0x3c494d, .5, .52),
    copper: machineFinish(0x8b8171, .47, .6),
    optic: new THREE.MeshStandardMaterial({ color: 0x9ad5db, emissive: 0x62b9c8,
      emissiveIntensity: .4, roughness: .2, metalness: .2 }),
  };
  const parts = Object.fromEntries(Object.keys(materials).map(k => [k, []]));
  const add = (finish, geometry, x, y, z) => { geometry.translate(x, y, z); parts[finish].push(geometry); };
  const box = (finish, x, y, z, sx, sy, sz) => add(finish, new THREE.BoxGeometry(sx, sy, sz), x, y, z);
  const shell = new THREE.SphereGeometry(1, 32, 16); shell.scale(.185, .095, .34);
  add('shell', shell, 0, .06, 0);
  box('frame', 0, -.02, 0, .3, .12, .42);
  for (const side of [-1, 1]) {
    box('copper', side * .1, .153, -.03, .015, .008, .2);
    // Landing skids and exposed load rails under the ceramic hull.
    box('frame', side * .2, -.23, 0, .035, .035, .56);
    for (const fore of [-1, 1]) {
      box('copper', side * .17, -.14, fore * .19, .035, .18, .035);
      box('frame', side * .28, .015, fore * .3, .45, .045, .065);
      // Deep open ducts, lower lips and stator braces read as an industrial
      // protected airframe rather than exposed hobby-quadcopter propellers.
      add('shell', new THREE.CylinderGeometry(.255,.235,.12,40,1,true),side*.48,.025,fore*.35);
      for (const py of [-.035,.085]) {
        const guard = new THREE.TorusGeometry(py>0?.255:.235,.012,8,40); guard.rotateX(Math.PI / 2);
        add(py>0?'shell':'frame', guard, side * .48, py, fore * .35);
      }
      for (const offset of [-1,1]) box('frame',side*.48+offset*.12,-.035,fore*.35,.23,.025,.025);
      add('copper', new THREE.CylinderGeometry(.045, .035, .10, 12), side * .48, .02, fore * .35);
      box('copper', side * .48, .06, fore * .604, .07, .023, .017);
    }
    for (let i = 0; i < 4; i++) box('copper', side * .18, .055, -.13 + i * .055, .04, .025, .018);
  }
  box('frame', 0, -.115, .25, .14, .12, .12);
  box('shell',0,-.055,.30,.18,.045,.16);
  // Protected sensor hood and aft heat radiator carry the family identity.
  for(let i=0;i<6;i++) box('frame',-.12+i*.048,.14,-.20,.019,.025,.13);
  for(const side of [-1,1]) {
    box('frame',side*.11,.145,.12,.018,.015,.10);
    box('copper',side*.15,.105,.2,.065,.012,.025);
  }
  add('optic', new THREE.SphereGeometry(.037, 12, 8), 0, -.11, .317);
  const body = Object.fromEntries(Object.entries(parts).map(([finish, list]) => {
    const geometry = mergeGeometries(list); list.forEach(g => g.dispose()); return [finish, geometry];
  }));
  const attachments={};
  for(const variant of ['survey','cargo']) {
    const bits=[];
    const part=(x,y,z,sx,sy,sz)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.translate(x,y,z);bits.push(g);};
    if(variant==='cargo') {
      for(const side of [-1,1]) {
        part(side*.23,.08,-.08,.15,.18,.36);
        part(side*.17,-.23,0,.035,.24,.035);
        part(side*.14,-.35,0,.10,.035,.24);
      }
    }else{
      part(0,.23,-.12,.018,.22,.018);part(0,.34,-.12,.27,.018,.025);
      part(0,-.17,.28,.045,.12,.045);
    }
    attachments[variant]=mergeGeometries(bits);bits.forEach(g=>g.dispose());
  }
  return { materials, body, attachments, blade: new THREE.BoxGeometry(.43, .009, .025),
    payload: new THREE.BoxGeometry(.24, .12, .26) };
}

export class FlyingDrone {
  constructor({ seed = 0, scale = 1, variant = 'survey' } = {}) {
    resources ??= createResources(); owners++;
    this.resources = resources; this.seed = Number.isFinite(seed) ? seed : 0; this.disposed = false;
    this.variant=variant==='cargo'?'cargo':'survey';
    this.group = new THREE.Group(); this.group.name = `flying-drone-${this.variant}`;
    this.group.userData.variant=this.variant;
    this.group.userData.droneClass = 'flying';
    this.group.scale.setScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
    for (const [finish, geometry] of Object.entries(resources.body)) {
      this.group.add(new THREE.Mesh(geometry, resources.materials[finish]));
    }
    this.group.add(new THREE.Mesh(resources.attachments[this.variant],resources.materials.frame));
    this.rotors = new THREE.InstancedMesh(resources.blade, resources.materials.frame, 8);
    this.rotors.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.rotors);
    this.payload = new THREE.Mesh(resources.payload, resources.materials.shell);
    this.payload.position.y = this.variant==='cargo'?-.28:-.15;
    if(this.variant==='cargo')this.payload.scale.set(1.25,1.5,1.4);
    this.group.add(this.payload);
    this.matrix = new THREE.Matrix4(); this.rotation = new THREE.Quaternion();
    this.position = new THREE.Vector3(); this.scale = new THREE.Vector3(1, 1, 1);
    this.axis = new THREE.Vector3(0, 1, 0);
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.update(0);
  }
  update(t, { working = false, carrying = working, reducedMotion = false } = {}) {
    if (this.disposed) return;
    const now = reducedMotion ? 0 : t;
    let index = 0;
    for (const side of [-1, 1]) for (const fore of [-1, 1]) {
      this.position.set(side * .48, .075, fore * .35);
      for (let blade = 0; blade < 2; blade++) {
        this.rotation.setFromAxisAngle(this.axis, now * 24 * side * fore + this.seed + blade * Math.PI / 2);
        this.matrix.compose(this.position, this.rotation, this.scale); this.rotors.setMatrixAt(index++, this.matrix);
      }
    }
    this.rotors.instanceMatrix.needsUpdate = true;
    this.payload.visible = !!carrying;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.group.removeFromParent(); this.rotors.dispose();
    if (--owners === 0) {
      Object.values(resources.body).forEach(g => g.dispose());
      Object.values(resources.attachments).forEach(g => g.dispose());
      resources.blade.dispose(); resources.payload.dispose();
      Object.values(resources.materials).forEach(m => m.dispose()); resources = null;
    }
  }
}
