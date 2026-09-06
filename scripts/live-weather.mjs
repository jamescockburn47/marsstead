// Disposable weather/position fixtures exercise real controls, simulation, rendering and IndexedDB.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const url=process.env.FIRSTLIGHT_URL||'http://127.0.0.1:5207';
mkdirSync('media/weather',{recursive:true});
const errors=[],evidence={};
async function setup(options={}){
 const context=await browser.newContext(options);
 await context.routeWebSocket('**',s=>s.close());
 await context.route('**/brain/**',r=>r.fulfill({status:503,body:'Offline test'}));
 await context.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${url}/?play`);await page.waitForFunction(()=>window.marsstead?.weatherSession,null,{timeout:60000});
 return {page,context};
}
async function place(page,target){
 await page.evaluate(target=>{const g=window.marsstead;g.weatherSession.close();
  const p=target==='home'?g.crownPos:target==='battery'?g.machines.find(m=>m.type==='battery'):target==='rig'?g.rig:target==='array'?g.machines.find(m=>m.type==='solar-array'):target==='smelter'?g.machines.find(m=>m.type==='smelter'):g.buggy;
  g.pos.set(p.x+2.4,g.groundAt(p.x+2.4,p.z),p.z);g.vel.set(0,0,0);g.vy=0;g.airborne=false;
  g.camYaw=Math.atan2(p.x-g.pos.x,p.z-g.pos.z);g.camPitch=.32;g.focusWorld();},target);
 await page.waitForTimeout(600);
}
async function clock(page,seconds){
 await page.evaluate(seconds=>{const g=window.marsstead;g.simMillis=g.weather.epochMillis+seconds*40000;g.updateWeatherWorld();},seconds);
 await page.waitForTimeout(200);
}
async function open(page){await page.locator('#weather-forecast').click();await page.waitForFunction(()=>window.marsstead.weatherSession.visible);}
async function shot(page,name){await page.screenshot({path:`media/weather/${name}.png`});}
try{
 const {page,context}=await setup({viewport:{width:1440,height:900}});
 assert.equal(await page.evaluate(()=>window.marsstead.weatherNow.phase),'clear');
 // Additional machinery fixture owns an ordinary queue; no player save is touched.
 await page.evaluate(async()=>{const g=window.marsstead,{createMachine}=await import('/src/machines.js');
  const array=createMachine('solar-array',g.crownPos.x+8,g.crownPos.z+1);
  const smelter=createMachine('smelter',g.crownPos.x-8,g.crownPos.z-5);smelter.queue=['iron-ore'];
  g.machines.push(array,smelter);g.machineLayer.sync(g.machines,g.groundAt.bind(g));
  g.gfxManual=true;g.applyQuality('fine');});
 await clock(page,940);await place(page,'battery');await open(page);
 await page.getByRole('button',{name:'Secure Battery bank',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.marsstead.machines[0].exposure.secured),true);
 const position=await page.evaluate(()=>({x:window.marsstead.pos.x,z:window.marsstead.pos.z,t:window.marsstead.simMillis}));
 await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.up('KeyW');
 assert.ok(await page.evaluate(p=>Math.hypot(window.marsstead.pos.x-p.x,window.marsstead.pos.z-p.z)<.08,position),'weather panel blocks movement');
 assert.ok(await page.evaluate(p=>window.marsstead.simMillis>p.t,position),'weather panel keeps world ticking');
 await shot(page,'01-prepare');
 await page.keyboard.press('Escape');await place(page,'home');await open(page);
 await page.getByRole('button',{name:'Recall crew',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.marsstead.weather.crewSecured),true);
 assert.equal(await page.evaluate(()=>window.marsstead.weatherCrewAvailable()),0);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{const g=window.marsstead;g.sunEl=-2;g.weatherNow={...g.weatherNow,phase:'clear',cold:false};g.trySleep();
  if(g.sleepAnim||g.sheltered())throw Error('Dusk must not allow outdoor sleep near home');g.habitat.enter();});
 assert.equal(await page.evaluate(()=>window.marsstead.weatherSheltered()),true);
 await page.locator('#habitat-tools [data-act=weather]').click();
 assert.equal(await page.getByRole('button',{name:'Uncover Battery bank',exact:true}).isDisabled(),true,'interior cannot remotely touch surface equipment');
 await page.getByRole('button',{name:'Release crew',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.marsstead.weather.crewSecured),false,'held crew can be released despite zero active count');
 await page.getByRole('button',{name:'Recall crew',exact:true}).click();
 await page.keyboard.press('Escape');await clock(page,1120);
 await page.evaluate(()=>{const g=window.marsstead;g.warm=.4;g.air=.4;});
 await page.waitForTimeout(700);
 assert.ok(await page.evaluate(()=>window.marsstead.warm>.4&&window.marsstead.air>.4),'sealed bunker recovers through storm');
 await shot(page,'02-bunker');
 await page.locator('#habitat-tools [data-act=weather]').click();await shot(page,'03-control-hub');await page.keyboard.press('Escape');
 await page.locator('#habitat-tools [data-act=exit]').click();
 assert.equal(await page.evaluate(()=>window.marsstead.weatherSheltered()),false,'standing above home is outside');
 const warmth=await page.evaluate(()=>window.marsstead.warm);await page.waitForTimeout(700);
 assert.ok(await page.evaluate(w=>window.marsstead.warm<w,warmth),'actual surface exposure lowers warmth');
 // Show daytime brownout without changing accumulated exposure or storm phase.
 await page.evaluate(()=>{const g=window.marsstead;g.calibrateToLocalHour(13);
  g.weather.epochMillis=g.simMillis-1120*40000;g.weather.processedThrough=g.simMillis;
  g.camYaw=-1.4;g.camPitch=.16;g.warm=1;});await page.waitForTimeout(800);
 evidence.storm=await page.evaluate(()=>{const g=window.marsstead;g.renderFrame(0);
  const c=document.createElement('canvas');c.width=64;c.height=48;const ctx=c.getContext('2d');
  ctx.drawImage(g.renderer.domElement,0,0,64,48);const pixels=ctx.getImageData(0,0,64,48).data;
  let mean=0;for(let i=0;i<pixels.length;i+=4)mean+=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
  return {tau:g.currentTau(),phase:g.weatherNow.phase,mean:mean/(64*48),fog:g.scene.fog.density};});
 assert.ok(evidence.storm.tau>4&&evidence.storm.fog>.025&&evidence.storm.mean>12,'storm renders visible dusty atmosphere');
 await shot(page,'04-dust-storm');
 await place(page,'rig');await open(page);
 assert.equal(await page.getByRole('button',{name:'Clean Mining rig · 4 seconds',exact:true}).isDisabled(),true);
 await page.keyboard.press('Escape');await clock(page,1201);
 evidence.after=await page.evaluate(()=>window.marsstead.weatherTargets().map(t=>({id:t.id,dust:t.condition.dust,secured:t.condition.secured})));
 assert.ok(evidence.after.find(t=>t.id==='rig').dust>=.64);
 assert.ok(evidence.after.find(t=>t.id==='machine-0').dust<.1);
 assert.equal(await page.evaluate(()=>window.marsstead.weatherEfficiency(window.marsstead.weatherEquipment.rig)),0);
 await page.evaluate(()=>{const m=window.marsstead.machines.find(m=>m.type==='smelter');m.queue=['iron-ore'];m.t=3;m.out={glass:1};});
 await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>window.marsstead.machines.find(m=>m.type==='smelter').t),3,'actual clogged machinery retains queue progress');
 await open(page);await shot(page,'05-cleanup');
 await page.getByRole('button',{name:'Clean Mining rig · 4 seconds',exact:true}).click();
 await page.waitForFunction(()=>window.marsstead.weatherEquipment.rig.dust===0,null,{timeout:10000});
 assert.ok(await page.evaluate(()=>window.marsstead.weatherEfficiency(window.marsstead.weatherEquipment.rig)>0));
 await shot(page,'06-restored');await page.keyboard.press('Escape');
 await place(page,'smelter');await open(page);await page.getByRole('button',{name:'Clean Smelter · 4 seconds',exact:true}).click();
 await page.waitForFunction(()=>window.marsstead.machines.find(m=>m.type==='smelter').exposure.dust===0,null,{timeout:10000});
 await page.keyboard.press('Escape');await page.waitForTimeout(600);
 assert.ok(await page.evaluate(()=>window.marsstead.machines.find(m=>m.type==='smelter').t>3),'actual cleaned queue resumes');
 await place(page,'array');await open(page);await page.getByRole('button',{name:'Clean Solar array · 4 seconds',exact:true}).click();
 await page.waitForFunction(()=>window.marsstead.machines.find(m=>m.type==='solar-array').exposure.dust===0,null,{timeout:10000});
 await page.waitForTimeout(200);const restoredSupply=await page.evaluate(()=>window.marsstead.grid.supply);
 assert.ok(restoredSupply>1,'cleaned solar restores real grid supply');
 await page.getByRole('button',{name:'Secure Solar array',exact:true}).click();await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>window.marsstead.grid.supply),1,'covered solar stops collection while RTG remains');
 await page.keyboard.press('Escape');await shot(page,'08-covered-array');await open(page);
 await page.getByRole('button',{name:'Uncover Solar array',exact:true}).click();await page.keyboard.press('Escape');
 await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>window.marsstead.grid.supply>1));

 await page.evaluate(async()=>{const g=window.marsstead;g.paused=true;await g.persist();});
 const persisted=await page.evaluate(()=>({weather:window.marsstead.weather,rig:window.marsstead.weatherEquipment.rig,
  machines:window.marsstead.machines.map(m=>m.exposure)}));
 await page.reload();await page.waitForFunction(()=>window.marsstead?.weatherSession,null,{timeout:60000});
 const restored=await page.evaluate(()=>({weather:window.marsstead.weather,rig:window.marsstead.weatherEquipment.rig,
  machines:window.marsstead.machines.map(m=>m.exposure)}));
 assert.deepEqual(restored.rig,persisted.rig);assert.deepEqual(restored.machines,persisted.machines);
 assert.equal(restored.weather.epochMillis,persisted.weather.epochMillis);
 assert.equal(restored.weather.crewSecured,true);
 // Actual pause path holds both simulation and exposure.
 await page.evaluate(()=>{const g=window.marsstead;g.experience.pause(true);});
 const frozen=await page.evaluate(()=>[window.marsstead.simMillis,window.marsstead.weather.processedThrough]);
 await page.waitForTimeout(500);assert.deepEqual(await page.evaluate(()=>[window.marsstead.simMillis,window.marsstead.weather.processedThrough]),frozen);
 await page.evaluate(()=>{const g=window.marsstead;g.experience.pause(false);g.calibrateToLocalHour(21);
  g.weather.epochMillis=g.simMillis-1030*40000;g.weather.processedThrough=g.simMillis;});
 await place(page,'home');await page.evaluate(()=>{window.marsstead.habitat.enter('2,1');});
 await page.waitForFunction(()=>window.marsstead.sunEl<-1);
 const sleepBefore=await page.evaluate(()=>({dust:window.marsstead.weatherEquipment.rig.dust,clock:window.marsstead.simMillis}));
 await page.locator('#habitat-tools [data-act=use]').click();
 await page.waitForFunction(()=>window.marsstead.sleepAnim!==null,null,{timeout:3000});
 await page.waitForFunction(()=>!window.marsstead.sleepAnim,null,{timeout:10000});
 assert.ok(await page.evaluate(p=>window.marsstead.simMillis>p.clock+500*40000&&window.marsstead.weatherEquipment.rig.dust>p.dust+.6,sleepBefore),'actual bunk sleep accounts for a skipped storm');
 assert.ok(await page.evaluate(()=>window.marsstead.warm>.99),'sleep in sealed bunk stays safe');
 await context.close();
 const phone=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await place(phone.page,'battery');await phone.page.locator('#weather-forecast').tap();
 await phone.page.getByRole('button',{name:'Secure Battery bank',exact:true}).tap();
 assert.equal(await phone.page.evaluate(()=>window.marsstead.machines[0].exposure.secured),true);
 assert.equal(await phone.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await shot(phone.page,'07-phone');await phone.context.close();
 assert.deepEqual(errors,[]);writeFileSync('media/weather/results.json',JSON.stringify(evidence,null,2));
 console.log('Weather browser: preparation, crew, real shelter, brownout pixels, exposure, cleaning, save/reload, pause and touch pass.',evidence);
}finally{await browser.close();}
