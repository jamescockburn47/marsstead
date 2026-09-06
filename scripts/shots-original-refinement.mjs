import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='media/original-refinement';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.route('**/brain/**',r=>r.fulfill({status:503,body:'Isolated visual check'}));
 await ctx.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 await ctx.routeWebSocket('**',ws=>ws.close());
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5207/?play&gfx=fine');await page.waitForFunction(()=>window.marsstead?.ready,null,{timeout:60000});
 await page.waitForTimeout(2500);
 await page.evaluate(()=>{const g=marsstead;requestAnimationFrame=()=>0;g.persist=()=>{};g.maybePing=()=>{};g.say=()=>{};g.enterAttract();g.attract=true;document.querySelectorAll('body > :not(canvas):not(script):not(style)').forEach(e=>e.style.setProperty('visibility','hidden','important'));});
 await page.waitForTimeout(150);
 const evidence=[];
 for(const shot of ['buggy-day','buggy-night','crown-day','crown-night','night-wide']){
  await page.evaluate(shot=>{
   const g=marsstead;g.attractShotId='';g.attractT=shot.includes('night')?55:41;g.frame(g.last+1);
   for(let i=0;i<200;i++){g.terrain.update(g.pos.x,g.pos.z);g.rocks.update(g.pos.x,g.pos.z);}
   for(let i=0;i<30;i++){g.frameWorld(.1);g.renderFrame(.1);}
   if(shot.startsWith('buggy')){
    const p=g.buggyLayer.group;g.cam.position.copy(p.localToWorld(g.cam.position.clone().set(3.4,2.2,4.1)));
    g.cam.lookAt(p.position.x,p.position.y+.9,p.position.z);
   }else if(shot.startsWith('crown')){
    const p=g.crownLayer.group.position;g.cam.position.set(p.x+4.5,p.y+2.8,p.z+4.1);g.cam.lookAt(p.x,p.y+.48,p.z);
   }
   g.renderFrame(0);
  },shot);
  const frames=[];
  for(const enabled of [false,true]){
   await page.evaluate(enabled=>{const g=marsstead;g.buggyLayer.finish.setEnabled(enabled);g.crownLayer.finish.visible=enabled;g.renderFrame(0);},enabled);
   frames.push(await page.evaluate(()=>{const g=marsstead;return{camera:g.cam.position.toArray(),quaternion:g.cam.quaternion.toArray(),time:g.t,simMillis:g.simMillis,exposure:g.renderer.toneMappingExposure,buggy:g.buggyLayer.group.position.toArray(),lamps:g.buggyLayer.lampL.intensity};}));
   await page.screenshot({path:`${dir}/${shot}-${enabled?'after':'before'}.png`});
  }
  assert.deepEqual(frames[0],frames[1],'Matched camera, clock, exposure, vehicle and lamps');
  assert.equal(frames[0].lamps,shot.includes('night')?46:0,'Actual day/night lamp state');evidence.push({shot,...frames[0]});
 }
 await page.goto('http://127.0.0.1:5207/prototypes/original/index.html');
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===1440));
 await page.getByRole('button',{name:'Original only',exact:true}).click();
 assert.equal(await page.locator('#mix').inputValue(),'0');
 await page.getByRole('button',{name:'Refined only',exact:true}).click();
 assert.equal(await page.locator('#mix').inputValue(),'100');
 await page.getByRole('button',{name:'Original buggy · day',exact:true}).click();
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===1440));
 await page.screenshot({path:`${dir}/comparison-viewer.png`});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);writeFileSync(`${dir}/evidence.json`,JSON.stringify({evidence,errors},null,2));
 console.log('Original-scene comparison: 5 exactly matched pairs; no browser/shader errors');
}finally{await browser.close();}
