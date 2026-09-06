import assert from 'node:assert/strict';
import {VesperDialogue,noticeAllowed,NOTICE_EVENTS} from '../src/vesper-dialogue.js';
import {buildMessages,stateBrief,STATE_FIELDS,ttsPlan,MOODS,TTS_MODEL,VOICE_ID,VESPER_CONTRACT} from '../src/vesperbrain.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const lines=[],spoken=[],requests=[];
const g={t:0,air:1,warm:1,weatherNow:{phase:'clear'},lastTalk:-Infinity,saidCounts:{},vesperHistory:[],
  voice:{speakingNow:false,listening:false,stopSpeaking(){},speak:(...args)=>spoken.push(args)},
  hud:{say:line=>lines.push(line),setEar(){}},chatBar:{style:{display:'none'}},
  brainState:()=>({air:100,warm:100}),persist(){},regard:{},simMillis:1770000000000};
const fetchBefore=globalThis.fetch;
globalThis.fetch=(_url,options)=>{const d=deferred();requests.push({...d,body:JSON.parse(options.body)});return d.promise;};
const response=line=>({ok:true,json:async()=>({line,mood:'calm'})});
try{
 const d=new VesperDialogue(g,()=> 'test');
 for(const event of ['idle','first-steps','first-jump','lope','buggy-air','devil-near'])
  assert.equal(noticeAllowed(event,{now:900}),false,`${event} does not earn an interruption`);
 for(const event of NOTICE_EVENTS)assert.equal(noticeAllowed(event,{now:100,lastNotice:0}),false,'firsts cannot bypass global gap');
 assert.equal(noticeAllowed('burrow-room',{now:900,lastTalk:880}),false);
 assert.equal(noticeAllowed('burrow-room',{now:900,danger:true}),false);
 assert.equal(noticeAllowed('burrow-room',{now:900,busy:true}),false);
 const bark=d.bark('wake');assert.equal(requests.length,1);
 const talk=d.talk('What next?');assert.equal(requests.length,2);
 requests[0].resolve(response('Obsolete welcome.'));await bark;
 assert.ok(!lines.includes('Obsolete welcome.'),'late notice cannot interrupt player question');
 requests[1].resolve(response('Use the supplied workshop.'));await talk;
 assert.equal(lines.at(-1),'Use the supplied workshop.');
 assert.ok(!requests[1].body.history.some(h=>h.text==='What next?'),'current question appears only once');
 const first=d.talk('First question'),second=d.talk('Second question');
 requests[3].resolve(response('Second answer.'));await second;
 requests[2].resolve(response('First answer.'));await first;
 assert.equal(lines.at(-1),'Second answer.','out-of-order answer discarded');
 const pending=d.talk('How far?');d.instrument('air-low','Air low. Enter shelter.');
 requests[4].resolve(response('Take a long walk.'));await pending;
 assert.equal(lines.at(-1),'Air low. Enter shelter.');assert.equal(spoken.at(-1)[2].urgent,true);
 const paused=d.talk('Question before pause');g.paused=true;d.cancel();
 requests[5].resolve(response('Late paused answer.'));await paused;
 assert.ok(!lines.includes('Late paused answer.'));g.paused=false;
 for(let i=0;i<50;i++)d.say('no-charge');
 assert.equal(lines.filter(s=>/charge|bank|power/i.test(s)&&s!=='Air low. Enter shelter.').length,1,'repeating waiting frames do not chatter');
 for(const key of ['homeLayout','constructionQueue','crewStatus','weatherStatus','equipmentStatus','activityStatus','vehicleStatus','inventoryStatus']){
  assert.equal(STATE_FIELDS[key].max,600);
  assert.ok(buildMessages({[key]:'changed-current-fact'},[],'help').at(-1).content.includes('changed-current-fact'));
 }
 for(const mood of MOODS){const plan=ttsPlan(mood);assert.equal(plan.model,TTS_MODEL);assert.equal(plan.voice_id,VOICE_ID);assert.equal(plan.emotion,'calm');}
 assert.ok(stateBrief({warrenShelter:30,warrenAir:0}).includes('NOT pressure or breathable-air readings'));
 for(const [health,expected] of [[{ok:true,contract:VESPER_CONTRACT},'current'],[{ok:true},'outdated'],[{ok:false},'unavailable']]){
  globalThis.fetch=async()=>({ok:true,json:async()=>health});assert.equal(await d.checkConnection(),expected);
 }
 globalThis.fetch=async()=>{throw Error('offline');};assert.equal(await d.checkConnection(),'unavailable');
 console.log('VESPER dialogue: meaningful notices, quiet gaps, latest reply, safety/pause cancellation, grounded fields and consistent voice pass');
}finally{globalThis.fetch=fetchBefore;}
