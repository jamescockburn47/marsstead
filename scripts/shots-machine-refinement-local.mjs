import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const stage=process.argv[2]||'before',dir=`media/machine-refinement-${stage}`;mkdirSync(dir,{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
await p.goto('http://127.0.0.1:5207/media/habitat/index.html');
for(const night of [false,true]) {
await p.evaluate(async night=>{const T=await import('/node_modules/three/build/three.module.js');const {WorkerSpider}=await import('/src/workerspider.js');const {FlyingDrone}=await import('/src/flyingdrone.js');
document.body.replaceChildren();document.body.style.margin='0';const scene=new T.Scene();scene.background=new T.Color(night?0x070a0c:0x403c35);const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1440,900);r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1;document.body.append(r.domElement);
const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x725c49,roughness:.98}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
scene.add(new T.HemisphereLight(0xb1c8d5,0x655043,night?.25:2));const light=night?new T.SpotLight(0xffd7ac,50,12,.7,.8):new T.DirectionalLight(0xffe6c3,3);light.position.set(-2,3,3);light.castShadow=true;light.shadow.mapSize.set(2048,2048);scene.add(light);if(night)scene.add(light.target);
for(const [i,variant]of ['dig','fabricate','repair'].entries()){const w=new WorkerSpider({variant});w.group.position.set(-1+i*.95,0,.7);w.update(9,{working:i===0});scene.add(w.group);}
for(const [i,variant]of ['cargo','survey'].entries()){const f=new FlyingDrone({variant});f.group.position.set(-.85+i*1.7,1,-.55);f.update(2,{carrying:i===0});scene.add(f.group);}
const c=new T.PerspectiveCamera(43,1440/900,.05,50);c.position.set(3,2.05,4.5);c.lookAt(0,.5,0);r.render(scene,c);window.fixture={scene,r,c};},night);
await p.screenshot({path:`${dir}/${night?'worklight':'daylight'}.png`});
}
if(errors.length)throw Error(errors.join('\n'));console.log('Machine daylight/worklight WebGL captures passed');}finally{await b.close();}
