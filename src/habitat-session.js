import * as THREE from 'three';
import { recordOpeningVisit } from './opening.js';
import { HabitatLayer } from './habitat-layer.js';
import { roomAt, roomByKey, constrainHabitat } from './habitat-model.js';
import { suitStep } from './survival.js';
import { canSleep } from './sleep.js';
import { HABITAT_WALK_SPEED as WALK_SPEED } from './physics.js';

// The diagram and the inhabited space share burrow.cells. Interior coordinates
// are session-only; saves retain the surface position and the actual room state.
export class HabitatSession {
  constructor(game) {
    this.g = game; this.active = false; this.depth = 1;
    this.pos = new THREE.Vector3(); this.velocity = new THREE.Vector3();
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x111919);
    this.cam = new THREE.PerspectiveCamera(68, 1, .06, 120);
    this.ui = document.createElement('aside'); this.ui.id = 'habitat-tools'; this.ui.hidden = true;
    this.ui.innerHTML = '<b></b><p></p><div><button data-act="use">Use room · E</button><button data-act="help">Ask VESPER</button><button data-act="eat" hidden>Eat tomato</button><button data-act="terminal" hidden>Production overview</button><button data-act="up">Climb up</button><button data-act="down">Climb down</button><button data-act="weather">Weather control hub</button><button data-act="plan">Plan rooms</button><button data-act="works">Explore workings</button><button data-act="exit">Surface</button></div>';
    document.body.appendChild(this.ui);
    const style = document.createElement('style');
    style.textContent = `#habitat-tools{position:fixed;bottom:20px;left:20px;z-index:52;max-width:560px;padding:14px;background:#102523eb;color:#e8dec4;border:1px solid #9db7a7;border-radius:9px;font:calc(14px * var(--mars-text-scale,1))/1.4 system-ui}#habitat-tools[hidden]{display:none}#habitat-tools p{margin:5px 0 10px}#habitat-tools div{display:flex;flex-wrap:wrap;gap:6px}#habitat-tools button{font:inherit;color:inherit;background:#36564e;border:1px solid #789c8e;border-radius:5px;padding:9px;cursor:pointer}#habitat-tools button:disabled{opacity:.4}body.in-habitat #minimap,body.in-habitat #planethud,body.in-habitat #hud .prompt,body.in-habitat #hud .bags,body.in-habitat #touchHud .top{display:none!important}@media(max-width:600px){#habitat-tools{left:10px;right:10px;bottom:auto;top:170px;padding:10px;max-height:36vh;overflow:auto}}`;
    document.head.appendChild(style);
    this.ui.onclick = e => {
      const a = e.target.closest('button')?.dataset.act;
      if (a === 'use') this.interact();
      if (a === 'help') game.talkToVesper('Help me with the workshop repair or the nursery crop in my current room.');
      if (a === 'eat') game.activityLoop?.act('eat');
      if (a === 'terminal' && this.room?.piece === 'bay') {game.clearInput();game.worksUI.open();}
      if (a === 'up') this.climb(-1);
      if (a === 'down') this.climb(1);
      if (a === 'weather') game.weatherSession?.open();
      if (a === 'plan') { game.clearInput(); game.burrowUI.open(); }
      if (a === 'works') this.explore();
      if (a === 'exit') this.exit();
      if (!game.weatherSession?.visible) game.focusWorld();
    };
  }
  enter(key = '0,1') {
    const g = this.g;
    if (this.active || g.under?.active || g.driving || g.inLander || g.hopFlight
      || g.distToCrown() > 7 || !(g.burrow.cells.get('0,1')?.dug >= 1)) return false;
    this.refresh();
    const room = roomByKey(this.layer.layout, key) || roomByKey(this.layer.layout, '0,1');
    if (!room) return false;
    this.returnView = { yaw: g.camYaw, pitch: g.camPitch, exposure: g.renderer.toneMappingExposure };
    this.active = true; this.depth = room.depth; this.pos.set(room.x, room.y, 1);
    g.camYaw = Math.PI / 2; g.camPitch = .15; g.vel.set(0,0,0); g.clearInput();
    g.burrowUI.close(); g.colonist.group.visible = false;
    document.body.classList.add('in-habitat');
    this.message = g.opening && !g.opening.visitedHome
      ? 'Your bunk and workshop are on this floor. Follow the corridor; drag to look, WASD or the stick to walk. The lower shaft leads to an unfinished expansion.'
      : 'Your built rooms, under your feet. Drag to look; WASD or the stick to walk.';
    this.step(0); g.focusWorld(); g.persist(); return true;
  }
  refresh() {
    const signature = [...this.g.burrow.cells].filter(([,c]) => c.dug >= 1).map(([k,c]) => k+c.piece).join('|');
    if (signature === this.signature) return;
    this.layer?.dispose(); this.layer = new HabitatLayer(this.scene, this.g.burrow); this.signature = signature;
  }
  exit() {
    if (!this.active) return;
    const g = this.g; this.active = false; this.ui.hidden = true;
    // A safe exit cancels an unfinished sleep fade rather than carrying a
    // clock animation into a scene whose frame loop cannot advance it.
    if (g.sleepAnim) { g.sleepAnim = null; g.hud.setVeil(0); }
    g.burrowUI.close(); g.worksUI.close(); this.velocity.set(0,0,0);
    document.body.classList.remove('in-habitat'); g.colonist.group.visible = true;
    g.scene.add(g.colonist.group); g.colonist.group.position.copy(g.pos); g.colonist.rig.first = true;
    g.camYaw = this.returnView.yaw; g.camPitch = this.returnView.pitch;
    g.renderer.toneMappingExposure = this.returnView.exposure;
    g.clearInput(); g.focusWorld(); g.persist();
  }
  get room() { return roomAt(this.layer.layout, this.pos.x, this.pos.z, this.depth); }
  climb(direction) {
    if (this.room?.piece !== 'shaft') { this.message = 'Use the ladder in the central shaft.'; return; }
    const next = roomByKey(this.layer.layout, `0,${this.depth + direction}`);
    if (!next || next.piece !== 'shaft') { this.message = 'No finished shaft on that level.'; return; }
    this.depth = next.depth; this.pos.set(next.x,next.y,0); this.velocity.set(0,0,0);
    this.message = `${this.depth * 3} metres below the surface.`;
  }
  key(e) {
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'KeyR') this.interact();
    if (e.code === 'KeyQ') this.climb(-1);
    if (e.code === 'KeyF') this.climb(1);
    if (e.code === 'KeyB') { this.g.clearInput(); this.g.burrowUI.open(); }
    if (e.code === 'KeyJ') this.g.journalUI.toggle(this.g.mystery, this.g.heritage);
    if (e.code === 'KeyO') this.g.experience.session.showHelp();
    if (e.code === 'KeyV' && this.g.voice.startListening()) { this.g.hud.setEar(true); this.g.lastTalk = this.g.t; }
  }
  interact() {
    const g = this.g, piece = this.room?.piece;
    if (!g.burrow.ringInstalled) { this.message = 'Bring and install the airlock ring in Plan rooms to make this home warm and breathable.'; return; }
    if (g.activityLoop?.interactRoom()) return;
    if (piece === 'bunk') {
      if (!canSleep(g.sunEl ?? 90)) { this.message = 'Rest here to recover warmth and air. Sleep until dawn is available after sunset.'; return; }
      g.trySleep(); this.message = g.sleepAnim ? 'Safe in your bunk. Sleeping until dawn.' : 'Sleep is unavailable here right now.';
    } else if (piece === 'garden') {
      this.message = 'You check the growing beds. The sealed garden replenishes your suit air while you stay.';
    } else if (piece === 'bay') {
      g.clearInput(); g.worksUI.open(); this.message = 'Workshop terminal: inspect your surface production chain from home.';
    } else if (piece === 'shaft') this.message = 'Q / F or the ladder buttons change levels. Surface leaves through the airlock.';
    else this.message = piece === 'store' ? 'Stored supplies are managed through your nearby cargo and worksite inventory.' : 'The sealed corridor connects your home. Keep walking to a room.';
  }
  explore() {
    const key = this.room?.key || '0,1'; this.exit();
    this.g.under.returnHabitatKey = key; this.g.under.requestEnter();
  }
  step(dt) {
    const g = this.g; this.refresh();
    const blocked = g.burrowUI.visible || g.worksUI.visible || !!g.sleepAnim;
    if (g.sleepAnim) g.frameSleeping(dt);
    let sx = g.touchStick?.x ?? ((g.keys.KeyD ? 1 : 0)-(g.keys.KeyA ? 1 : 0));
    let sz = g.touchStick?.y ?? ((g.keys.KeyW ? 1 : 0)-(g.keys.KeyS ? 1 : 0));
    if (blocked) { sx=0; sz=0; this.velocity.set(0,0,0); }
    const target = new THREE.Vector3(Math.sin(g.camYaw)*sz+Math.cos(g.camYaw)*sx,0,Math.cos(g.camYaw)*sz-Math.sin(g.camYaw)*sx);
    if (target.length()>1) target.normalize(); target.multiplyScalar(WALK_SPEED);
    this.velocity.lerp(target,Math.min(1,dt*10));
    const p = constrainHabitat(this.layer.layout,this.pos,{x:this.pos.x+this.velocity.x*dt,z:this.pos.z+this.velocity.z*dt},this.depth);
    this.pos.x=p.x; this.pos.z=p.z;
    const room=this.room; if(room) this.pos.y=room.y;
    if (['bunk', 'bay'].includes(room?.piece) && recordOpeningVisit(g.opening)) {
      this.message = 'Home found. Explore the other rooms, then return to the surface and meet your worker crew.';
      g.persist();
    }
    const sealed=!!g.burrow.ringInstalled;
    const v=suitStep({air:g.air,warm:g.warm,temp:sealed?19:-65,sheltered:sealed,mode:g.settings.survival},dt);
    g.air=v.air;g.warm=v.warm;
    if(v.rescue){this.exit();g.experience.rescue();return;}
    this.cam.position.copy(this.pos).add(new THREE.Vector3(0,1.65,0));
    this.cam.lookAt(this.pos.x+Math.sin(g.camYaw)*5,this.pos.y+1.65+Math.sin(.15-g.camPitch)*5,this.pos.z+Math.cos(g.camYaw)*5);
    this.cam.aspect=innerWidth/innerHeight;this.cam.updateProjectionMatrix();
    this.layer.update(g.t,{position:this.pos,depth:this.depth,sealed});
    this.present();
  }
  present() {
    const g=this.g, room=this.room, sealed=!!g.burrow.ringInstalled;
    this.ui.hidden=!this.active||g.weatherSession?.visible||g.paused||g.burrowUI.visible||g.worksUI.visible||g.journalUI.visible||g.orders.visible||g.chatBar.style.display==='block';
    this.ui.querySelector('b').textContent=`${room?.piece?.toUpperCase() || 'HOME'} · ${this.depth*3} m · ${sealed?'WARM / SEALED':'UNSEALED'}`;
    this.ui.querySelector('p').textContent=this.message;
    for(const [a,d] of [['up',-1],['down',1]]) this.ui.querySelector(`[data-act=${a}]`).disabled=room?.piece!=='shaft'||!roomByKey(this.layer.layout,`0,${this.depth+d}`);
    this.ui.querySelector('[data-act=use]').textContent=room?.piece==='bunk'?'Sleep / rest · E':room?.piece==='bay'?'Workshop · E':'Use room · E';
    const action=g.activityLoop?.roomAction();if(action)this.ui.querySelector('[data-act=use]').textContent=`${action[1]} · E`;
    this.ui.querySelector('[data-act=terminal]').hidden=room?.piece!=='bay';
    this.ui.querySelector('[data-act=eat]').hidden=!g.activities?.rations;
    this.ui.querySelector('[data-act=eat]').textContent=`Eat tomato (${g.activities?.rations||0})`;
    g.hud.setVitals(g.air,g.warm,sealed?19:-65);g.hud.setClock('HOME ON MARS',sealed?'Warmth and air recovering':'Install the airlock ring to seal your home');
  }
  render() {
    this.present(); this.g.renderer.toneMappingExposure=1.2;
    this.g.renderer.render(this.scene,this.cam);
  }
}
