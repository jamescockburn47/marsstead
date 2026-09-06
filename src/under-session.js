import * as THREE from 'three';
import { strideState, stepTravel, movementEase, movementHeading } from './locomotion.js';
import { UnderLayer } from './underlayer.js';
import { UnderSwarm } from './under-swarm.js';
import { UnderUI } from './underui.js';
import { centreAt, floorAt, constrainPosition, nextUnderNode, interactUnderworld } from './underworld.js';
import { suitStep } from './survival.js';
import { WALK_SPEED } from './physics.js';
import { RESCUE_SITE } from './habitat-activities.js';

const MODES = ['Survey', 'Worklight', 'Beacon'];
const REQUIRED_MODE = { relay: 1, brood: 2, lattice: 0 };
const TASKS = {
  relay: 'Use Worklight at the relay. Hold still while the repair workers reconnect it.',
  brood: 'Use Beacon to call the workers to the cradle. Inspect their manufacturing pattern.',
  lattice: 'Use Survey to record the lattice. Keep the scanner steady until the reading completes.',
};

export class UnderSession {
  constructor(game) {
    this.g = game; this.active = false; this.mode = 0; this.lampOn = true; this.scan = 0;
    game.journalUI.underworld = () => game.underworld;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.vy = 0; this.airborne = false;
    this.ui = new UnderUI({ onEnter: fear => this.enter(fear), onCancel: () => {
      const key = this.returnHabitatKey; this.returnHabitatKey = null;
      if (key) game.habitat.enter(key); else game.focusWorld();
    },
      onExit: () => this.exit(), onMode: i => this.setMode(i), onInteract: () => this.interact(),
      onFocusWorld: () => game.focusWorld() });
  }
  requestEnter(entrance = 'home') {
    const g = this.g;
    const field = entrance === 'field' && g.activities?.routeOpen && Math.hypot(g.pos.x-RESCUE_SITE.x,g.pos.z-RESCUE_SITE.z)<3;
    if (this.active || g.habitat?.active || g.driving || g.inLander || g.hopFlight || (!field && g.distToCrown() > 7)
      || !(g.burrow.cells.get('0,1')?.dug >= 1)) return;
    if(field)this.returnHabitatKey = null;
    g.burrowUI.close(); g.clearInput(); this.ui.showIntro(g.settings.fear);
  }
  enter(fear) {
    const g = this.g;
    this.ui.close(); g.settings.fear = fear; g.experience.session.setSettings(g.settings);
    if (!this.scene) {
      this.scene = new THREE.Scene(); this.layer = new UnderLayer(this.scene); this.swarm = new UnderSwarm(this.scene);
      this.cam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .07, 180);
    }
    this.returnView = { yaw: g.camYaw, pitch: g.camPitch, exposure: g.renderer.toneMappingExposure };
    this.active = true; this.scan = 0; this.lampOn = true; this.mode = 0;
    const p = constrainPosition(centreAt(5).x, 5); this.pos.set(p.x, p.y, p.z);
    this.vel.set(0, 0, 0); this.vy = 0; this.airborne = false; this.heading = 0;
    this.boundStride = strideState();
    g.camYaw = 0; g.camPitch = .1; g.vel.set(0, 0, 0); g.clearInput();
    this.scene.add(g.colonist.group); g.colonist.group.visible = true; g.colonist.rig.first = true;
    g.colonist.setLamp(false); g.colonist.setDaylight(0);
    document.body.classList.add('underground'); this.ui.setActive(true); g.focusWorld();
    this.message = 'Follow the amber cable. Surface return is always available.';
    this.step(0); g.persist();
  }
  exit() {
    if (!this.active) { this.ui.close(); this.g.focusWorld(); return; }
    const g = this.g;
    if (!nextUnderNode(g.underworld)) g.underworld.returned = true;
    this.active = false; this.scan = 0; this.ui.setActive(false);
    document.body.classList.remove('underground'); g.scene.add(g.colonist.group);
    g.colonist.group.position.copy(g.pos); g.colonist.rig.first = true; g.colonist.setLamp(g.lamp);
    g.camYaw = this.returnView.yaw; g.camPitch = this.returnView.pitch;
    g.renderer.toneMappingExposure = this.returnView.exposure;
    if (g.post) g.post.grade.uniforms.uDread.value = 0;
    g.clearInput(); g.focusWorld(); g.experience.sound.play('return'); g.persist();
    g.hud.say(g.underworld.returned
      ? 'Workings surveyed. Worker coordination upgraded: excavation is 15% faster.'
      : 'Back at the shaft. Your underground readings are saved.', g.t, 9);
    if (this.returnHabitatKey) {
      const key = this.returnHabitatKey; this.returnHabitatKey = null;
      g.habitat.enter(key);
    }
  }
  setMode(index) {
    this.mode = Math.max(0, Math.min(2, index)); this.lampOn = true; this.scan = 0;
    this.message = `${MODES[this.mode]} selected.`; this.g.focusWorld();
  }
  key(e) {
    if (e.code === 'KeyV' && !e.repeat && this.g.voice.startListening()) {
      this.g.hud.setEar(true); this.g.lastTalk = this.g.t;
    }
    if (e.code === 'KeyE') this.interact();
    if (e.code === 'KeyF' || e.code === 'KeyC') this.setMode((this.mode + 1) % 3);
    if (e.code === 'KeyL') this.lampOn = !this.lampOn;
    if (e.code === 'KeyJ') { this.g.clearInput(); this.g.journalUI.toggle(this.g.mystery, this.g.heritage); }
    if (e.code === 'KeyO') this.g.experience.session.showHelp();
  }
  interact() {
    const n = nextUnderNode(this.g.underworld);
    if (this.pos.z < 6) { this.exit(); return; }
    if (!n || Math.hypot(this.pos.x - n.x, this.pos.z - n.z) > 3.4) {
      this.message = n ? 'Approach the lit instrument beside the cable.' : 'Survey complete. Follow the cable back or use Return to surface.';
      return;
    }
    if (this.mode !== REQUIRED_MODE[n.id] || !this.lampOn) {
      this.message = `Select ${MODES[REQUIRED_MODE[n.id]]}, then use the instrument.`; return;
    }
    this.scan = .001; this.message = 'Instrument active. Hold still; the workers are responding.';
  }
  step(dt) {
    const g = this.g;
    const x = (g.keys.KeyD ? 1 : 0) - (g.keys.KeyA ? 1 : 0);
    const z = (g.keys.KeyW ? 1 : 0) - (g.keys.KeyS ? 1 : 0);
    const stick = g.touchStick;
    const sx = stick ? stick.x : x, sz = stick ? stick.y : z;
    const forward = new THREE.Vector3(Math.sin(g.camYaw), 0, Math.cos(g.camYaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const target = forward.multiplyScalar(sz).addScaledVector(right, -sx);
    if (target.length() > 1) target.normalize(); target.multiplyScalar(g.keys.ShiftLeft || g.keys.ShiftRight ? 4 : WALK_SPEED);
    this.vel.lerp(target, movementEase(dt, this.airborne, target.lengthSq() > 0));
    const oldX = this.pos.x, oldZ = this.pos.z;
    const bounded = constrainPosition(oldX + this.vel.x * dt, oldZ + this.vel.z * dt);
    this.pos.x = bounded.x; this.pos.z = bounded.z;
    if (dt > 0) { this.vel.x = (this.pos.x - oldX) / dt; this.vel.z = (this.pos.z - oldZ) / dt; }
    if (this.vel.length() > .15) this.heading = movementHeading(this.heading, this.vel.x, this.vel.z, dt);
    const manualJump = g.keys.Space && !this.airborne;
    if (manualJump) g.keys.Space = false;
    this.boundStride ??= strideState();
    const travel = stepTravel(this.boundStride, dt, { speed: this.vel.length(),
      contact: g.colonist.rig.supportHint(this.pos.x, this.pos.z, this.heading),
      moving: target.lengthSq() > 0, airborne: this.airborne, vy: this.vy,
      y: this.pos.y, ground: bounded.y, manualJump });
    this.pos.y = travel.y; this.vy = travel.vy; this.airborne = travel.airborne;
    g.colonist.group.position.copy(this.pos);
    g.colonist.pose(dt, { x: this.pos.x, z: this.pos.z, heading: this.heading,
      vx: this.vel.x, vz: this.vel.z, speed: this.vel.length(), airborne: this.airborne, vy: this.vy,
      gait: travel.gait, y: this.pos.y,
      groundAt: floorAt, simT: g.t });
    this.updateCamera(dt); this.updateInstruments(dt);
    const nearest = this.swarm.update(dt, g.t, this.pos, g.settings, this.mode);
    if (dt > 0) {
      const sound = g.experience.sound;
      if (nearest < 9 && Math.sin(g.t * 2.3) > .4) sound.play('scuttle');
      if (g.settings.fear !== 'gentle') sound.play('underHum');
    }
    this.layer.update(g.t, { position: this.pos, heading: g.camYaw, lampOn: this.lampOn,
      fear: g.settings.fear, reducedMotion: g.settings.reducedMotion, completed: g.underworld.completed });
    this.layer.lamp.angle = this.mode === 0 ? .5 : this.mode === 1 ? .9 : .65;
    this.layer.nearLight.intensity = this.lampOn ? .18 : .06;
    this.layer.lamp.color.set(this.mode === 2 ? 0xc5e2d5 : this.mode === 1 ? 0xffd49a : 0xe2edff);
    this.layer.lamp.target.position.y += Math.sin(.15 - g.camPitch) * 9;
    this.present();
  }
  updateCamera(dt) {
    const g = this.g, behind = 3.7;
    const x = this.pos.x - Math.sin(g.camYaw) * behind + Math.cos(g.camYaw) * .45;
    const z = this.pos.z - Math.cos(g.camYaw) * behind;
    const c = constrainPosition(x, z, .65);
    const desired = new THREE.Vector3(c.x, Math.max(c.y + .7, this.pos.y + 2.05), c.z);
    if (dt === 0) this.cam.position.copy(desired);
    else this.cam.position.lerp(desired, Math.min(1, dt * 12));
    this.cam.lookAt(this.pos.x + Math.sin(g.camYaw) * 4,
      this.pos.y + 1.55 + Math.sin(.15 - g.camPitch) * 4, this.pos.z + Math.cos(g.camYaw) * 4);
    this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix();
  }
  updateInstruments(dt) {
    const g = this.g, n = nextUnderNode(g.underworld);
    if (this.scan && n) {
      if (this.vel.length() > .35 || this.airborne || !this.lampOn
        || this.mode !== REQUIRED_MODE[n.id] || Math.hypot(this.pos.x - n.x, this.pos.z - n.z) > 3.4) {
        this.scan = 0; this.message = 'Reading interrupted. Hold still beside the instrument and try again.';
      } else {
        this.scan += dt;
        if (this.scan >= 2.5 && interactUnderworld(g.underworld, n.id)) {
          this.scan = 0; this.message = `${n.name}: complete. Reading saved.`;
          g.experience.sound.play('survey'); g.persist();
        }
      }
    }
    const vitals = suitStep({ air: g.air, warm: g.warm, temp: -58, mode: g.settings.survival,
      rested: g.simMillis < (g.restedUntil || 0) ? g.restedQ : 0 }, dt);
    g.air = vitals.air; g.warm = vitals.warm;
    if (vitals.rescue) { this.exit(); g.experience.rescue(); }
  }
  present() {
    const g = this.g, n = nextUnderNode(g.underworld);
    this.ui.update({ title: n?.name || 'Bring the pattern home', detail: n ? TASKS[n.id] : 'Return to the surface to improve your worker coordination.',
      distance: n ? Math.round(Math.hypot(this.pos.x - n.x, this.pos.z - n.z)) : Math.round(this.pos.z),
      depth: Math.round(12 + this.pos.z * .08), mode: this.mode,
      progress: this.scan ? `${Math.min(100, Math.round(this.scan / 2.5 * 100))}% scanning` : g.underworld.completed.length,
      message: this.message, paused: g.paused || g.journalUI.visible || g.orders.visible || g.chatBar.style.display === 'block' });
    g.hud.setVitals(g.air, g.warm, -58);
    g.hud.setClock('THE WORKINGS', `${Math.round(12 + this.pos.z * .08)} m below · ${g.underworld.completed.length}/3 readings`);
  }
  render(dt) {
    const g = this.g; this.present();
    g.colonist.setDaylight(0);
    g.renderer.toneMappingExposure = g.settings.fear === 'gentle' ? 1.35 : 1.05;
    if (g.post && g.gfxQuality === 'fine') {
      const pass = g.post.composer.passes[0];
      pass.scene = this.scene; pass.camera = this.cam;
      g.post.bloom.strength = .28; g.post.bloom.threshold = .95;
      g.post.grade.uniforms.uDread.value = g.settings.fear === 'intense' ? .65 : .15;
      g.post.grade.uniforms.uWarmth.value = 0; g.post.grade.uniforms.uTime.value += dt;
      try { g.post.composer.render(); } finally { pass.scene = g.scene; pass.camera = g.cam; }
    } else g.renderer.render(this.scene, this.cam);
  }
}
