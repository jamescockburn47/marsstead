// Fresh IndexedDB context; real game input and elapsed simulation. No reward, clock or actor teleport fixtures.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
const url=process.env.FIRSTLIGHT_URL||'http://127.0.0.1:5207';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
mkdirSync('media/opening',{recursive:true});
const marks=[],start=Date.now(),errors=[];
const mark=label=>{const seconds=Math.round((Date.now()-start)/1000);marks.push({seconds,label});console.log(`${seconds}s ${label}`);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.routeWebSocket('**',s=>s.close());await context.route('**/brain/**',r=>r.fulfill({status:503,body:'Offline test'}));await context.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const shot=name=>page.screenshot({path:`media/opening/${name}.png`});
 const ready=()=>page.waitForFunction(()=>window.marsstead?.ready&&window.marsstead.activityLoop,null,{timeout:60000});
 const walk=async(target,reach=1.5,indoors=false)=>{
  await page.evaluate(()=>window.marsstead.focusWorld());
  const until=Date.now()+45000;
  try{while(Date.now()<until){
   const distance=await page.evaluate(({target,indoors})=>{const g=window.marsstead,p=indoors?g.habitat.pos:g.pos;g.camYaw=Math.atan2(target.x-p.x,target.z-p.z);return Math.hypot(target.x-p.x,target.z-p.z);},{target,indoors});
   if(distance<reach)return;await page.keyboard.down('KeyW');await page.waitForTimeout(100);
  }throw Error('Walking blocked '+JSON.stringify(target));}finally{await page.keyboard.up('KeyW');await page.waitForTimeout(180);if(!indoors)await page.waitForFunction(()=>!window.marsstead.airborne&&window.marsstead.vel.length()<.2,null,{timeout:5000});}
 };
 const drive=async(target)=>{
  const until=Date.now()+150000;let lastLog=Date.now();
  try{while(Date.now()<until){
   const state=await page.evaluate(target=>{const g=window.marsstead,b=g.buggy;return {distance:Math.hypot(target.x-b.x,target.z-b.z),error:Math.atan2(Math.sin(Math.atan2(target.x-b.x,target.z-b.z)-b.heading),Math.cos(Math.atan2(target.x-b.x,target.z-b.z)-b.heading)),speed:b.u,x:b.x,z:b.z};},target);
   if(state.distance<7)break;
   for(const [key,on] of [['KeyW',state.speed<(Math.abs(state.error)>1?2.5:state.distance<20?3:7)],['KeyA',state.error>.12],['KeyD',state.error<-.12]])await page.keyboard[on?'down':'up'](key);
   if(Date.now()-lastLog>20000){console.log('drive',state);lastLog=Date.now();}
   await page.waitForTimeout(100);
  }
  assert.ok(Date.now()<until,'rover reaches destination using its steering and terrain physics');
  }finally{for(const key of ['KeyW','KeyA','KeyD'])await page.keyboard.up(key);}
  await page.keyboard.down('Space');await page.waitForFunction(()=>Math.abs(window.marsstead.buggy.u)<.3,null,{timeout:10000});await page.keyboard.up('Space');
 };
 await page.goto(url,{waitUntil:'load'});await page.getByRole('button',{name:'LAND',exact:true}).click();await ready();await page.waitForTimeout(1000);
 assert.deepEqual(await page.evaluate(()=>{const g=window.marsstead;return [g.opening.fleetMode,g.burrow.cells.size,g.burrow.ringInstalled,g.machines.filter(m=>m.type==='battery').length,g.burrow.cells.get('1,2').dug];}),['park',7,true,1,0]);
 await shot('01-arrival');mark('Fresh landfall: sealed starter home, crew and prepaid expansion');
 const home=await page.evaluate(()=>window.marsstead.crownPos);
 await walk(home,5.5);await page.locator('#first-light button').click();await page.waitForFunction(()=>window.marsstead.habitat.active);
 await shot('02-entry');await walk({x:13,z:0},.8,true);assert.equal(await page.evaluate(()=>window.marsstead.opening.visitedHome),true);await shot('03-bunk');
 await walk({x:-13,z:0},.8,true);await shot('04-workshop');mark('Walked from entrance through bunk and workshop');
 await page.locator('#habitat-tools [data-act=exit]').click();
 await walk(await page.evaluate(()=>window.marsstead.crew.nearest()),1.4);
 await page.waitForFunction(()=>window.marsstead.crew.eligible());await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.marsstead.crew.visible);await shot('05-crew');
 const stationary=await page.evaluate(()=>({x:window.marsstead.pos.x,z:window.marsstead.pos.z}));await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');
 assert.ok(await page.evaluate(p=>Math.hypot(window.marsstead.pos.x-p.x,window.marsstead.pos.z-p.z)<.08,stationary),'crew panel blocks movement');
 await page.locator('[data-crew=follow]').click();await walk({x:home.x+5,z:home.z+3},.8);await page.waitForTimeout(2200);await shot('06-follow');
 assert.equal(await page.evaluate(()=>window.marsstead.burrow.cells.get('1,2').dug),0,'follow does not excavate');
 await page.keyboard.press('KeyE');await page.locator('[data-crew=park]').click();await page.waitForTimeout(600);
 await page.keyboard.press('KeyE');await page.locator('[data-crew=work]').click();
 await page.waitForFunction(()=>window.marsstead.burrow.cells.get('1,2').dug>=1,null,{timeout:20000});mark('Called, held and sent crew to finish first expansion');
 await walk(home,5.5);
 // HOME remains a direct world interaction independent of the current trip objective.
 await walk(home,3.5);await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.marsstead.burrowUI.visible);await shot('07-expanded-plan');await page.locator('#benter').click();
 await page.locator('#habitat-tools [data-act=down]').click();await walk({x:9,z:0},.8,true);await shot('08-new-passage');await page.locator('#habitat-tools [data-act=exit]').click();
 // Approach the rover from its near side; no character or vehicle relocation.
 const rover=await page.evaluate(()=>({x:window.marsstead.buggy.x,z:window.marsstead.buggy.z}));await walk({x:rover.x-2,z:rover.z},.6);await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.driving),true);
 await drive({x:108,z:-94});await shot('09-rover-outing');await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.driving),false);
 await page.getByRole('button',{name:'Use light sensors',exact:true}).click();await page.waitForFunction(()=>window.marsstead.fieldUI.visible);
 await page.getByRole('button',{name:'Horizon: turn right',exact:true}).click({clickCount:2});await page.getByRole('button',{name:'Sky: turn left',exact:true}).click({clickCount:3});await page.getByRole('button',{name:'Reflected light: turn left',exact:true}).click();
 await page.getByRole('button',{name:'Recover solar wing · 18 kg'}).click();assert.equal(await page.evaluate(()=>window.marsstead.expedition.claimed),true);await shot('10-survey-reward');await page.locator('#fieldConsole .close').click();
 await walk({x:120,z:-86},2.5);await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.activities.worker),'carried');await shot('11-recovered-worker');mark('Drove to station, aligned sensors and recovered wing plus disabled worker');
 const parked=await page.evaluate(()=>({x:window.marsstead.buggy.x,z:window.marsstead.buggy.z}));await walk(parked,2.8);await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.driving),true);await drive({x:home.x+9,z:home.z+9});await page.keyboard.press('KeyE');
 await walk({x:home.x+5,z:home.z+4},1);await page.locator('#first-light button').click();await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.expedition.complete),true,'wing builds actual array');await page.keyboard.press('KeyB');await shot('12-solar-home');mark('Returned with both finds and installed first solar array');
 await walk(home,3.5);await page.keyboard.press('KeyE');await page.locator('#benter').click();await walk({x:-16,z:0},.4,true);await walk({x:-16,z:-1},.15,true);
 for(const state of ['bench','diagnosed','repaired','equipped']){await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.activities.worker),state);}
 await shot('13-repaired-worker');mark('Repaired and equipped recovered worker at starter workshop');
 await page.locator('#habitat-tools [data-act=plan]').click();await page.locator('#bcards [data-id=garden]').click();await page.locator('#bsvg [data-key="2,2"]').click();await page.locator('#bx').click();
 await page.waitForFunction(()=>window.marsstead.burrow.cells.get('2,2')?.dug>=1,null,{timeout:150000});
 await walk({x:0,z:0},.4,true);await page.locator('#habitat-tools [data-act=down]').click();await walk({x:16,z:0},.4,true);await walk({x:16.65,z:1.25},.15,true);
 await page.evaluate(()=>{window.marsstead.camYaw=0;window.marsstead.camPitch=.35;});
 await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.activities.crop.phase),'planted');await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.activities.crop.phase),'watered');await shot('14-first-garden');mark('Built garden with earned power, planted and watered first crop');
 await page.waitForFunction(()=>window.marsstead.activities.crop.phase==='ready',null,{timeout:75000});await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.activities.harvests),1);mark('Harvested first ration; field route is the next optional expedition');
 assert.ok((Date.now()-start)<900000,'whole opening completed within15min real time');assert.deepEqual(errors,[]);
 await page.evaluate(()=>window.marsstead.persist());await page.goto(`${url}/?play`);await ready();
 assert.deepEqual(await page.evaluate(()=>{const g=window.marsstead;return [g.opening.visitedHome,g.opening.followed,g.opening.worked,g.expedition.complete,g.activities.worker,g.activities.harvests,g.machines.filter(m=>m.type==='battery').length];}),[true,true,true,true,'equipped',1,1]);mark('Actual IndexedDB reload preserves opening, earned rewards and exactly one starter battery');
 writeFileSync('media/opening/results.json',JSON.stringify({marks,errors},null,2));
}catch(error){console.error(error);for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:'media/opening/failure.png'});console.error(await page.evaluate(()=>{const g=window.marsstead;if(!g)return null;return {pos:g.pos,opening:g.opening,goal:g.experience.goal.innerText,crew:g.crew.visible,burrow:g.burrowUI.visible,habitat:g.habitat.active,worker:g.activities.worker,air:g.air,airborne:g.airborne,reading:g.reading,crewBlocked:g.crew.blocked(),crewEligible:g.crew.eligible(),focus:document.activeElement?.tagName,buggy:g.buggy,field:g.fieldUI.visible};}));}throw error;}finally{await browser.close();}
