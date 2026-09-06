import { ArrivalLayer } from './arrival-layer.js';
import { FieldLayer } from './fieldlayer.js';
import { FieldConsole } from './fieldconsole.js';
import { FIELD_SITE, FIELD_RADIUS, collectFieldwork, fieldDistance, firstLightGoal } from './fieldwork.js';
import { SessionUI } from './sessionui.js';
import { GameSound } from './gamesound.js';
import { normaliseSettings } from './playsettings.js';
import { EXPERIENCE_CSS } from './experience-style.js';
import { PART_TYPES } from './build.js';
import { MACHINE_TYPES } from './machines.js';
import { ITEMS } from './inventory.js';
import { poolCount } from './worksite.js';

export class PlayExperience {
  constructor(game, groundAt) {
    game.settings.muted = game.settings.muted || game.voice.muted;
    this.g = game; this.groundAt = groundAt; this.lastGoal = ''; this.lastStep = 0;
    this.sound = new GameSound(); this.sound.setSettings(game.settings);
    const unlock = () => this.sound.unlock();
    addEventListener('pointerdown', unlock, { capture: true, once: true });
    addEventListener('keydown', unlock, { capture: true, once: true });
    this.field = new FieldLayer(game.scene, groundAt);
    this.arrival = new ArrivalLayer(game.scene, groundAt, { home: game.crownPos, field: FIELD_SITE });
    game.journalUI.fieldwork = () => game.expedition;
    game.fieldUI = new FieldConsole({ getState: () => game.expedition,
      onClose: () => game.focusWorld(),
      onTurn: () => { this.sound.play('survey'); game.persist(); },
      onCollect: () => {
        if (!collectFieldwork(game.expedition, game.workStores())) return false;
        this.sound.play('build'); game.persist(); return true;
      } });
    this.session = new SessionUI({ settings: game.settings,
      onResumeFocus: () => game.focusWorld(),
      onPause: value => this.pause(value), onHome: () => this.rescue(),
      onSaveTitle: async () => {
        if (game.hopFlight) throw new Error('Wait for touchdown before leaving.');
        if (await game.persist() === false) throw new Error('Save failed');
        location.assign(location.pathname);
      },
      onOrders: () => { game.clearInput(); game.orders.open(); },
      onRecord: () => { game.clearInput(); game.journalUI.toggle(game.mystery, game.heritage); },
      onChat: () => this.openChat(),
      onFeedback: () => game.feedback.open(),
      onSettings: settings => { game.settings = normaliseSettings(settings); this.applySettings(); game.persist(); },
    });
    const style = document.createElement('style'); style.textContent = EXPERIENCE_CSS; document.head.append(style);
    this.goal = document.createElement('aside'); this.goal.id = 'first-light';
    this.goal.setAttribute('aria-label', 'Current project');
    this.goal.innerHTML = '<div class="overline">FIRST LIGHT / YOUR FIRST HOME</div><h2></h2><p class="detail"></p>'
      + '<div class="reward"></div><div class="bearing"><span class="arrow">↑</span><span class="distance"></span></div><button></button>';
    this.goal.querySelector('button').onclick = () => this.goalAction();
    this.catalogue = document.createElement('aside'); this.catalogue.id = 'build-menu';
    this.catalogue.innerHTML = '<h2>Build something useful</h2><p>Materials come from your suit and nearby cargo. Choose a project, then E to place it.</p><div></div>';
    this.types = [...Object.keys(PART_TYPES), ...Object.keys(MACHINE_TYPES)];
    this.buildButtons = new Map();
    for (const type of [...Object.keys(MACHINE_TYPES), ...Object.keys(PART_TYPES)]) {
      const b = document.createElement('button'); b.type = 'button';
      const label = document.createElement('span'); label.textContent = (MACHINE_TYPES[type] || PART_TYPES[type]).name || type;
      const cost = document.createElement('small'); b.append(label, cost);
      b.onclick = () => { game.buildSel = this.types.indexOf(type); b.blur(); };
      this.catalogue.querySelector('div').append(b); this.buildButtons.set(type, { b, cost });
    }
    document.body.append(this.goal, this.catalogue); this.applySettings(); this.update(0);
  }
  applySettings() {
    const s = this.g.settings;
    document.documentElement.style.setProperty('--ui-scale', s.textScale);
    document.documentElement.style.setProperty('--mars-text-scale', s.textScale);
    document.documentElement.classList.toggle('reduce-motion', s.reducedMotion);
    this.sound.setSettings(s);
    this.g.voice.setVolume?.(s.volume); this.g.voice.setMuted(s.muted);
  }
  pause(value) {
    this.g.paused = value; this.g.clearInput(); this.sound.setPaused(value);
    this.session.setPaused(value);
    if (value) { this.g.dialogue?.cancel(); this.g.persist(); }
  }
  openChat() { this.g.comms.open(); }
  goalAction() {
    const g = this.g; const goal = firstLightGoal(g);
    if (goal.actionId) {
      this.openingAction(goal); this.goal.querySelector('button').blur(); return;
    }
    if (goal.id === 'under' && g.distToCrown() < 7 && !g.driving) { g.under.requestEnter(); }
    else if (goal.id === 'power' && g.distToCrown() < 25 && !g.driving) {
      g.buildMode = true; g.buildSel = this.types.indexOf('solar-array');
    } else if (g.distToCrown() < 7 && !g.driving) { g.clearInput(); g.burrowUI.open(); }
    else {
      const dx = goal.target.x - g.pos.x, dz = goal.target.z - g.pos.z;
      g.camYaw = Math.atan2(dx, dz); // Look toward the objective, never teleport to it.
    }
    this.goal.querySelector('button').blur();
  }
  openingAction(goal) {
    const g = this.g, nearHome = g.distToCrown() < 7 && !g.driving;
    if (goal.actionId === 'crew' && g.crew.open()) return;
    if (goal.id === 'home' && nearHome) { g.habitat.enter(); return; }
    if (goal.actionId === 'home' && nearHome) { g.clearInput(); g.burrowUI.open(); return; }
    if (goal.actionId === 'power' && g.distToCrown() < 25 && !g.driving) {
      g.buildMode = true; g.buildSel = this.types.indexOf('solar-array'); return;
    }
    if (goal.actionId === 'survey' && !g.driving && !g.inLander && fieldDistance(g.pos) <= FIELD_RADIUS) {
      g.clearInput(); g.fieldUI.open(); return;
    }
    if (goal.actionId.startsWith('worker-')) {
      if (g.activityLoop?.interactSurface()) return;
      if (nearHome && ['carried', 'bench', 'diagnosed', 'repaired'].includes(g.activities.worker)) {
        g.habitat.enter(); return;
      }
    }
    const target = goal.actionId === 'crew' ? g.crew.nearest() || goal.target : goal.target;
    g.camYaw = Math.atan2(target.x - g.pos.x, target.z - g.pos.z);
    g.hud.say(goal.actionId === 'crew' ? 'Walk close to a worker, then press E for crew commands.'
      : `Facing ${goal.location || 'home'}. Follow the bearing.`, g.t, 5);
    g.focusWorld();
  }
  interact() {
    const g = this.g;
    if (g.driving || g.inLander || g.buildMode || g.distToRover() < 3.2 || fieldDistance(g.pos) > FIELD_RADIUS) return false;
    g.clearInput(); g.fieldUI.open(); return true;
  }
  rescue() {
    const g = this.g;
    if (g.under?.active) g.under.exit();
    if (g.habitat?.active) g.habitat.exit();
    if (g.hopFlight) { g.hud.say('Landing in progress. Return home is available after touchdown.', g.t, 6); return; }
    this.pause(false);
    [g.weatherSession, g.crew, g.fieldUI, g.burrowUI, g.worksUI, g.hopUI, g.orders, g.journalUI].forEach(p => p?.close?.());
    if (g.map.visible) g.map.toggle();
    g.scene.add(g.colonist.group);
    g.comms.close();
    g.driving = false; g.fpv = false; g.buildMode = false; g.sleepAnim = null;
    g.cycling = null; g.unbolt = null; g.anchoring = null; g.reading = null; g.salvaging = null;
    g.steadLayer.showGhost(null); g.machineLayer.showGhost(null);
    g.pos.set(g.landerPos.x, this.groundAt(g.landerPos.x, g.landerPos.z + 5), g.landerPos.z + 5);
    g.vel.set(0, 0, 0); g.vy = 0; g.airborne = false; g.air = 1; g.warm = 1;
    g.enterLander(); g.hud.say('Returned aboard. Air and warmth restored; your cargo is safe. The buggy remains where you left it.', g.t, 12);
    this.sound.play('return'); g.focusWorld(); g.persist();
  }
  update(dt) {
    const g = this.g;
    g.comms?.update();
    const link = this.session.root.querySelector('#vesper-link-status');
    if (link) {
      const connection = g.dialogue?.connection;
      link.textContent = connection === 'current' ? 'VESPER relay connected · current game context.'
        : connection === 'outdated' ? 'VESPER is connected, but her relay needs the current gameplay update.'
        : connection === 'unavailable' ? 'VESPER relay unavailable. Instruments and worker commands remain available.' : 'Checking VESPER connection…';
      if (g.voice.status === 'unavailable') link.textContent += ' Voice unavailable; replies remain readable.';
    }
    g.weatherSession?.update(dt); g.crew?.update(dt); this.arrival.update(g);
    const panels = g.weatherSession?.visible || g.crew?.visible || g.paused || g.habitat?.active || g.under?.active || g.under?.ui.visible || g.orders.visible || g.map.visible || g.journalUI.visible
      || g.burrowUI.visible || g.worksUI.visible || g.hopUI.visible || g.fieldUI.visible || g.inLander || g.hopFlight;
    this.goal.hidden = !g.settings.guidance || panels || g.buildMode;
    this.catalogue.hidden = !g.buildMode || panels;
    const goal = firstLightGoal(g);
    if (goal.id !== this.lastGoal) {
      this.goal.querySelector('h2').textContent = goal.title;
      this.goal.querySelector('.detail').textContent = goal.detail;
      this.goal.querySelector('.reward').textContent = goal.reward;
      this.goal.querySelector('button').textContent = goal.action;
      if (this.lastGoal) { this.sound.play('build'); g.sayOnce(goal.id === 'survey' ? 'brief-dig' : 'brief-works'); }
      this.lastGoal = goal.id;
    }
    this.goal.querySelector('button').textContent = goal.actionId === 'survey' && !g.driving && fieldDistance(g.pos) <= FIELD_RADIUS
      ? 'Use light sensors' : goal.action;
    const target = goal.actionId === 'crew' ? g.crew.nearest() || goal.target : goal.target;
    const dx = target.x - g.pos.x, dz = target.z - g.pos.z;
    this.goal.querySelector('.distance').textContent = `${Math.round(Math.hypot(dx, dz))} m · ${goal.actionId === 'crew' ? 'worker crew' : goal.location || (goal.id === 'survey' ? 'survey station' : 'home')}`;
    this.goal.querySelector('.arrow').style.transform = `rotate(${(Math.atan2(dx, dz) - g.camYaw) * -180 / Math.PI}deg)`;
    if (g.buildMode) for (const [type, { b, cost }] of this.buildButtons) {
      b.setAttribute('aria-pressed', String(type === g.buildablePart()));
      cost.textContent = g.costsOf(type).map(([id, n]) => `${poolCount(g.workStores(), id)}/${n} ${ITEMS[id].name}`).join(' · ')
        + (MACHINE_TYPES[type] ? ` · ${g.machineCharge(type)} kWh` : '');
    }
    if (!panels && !g.buildMode && !g.driving && g.distToRover() >= 3.2 && fieldDistance(g.pos) < FIELD_RADIUS) {
      g.hud.setPrompt('|*E| use light sensors · recover the station’s solar wing');
    }
    this.field.update(g.t, g.expedition, (g.sunEl ?? 10) < 0, g.settings.reducedMotion);
    if (!panels && !g.driving && g.vel.length() > 0.7 && !g.airborne) {
      this.lastStep += dt;
      if (this.lastStep > 0.48) { this.sound.play('step'); this.lastStep = 0; }
    }
    this.session.toolbar.hidden = !!(g.crew?.visible || g.hopUI.visible || g.fieldUI.visible || g.burrowUI.visible || g.worksUI.visible);
    this.g.planetHud.root && (this.g.planetHud.root.style.display = innerWidth < 1050 || panels ? 'none' : '');
  }
}
