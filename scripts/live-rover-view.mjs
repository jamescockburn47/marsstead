// The simulation can pass while bloom spreads an invalid normal into a black view.
// Disposable placement-only fixture; verify the actual fine-tier rendered pixels.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright-core';
const visibleScene=s=>s.mean>25&&s.coloured>.3;
assert.equal(visibleScene({mean:0,coloured:0}),false,'black framebuffer counterexample fails');
assert.equal(visibleScene({mean:3.5,coloured:0}),false,'grade grain cannot disguise a missing scene');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
mkdirSync('media/opening',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.routeWebSocket('**',s=>s.close());
 await context.route('**/brain/**',r=>r.fulfill({status:503,body:'Offline test'}));
 await context.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.FIRSTLIGHT_URL||'http://127.0.0.1:5207'}/?play`);
 await page.waitForFunction(()=>window.marsstead?.ready,null,{timeout:60000});
 await page.evaluate(()=>{const g=window.marsstead;g.gfxManual=true;g.applyQuality('fine');
  g.pos.set(g.buggy.x-2,g.groundAt(g.buggy.x-2,g.buggy.z),g.buggy.z);
  g.vel.set(0,0,0);g.vy=0;g.airborne=false;g.focusWorld();});
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.marsstead.driving);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1500);
 for(const pitch of [.16,.32,.5]){
  await page.evaluate(pitch=>{window.marsstead.camPitch=pitch;},pitch);await page.waitForTimeout(500);
  const pixels=await page.evaluate(()=>{const g=window.marsstead;
   if(g.gfxQuality!=='fine'||!g.post.bloom.enabled)throw Error('Fine bloom must remain enabled');
   if(!g.cam.matrixWorld.elements.every(Number.isFinite))throw Error('Camera matrix must be finite');
   g.renderFrame(0);const sample=document.createElement('canvas');sample.width=96;sample.height=64;
   const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(g.renderer.domElement,320,200,760,450,0,0,96,64);
   const rgba=ctx.getImageData(0,0,96,64).data;let total=0,coloured=0;
   for(let i=0;i<rgba.length;i+=4){total+=rgba[i]+rgba[i+1]+rgba[i+2];if(Math.max(rgba[i],rgba[i+1],rgba[i+2])-Math.min(rgba[i],rgba[i+1],rgba[i+2])>15)coloured++;}
   return {mean:total/(96*64*3),coloured:coloured/(96*64)};});
  assert.ok(visibleScene(pixels),`rover view at pitch ${pitch} must show lit Mars: ${JSON.stringify(pixels)}`);
  console.log('Fine rover pixels',pitch,pixels);
 }
 await page.keyboard.up('KeyW');await page.evaluate(()=>{window.marsstead.camPitch=.16;});await page.waitForTimeout(500);
 await page.screenshot({path:'media/opening/15-rover-visibility.png'});
 await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.marsstead.driving),false);
 assert.deepEqual(errors,[]);console.log('Rover visibility: fine MSAA/bloom, three viewing angles, actual driving and dismount pass.');
}finally{await browser.close();}
