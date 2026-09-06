// Enclosed underground scene, independent of the surface sky and light rig.
import * as THREE from 'three';
import { centreAt, floorAt, UNDER_LENGTH, UNDER_NODES } from './underworld.js';
import { underShellData, underCapData, fractureShelfData, UNDER_SIDES } from './under-geometry.js';
import { underRockMaterial, underMachineMaterial } from './under-material.js';

export class UnderLayer {
  constructor(scene) {
    this.scene=scene; this.group=new THREE.Group(); scene.add(this.group);
    scene.background=new THREE.Color(0x020304);
    scene.fog=new THREE.FogExp2(0x05090b,.028);
    this.metal=underMachineMaterial();
    this.trim=underMachineMaterial(0x9f8c6c);
    this.rock=underRockMaterial();
    this.amber=new THREE.MeshStandardMaterial({color:0xe5bf80,emissive:0xd79f54,emissiveIntensity:.85,roughness:.5});
    this.teal=new THREE.MeshStandardMaterial({color:0x93bfb6,emissive:0x6da99e,emissiveIntensity:.6,roughness:.35});
    this.dark=new THREE.MeshStandardMaterial({color:0x263031,roughness:.8,metalness:.2});
    this.parts=[]; this.marks=[]; this.beacons=[];
    const shell=underShellData();
    const geometry=this.geometry(shell);
    // Weld the duplicated ring normals so the longitudinal seam never catches light.
    const normal=geometry.attributes.normal;
    for(let r=0;r<shell.rows;r++) {
      const a=r*(UNDER_SIDES+1),b=a+UNDER_SIDES;
      const n=new THREE.Vector3().fromBufferAttribute(normal,a)
        .add(new THREE.Vector3().fromBufferAttribute(normal,b)).normalize();
      normal.setXYZ(a,n.x,n.y,n.z); normal.setXYZ(b,n.x,n.y,n.z);
    }
    this.mesh(geometry,this.rock);
    this.mesh(this.geometry(underCapData(0)),this.rock);
    this.mesh(this.geometry(underCapData(UNDER_LENGTH)),this.rock);
    this.buildFractures(); this.group.userData.caveFractures=this.fractures;
    this.buildRoute(); this.buildLandmarks();
    this.ambient=new THREE.AmbientLight(0x879ead,.095); scene.add(this.ambient);
    this.lamp=new THREE.SpotLight(0xf0e7d3,300,38,.72,.7,1.65);
    this.lamp.castShadow=true; this.lamp.shadow.mapSize.set(1024,1024);
    this.lamp.shadow.camera.near=.08; this.lamp.shadow.camera.far=38;
    this.lamp.shadow.bias=-.00015; this.lamp.shadow.normalBias=.014;
    this.lamp.target=new THREE.Object3D(); scene.add(this.lamp,this.lamp.target);
    this.nearLight=new THREE.PointLight(0xc9d6d0,4,9,1.8);
    this.workLight=new THREE.PointLight(0xc59d64,28,18,1.7);
    scene.add(this.nearLight,this.workLight);
  }

