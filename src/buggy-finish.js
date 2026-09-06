// Refinement of the existing open LTV: same envelope, axle positions and lights.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WHEEL_R} from './buggy.js';

const material=(color,shininess)=>new T.MeshPhongMaterial({color,shininess});
function batch(group){
  const bins=new Map();
  for(const child of [...group.children])if(child.isMesh){
    child.updateMatrix();const geo=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geo.applyMatrix4(child.matrix);
    const list=bins.get(child.material)||[];list.push(geo);bins.set(child.material,list);group.remove(child);child.geometry.dispose();
  }
  for(const [mat,list] of bins){const m=new T.Mesh(mergeGeometries(list),mat);m.castShadow=true;m.receiveShadow=true;group.add(m);list.forEach(g=>g.dispose());}
}
export function createBuggyFinish(layer,{seat,back}){
  const group=new T.Group();group.name='ltv-engineering-finish';layer.group.add(group);
  const metal=material(0x6c6860,36),dark=material(0x272929,9),white=material(0xc9bdac,14),cloth=material(0x363a37,2);
  const mesh=(g,geometry,mat,x,y,z)=>{const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);g.add(m);return m;};
  const box=(g,mat,x,y,z,w,h,d,r=.015)=>mesh(g,new RoundedBoxGeometry(w,h,d,2,r),mat,x,y,z);
  const rod=(g,mat,a,b,r)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.sub(start);const m=mesh(g,new T.CylinderGeometry(r,r,v.length(),10),mat,0,0,0);m.position.copy(start).addScaledVector(v,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;};
  // Padded cover and stitched ribs retain the original seat and back dimensions.
  box(group,cloth,0,.765,-.1,.5,.105,.49,.042);
  const pad=box(group,cloth,0,.985,-.325,.5,.43,.105,.042);pad.rotation.x=-.06;
  for(const x of [-.17,-.085,0,.085,.17]){
    box(group,dark,x,.82,-.105,.009,.004,.33,.001);
    box(group,dark,x,.99,-.266,.009,.29,.004,.001);
  }
  for(const side of [-1,1]){
    // Open frame, handholds, stepped foot rests and service fasteners.
    rod(group,metal,[side*.53,.57,-.45],[side*.58,.60,.94],.022);
    rod(group,metal,[side*.57,.59,.9],[side*.48,.85,.48],.02);
    box(group,dark,side*.66,.47,.10,.22,.055,.60,.016);
    for(let i=0;i<6;i++)box(group,metal,side*.66,.5,-.13+i*.085,.20,.008,.009,.002);
    for(const z of [-.45,.05,.55,1.25]){
      const bolt=mesh(group,new T.CylinderGeometry(.015,.015,.009,6),metal,side*.46,z>1?.689:.737,z);
      bolt.rotation.x=z>1?.18:0;
    }
    box(group,white,side*.50,.82,.12,.07,.10,.42,.02);
    rod(group,metal,[side*.52,.7,-.65],[side*.42,.80,-1.22],.018);
  }
  // Solar cell divisions sit in the original tilted deck plane.
  const cells=new T.Group();cells.position.set(0,.838,-.95);cells.rotation.x=-.22;
  for(let i=0;i<9;i++)box(cells,metal,-.49+i*.1225,0,0,.004,.004,.75,.001);
  for(let i=0;i<5;i++)box(cells,metal,0,0,-.36+i*.18,1.02,.004,.004,.001);
  group.add(cells);batch(cells);batch(group);
  const oldWheels=[],wheelGroups=[];
  for(const wheel of layer.wheels){
    oldWheels.push([...wheel.children]);const detail=new T.Group();detail.name='ltv-wheel-finish';wheel.add(detail);wheelGroups.push(detail);
    const drum=mesh(detail,new T.CylinderGeometry(WHEEL_R,WHEEL_R,.40,40),dark,0,0,0);drum.rotation.z=Math.PI/2;
    for(const side of [-1,1]){
      for(const radius of [WHEEL_R*.93,WHEEL_R*.70]){
        const rim=mesh(detail,new T.TorusGeometry(radius,.013,6,40),metal,side*.206,0,0);rim.rotation.y=Math.PI/2;
      }
      const hub=mesh(detail,new T.CylinderGeometry(.11,.11,.05,20),white,side*.221,0,0);hub.rotation.z=Math.PI/2;
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;rod(detail,metal,[side*.21,Math.cos(a)*.11,Math.sin(a)*.11],[side*.21,Math.cos(a)*WHEEL_R*.7,Math.sin(a)*WHEEL_R*.7],.012);
      }
    }
    // Fine open-wheel grousers, not oversized rubber blocks.
    for(let i=0;i<32;i++){
      const a=i*Math.PI/16;rod(detail,metal,[-.185,Math.cos(a)*WHEEL_R,Math.sin(a)*WHEEL_R],[.185,Math.cos(a+.10)*WHEEL_R,Math.sin(a+.10)*WHEEL_R],.009);
    }
    batch(detail);
  }
  return {group,wheelGroups,setEnabled(enabled){group.visible=enabled;seat.visible=back.visible=!enabled;wheelGroups.forEach((g,i)=>{g.visible=enabled;oldWheels[i].forEach(m=>m.visible=!enabled);});}};
}
