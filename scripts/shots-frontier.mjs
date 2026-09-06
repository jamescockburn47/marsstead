import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const output='media/redesign';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5207/prototypes/frontier/index.html');
 await page.waitForFunction(()=>window.frontier,{timeout:30000});
 await page.waitForTimeout(1800);
 const normalScores=await page.evaluate(()=>frontier.world.group.children.filter(m=>m.name==='geological-mesa').map(m=>{
  const p=m.geometry.attributes.position,n=m.geometry.attributes.normal,c=m.userData.centre;let sum=0;
  for(let i=0;i<Math.min(65,p.count);i++)sum+=(p.getX(i)-c.x)*n.getX(i)+(p.getZ(i)-c.z)*n.getZ(i);
  return sum/Math.min(65,p.count);
 }));
 assert.equal(normalScores.length,10);assert.ok(normalScores.every(score=>score>0),'Mesa surfaces face outward, not inside-out');
 const evidence=[];
 for(const mode of ['sunset','survey','night'])for(const view of ['basin','station','rover','suit']){
  await page.evaluate(({mode,view})=>{window.frontier.lighting(mode);window.frontier.view(view);}, {mode,view});
  await page.waitForTimeout(200);
  await page.screenshot({path:`${output}/${view}-${mode}.png`});
  evidence.push(await page.evaluate(()=>({mode:frontier.mode,draws:frontier.renderer.info.render.calls,triangles:frontier.renderer.info.render.triangles,geometries:frontier.renderer.info.memory.geometries})));
 }
 await page.getByRole('button',{name:'Modest graphics'}).click();
 assert.equal(await page.evaluate(()=>frontier.modest),true);
 await page.getByRole('button',{name:'Clear day',exact:true}).click();
 await page.getByRole('button',{name:'The frontier',exact:true}).click();
 await page.getByRole('button',{name:'Walk view',exact:true}).click();
 const before=await page.evaluate(()=>frontier.camera.position.toArray());
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
 const after=await page.evaluate(()=>frontier.camera.position.toArray());
 assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])>.1,'Actual keyboard moves viewpoint');
 await page.screenshot({path:`${output}/walk-modest.png`});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:`${output}/phone.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
 assert.deepEqual(errors,[],'No browser or shader errors');
 const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const phone=await touch.newPage();await phone.goto('http://127.0.0.1:5207/prototypes/frontier/index.html');
 await phone.waitForFunction(()=>window.frontier);await phone.getByRole('button',{name:'Blue hour',exact:true}).tap();
 assert.equal(await phone.evaluate(()=>frontier.mode),'night');
 const touchBefore=await phone.evaluate(()=>frontier.camera.position.toArray());
 const bounds=await phone.getByRole('button',{name:'Forward',exact:true}).boundingBox();
 const cdp=await touch.newCDPSession(phone);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}]});
 await phone.waitForTimeout(400);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const touchAfter=await phone.evaluate(()=>frontier.camera.position.toArray());
 assert.ok(Math.hypot(touchAfter[0]-touchBefore[0],touchAfter[2]-touchBefore[2])>.1,'Touch button moves view');
 await phone.screenshot({path:`${output}/phone.png`});await touch.close();
 writeFileSync(`${output}/prototype-evidence.json`,JSON.stringify({evidence,normalScores,before,after,touchBefore,touchAfter,errors},null,2));
 console.log('Frontier: 4 views × 3 light treatments, modest graphics, keyboard movement, narrow viewport and WebGL checks pass');
} finally {await browser.close();}
