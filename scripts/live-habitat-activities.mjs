import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
mkdirSync('media/habitat-activities',{recursive:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.routeWebSocket('**',s=>s.close());
 await context.route('**/brain/**',r=>r.fulfill({status:503,body:'Offline test'}));
 await context.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(process.env.FIRSTLIGHT_URL||'http://127.0.0.1:5207/?play');
 await page.waitForFunction(()=>window.marsstead?.ready&&window.marsstead.activityLoop,null,{timeout:60000});
 await page.evaluate(async()=>{
  const g=window.marsstead,{createBurrow,plan,tick,installRing}=await import('/src/burrow.js');
  // This activity regression owns its workshop/garden assignment, not the new starter layout.
  g.opening=null;g.burrow=createBurrow();
  g.activities=(await import('/src/habitat-activities.js')).acceptHabitatActivities(null);
  // Disposable earned-layout fixture, through the actual construction rules.
  for(const [p,c,d] of [['shaft',0,1],['corridor',1,1],['bay',2,1],['corridor',-1,1],['garden',-2,1]]){
   if(!plan(g.burrow,p,c,d))throw Error('Illegal activity fixture '+p);tick(g.burrow,120,3,()=>true);
  }
  installRing(g.burrow);g.inLander=false;g.driving=false;
 });
 const surface=async(x,z)=>page.evaluate(async({x,z})=>{
  const g=window.marsstead,{meshGroundHeight}=await import('/src/marschunk.js');
  g.habitat.exit();g.pos.set(x,meshGroundHeight(x,z),z);g.vel.set(0,0,0);g.clearInput();
 },{x,z});
 const phase=()=>page.evaluate(()=>window.marsstead.activities.worker);
 await surface(120,-86);await page.keyboard.press('KeyE');assert.equal(await phase(),'carried');
 await page.keyboard.press('KeyE');assert.equal(await phase(),'carried','worker cannot be collected twice');
 await page.evaluate(()=>window.marsstead.persist());await page.waitForTimeout(350);await page.reload();
 await page.waitForFunction(()=>window.marsstead?.ready);assert.equal(await phase(),'carried','carried worker survives real IndexedDB reload');
 const home=await page.evaluate(()=>({x:window.marsstead.crownPos.x,z:window.marsstead.crownPos.z+2}));
 await surface(home.x,home.z);
 await page.evaluate(()=>window.marsstead.habitat.enter('2,1'));
 await page.waitForTimeout(200);await page.keyboard.press('KeyE');assert.equal(await phase(),'carried','must approach actual bench');
 // Walk down the clear aisle towards the bench; do not teleport through furniture.
 await page.evaluate(()=>{window.marsstead.camYaw=Math.PI;});
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.marsstead.habitat.pos.z<-.85,null,{timeout:5000});await page.keyboard.up('KeyW');
 await page.keyboard.press('KeyE');assert.equal(await phase(),'bench');
 await page.evaluate(()=>window.marsstead.habitat.key({code:'KeyE',repeat:true}));assert.equal(await phase(),'bench','key repeat cannot skip repair stages');
 await page.keyboard.press('KeyE');assert.equal(await phase(),'diagnosed');
 await page.waitForTimeout(150);await page.screenshot({path:'media/habitat-activities/01-workshop.png'});
 await page.keyboard.press('KeyE');assert.equal(await phase(),'repaired');
 await page.keyboard.press('KeyE');assert.equal(await phase(),'equipped');
 console.log('Worker: rescue, actual save/reload, approach, bench, diagnosis, refit and equipment pass.');
 await page.evaluate(async()=>{
  const g=window.marsstead,{plan,tick}=await import('/src/burrow.js');
  for(const [p,c] of [['shaft',0],['corridor',-1],['bay',-2],['corridor',1],['garden',2]]){
   if(!plan(g.burrow,p,c,2))throw Error('Illegal expansion');tick(g.burrow,120,3,()=>true);
  }
  g.habitat.refresh();g.activityLoop.refreshVisuals();g.habitat.exit();g.habitat.enter('-2,2');
 });
 await page.keyboard.press('KeyE');
 assert.ok(await page.evaluate(()=>window.marsstead.habitat.message.includes('2,1')),'second workshop directs to assigned bench');
 assert.equal(await page.evaluate(()=>window.marsstead.activities.benchRoom),'2,1');
 assert.equal(await page.evaluate(()=>window.marsstead.activities.cropRoom),'-2,1','new garden does not relocate crop');
 await page.evaluate(()=>{const g=window.marsstead;g.habitat.exit();g.habitat.enter('-2,1');});
 await page.waitForTimeout(150);await page.keyboard.press('KeyE');
 assert.equal(await page.evaluate(()=>window.marsstead.activities.crop.phase),'planted');
 await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.activities.crop.phase),'watered');
 await page.locator('#session-tools [data-action=pause]').click();
 const growth=await page.evaluate(()=>window.marsstead.activities.crop.growth);
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.marsstead.activities.crop.growth),growth);
 assert.equal(await page.evaluate(()=>window.marsstead.activityLoop.act('harvest').ok),false);
 await page.locator('#session-card [data-action=resume]').click();
 await page.evaluate(()=>{window.marsstead.camYaw=0;window.marsstead.camPitch=.25;});
 await page.screenshot({path:'media/habitat-activities/02-nursery.png'});
 console.log('Crop planted and watered; pause freezes growth. Waiting for real active growth while the worker excavates.');
 await surface(118,-85);
 await page.evaluate(()=>window.marsstead.under.requestEnter('field'));
 assert.equal(await page.locator('#under-intro').isVisible(),false,'closed field hatch denies entry');
 await page.keyboard.press('KeyE');assert.equal(await phase(),'deployed');
 await page.waitForTimeout(1500);
 await page.evaluate(()=>{const g=window.marsstead;g.camYaw=Math.PI;g.camPitch=.28;});
 await page.screenshot({path:'media/habitat-activities/03-excavating.png'});
 await page.waitForFunction(()=>window.marsstead.activities.routeOpen,null,{timeout:25000});
 await page.keyboard.press('KeyE');await page.locator('#under-intro [data-action=enter]').click();
 assert.equal(await page.evaluate(()=>window.marsstead.under.active),true);
 await page.locator('#under-instruments [data-action=exit]').click();
 assert.ok(await page.evaluate(()=>Math.hypot(window.marsstead.pos.x-118,window.marsstead.pos.z+85)<.1),'exit returns to field hatch');
 console.log('Excavation: timed working spider opens usable entrance, descent and return preserve field position.');
 await surface(home.x,home.z);await page.evaluate(()=>window.marsstead.habitat.enter('-2,1'));
 await page.waitForFunction(()=>window.marsstead.activities.crop.phase==='ready',null,{timeout:80000});
 await page.evaluate(()=>{window.marsstead.camYaw=0;window.marsstead.camPitch=.25;});
 await page.screenshot({path:'media/habitat-activities/04-harvest.png'});
 await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.activities.rations),1);
 await page.evaluate(()=>window.marsstead.persist());await page.waitForTimeout(350);await page.reload();await page.waitForFunction(()=>window.marsstead?.ready);
 assert.equal(await page.evaluate(()=>window.marsstead.activities.rations),1);
 assert.equal(await page.evaluate(()=>window.marsstead.activities.routeOpen),true);
 await page.locator('#habitat-activity [data-act=eat]').click();
 assert.equal(await page.evaluate(()=>window.marsstead.activities.rations),0);
 assert.ok(await page.evaluate(()=>window.marsstead.restedUntil>window.marsstead.simMillis&&window.marsstead.restedQ>=.35));
 assert.deepEqual(errors,[]);console.log('Crop: real active growth, harvest, persistent reward and eating bonus pass; no page errors.');
 const phoneContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await phoneContext.routeWebSocket('**',s=>s.close());
 await phoneContext.route('**/brain/**',r=>r.fulfill({status:503,body:'Offline test'}));
 await phoneContext.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const phone=await phoneContext.newPage();await phone.goto(process.env.FIRSTLIGHT_URL||'http://127.0.0.1:5207/?play');await phone.waitForFunction(()=>window.marsstead?.ready);
 await phone.evaluate(async()=>{
  const g=window.marsstead,{meshGroundHeight}=await import('/src/marschunk.js');g.inLander=false;g.driving=false;
  g.opening=null;g.burrow=(await import('/src/burrow.js')).createBurrow();
  g.activities=(await import('/src/habitat-activities.js')).acceptHabitatActivities(null);
  g.pos.set(120,meshGroundHeight(120,-86),-86);
 });
 await phone.locator('#habitat-activity [data-act=use]').tap();
 assert.equal(await phone.evaluate(()=>window.marsstead.activities.worker),'carried','touch recovers worker');
 await phone.evaluate(async()=>{
  const g=window.marsstead,{plan,tick,installRing}=await import('/src/burrow.js'),{meshGroundHeight}=await import('/src/marschunk.js');
  for(const [p,c] of [['shaft',0],['corridor',1],['garden',2]]){if(!plan(g.burrow,p,c,1))throw Error('Illegal phone activity fixture '+p);tick(g.burrow,120,3,()=>true);}installRing(g.burrow);
  g.pos.set(g.crownPos.x,meshGroundHeight(g.crownPos.x,g.crownPos.z+2),g.crownPos.z+2);g.habitat.enter('2,1');
 });
 await phone.locator('#habitat-tools [data-act=use]').tap();await phone.locator('#habitat-tools [data-act=use]').tap();
 assert.equal(await phone.evaluate(()=>window.marsstead.activities.crop.phase),'watered','touch plants and waters');
 await phone.screenshot({path:'media/habitat-activities/05-phone.png'});
 console.log('Touch: recover worker, plant and water through visible buttons pass.');
 await phoneContext.close();
} finally {await browser.close();}
