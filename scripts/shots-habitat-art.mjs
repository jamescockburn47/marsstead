import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
mkdirSync('media/habitat-art',{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error' && !m.text().includes('404'))errors.push(m.text());});
await p.goto('http://127.0.0.1:5207/media/habitat/index.html');
for(const piece of ['garden','bunk']){
await p.evaluate(async(piece)=>{const T=await import('/node_modules/three/build/three.module.js'),{HabitatLayer}=await import('/src/habitat-layer.js');document.body.replaceChildren();const scene=new T.Scene();scene.background=new T.Color(0x111c1a);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,900);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.style.margin='0';document.body.append(renderer.domElement);const layer=new HabitatLayer(scene,{cells:new Map([['0,1',{piece,dug:1}]]),ringInstalled:true});const c=new T.PerspectiveCamera(70,1440/900,.05,80);c.position.set(piece==='garden'?3.5:2.65,1.75,piece==='garden'?0:1.5);c.lookAt(piece==='garden'?-1:-1.4,1.5,piece==='garden'?0:-2.7);renderer.render(scene,c);window.art={renderer,scene,layer,c};},piece);
await p.screenshot({path:`media/habitat-art/${piece}.png`});
}
if(errors.length)throw Error(errors.join('\n'));console.log('Rendered habitat artwork without browser/shader errors');
}finally{await b.close()}
