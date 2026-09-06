import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const out = 'media/teaser60'; mkdirSync(out,{recursive:true});
const FPS=24, W=1280,H=720;
const exe=process.env.CHROMIUM_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({executablePath:exe,headless:true});
const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
await ctx.route('**/brain/**',r=>r.fulfill({status:503,body:'Teaser offline'}));
await ctx.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
await ctx.routeWebSocket('**', ws=>ws.close());
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5207/?play&gfx=fine');
await page.waitForFunction(()=>window.marsstead?.ready,null,{timeout:60000});
await page.waitForTimeout(4000);
await page.evaluate(async()=>{
 const g=window.marsstead;
 window.requestAnimationFrame=()=>0;
 g.persist=()=>{};g.maybePing=()=>{};g.say=()=>{};
 g.enterAttract();g.attract=true;g.attractVeil.style.display='none';
 const s=document.createElement('style');s.textContent='body > *:not(canvas):not(#teaserCaption):not(style):not(script):not(#burrow){visibility:hidden!important} #teaserCaption{position:fixed;z-index:999;inset:0;pointer-events:none;color:#f5eee0;font-family:Arial,sans-serif} #teaserCaption .brand{position:absolute;top:32px;left:42px;letter-spacing:5px;font-size:16px} #teaserCaption .bottom{position:absolute;left:42px;bottom:42px;text-shadow:0 2px 12px #000;font-size:32px;letter-spacing:1px} #teaserCaption .sub{font-size:14px;letter-spacing:2px;margin-top:12px;color:#d2bc9a} #teaserCaption .centre{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(5,9,10,.35)} #teaserCaption h1{font-size:74px;letter-spacing:18px;font-weight:400;margin:0} #teaserCaption .rule{width:90px;height:1px;background:#d9aa72;margin:24px auto}';document.head.appendChild(s);
 const c=document.createElement('div');c.id='teaserCaption';document.body.appendChild(c);
 window.teaser={g,c,ground:(await import('/src/marschunk.js')).meshGroundHeight};
});
await page.waitForTimeout(100);
const shots=[
 {id:'planet',dur:3,label:'A whole planet to explore.',sub:'ALL OF MARS · PLOT A HOP · LAND · ROAM',start:3,span:8},
 {id:'descent',dur:6,label:'Choose your ground. Make your landing.',sub:'ROCKET DESCENT · TOUCH DOWN · EXPLORE'},
 {id:'stead',dur:4,label:'Make something worth returning to.',sub:'POWER · MANUFACTURE · BUILD',start:41,span:8},
 {id:'drive',dur:6,label:'Follow your own lights.',sub:'LOW GRAVITY · NIGHT EXPLORATION',start:55,span:7},
 {id:'spider',dur:5,label:'Many little hands.',sub:'SPIDER WORKERS · DIGGING AND MANUFACTURING'},
 {id:'flyer',dur:5,label:'And a little lift.',sub:'FLYING WORKERS · LIFT AND HAUL'},
 {id:'plan',dur:4,label:'Draw your home.',sub:'YOUR PLAN BECOMES YOUR PLACE'},
 {id:'habitat',dur:6,label:'Then live inside it.',sub:'WARMTH · AIR · A PLACE TO REST'},
 {id:'garden',dur:8,label:'Grow a little life.',sub:'WALK YOUR HOME · VISIT YOUR GREENHOUSE'},
 {id:'cave',dur:8,label:'There is more beneath the surface.',sub:'FOLLOW THE WORKERS INTO THE DARK'},
 {id:'dusk',dur:2,label:'A voice in the silence.',sub:'VESPER · YOUR LIVE AI COMPANION',start:73,span:6},
 {id:'end',dur:3,label:'',sub:'',start:80,span:4},
];
const selected=process.env.TEASER_SHOTS?.split(',');
for(const shot of shots){
 if(selected&&!selected.includes(shot.id))continue;
 await page.evaluate(async s=>{
  const {g,c,ground}=window.teaser;
  g.habitat?.exit();g.under?.exit();g.burrowUI.close();g.clearInput();g.attract=true;
  g.terrain.setVisible(true);g.rocks.setVisible(true);g.globe.setVisible(false);g.vista.setVisible(false);
  g.attractShotId='';g.attractT=s.start||41;g.frame(g.last+1);
  g.air=1;g.warm=1;
  if(s.id==='descent'){
   g.attract=false;g.hopper.state='parked';g.hopper.hop=null;g.hopper.fuelKg=660;
   g.hopper.x=g.crownPos.x-1800;g.hopper.z=g.crownPos.z+120;
   g.igniteHop(g.crownPos.x+50,g.crownPos.z+35,false);
   if(!g.hopper.hop)throw Error('Landing shot requires a valid actual hop');
   g.hopper.hop.t=g.hopper.hop.dur.total-4.5;
   window.teaser.landing={x:g.hopper.hop.to[0],z:g.hopper.hop.to[1]};
   g.frameFlight(0);g.terrain.setVisible(true);g.rocks.setVisible(true);g.vista.setVisible(false);
  }
  if(s.id==='spider'||s.id==='flyer'){
   const {plan,tick}=await import('/src/burrow.js');
   g.burrow.cells.delete('0,3');g.burrow.queue=g.burrow.queue.filter(k=>k!=='0,3');
   plan(g.burrow,'shaft',0,3);g.power.charge=12;tick(g.burrow,.01,g.droneCount,kwh=>{if(g.power.charge<kwh)return false;g.power.charge-=kwh;return true;});
   g.t=s.id==='spider'?9:4.2;
  }
  if(s.id==='drive'){
   const initialGap=g.buggy.y-g.wheelGround(g.buggy.x,g.buggy.z,g.buggy.heading).h;
   if(Math.abs(initialGap)>.35||g.buggy.airborne)throw Error(`Drive cut is not grounded: gap ${initialGap}`);
   for(let i=0;i<120;i++){g.attractT=s.start;g.frame(g.last+1000/60);}
   const gap=g.buggy.y-g.wheelGround(g.buggy.x,g.buggy.z,g.buggy.heading).h;
   if(Math.abs(gap)>.35||g.buggy.airborne)throw Error(`Drive has not grounded: gap ${gap}`);
   window.teaser.driveOpening={gap,airborne:g.buggy.airborne,y:g.buggy.y};
  }
  if(s.id==='plan'){g.burrowUI.open();g.burrowUI.root.style.visibility='visible';}
  if(s.id==='habitat'||s.id==='garden'){
   if(!g.habitat)throw Error('Habitat runtime not ready');
   g.attract=false;g.pos.set(g.crownPos.x,ground(g.crownPos.x,g.crownPos.z+3),g.crownPos.z+3);
   g.habitat.enter(s.id==='garden'?'1,2':'1,1');g.habitat.pos.x=s.id==='garden'?8:10;g.habitat.pos.z=0;
  }
  if(s.id==='cave'){
   g.attract=false;g.under.enter('uneasy');
   const {centreAt,floorAt}=await import('/src/underworld.js');const p=centreAt(72);window.teaser.centreAt=centreAt;
   g.under.pos.set(p.x,floorAt(p.x,72),72);g.camYaw=.1;g.under.mode=1;
  }
  c.innerHTML=s.id==='end'?'<div class="centre"><div><h1>MARSSTEAD</h1><div class="rule"></div><div style="font-size:23px;letter-spacing:3px">A little light. A very large planet.</div><div style="margin-top:30px;font-size:18px;letter-spacing:3px">marsstead.app</div><div class="sub">DEVELOPMENT GAMEPLAY · BROWSER FIRST</div></div></div>':`<div class="brand">MARSSTEAD</div><div class="bottom">${s.label}<div class="sub">${s.sub}</div></div>`;
 c.style.background=s.id==='end'?'':'linear-gradient(transparent 63%,rgba(0,0,0,.77))';
 if(s.id==='plan')c.innerHTML='<div style="position:absolute;top:0;left:0;right:0;height:76px;background:#202727;box-sizing:border-box;padding:14px 30px;font-size:27px">Draw your home.<div class="sub" style="margin-top:4px">YOUR PLAN BECOMES YOUR PLACE</div></div>';
 },shot);
 // Stabilise shader compilation, terrain queues and exposure with the real renderer.
 await page.evaluate(()=>{const g=window.teaser.g;for(let i=0;i<500;i++){g.terrain.update(g.pos.x,g.pos.z);g.rocks.update(g.pos.x,g.pos.z);if(!g.terrain.queue.length&&!g.rocks.queue.length)break;}for(let i=0;i<30;i++){g.frameWorld(.1);g.renderFrame(.1);}});
 const evidence={start:await page.evaluate(()=>{const g=window.teaser.g;return{t:g.t,under:g.under.pos.toArray(),buggy:window.teaser.driveOpening};}),samples:[]};
 const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS),'-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',`${out}/${shot.id}.mp4`]);
 let ferr='';ff.stderr.on('data',d=>ferr+=d);const done=once(ff,'close');
 for(let i=0;i<shot.dur*FPS;i++){
  await page.evaluate(({s,i,FPS})=>{
   const {g,ground}=window.teaser;const k=i/(s.dur*FPS);
   if(s.id==='cave'){g.keys.KeyW=true;const p=g.under.pos,q=window.teaser.centreAt(p.z+3);g.camYaw=Math.atan2(q.x-p.x,3);}
   if(s.id==='habitat'||s.id==='garden'){const walk=s.id==='garden'?.35:.25;g.keys.KeyW=k<walk;g.camYaw=Math.PI/2+Math.min(1,Math.max(0,(k-walk)/.4))*1.23;}
   if(g.attract)g.attractT=(s.start||41)+(s.span||1)*k;
   g.frame(g.last+1000/FPS);
   if(s.id==='descent'){
    const p=window.teaser.landing,y=ground(p.x,p.z);
    g.cam.position.set(p.x+32,y+13,p.z+36);g.cam.lookAt(p.x,y+10,p.z);
    g.colonist.group.visible=false;g.renderFrame(0);
   }
   if(s.id==='spider'||s.id==='flyer'){
    const worker=g.crownLayer.drones[s.id==='spider'?0:2];
    const target=worker.getWorldPosition(g.cam.position.clone());
    const angle=(s.id==='spider'?0:.5)+k*.25, distance=s.id==='spider'?1.65:2.8;
    g.cam.position.set(target.x+Math.sin(angle)*distance,target.y+(s.id==='spider'?1.1:.3),target.z+Math.cos(angle)*distance);
    g.cam.lookAt(target.x,target.y+(s.id==='spider'?.2:-.12),target.z);g.renderFrame(0);
   }


  },{s:shot,i,FPS});
  const buf=await page.screenshot({type:'jpeg',quality:94});
  if(shot.id==='cave'&&i>=48&&i<=51){writeFileSync(`${out}/cave-step-${i}.jpg`,buf);evidence.samples.push(await page.evaluate(()=>{const g=window.teaser.g;return{t:g.t,pos:g.under.pos.toArray(),velocity:g.under.vel.toArray()};}));}
  if(i===Math.floor(shot.dur*FPS/2))writeFileSync(`${out}/${shot.id}-poster.jpg`,buf);
  if(!ff.stdin.write(buf))await once(ff.stdin,'drain');
 }
 ff.stdin.end();const [code]=await done;if(code!==0)throw Error(ferr);
 evidence.end=await page.evaluate(()=>{const g=window.teaser.g;return{t:g.t,under:g.under.pos.toArray(),hopperState:g.hopper.state,hopActive:!!g.hopFlight,workers:g.crownLayer.drones.slice(0,3).map(w=>({phase:w.userData.workPhase,carrying:w.userData.carrying}))};});
 if(shot.id==='descent'&&(evidence.end.hopperState!=='parked'||evidence.end.hopActive))throw Error('Rocket did not complete its real landing');
 if(shot.id==='cave'&&(evidence.end.under[2]-evidence.start.under[2]<10||Math.abs(evidence.end.t-evidence.start.t-shot.dur)>.01))throw Error('Tunnel capture did not follow real single-step walking');
 writeFileSync(`${out}/${shot.id}-evidence.json`,JSON.stringify(evidence,null,2));
 console.log(`captured ${shot.id} ${shot.dur}s`);
}
writeFileSync(`${out}/capture-errors.json`,JSON.stringify(errors,null,2));
writeFileSync(`${out}/shot-list.json`,JSON.stringify(shots,null,2));
await browser.close();
