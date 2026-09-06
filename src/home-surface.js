// Small, state-derived details at the crown. Pooled once; no per-frame geometry.
import * as THREE from 'three';

export class HomeSurface {
  constructor(group, groundAt) {
    this.group = new THREE.Group(); group.add(this.group);
    const shell = new THREE.MeshPhongMaterial({ color:0xc9cbbf, shininess:35 });
    const dark = new THREE.MeshPhongMaterial({ color:0x414f52, shininess:15 });
    const green = new THREE.MeshPhongMaterial({ color:0x689e87, shininess:20 });
    const bronze = new THREE.MeshPhongMaterial({ color:0xa1835b, shininess:25 });
    const glow = new THREE.MeshPhongMaterial({ color:0xcfe2ce, emissive:0x95d8bf, emissiveIntensity:0 });
    this.glow = glow;
    const mesh = (geometry, material, x=0, y=0, z=0) => {
      const m = new THREE.Mesh(geometry,material); m.position.set(x,y,z);
      m.castShadow = true; m.receiveShadow = true; return m;
    };
    const place = (g,x,z) => { g.position.set(x,groundAt(x,z),z); this.group.add(g); return g; };
    // Gardens reveal themselves as small glazed light wells: a glimpse of green.
    this.gardens = []; this.leaves = [];
    for (let i=0;i<4;i++) {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(.52,.64,.18,24),bronze,0,.09));
      g.add(mesh(new THREE.CylinderGeometry(.45,.45,.08,24),dark,0,.2));
      const ring = mesh(new THREE.TorusGeometry(.48,.045,8,24),shell,0,.23); ring.rotation.x=Math.PI/2; g.add(ring);
      const glass = new THREE.MeshPhongMaterial({ color:0xaccdc9, transparent:true, opacity:.25, shininess:90, depthWrite:false });
      g.add(mesh(new THREE.SphereGeometry(.46,20,12,0,Math.PI*2,0,Math.PI/2),glass,0,.22));
      for (let k=0;k<3;k++) {
        const plant=new THREE.Group(); plant.position.set((k-1)*.16,.26,0);
        plant.add(mesh(new THREE.CylinderGeometry(.008,.008,.22,5),green,0,.11));
        for (const side of [-1,1]) {
          const leaf=mesh(new THREE.SphereGeometry(.08,8,6),green,side*.055,.13+side*.035);
          leaf.scale.set(.7,.18,1.5); leaf.rotation.z=side*.5; plant.add(leaf);
        }
        g.add(plant); this.leaves.push(plant);
      }
      g.add(mesh(new THREE.BoxGeometry(.15,.025,.035),glow,0,.27,.46));
      this.gardens.push(place(g,-3.7-i*.95,2.1));
    }
    // A useful storage room has organised supply lockers above its intake.
    this.stores=[];
    for(let i=0;i<6;i++) {
      const g=new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(.48,.4,.4),shell,0,.22));
      g.add(mesh(new THREE.BoxGeometry(.38,.05,.015),bronze,0,.28,.21));
      g.add(mesh(new THREE.BoxGeometry(.09,.09,.018),dark,.12,.12,.211));
      this.stores.push(place(g,-3.5-(i%3)*.56,-2.1-Math.floor(i/3)*.48));
    }
    this.bunks=[];
    for(let i=0;i<6;i++) {
      const g=new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(.1,.14,.45,12),bronze,0,.23));
      g.add(mesh(new THREE.CylinderGeometry(.085,.085,.12,12),glow,0,.46));
      g.add(mesh(new THREE.CylinderGeometry(.13,.1,.03,12),shell,0,.54));
      this.bunks.push(place(g,3.1+i*.65,-1.6));
    }
    this.specimen=new THREE.Group();
    this.specimen.add(mesh(new THREE.CylinderGeometry(.18,.24,.35,12),dark,0,.18));
    const crystal=mesh(new THREE.OctahedronGeometry(.14),glow,0,.49);
    crystal.scale.set(.7,1.2,.7); this.specimen.add(crystal);
    place(this.specimen,1.8,2.25);
    this.group.visible=false;
  }

  update(growth, t, night, discovery, reducedMotion=false) {
    this.group.visible=true;
    this.gardens.forEach((g,i) => { g.visible=i<growth.garden; });
    this.stores.forEach((g,i) => { g.visible=i<growth.store*2; });
    this.bunks.forEach((g,i) => { g.visible=i<growth.bunk*2 && growth.sealed; });
    this.specimen.visible=!!discovery;
    this.glow.emissiveIntensity=growth.sealed ? (night?1.1:.16) : 0;
    this.leaves.forEach((p,i) => { p.rotation.z=reducedMotion?0:Math.sin(t*.75+i)*.045; });
  }
}
