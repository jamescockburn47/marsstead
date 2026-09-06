import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const ctx=await b.newContext({viewport:{width:1440,height:900}});await ctx.routeWebSocket('**',s=>s.close());
 await ctx.route('**/brain/**',r=>r.fulfill({status:503,body:'Isolated visual verification'}));await ctx.route('**/dash/**',r=>r.fulfill({status:200,body:'{}'}));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|THREE|WebGL/.test(m.text()))errors.push(m.text());});
 await p.goto('http://127.0.0.1:5207/media/visual-session/index.html');
 const buttons=p.locator('.scenes button');assert.equal(await buttons.count(),15);
 for(let i=0;i<15;i++){await buttons.nth(i).click();await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));}
 await p.locator('#before').click();assert.equal(await p.locator('#mix').inputValue(),'0');
 await p.locator('#split').click();assert.equal(await p.locator('#mix').inputValue(),'50');
 await p.locator('#after').click();assert.equal(await p.locator('#mix').inputValue(),'100');
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'review fits phone');
 await p.setViewportSize({width:1440,height:900});await p.goto('http://127.0.0.1:5207/?play');await p.waitForFunction(()=>window.marsstead?.ready);
 const size=selector=>p.locator(selector).evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 await p.evaluate(()=>{const g=marsstead;g.settings.textScale=1;g.experience.applySettings();});const base=await size('#first-light h2');
 await p.evaluate(()=>{const g=marsstead;g.settings.textScale=1.4;g.experience.applySettings();});assert(Math.abs(await size('#first-light h2')/base-1.4)<.01,'heading respects text scale');
 await p.setViewportSize({width:390,height:844});
 await p.evaluate(()=>document.documentElement.style.setProperty('--mars-text-scale','1'));const roomBase=await size('#habitat-tools p');
 await p.evaluate(()=>document.documentElement.style.setProperty('--mars-text-scale','1.4'));assert(Math.abs(await size('#habitat-tools p')/roomBase-1.4)<.01,'mobile room text respects text scale');
 assert.deepEqual(errors,[]);console.log('Visual review: 15 complete pairs, comparison controls, phone fit, scalable game/room text and browser shaders pass');
}finally{await b.close();}
