import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
mkdirSync('media/stone-refinement',{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await p.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));await p.goto('http://127.0.0.1:5207/media/habitat/index.html');
 await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{RockLayer}=await import('/src/rocklayer.js');
  document.body.replaceChildren();document.body.style.margin='0';const scene=new T.Scene();scene.background=new T.Color(0x161e24);
  const layer=new RockLayer(scene),r=new T.WebGLRenderer({antialias:true});r.setSize(1440,900);r.toneMapping=T.ACESFilmicToneMapping;r.shadowMap.enabled=true;document.body.append(r.domElement);
  const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:0x76543c,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.4;floor.receiveShadow=true;scene.add(floor);
  const lamp=new T.SpotLight(0xffd7b0,160,25,1.1,.65);lamp.position.set(-4,4,4);lamp.castShadow=true;lamp.shadow.mapSize.set(2048,2048);scene.add(lamp,lamp.target,new T.HemisphereLight(0x92b6d1,0x534238,.6));
  const stones=[];for(let i=0;i<3;i++){const m=new T.Mesh(layer.geos[i],layer.mat);m.position.set((i-1)*2.4,0,(i%2)*-.6);m.castShadow=m.receiveShadow=true;scene.add(m);stones.push(m);}
  const c=new T.PerspectiveCamera(45,1440/900,.05,50);c.position.set(6,3.6,8);c.lookAt(0,.1,0);
  window.stoneCapture={r,scene,c,stones,after:layer.mat,before:new T.MeshLambertMaterial({color:0x78533b})};layer.mat.color.set(0x78533b);
 });
 for(const mode of ['before','after']){await p.evaluate(mode=>{const f=stoneCapture;f.stones.forEach(m=>m.material=f[mode]);f.r.render(f.scene,f.c);},mode);await p.screenshot({path:`media/stone-refinement/${mode}.png`});}
 if(errors.length)throw Error(errors.join('\n'));console.log('Basalt material: original stone geometry, same lamp/camera, both shader paths rendered');
}finally{await b.close();}
