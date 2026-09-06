import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const phase=process.argv[2]||'after',dir=`media/visual-session/${phase}`;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.routeWebSocket('**',s=>s.close());
 await ctx.route('**/brain/**',r=>r.fulfill({status:503,body:'Isolated art capture'}));
 await ctx.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await p.goto('http://127.0.0.1:5207/?play&gfx=fine');await p.waitForFunction(()=>window.marsstead?.ready,null,{timeout:60000});
 await p.evaluate(()=>{const g=marsstead;requestAnimationFrame=()=>0;g.persist=()=>{};g.maybePing=()=>{};g.say=()=>{};g.enterAttract();g.attract=true;document.querySelectorAll('body > :not(canvas):not(script):not(style)').forEach(e=>e.style.setProperty('visibility','hidden','important'));});
 const evidence=[];
 for(const shot of (process.argv[3]?[process.argv[3]]:['buggy-day','buggy-night','ship-day','ship-night','rocks-day','crown-night'])){
  await p.evaluate(async({shot,phase})=>{
   const g=marsstead;g.attractShotId='';g.attractT=shot.includes('night')?55:41;g.frame(g.last+1);
   for(let i=0;i<200;i++){g.terrain.update(g.pos.x,g.pos.z);g.rocks.update(g.pos.x,g.pos.z);}
   for(let i=0;i<30;i++){g.frameWorld(.1);g.renderFrame(.1);}
   if(shot.startsWith('buggy')){const a=g.buggyLayer.group;g.cam.position.copy(a.localToWorld(g.cam.position.clone().set(3.4,2.2,4.1)));g.cam.lookAt(a.position.x,a.position.y+.9,a.position.z);}
   else if(shot.startsWith('ship')){const a=g.hopperLayer.group.position;g.cam.position.set(a.x+10,a.y+5,a.z+13);g.cam.lookAt(a.x,a.y+4,a.z);}
   else if(shot.startsWith('rocks')){
    const {rocksInChunk}=await import('/src/rocks.js'),{CHUNK,meshGroundHeight}=await import('/src/marschunk.js');
    const a=g.crownLayer.group.position,list=rocksInChunk(Math.floor(a.x/CHUNK),Math.floor(a.z/CHUNK));
    const rock=list.find(r=>r.kind==='boulder')||list.find(r=>r.kind==='slab');if(!rock)throw Error('No reference rock');
    const x=rock.x+6,z=rock.z+6;g.cam.position.set(x,Math.max(meshGroundHeight(x,z)+1.6,rock.y+2.5),z);g.cam.lookAt(rock.x,rock.y+.4,rock.z);
    if(phase==='before'){const T=await import('/node_modules/three/build/three.module.js');const mat=new T.MeshLambertMaterial();for(const c of g.rocks.chunks.values())if(c.mesh)c.mesh.material=mat;}
   }
   else{const a=g.crownLayer.group.position;g.cam.position.set(a.x+4.5,a.y+2.8,a.z+4.1);g.cam.lookAt(a.x,a.y+.48,a.z);}
   g.renderFrame(0);
  },{shot,phase});
  await p.screenshot({path:`${dir}/${shot}.png`});
  evidence.push(await p.evaluate(shot=>({shot,camera:marsstead.cam.position.toArray(),rotation:marsstead.cam.quaternion.toArray(),time:marsstead.simMillis,draws:marsstead.renderer.info.render.calls,triangles:marsstead.renderer.info.render.triangles}),shot));
 }
 assert.deepEqual(errors,[]);writeFileSync(`${dir}/evidence.json`,JSON.stringify(evidence,null,2));console.log(`${phase}: six surface captures; no shader/browser errors`);
}finally{await browser.close();}
