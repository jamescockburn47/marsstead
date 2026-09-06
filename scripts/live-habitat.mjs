import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const executablePath=process.env.CHROMIUM_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/opt/pw-browsers/chromium'].find(existsSync);
const url=process.env.FIRSTLIGHT_URL||'http://127.0.0.1:5207/?play';
const browser=await chromium.launch({executablePath,headless:true});
mkdirSync('media/habitat-live',{recursive:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 // Keep this disposable regression on the module version loaded at entry.
 await context.routeWebSocket('**', socket=>socket.close());
 await context.route('**/brain/**',r=>r.fulfill({status:503,body:'Offline test'}));
 await context.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForFunction(()=>window.marsstead?.ready,null,{timeout:60000});
 await page.evaluate(async()=>{
   const g=window.marsstead,{createBurrow,plan,tick,installRing}=await import('/src/burrow.js');
   const {meshGroundHeight}=await import('/src/marschunk.js');
   // Authored legacy layout: the new-game starter rooms are not part of this fixture.
   g.opening=null;g.burrow=createBurrow();
   g.activities=(await import('/src/habitat-activities.js')).acceptHabitatActivities(null);
   // Earned-layout fixture through actual rules, accelerated power/time; separate save.
   for(const [p,c,d] of [['shaft',0,1],['corridor',1,1],['bunk',2,1],['corridor',-1,1],['garden',-2,1],['shaft',0,2]]) {
     if(!plan(g.burrow,p,c,d))throw Error('Illegal fixture plan');tick(g.burrow,120,3,()=>true);
   }
   installRing(g.burrow);g.pos.set(g.crownPos.x,meshGroundHeight(g.crownPos.x,g.crownPos.z+2),g.crownPos.z+2);
   g.air=.5;g.warm=.5;g.burrowUI.open();
 });
 await page.locator('#benter').click();assert.equal(await page.evaluate(()=>window.marsstead.habitat.active),true);
 const surface=await page.evaluate(()=>window.marsstead.pos.toArray());
 await page.waitForTimeout(600);
 assert.ok(await page.evaluate(()=>window.marsstead.air>.5&&window.marsstead.warm>.5),'sealed interior recovers vitals');
 await page.screenshot({path:'media/habitat-live/01-shaft.png'});
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.marsstead.habitat.room?.piece==='bunk',null,{timeout:18000});await page.keyboard.up('KeyW');
 assert.equal(await page.evaluate(()=>window.marsstead.habitat.room.piece),'bunk','walk through actual connected doors into bunk');
 assert.deepEqual(await page.evaluate(()=>window.marsstead.pos.toArray()),surface,'surface save coordinate stays isolated');
 await page.evaluate(()=>{window.marsstead.camYaw=Math.PI;});await page.waitForTimeout(100);
 await page.screenshot({path:'media/habitat-live/02-bunk.png'});
 await page.keyboard.down('KeyW');await page.waitForTimeout(2500);await page.keyboard.up('KeyW');
 assert.ok(await page.evaluate(()=>window.marsstead.habitat.pos.z>-4),'walls block walking');
 await page.locator('#session-tools [data-action=pause]').click();
 const frozen=await page.evaluate(()=>[window.marsstead.t,window.marsstead.air,...window.marsstead.habitat.pos.toArray()]);
 await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>[window.marsstead.t,window.marsstead.air,...window.marsstead.habitat.pos.toArray()]),frozen);
 await page.locator('#session-card [data-action=resume]').click();
 await page.evaluate(async()=>{
   const g=window.marsstead,{sunElevation}=await import('/src/marstime.js'),{worldToLatLon}=await import('/src/mars.js');
   const {lat,lon}=worldToLatLon(g.pos.x,g.pos.z);
   for(let i=0;i<24;i++){const time=g.simMillis+i*3700000;if(sunElevation(time,lat,lon)<-10){g.simMillis=time;break;}}
 });
 await page.waitForTimeout(150);await page.keyboard.press('KeyE');
 assert.ok(await page.evaluate(()=>!!window.marsstead.sleepAnim),'bunk starts real night sleep');
 await page.locator('#habitat-tools [data-act=works]').click();
 assert.equal(await page.evaluate(()=>window.marsstead.sleepAnim),null,'leaving cancels sleep fade');
 assert.equal(await page.evaluate(()=>window.marsstead.hud.veil.style.opacity),'0','exit removes sleep blackout');
 await page.locator('#under-intro [data-action=cancel]').click();
 assert.equal(await page.evaluate(()=>window.marsstead.habitat.room.piece),'bunk','cancel descent returns to bunk');
 await page.keyboard.press('KeyE');
 await page.waitForTimeout(3600);assert.equal(await page.evaluate(()=>window.marsstead.sleepAnim),null);
 assert.equal(await page.evaluate(()=>window.marsstead.air),1);
 await page.evaluate(()=>{const h=window.marsstead.habitat;h.pos.set(0,0,0);h.depth=1;});
 await page.locator('#habitat-tools [data-act=down]').click();assert.equal(await page.evaluate(()=>window.marsstead.habitat.depth),2);
 await page.locator('#habitat-tools [data-act=up]').click();assert.equal(await page.evaluate(()=>window.marsstead.habitat.depth),1);
 await page.locator('#habitat-tools [data-act=plan]').click();
 await page.locator('#benter').click();assert.equal(await page.evaluate(()=>window.marsstead.burrowUI.visible),false,'enter from planner resumes habitat');
 await page.locator('#habitat-tools [data-act=plan]').click();
 await page.locator('#bexplore').click();
 await page.locator('#under-intro [data-action=enter]').click();assert.equal(await page.evaluate(()=>window.marsstead.under.active),true);
 await page.locator('#under-instruments [data-action=exit]').click();assert.equal(await page.evaluate(()=>window.marsstead.habitat.active),true);
 await page.evaluate(()=>window.marsstead.persist());await page.reload();await page.waitForFunction(()=>window.marsstead?.ready);
 assert.equal(await page.evaluate(()=>window.marsstead.habitat.active),false);
 assert.deepEqual(await page.evaluate(()=>window.marsstead.pos.toArray()),surface);
 assert.equal(await page.evaluate(()=>window.marsstead.burrow.cells.get('2,1').piece),'bunk');
 assert.deepEqual(errors,[]);console.log('habitat: actual connected walking, wall collision, shelter, sleep, ladder, workings return, pause and safe save/reload pass');
 const phoneContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await phoneContext.routeWebSocket('**', socket=>socket.close());
 await phoneContext.route('**/brain/**',r=>r.fulfill({status:503,body:''}));
 await phoneContext.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const phone=await phoneContext.newPage();await phone.goto(url);await phone.waitForFunction(()=>window.marsstead?.ready);
 await phone.evaluate(async()=>{
   const g=window.marsstead,{meshGroundHeight}=await import('/src/marschunk.js');
   g.opening=null;g.burrow=(await import('/src/burrow.js')).createBurrow();
   g.activities=(await import('/src/habitat-activities.js')).acceptHabitatActivities(null);
   g.burrow.cells.set('0,1',{piece:'shaft',dug:1,funded:true});
   g.pos.set(g.crownPos.x,meshGroundHeight(g.crownPos.x,g.crownPos.z+2),g.crownPos.z+2);g.burrowUI.open();
 });
 await phone.locator('#benter').tap();
 const before=await phone.evaluate(()=>window.marsstead.habitat.pos.x);
 const input=await phoneContext.newCDPSession(phone);
 await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:92,y:748}]});
 await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:92,y:682}]});
 await phone.waitForTimeout(800);
 await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(await phone.evaluate(x=>window.marsstead.habitat.pos.x>x+.2,before),'touch forward follows interior view');
 await phone.screenshot({path:'media/habitat-live/03-phone.png'});
 await phone.locator('#habitat-tools [data-act=exit]').tap();assert.equal(await phone.evaluate(()=>window.marsstead.habitat.active),false);
 await phoneContext.close();console.log('habitat: actual touch entry, forward movement and exit pass');
}finally{await browser.close();}
