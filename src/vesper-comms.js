// Conversation UI only; dialogue owns requests and the game owns worker rules.
const CSS = `
#vesper-comms{position:fixed;right:18px;bottom:20px;z-index:65;width:min(460px,calc(100vw - 24px));
 max-height:calc(100dvh - 40px);box-sizing:border-box;background:#132124f7;color:#eee6d7;border:1px solid #819a8c;
 border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:auto;font:calc(15px * var(--ui-scale,1))/1.45 system-ui}
#vesper-comms[hidden]{display:none}#vesper-comms header{display:flex;align-items:center;justify-content:space-between;gap:12px}
#vesper-comms h2{font:22px Georgia,serif;margin:0}#vesper-comms p{margin:0}
#vesper-comms button{color:#f0e9d9;background:#2b403b;border:1px solid #819a8c;border-radius:4px;
 font:inherit;padding:8px 12px;min-height:44px;cursor:pointer}#vesper-comms button:disabled{opacity:.5;cursor:default}
#vesper-comms :focus-visible{outline:3px solid #b6ecdc;outline-offset:2px}
#vesper-transcript{min-height:80px;max-height:40dvh;overflow:auto;overscroll-behavior:contain;flex:1;touch-action:pan-y}
#vesper-transcript article{border-bottom:1px solid #73918740;padding:10px 0;overflow-wrap:anywhere}
#vesper-transcript strong{display:block;color:#afcfc1;font-size:.8em;margin-bottom:4px}
#vesper-transcript button{font-size:.8em;min-height:36px;padding:4px 9px;margin-top:7px}
#vesper-comms form{display:flex;gap:8px}#vesperchat{min-width:0;flex:1;width:100%;box-sizing:border-box;
 padding:11px;font:inherit;font-size:max(16px,1em);color:#fff3df;background:#0b171b;border:1px solid #94b4a5;border-radius:4px}
#vesper-comms .comms-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#vesper-comms .comms-state{font-size:.85em;color:#c3d6cc;min-height:1.4em}
#session-tools{flex-wrap:wrap;justify-content:flex-end;max-width:calc(100vw - 20px)}
#session-tools [data-action=chat]{border-color:#96c5b3;color:#cceadd}
@media(max-width:600px){#vesper-comms{right:12px;bottom:max(12px,env(safe-area-inset-bottom));padding:12px;
 max-height:calc(100dvh - 24px)}#vesper-transcript{max-height:34dvh}#session-tools{gap:4px}#session-tools button{padding:8px}#session-tools .comms-prefix{display:none}}
`;
export class VesperComms {
  constructor(game) {
    this.g=game;this.opened=false;this.loaded=false;this.entries=[];
    const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
    this.root=document.createElement('section');this.root.id='vesper-comms';this.root.hidden=true;
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-label','Conversation with VESPER');
    this.root.innerHTML='<header><h2>VESPER</h2><button type="button" data-comms="close" aria-label="Close conversation">Close</button></header>'
      +'<div id="vesper-transcript" role="log" aria-live="polite" aria-label="Recent conversation"></div>'
      +'<label for="vesperchat">Your reply</label><form><input id="vesperchat" maxlength="240" placeholder="Type a message…" autocomplete="off" enterkeyhint="send"><button type="submit">Send</button></form>'
      +'<div class="comms-actions"><button type="button" data-comms="speak">Speak</button><span>Replies are spoken and written.</span></div>'
      +'<p class="comms-state" role="status"></p>';
    this.input=this.root.querySelector('input');this.input.style.display='none';
    this.log=this.root.querySelector('[role=log]');this.status=this.root.querySelector('[role=status]');
    this.mic=this.root.querySelector('[data-comms=speak]');this.mic.disabled=!game.voice.earsSupported();
    this.root.querySelector('form').onsubmit=e=>{e.preventDefault();this.send();};
    this.root.querySelector('[data-comms=close]').onclick=()=>this.close();
    this.mic.onclick=()=>{
      if(game.voice.listening){game.voice.stopListening();return;}
      game.clearInput();game.voice.poke();game.voice.startListening();this.update();
    };
    for(const event of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','touchend','wheel','click','keyup'])
      this.root.addEventListener(event,e=>e.stopPropagation());
    this.root.addEventListener('keydown',e=>{
      e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.close();}
      if(e.key==='Tab'){
        const fields=[...this.root.querySelectorAll('button,input')].filter(el=>!el.disabled),first=fields[0],last=fields.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    document.body.append(this.root);
  }
  loadHistory() {
    if(this.loaded)return;this.loaded=true;
    const pending=this.entries;this.entries=[];
    for(const entry of [...(this.g.vesperHistory||[]),...pending])this.record(entry.who,entry.text);
  }
  open() {
    this.loadHistory();this.g.voice.cancelListening();this.g.voice.poke();this.g.dialogue.cancel();this.g.lastTalk=this.g.t;this.g.clearInput();
    this.opened=true;this.root.hidden=false;this.input.style.display='block';this.draw();this.input.focus();this.update();
  }
  close() {
    this.g.voice.cancelListening();
    this.opened=false;this.root.hidden=true;this.input.style.display='none';this.input.blur();
    this.g.clearInput();this.g.focusWorld();
  }
  send() {
    const text=this.input.value.trim();if(!text)return;
    this.g.voice.cancelListening();this.g.voice.poke();this.input.value='';
    this.g.talkToVesper(text);this.input.focus();
  }
  record(who,text) {
    if(typeof text!=='string'||!text.trim())return;
    this.loadHistory();
    who=who==='you'?'you':'vesper';const previous=this.entries.at(-1);
    if(previous?.who===who&&previous.text===text)return;
    this.entries.push({who,text});this.entries=this.entries.slice(-60);
    if(this.opened)this.draw();
  }
  draw() {
    const previousScroll=this.log.scrollTop;
    const nearBottom=this.log.scrollHeight-this.log.scrollTop-this.log.clientHeight<60;
    this.log.replaceChildren();
    for(const entry of this.entries){
      const row=document.createElement('article'),who=document.createElement('strong'),text=document.createElement('p');
      who.textContent=entry.who==='you'?'YOU':'VESPER';text.textContent=entry.text;row.append(who,text);
      if(entry.who==='vesper'){
        const replay=document.createElement('button');replay.type='button';replay.textContent='Read aloud';
        replay.onclick=()=>{this.g.voice.poke();this.g.voice.speak(entry.text,'calm',{live:true,caption:false,replay:true});};row.append(replay);
      }
      this.log.append(row);
    }
    if(!this.entries.length)this.log.textContent='Ask about your home, your workers or what to do next.';
    this.log.scrollTop=nearBottom?this.log.scrollHeight:previousScroll;
  }
  update() {
    if(!this.opened)return;
    if(this.g.paused||this.g.attract){this.close();return;}
    // Mobile keyboards can shrink only the visual viewport, leaving CSS vh unchanged.
    const view=window.visualViewport,keyboard=view&&view.height<innerHeight-1;
    this.root.style.bottom=keyboard?`${Math.max(12,innerHeight-view.height-view.offsetTop+12)}px`:'';
    this.root.style.maxHeight=keyboard?`${Math.max(120,view.height-24)}px`:'';
    if(!this.root.dataset.drawn){this.draw();this.root.dataset.drawn='true';}
    const voice=this.g.voice,thinking=this.g.dialogue.status==='thinking';
    this.mic.textContent=voice.listening?'Finish speaking':'Speak';this.mic.setAttribute('aria-pressed',String(voice.listening));
    this.status.textContent=voice.listening?'Listening — your words will appear here.'
      :thinking?'VESPER is thinking… You can type your next message.'
      :voice.status==='muted'?'Audio is muted in Options. Messages remain readable.'
      :voice.status==='unavailable'?'Voice unavailable. You can keep reading and typing.'
      :!voice.earsSupported()?'Microphone recognition is unavailable here. Type below to reply.'
      :'Type and press Send or Enter. Speak uses your microphone.';
  }
}
