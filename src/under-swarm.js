import * as THREE from 'three';
import { WorkerSpider } from './workerspider.js';
import { centreAt, floorAt } from './underworld.js';
import { shellPoint, shellNormal } from './under-geometry.js';

// The same machines as the surface colony. Their task paths cling to rock;
// a service beacon gathers nearby floor workers rather than making enemies.
export class UnderSwarm {
  constructor(scene) {
    this.workers = Array.from({ length: 28 }, (_, i) => {
      const spider = new WorkerSpider({ scale: i % 5 === 0 ? 1.1 : .72, seed: i + 40,
        variant: ['dig', 'fabricate', 'repair'][i % 3] });
      const z = i < 20 ? 10 + i * 6.8 : 77 + (i - 20) * 1.8;
      const wall = i % 3 !== 0;
      const theta = wall ? (i % 2 ? .22 : Math.PI - .22) + (i % 5 === 0 ? .85 : 0) : -Math.PI / 2;
      scene.add(spider.group);
      return { spider, base: z, z, theta, wall, index: i };
    });
    this.up = new THREE.Vector3(0, 1, 0);
    this.fractures=scene.children.find(g=>g.userData.caveFractures)?.userData.caveFractures||[];
    for(const mesh of this.fractures){mesh.updateMatrixWorld();mesh.geometry.computeBoundingBox();}
    this.ray=new THREE.Raycaster();this.ray.far=5;this.normal=new THREE.Vector3();
  }
  update(dt, t, position, { fear, reducedMotion }, mode) {
    let nearest = 99;
    for (const w of this.workers) {
      const i = w.index, responding = mode === 2 && !w.wall && Math.abs(w.z - position.z) < 18;
      const desired = responding ? Math.min(146, position.z + 5 + i % 3)
        : w.base + Math.sin(t * .17 + i * 1.73) * 2.1;
      const oldZ = w.z;
      if (dt > 0) w.z += Math.max(-dt * .65, Math.min(dt * .65, desired - w.z));
      const c = centreAt(w.z), group = w.spider.group;
      if (w.wall) {
        const a = w.theta;
        group.position.fromArray(shellPoint(w.z, a));
        const normal = this.normal.fromArray(shellNormal(w.z, a));
        // New ledges are the visible substrate: probe outward from the hollow
        // against only nearby slabs so workers never crawl behind the rock.
        this.ray.ray.origin.copy(group.position).addScaledVector(normal,3);
        this.ray.ray.direction.copy(normal).negate();
        const candidates=this.fractures.filter(m=>{const b=m.geometry.boundingBox;return w.z>=b.min.z-1&&w.z<=b.max.z+1;});
        const hit=this.ray.intersectObjects(candidates,false)[0];
        if(hit){group.position.copy(hit.point);normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);}
        group.quaternion.setFromUnitVectors(this.up, normal);
      } else {
        const x = c.x + Math.sin(i * 2.3) * (responding ? 2 : c.width * .45);
        group.position.set(x, floorAt(x, w.z) + .025, w.z); group.quaternion.identity();
      }
      group.rotateY(desired >= w.z ? 0 : Math.PI);
      const distance = group.position.distanceTo(new THREE.Vector3(position.x, position.y + 1, position.z));
      group.visible = distance < 32 && (fear !== 'gentle' || i % 2 === 0);
      if (!group.visible) continue;
      nearest = Math.min(nearest, distance);
      w.spider.update(t, { moving: dt > 0 ? Math.abs(w.z - oldZ) / dt : 0,
        working: Math.abs(desired - w.z) < .3 || mode === 1, reducedMotion });
    }
    return nearest;
  }
  dispose() { for (const { spider } of this.workers) { spider.group.removeFromParent(); spider.dispose(); } }
}
