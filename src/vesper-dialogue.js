import { sanitizeState, clampLine, LIMITS, VESPER_CONTRACT } from './vesperbrain.js';
import { suitSay as instrumentLine } from './vesper.js';
import { executeVesperCommand } from './vesper-commands.js';
import { noteTalk } from './regard.js';

// A milestone earns consideration, not an exception to the quiet interval.
export const NOTICE_EVENTS = new Set(['wake','burrow-home','ring-installed','drone-deployed',
  'fab-first-steel','signal-found','heritage-record','hop-landed','burrow-room']);
export const SAFETY_EVENTS = new Set(['air-low','cold','power-low','leak','weather-storm','weather-cold']);
export function noticeAllowed(event, {now,lastNotice=-Infinity,lastEvent=-Infinity,lastTalk=-Infinity,busy=false,danger=false}) {
  return NOTICE_EVENTS.has(event) && !busy && !danger && now-lastNotice>=180 && now-lastEvent>=600 && now-lastTalk>=45;
}
const signature = g => JSON.stringify([g.weatherNow?.phase,g.weatherSheltered?.(),!!g.habitat?.active,!!g.under?.active,!!g.driving]);

export class VesperDialogue {
  constructor(game, pid) {
    this.g=game;this.pid=pid;this.revision=0;this.pending=null;this.lastNotice=-Infinity;
    this.notices=new Map();this.instruments=new Map();this.lastSafety=-Infinity;this.status='idle';this.connection='checking';
  }
  async checkConnection() {
    try {
      const response=await fetch('/brain/health',{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('unavailable');
      const health=await response.json();
      this.connection=health.ok===true ? health.contract===VESPER_CONTRACT ? 'current' : 'outdated' : 'unavailable';
    } catch { this.connection='unavailable'; }
    return this.connection;
  }
  cancel() {
    this.revision++;this.pending?.abort();this.pending=null;this.g.voice.stopSpeaking();this.status='idle';
  }
  busy() {
    const g=this.g;
    return !!(this.pending||g.paused||g.voice.listening||g.voice.speakingNow||g.chatBar?.style.display==='block'
      ||g.crew?.visible||g.weatherSession?.visible||g.burrowUI?.visible||g.worksUI?.visible||g.fieldUI?.visible
      ||g.orders?.visible||g.map?.visible||g.journalUI?.visible||g.under?.ui.visible||g.sleepAnim);
  }
  instrument(event, text, {force=false}={}) {
    const g=this.g, safety=SAFETY_EVENTS.has(event), gap=g.t-(this.instruments.get(event)??-Infinity);
    if(!force && gap<(safety?10:45))return false;
    this.instruments.set(event,g.t);
    if(safety){this.cancel();this.lastSafety=g.t;}
    g.comms?.record('vesper',text);
    g.hud.say(text,g.t,8);
    g.voice.speak(text,safety?'warning':'calm',{urgent:safety});return true;
  }
  say(event) {
    const g=this.g;if(g.attract)return;
    const line=instrumentLine(event,g.saidCounts[event]||0,g.settlerName);
    if(line){if(this.instrument(event,line))g.saidCounts[event]=(g.saidCounts[event]||0)+1;return;}
    return this.bark(event);
  }
  async bark(event) {
    const g=this.g;
    if(!noticeAllowed(event,{now:g.t,lastNotice:this.lastNotice,lastEvent:this.notices.get(event),lastTalk:g.lastTalk,
      busy:this.busy(),danger:g.air<.3||g.warm<.3||g.weatherNow?.phase==='storm'||g.t-this.lastSafety<45}))return;
    this.lastNotice=g.t;this.notices.set(event,g.t);
    const context=signature(g), capturedTalk=g.lastTalk;
    return this.request({bark:event,history:g.vesperHistory.slice(-4)},true,()=>signature(g)===context&&g.lastTalk===capturedTalk);
  }
  async talk(raw) {
    const g=this.g,text=typeof raw==='string'?raw.trim().slice(0,LIMITS.playerMax):'';
    if(!text||g.attract)return;
    this.cancel();g.hud.setEar(false);g.chatBar.style.display='none';
    g.hud.say(`(you) ${text}`,g.t,5);
    g.lastTalk=g.t;g.talks=(g.talks||0)+1;noteTalk(g.regard,Math.floor(g.simMillis/88775244));
    const history=g.vesperHistory.slice(-6);
    this.remember('you',text);
    const command=executeVesperCommand(g,text);
    if(command){this.remember('vesper',command.message);this.instrument('worker-command',command.message,{force:true});g.persist();if(g.comms?.opened)g.chatBar.style.display='block';return command;}
    const response=this.request({text,history},false);
    if(g.comms?.opened)g.chatBar.style.display='block';
    return response;
  }
  remember(who,text) {
    this.g.vesperHistory.push({who,text});
    this.g.vesperHistory=this.g.vesperHistory.slice(-8);
    this.g.comms?.record(who,text);
  }
  async request(body,notice,stillRelevant=()=>true) {
    const g=this.g, revision=++this.revision, controller=new AbortController();
    this.pending=controller;this.status='thinking';
    const timer=setTimeout(()=>controller.abort(),notice?12000:28000);
    try {
      const r=await fetch('/brain/chat',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...body,state:sanitizeState(g.brainState()),pid:this.pid()}),signal:controller.signal});
      if(!r.ok)throw Error(`relay ${r.status}`);
      const data=await r.json(),line=clampLine(data.line);
      if(!line)throw Error('empty reply');
      if(revision!==this.revision||controller.signal.aborted||g.paused||g.voice.listening||!stillRelevant())return;
      this.status='connected';
      if(!notice)g.lastTalk=g.t;
      this.remember('vesper',line);g.hud.say(line,g.t,Math.max(7,line.length/12));
      g.voice.speak(line,data.mood||'calm',{live:!notice});g.persist();return line;
    } catch(error) {
      if(revision!==this.revision)return;
      this.status='unavailable'; this.lastError=error.name==='AbortError'?'timeout':error.message;
      if(!notice&&!g.paused)this.instrument('radio-static','VESPER relay unavailable. Instruments and worker commands still work; try your question again.',{force:true});
    } finally {
      clearTimeout(timer);if(revision===this.revision)this.pending=null;
    }
  }
}