  geometry({positions,indices}) {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(positions,3));
    g.setIndex(new THREE.BufferAttribute(indices,1)); g.computeVertexNormals(); return g;
  }
  mesh(geo,mat,x=0,y=0,z=0,parent=this.group) {
    const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true; parent.add(m); this.parts.push(m); return m;
  }
  tube(points,radius,mat,parent=this.group) {
    const curve=new THREE.CatmullRomCurve3(points);
    return this.mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*3),radius,8,false),mat,0,0,0,parent);
  }
  buildFractures() {
    this.fractures=[];
    const add=(z,side,seed,options)=>{
      const source=this.geometry(fractureShelfData(z,side,seed,options));
      const geo=source.toNonIndexed();source.dispose();geo.computeVertexNormals();
      // Retain an index for geometric winding/clearance verification.
      geo.setIndex(Array.from({length:geo.attributes.position.count},(_,i)=>i));
      const m=this.mesh(geo,this.rock);
      m.userData.fracture={z,side,ceiling:!!options.ceiling};this.fractures.push(m);
    };
    // Irregular, interrupted ledges replace a continuous manufactured tube read.
    for(const [i,z] of [5,11,17,23,29,45,52,58,64,70,93,99,105,111,117,123,142,147].entries()) {
      const side=i%3===0?-1:1;
      add(z,side,i+3,{span:1.7,rise:.7+(i%3)*.23,length:2.4+(i%4)*.65});
      if(i%3!==1)add(z+1.8,side,i+37,{ceiling:true,span:1.1+(i%2)*.8,rise:.45,length:1.6});
    }
    // Staggered wall masses are rooted in the margins; their overlapping backs
    // penetrate the shell while joint gaps reveal dark recesses.
    for(let i=0,z=3;z<148;i++,z+=4.1+Math.sin(i*2.7)*.7) {
      for(const side of [-1,1])add(z+side*.7,side,230+i*7+side,{span:1,rise:1.2,length:2.3});
    }
    // Three chamber signatures: split bedding, offset roof plates, mineral fins.
    for(let i=0;i<6;i++) {
      add(34+i*1.05,1,80+i,{span:1.3,rise:.18,length:1.1});
      add(81+i*1.35,i%2?1:-1,110+i,{ceiling:true,span:2.3,rise:.28,length:1.45});
      add(127+i*1.22,-1,150+i,{span:.7,rise:.8+(i%3)*.32,length:.48});
    }
  }
  buildRoute() {
    // Two engineered cables follow the rock contour; their amber clips are the route home.
    for(const offset of [0,.14]) {
      const points=[];
      for(let z=1;z<UNDER_LENGTH;z+=2) {
        const c=centreAt(z),x=c.x-c.width*.77;
        points.push(new THREE.Vector3(x,floorAt(x,z)+.18+offset,z));
      }
      this.tube(points,.028,this.dark);
    }
    for(let z=3;z<UNDER_LENGTH;z+=9.5+2*Math.sin(z*.7)) {
      const c=centreAt(z),x=c.x-c.width*.75,y=floorAt(x,z)+.24;
      const frame=this.mesh(new THREE.BoxGeometry(.11,.36,.28),this.metal,x,y,z);
      const glow=this.mesh(new THREE.BoxGeometry(.045,.22,.17),this.amber,x+.07,y,z);
      frame.rotation.z=-.2; glow.rotation.z=-.2;
      this.beacons.push(new THREE.Vector3(x+.18,y+.12,z));
    }
    // Entry pressure bulkhead: a recognisable warm door behind the player.
    const c=centreAt(.15);
    this.mesh(new THREE.BoxGeometry(2.1,2.8,.18),this.metal,c.x,c.y+1.4,.15);
    this.mesh(new THREE.BoxGeometry(1.65,2.4,.035),this.dark,c.x,c.y+1.3,.26);
    const ring=this.mesh(new THREE.TorusGeometry(.56,.045,10,32),this.trim,c.x,c.y+1.45,.31);
    ring.rotation.z=.2;
    this.mesh(new THREE.BoxGeometry(1.45,.065,.06),this.amber,c.x,c.y+2.58,.31);
  }
  buildLandmarks() {
    UNDER_NODES.forEach((n,i)=>{
      const y=floorAt(n.x,n.z),g=new THREE.Group();g.position.set(n.x,y,n.z);this.group.add(g);
      // A low scanner at the actual interaction point; major machinery stands at the wall.
      this.mesh(new THREE.CylinderGeometry(.19,.26,.65,12),this.metal,0,.33,0,g);
      const panel=this.mesh(new THREE.BoxGeometry(.48,.10,.30),this.metal,0,.7,0,g);panel.rotation.x=.32;
      const screen=this.mesh(new THREE.BoxGeometry(.30,.014,.16),this.teal,0,.762,-.012,g);screen.rotation.x=.32;
      const marker=this.mesh(new THREE.TorusGeometry(.12,.012,6,24),this.amber,0,.94,0,g);
      this.marks.push({id:n.id,mesh:marker});
      const z=[38,85,132][i],c=centreAt(z),side=i===1?-1:1,x=c.x+side*c.width*.62;
      const apparatus=new THREE.Group();apparatus.position.set(x,floorAt(x,z),z);this.group.add(apparatus);
      this.landmark(apparatus,i);
    });
  }
  landmark(g,kind) {
    const box=(w,h,d,x,y,z,mat=this.metal)=>this.mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,g);
    if(kind===0) {
      // Survey mast beside a mineral-bearing wall; insulated ceramic sample jaws.
      box(.9,.14,1.25,0,.1,0,this.dark);
      box(.18,2.25,.18,0,1.2,0);
      for(let i=0;i<4;i++) {
        const y=.5+i*.45;box(.8,.085,.18,0,y,0,this.trim);
        box(.08,.22,.08,-.34,y+.12,0,this.teal);
      }
      const cable=[new THREE.Vector3(-.4,.2,-.4),new THREE.Vector3(-.6,1,.2),new THREE.Vector3(0,2.3,0)];
      this.tube(cable,.025,this.dark,g);
    } else if(kind===1) {
      // Open printing cradles. Worker spiders are supplied by the shared rig layer.
      for(let i=0;i<3;i++) {
        const z=(i-1)*1.15;box(1.4,.12,.9,0,.18,z,this.dark);
        for(const s of [-1,1]) {box(.08,1,.12,s*.62,.7,z);box(.1,.04,.74,s*.6,.22,z,this.teal);}
        box(1.4,.12,.14,0,1.22,z,this.trim);
        this.mesh(new THREE.CylinderGeometry(.12,.06,.24,12),this.metal,0,1.03,z,g);
      }
    } else {
      // A vertical machine lattice catches isolated edge glints, never a glowing wall.
      for(let row=0;row<4;row++) for(let col=0;col<3;col++) {
        const x=(col-1)*.63,y=.55+row*.61;
        const ring=this.mesh(new THREE.TorusGeometry(.31,.035,8,6),this.trim,x,y,0,g);ring.rotation.z=Math.PI/6;
        if((row+col)%3===0) this.mesh(new THREE.OctahedronGeometry(.075),this.teal,x,y,.07,g);
      }
      box(2.25,.18,.65,0,.14,0,this.dark);
      for(const s of [-1,1]) box(.12,2.85,.15,s*1.12,1.55,0);
    }
  }

  update(t,{position,heading,lampOn=true,fear='gentle',reducedMotion=false,completed=[]}) {
    const head=new THREE.Vector3(position.x,position.y+1.5,position.z);
    const forward=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
    this.lamp.position.copy(head).addScaledVector(forward,.18);
    this.lamp.target.position.copy(head).addScaledVector(forward,14);this.lamp.target.position.y-=.3;
    this.lamp.intensity=lampOn?(fear==='gentle'?300:245):0;
    // Low spill from the suit lamp makes boot/floor contact readable without
    // flattening distant recesses or adding another light to the scene.
    this.nearLight.position.copy(position);this.nearLight.position.y+=.8;
    this.nearLight.position.addScaledVector(forward,-.22);
    this.nearLight.intensity=lampOn?(fear==='gentle'?7:4):.6;
    this.ambient.intensity=fear==='gentle'?.095:.055;
    let nearest=this.beacons[0],best=Infinity;
    for(const b of this.beacons) {const d=b.distanceToSquared(head);if(d<best){best=d;nearest=b;}}
    this.workLight.position.copy(nearest);this.workLight.intensity=fear==='gentle'?32:23;
    for(const mark of this.marks) {
      mark.mesh.material=completed.includes(mark.id)?this.teal:this.amber;
      mark.mesh.rotation.y=reducedMotion?0:Math.sin(t*.5)*.12;
    }
  }

  dispose() {
    const geometries=new Set(),materials=new Set();
    this.group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
    this.scene.remove(this.group,this.ambient,this.lamp,this.lamp.target,this.nearLight,this.workLight);
    this.lamp.dispose();this.nearLight.dispose();this.workLight.dispose();
  }
}
