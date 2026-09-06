// Purposeful fittings on the original surface hardware. No simulation or lights.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
function fittings(parent){
 const group=new T.Group();group.name='industrial-fittings';parent.add(group);
 const mats={steel:new T.MeshPhongMaterial({color:0x969b97,shininess:48}),dark:new T.MeshPhongMaterial({color:0x272b29,shininess:5}),enamel:new T.MeshPhongMaterial({color:0xc0b5a0,shininess:18}),copper:new T.MeshPhongMaterial({color:0x8c6447,shininess:25})};
 const mesh=(geo,kind,p=[0,0,0],rot=[0,0,0])=>{const m=new T.Mesh(geo,mats[kind]);m.position.set(...p);m.rotation.set(...rot);group.add(m);return m;};
 const box=(w,h,d,kind,p,rot)=>mesh(new T.BoxGeometry(w,h,d),kind,p,rot);
 const ring=(r,t,kind,p,rot=[Math.PI/2,0,0])=>mesh(new T.TorusGeometry(r,t,8,40),kind,p,rot);
 const rod=(a,b,r,kind='steel')=>{const from=new T.Vector3(...a),delta=new T.Vector3(...b).sub(from),m=mesh(new T.CylinderGeometry(r,r,delta.length(),10),kind);m.position.copy(from).addScaledVector(delta,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;};
 const bolt=(p,rot=[0,0,0])=>mesh(new T.CylinderGeometry(.022,.022,.025,6),'steel',p,rot);
 const hose=points=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,.022,6,false),'dark');
 const finish=()=>{const bins=new Map();for(const m of [...group.children]){m.updateMatrix();const g=m.geometry.toNonIndexed();g.applyMatrix4(m.matrix);const list=bins.get(m.material)||[];list.push(g);bins.set(m.material,list);m.geometry.dispose();group.remove(m);}for(const[material,geos]of bins){const m=new T.Mesh(mergeGeometries(geos),material);m.castShadow=m.receiveShadow=true;group.add(m);geos.forEach(g=>g.dispose());}return group;};
 return {group,box,ring,rod,bolt,hose,mesh,finish};
}
export function machineFittings(parent,type){
 const k=fittings(parent),{box,ring,rod,bolt,hose}=k;
 if(type==='smelter'){
  for(const y of [.35,.96,1.15])ring(y<.5?.9:.79,.026,'steel',[0,y,0]);
  for(let i=0;i<10;i++){const a=i*Math.PI/5;bolt([Math.sin(a)*.84,1.0,Math.cos(a)*.84]);}
  for(const s of [-1,1]){box(.075,.54,.045,'copper',[s*.31,.53,.77]);box(.16,.08,.25,'dark',[s*.32,.25,.76]);}
  ring(.285,.035,'steel',[0,.51,.848],[0,0,0]);
  hose([[-.5,.35,.64],[-.82,.42,.45],[-.94,.13,.12],[-.67,.04,-.15]]);
  for(const y of [1.65,2.28])ring(.17,.023,'dark',[.45,y,-.3]);
 }else if(type==='electrolyser'||type==='mill'){
  for(const x of [-.63,.63])ring(type==='mill'?.505:.558,.035,'dark',[x,.85,0],[0,Math.PI/2,0]);
  for(const x of [-.83,.83]){
   ring(type==='mill'?.47:.43,.022,'steel',[x,.85,0],[0,Math.PI/2,0]);
   for(let i=0;i<8;i++){const a=i*Math.PI/4;bolt([x,.85+Math.sin(a)*.42,Math.cos(a)*.42],[0,0,Math.PI/2]);}
  }
  for(const s of [-1,1]){box(.14,.065,.9,'steel',[s*.6,.04,0]);rod([s*.6,.05,-.35],[s*.6,.7,.16],.025);}
  box(.32,.24,.14,'enamel',[.45,.87,.51]);
  if(type==='electrolyser'){
   rod([-.3,1.36,0],[-.3,1.58,0],.032);rod([-.3,1.55,0],[.35,1.55,0],.032);ring(.115,.018,'copper',[.32,1.55,0],[0,0,0]);
   hose([[-.4,.7,.45],[-.6,.34,.65],[-.2,.1,.67],[.45,.12,.52]]);
  }else{for(let i=0;i<7;i++)box(.02,.3,.035,'dark',[.81+i*.055,.85,.345]);ring(.42,.018,'steel',[-.35,1.85,0]);}
 }else if(type==='assembler'){
  ring(.86,.02,'dark',[0,1.05,.10],[0,0,0]);
  for(const s of [-1,1]){rod([s*.56,.16,0],[s*.76,.66,0],.055);box(.2,.075,.32,'enamel',[s*.56,.2,0]);}
  for(let i=0;i<10;i++){const a=i*Math.PI/5;bolt([Math.sin(a)*.85,1.05+Math.cos(a)*.85,.085],[Math.PI/2,0,0]);}
  box(.53,.055,.45,'steel',[0,.25,.08]);for(let i=0;i<5;i++)box(.39,.006,.008,'dark',[0,.282,-.08+i*.07]);
  hose([[-.55,.22,-.1],[-.76,.65,-.08],[-.72,1.35,-.08],[-.3,1.81,-.06]]);
 }else if(type==='solar-array'){
  // Grid and clamps use the original face tilt, not a second solar surface.
  const panel=new T.Group();panel.position.y=1.28;panel.rotation.x=-.6;parent.add(panel);const p=fittings(panel);
  for(let i=1;i<12;i++)p.box(.007,.006,1.44,'steel',[-1.15+i*2.3/12,.029,0]);
  for(let i=1;i<6;i++)p.box(2.25,.006,.009,'steel',[0,.029,-.75+i*.25]);
  for(const x of [-1.10,1.10])for(const z of [-.67,.67])p.box(.065,.04,.10,'dark',[x,.03,z]);p.finish();
  for(const x of [-.38,.38]){rod([0,.78,0],[x,.06,.24],.027);box(.26,.05,.24,'dark',[x,.025,.24]);bolt([x,.07,.24]);}
  box(.16,.20,.10,'enamel',[.07,.75,.08]);
 }else if(type==='battery'){
  for(const x of [-.39,.39]){box(.045,.76,.54,'dark',[x,.4,0]);box(.16,.055,.56,'steel',[x,.12,0]);}
  for(const y of [.3,.66])for(const z of [-.2,.2]){ring(.15,.018,'dark',[.43,y,z],[0,Math.PI/2,0]);box(.035,.09,.10,'copper',[.56,y,z]);}
  box(.035,.36,.035,'copper',[.57,.48,-.2]);box(.035,.36,.035,'copper',[.57,.48,.2]);
  box(.16,.23,.19,'enamel',[-.56,.48,0]);hose([[-.55,.37,0],[-.63,.16,.16],[-.3,.08,.47]]);
 }
 return k.finish();
}
export function rigFittings(layer){
 const k=fittings(layer.group),{box,rod,bolt,ring}=k;
 for(const x of [-.76,.76]){
  box(.055,.12,2.42,'steel',[x,.7,0]);
  for(const z of [-1.13,1.13]){ring(.075,.016,'steel',[x,.77,z],[0,0,0]);bolt([x,.72,z]);}
  rod([x,.52,-.3],[x*.4,.52,.65],.038);
 }
 box(.9,.035,.7,'dark',[0,.721,-.72]);for(let i=0;i<6;i++)box(.012,.008,.6,'steel',[-.36+i*.14,.745,-.72]);
 const mast=fittings(layer.mast);
 for(const x of [-.17,.17])mast.rod([x,.06,.05],[x,2.10,.05],.023);
 for(let i=0;i<6;i++)mast.box(.38,.045,.035,'steel',[0,.15+i*.35,.17]);
 mast.box(.38,.14,.43,'enamel',[0,1.77,0]);mast.rod([0,-.58,.22],[0,1.78,.22],.045,'steel');
 const points=[];for(let i=0;i<=100;i++){const t=i/100;points.push([Math.cos(t*Math.PI*16)*.075,-.56+t*1.22,.22+Math.sin(t*Math.PI*16)*.075]);}
 mast.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),120,.018,6,false),'steel');
 mast.mesh(new T.ConeGeometry(.078,.16,16),'steel',[0,-.64,.22],[Math.PI,0,0]);
 mast.hose([[.2,2.1,-.1],[.26,1.5,-.16],[.26,.7,-.1],[.1,.04,-.2]]);mast.finish();
 for(const leg of layer.legs){const foot=fittings(leg);foot.box(.30,.035,.30,'steel',[0,-.53,0]);foot.ring(.07,.013,'copper',[0,.15,0]);foot.finish();}
 return k.finish();
}
export function panelFittings(parent,type,cell){
 const k=fittings(parent),{box,bolt,ring}=k,edge=cell/2-.09;
 for(const side of [-1,1]){
  for(const x of [-edge,edge])for(const y of [-edge,0,edge])bolt([x,y,side*.13],[Math.PI/2,0,0]);
  if(type==='airlock'){
   for(const x of [-.52,.52])for(const y of [-.62,.56])box(.11,.18,.045,'steel',[x,y,side*.13]);
   ring(.585,.013,'dark',[0,-cell/2+.955,side*.23],[0,0,0]);box(.06,.26,.05,'steel',[.42,-.2,side*.17]);
  }else if(type!=='window'){
   for(const y of [-.62,.67])box(cell-.42,.016,.006,'dark',[0,y,side*.075]);
  }
 }
 return k.finish();
}
