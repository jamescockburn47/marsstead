import { canOpenCrew, commandCrew, crewIdentity, crewMode, crewSummary, nearCrew } from './crew-control.js';
import { CREW_CSS } from './crew-style.js';

export class CrewSession {
  constructor(game) {
    this.g = game; this.visible = false; this.labels = [];
    const style = document.createElement('style'); style.textContent = CREW_CSS; document.head.append(style);
    this.root = document.createElement('section'); this.root.id = 'crew-console';
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Worker crew commands');
    this.root.innerHTML = '<div class="crew-card"><button class="crew-close">Close · Esc</button><h2>Your worker crew</h2>'
      + '<p class="crew-count"></p><ul class="crew-members"></ul><p>Spiders excavate planned rooms. The survey flyer supports the same crew.</p>'
      + '<div class="crew-actions"></div><p role="status"></p></div>';
    this.closeButton = this.root.querySelector('.crew-close'); this.closeButton.onclick = () => this.close();
    this.actions = new Map();
    for (const [mode, text] of [['follow', 'Call over'], ['park', 'Hold position'], ['work', 'Resume excavation']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
      button.dataset.crew = mode; button.onclick = () => this.command(mode);
      this.root.querySelector('.crew-actions').append(button); this.actions.set(mode, button);
    }
    this.root.addEventListener('keydown', event => {
      if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); return; }
      if (event.code === 'Tab') {
        const buttons = [...this.root.querySelectorAll('button:not(:disabled)')];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
      } else event.stopPropagation();
    });
    this.root.addEventListener('keyup', event => event.stopPropagation());
    this.prompt = document.createElement('button'); this.prompt.id = 'crew-prompt'; this.prompt.hidden = true;
    this.prompt.onclick = () => this.open(); document.body.append(this.root, this.prompt);
  }
  localPlayer() {
    const g = this.g;
    return { x: g.pos.x - g.crownPos.x, z: g.pos.z - g.crownPos.z, heading: g.heading };
  }
  bots() {
    return this.g.crownLayer.drones.map(drone => ({ x: drone.position.x, z: drone.position.z, visible: drone.visible }));
  }
  nearest() {
    const player = this.localPlayer(), crown = this.g.crownPos;
    return this.bots().filter(bot => bot.visible).map(bot => ({ x: crown.x + bot.x, z: crown.z + bot.z,
      distance: Math.hypot(player.x - bot.x, player.z - bot.z) })).sort((a, b) => a.distance - b.distance)[0] ?? null;
  }
  blocked() {
    const g = this.g;
    return !!(g.weatherCrewHeld?.() || g.weatherSession?.visible || g.paused || g.attract || g.inLander || g.driving || g.hopFlight || g.airborne || g.buildMode
      || g.habitat?.active || g.under?.active || g.under?.ui.visible || g.sleepAnim || g.cycling
      || g.map?.visible || g.journalUI?.visible || g.orders?.visible || g.fieldUI?.visible
      || g.burrowUI?.visible || g.worksUI?.visible || g.hopUI?.visible || g.chatBar?.style.display === 'block');
  }
  eligible() { return canOpenCrew(this.g.opening, this.localPlayer(), this.bots(), this.blocked()); }
  interact() { return nearCrew(this.localPlayer(), this.bots()) && this.open(); }
  open() {
    if (!this.eligible() || !nearCrew(this.localPlayer(), this.bots())) return false;
    this.g.clearInput(); this.visible = true; this.root.style.display = 'flex'; this.prompt.hidden = true;
    this.draw(); this.closeButton.focus(); return true;
  }
  close(focus = true) {
    if (!this.visible) return;
    this.visible = false; this.root.style.display = 'none'; this.g.clearInput(); if (focus) this.g.focusWorld();
  }
  command(mode) {
    if (!this.visible || !commandCrew(this.g.opening, mode,
      { player: this.localPlayer(), bots: this.bots(), blocked: this.blocked() })) {
      this.root.querySelector('[role=status]').textContent = 'Move closer to a worker to give a command.'; return false;
    }
    this.g.clearInput(); this.g.persist(); this.close();
    this.g.hud.say(mode === 'follow' ? 'Crew following nearby. Excavation paused.'
      : mode === 'park' ? 'Crew holding position. Excavation paused.' : 'Crew returning to excavation.', this.g.t, 5);
    return true;
  }
  draw() {
    const g = this.g, bots = this.bots(), mode = crewMode(g.opening);
    this.root.querySelector('.crew-count').textContent = crewSummary(g.droneCount);
    const list = this.root.querySelector('.crew-members'); list.replaceChildren();
    bots.forEach((bot, i) => {
      if (!bot.visible) return;
      const row = document.createElement('li'); row.textContent = crewIdentity(i); list.append(row);
    });
    for (const [id, button] of this.actions) {
      button.disabled = !nearCrew(this.localPlayer(), bots) || this.blocked();
      button.setAttribute('aria-pressed', String(id === mode));
    }
    this.root.querySelector('[role=status]').textContent = mode === 'follow'
      ? 'Following nearby. The crew returns to its dock if you leave the 18 m home area. Excavation is paused.'
      : mode === 'park' ? 'Holding position. Excavation is paused.'
        : 'Excavation resumed. The crew works on the planned room queue when power is available.';
  }
  update() {
    const g = this.g, bots = this.bots(), near = nearCrew(this.localPlayer(), bots);
    if (this.visible && !this.eligible()) this.close(false);
    if (this.visible) { g.clearInput(); this.draw(); }
    this.prompt.hidden = this.visible || !this.eligible() || !near || g.distToCrown() < 4;
    this.prompt.textContent = `${crewSummary(g.droneCount)} · E: crew commands`;
    g.crownLayer.drones.forEach((drone, i) => {
      let label = this.labels[i];
      if (!label) {
        label = document.createElement('span'); label.className = 'crew-label';
        label.textContent = crewIdentity(i); document.body.append(label); this.labels[i] = label;
      }
      label.hidden = this.visible || this.blocked() || !g.opening || !drone.visible
        || Math.hypot(this.localPlayer().x - drone.position.x, this.localPlayer().z - drone.position.z) > 12;
      if (label.hidden) return;
      const position = g.crownLayer.group.localToWorld(drone.position.clone());
      position.y += drone.userData.droneClass === 'flying' ? .6 : 1.15; position.project(g.cam);
      label.hidden = position.z < -1 || position.z > 1 || Math.abs(position.x) > .95 || Math.abs(position.y) > .95;
      label.style.left = `${(position.x * .5 + .5) * innerWidth}px`;
      label.style.top = `${(-position.y * .5 + .5) * innerHeight}px`;
    });
  }
}
