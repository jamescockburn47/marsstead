// Local disposable regression for funded work visuals and grounded reel cuts.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
 const context=await browser.newContext();
 await context.route('**/brain/**',r=>r.fulfill({status:503,body:''}));
 await context.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const page=await context.newPage();
 await page.goto(process.env.FIRSTLIGHT_URL||'http://127.0.0.1:5207/?play');
 await page.waitForFunction(()=>window.marsstead?.ready);
 const result=await page.evaluate(async()=>{
   const g=window.marsstead,{createBurrow,plan,tick}=await import('/src/burrow.js');
   window.requestAnimationFrame=()=>0;g.persist=()=>{};
   g.burrow=createBurrow();plan(g.burrow,'shaft',0,1);g.power.charge=0;g.t=9;g.frameWorld(.01);
   const unfunded={dug:g.burrow.cells.get('0,1').dug,phase:g.crownLayer.drones[2].userData.workPhase,carrying:g.crownLayer.drones[2].userData.carrying};
   g.power.charge=12;tick(g.burrow,.01,3,kwh=>{g.power.charge-=kwh;return true;});g.frameWorld(.01);
   const funded={dug:g.burrow.cells.get('0,1').dug,phase:g.crownLayer.drones[2].userData.workPhase,carrying:g.crownLayer.drones[2].userData.carrying};
   g.power.charge=0;g.machines=[];g.calibrateToLocalHour(1);g.frameWorld(.1);
   const shed={shed:g.grid.shed,phase:g.crownLayer.drones[2].userData.workPhase,carrying:g.crownLayer.drones[2].userData.carrying};
   g.enterAttract();
   const yardGap=g.buggy.y-g.wheelGround(g.buggy.x,g.buggy.z,g.buggy.heading).h;
   g.attractT=55;g.frameAttract(0);
   const driveGap=g.buggy.y-g.wheelGround(g.buggy.x,g.buggy.z,g.buggy.heading).h;
   return{unfunded,funded,shed,yardGap,driveGap};
 });
 assert.equal(result.unfunded.dug,0);assert.equal(result.unfunded.phase,'standby');assert.equal(result.unfunded.carrying,false);
 assert.ok(result.funded.dug>0);assert.equal(result.funded.phase,'hauling');assert.equal(result.funded.carrying,true);
 assert.ok(result.shed.shed.includes('drone'));assert.equal(result.shed.phase,'standby');assert.equal(result.shed.carrying,false);
 assert.ok(Math.abs(result.yardGap)<.01&&Math.abs(result.driveGap)<.35);
 console.log('work presentation: unfunded/shed standby, funded loaded haul, grounded yard and night-drive cuts pass');
} finally { await browser.close(); }
