// Console-only home: the real room lattice, rendered as a living cutaway.
import { BURROW_PIECES, digPrice, warrenReport } from './burrow.js';
import { BUILD_KWH, RECALL_KWH } from './power.js';
import { recallSeconds, RECALL_MIN_M } from './buggy.js';
import { HOME_CSS } from './home-style.js';
import { renderHomeScene } from './home-scene.js';
import { escapeHomeText as esc, roomDescription } from './home-model.js';
import { fleetCounts } from './dronefleet.js';

const GLYPH = { shaft: '↧', corridor: '↔', bunk: '☾', store: '▤', bay: '⚙', garden: '♧' };
const meter = (label, v, cool = false) => `<div class="bmeter${cool ? ' cool' : ''}"><div class="ml"><span>${label}</span><span>${Math.round(v * 100)}%</span></div><div class="mb"><i style="width:${Math.round(v * 100)}%"></i></div></div>`;

export class BurrowConsole {
  // Original hooks retained. Optional getDiscovery() and reducedMotion().
  constructor(hooks) {
    this.h = hooks; this.visible = false; this.sel = 'shaft'; this._t = 0;
    this.selectedKey = ''; this.sceneSignature = ''; this.cardSignature = '';
    const style = document.createElement('style'); style.textContent = HOME_CSS;
    document.head.appendChild(style);
    this.root = document.createElement('section'); this.root.id = 'burrow';
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'burrow-title');
    this.root.innerHTML = `<header><h1 id="burrow-title">THE BURROW</h1>
      <span class="sub">A little light beneath a very large planet.</span>
      <button class="x" id="bx" aria-label="Close the Burrow">Close · E</button></header>
      <div id="bmain"><div id="bside">
        <aside class="bpanel"><h2>MAKE ROOM</h2><div id="bcards"></div></aside>
        <aside class="bpanel" id="binspect"><h2>YOUR NEXT ROOM</h2><div id="bdetail"></div></aside>
        <aside class="bpanel report-panel"><h2>HOME COMFORTS</h2><div id="breport"></div></aside>
        <aside class="bpanel voice-panel"><h2>VESPER</h2><div id="bvesper"></div><div id="bstats"></div></aside>
      </div><div id="bscene"><svg id="bsvg" preserveAspectRatio="xMidYMin meet" role="group" aria-label="Your underground home. Choose a room or glowing building space."></svg></div></div>
      <footer><span class="hint" id="btip">Choose a piece, then a glowing space. Inspect finished rooms to see how they help.</span>
        <button id="benter">Enter your home</button><button id="bexplore">Explore the workings</button><button id="bdrone"></button><button id="brecall"></button><button id="bring"></button></footer>`;
    document.body.appendChild(this.root);
    this.q('#bx').onclick = () => this.close();
    this.q('#bexplore').onclick = () => this.h.onExplore?.();
    this.q('#benter').onclick = () => this.h.onEnterHome?.();
    for (const [id, hook] of [['#bring', 'onInstallRing'], ['#bdrone', 'onDeployDrone'], ['#brecall', 'onRecall']]) {
      this.q(id).onclick = () => { this.h[hook]?.(); this.render(); };
    }
    this.q('#bcards').onclick = e => {
      const card = e.target.closest('.bcard');
      if (!card) return;
      this.sel = card.dataset.id; this.selectedKey = ''; this.render();
      this.q(`[data-id="${this.sel}"]`)?.focus({ preventScroll: true });
    };
    this.q('#bsvg').addEventListener('click', e => this.activate(e));
    this.root.addEventListener('keydown', e => {
      // Modal controls must not also move, jump or build in the world.
      e.stopPropagation();
      if (e.key === 'Escape' || e.code === 'KeyE') { e.preventDefault(); this.close(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-key]')) {
        e.preventDefault(); this.activate(e); return;
      }
      if (e.key === 'Tab') {
        const all = [...this.root.querySelectorAll('button:not(:disabled), [tabindex="0"]')]
          .filter(el => el.getClientRects().length);
        const first = all[0], last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
  }

  q(selector) { return this.root.querySelector(selector); }
  activate(e) {
    const target = e.target.closest('[data-key]');
    if (!target) return;
    const key = target.dataset.key;
    if (target.classList.contains('sock')) this.h.onPlan(this.sel, +target.dataset.c, +target.dataset.d);
    else if (target.classList.contains('plan')) this.h.onCancel(+target.dataset.c, +target.dataset.d);
    this.selectedKey = key; this.render();
    this.q(`[data-key="${key}"]`)?.focus({ preventScroll: true });
  }
  open() {
    this.returnFocus = document.activeElement;
    this.visible = true; this.root.classList.add('open'); this.render(); this.q('#bx').focus();
  }
  close() {
    this.visible = false; this.root.classList.remove('open');
    this.h.onClose?.();
  }
  toggle() { this.visible ? this.close() : this.open(); }
  update(dt) {
    if (!this.visible) return;
    this._t += dt;
    if (this._t > .4) { this._t = 0; this.render(); }
  }

  render() {
    const b = this.h.getBurrow(), bank = this.h.getBank?.();
    const discovery = !!this.h.getDiscovery?.();
    this.root.classList.toggle('reduced-motion', !!this.h.reducedMotion?.());
    const cards = Object.entries(BURROW_PIECES).map(([id, p]) =>
      `<button class="bcard${id === this.sel ? ' sel' : ''}" data-id="${id}" aria-pressed="${id === this.sel}"><span class="glyph" aria-hidden="true">${GLYPH[id]}</span><span><b>${esc(p.name)}</b><small>${digPrice(b, id)} kWh to dig</small></span></button>`).join('');
    if (cards !== this.cardSignature) {
      const id = document.activeElement?.dataset?.id;
      this.q('#bcards').innerHTML = cards; this.cardSignature = cards;
      if (id) this.q(`[data-id="${id}"]`)?.focus({ preventScroll: true });
    }
    // Keep SVG DOM and CSS animations alive until actual visible state changes.
    const signature = JSON.stringify([this.sel, this.selectedKey, b.ringInstalled, this.h.getDroneCount(), discovery,
      [...b.cells].map(([k,c]) => [k,c.piece,Math.round(c.dug*100),!!c.waiting])]);
    if (signature !== this.sceneSignature) {
      const focused = document.activeElement?.dataset?.key;
      const scene = renderHomeScene(b, this.sel, { droneCount:this.h.getDroneCount(), selectedKey:this.selectedKey, discovery });
      const svg = this.q('#bsvg');
      svg.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`); svg.innerHTML = scene.svg;
      this.sceneSignature = signature;
      if (focused) this.q(`[data-key="${focused}"]`)?.focus({ preventScroll: true });
    }
    const desc = roomDescription(b, this.selectedKey);
    this.q('#bdetail').innerHTML = desc
      ? `<b>${esc(desc.title)} · ${desc.depth} m</b><div class="state">${esc(desc.state)}</div><p>${esc(desc.detail)}</p>`
      : `<b>${esc(BURROW_PIECES[this.sel].name)}</b><p>${this.sel === 'shaft' ? 'Choose the glowing space below your lowest shaft. Working drones dig the planned extension.'
        : this.sel === 'corridor' ? 'Choose a glowing space beside a finished shaft or corridor.'
        : 'Rooms join finished corridors. Dig a corridor first if no space is glowing.'}</p>`;
    if (discovery) this.q('#bdetail').innerHTML += '<p class="state">FIRST LIGHT · Field survey complete</p>';
    const rep = warrenReport(b);
    this.q('#breport').innerHTML = meter('Shelter',rep.shelter) + meter('Garden air',rep.air,true) + meter('Hauling help',rep.haul*2);
    this.q('#bvesper').textContent = this.h.line?.() || 'The instrument channel is ready.';
    const fleet = fleetCounts(this.h.getDroneCount());
    this.q('#bstats').textContent = `${fleet.spider} spider · ${fleet.flying} flying · ${b.queue.length} queued${bank ? ` · ${bank.charge}/${bank.capacity} kWh` : ''}`;
    this.q('#bstats').title = 'Spiders excavate and fabricate; flying drones survey and carry light loads. The fleet currently shares one work budget.';
    const drone = this.q('#bdrone'), frame = this.h.droneCarried?.(), funded = bank?.charge >= BUILD_KWH.drone;
    drone.disabled = !(frame && funded) || this.h.getDroneCount() >= 8;
    drone.textContent = this.h.getDroneCount() >= 8 ? 'All 8 drones deployed' : !frame ? 'Drone needs a frame' : funded ? `Deploy drone · ${BUILD_KWH.drone} kWh` : 'Drone needs charge';
    const recall = this.q('#brecall'), away = this.h.buggyAwayM?.() || 0, towing = this.h.recallState?.();
    recall.style.display = towing || away >= RECALL_MIN_M ? '' : 'none';
    recall.disabled = !!towing || !(bank?.charge >= RECALL_KWH);
    recall.textContent = towing ? `Fetching buggy · ${Math.ceil(towing.rem)}s` : `Recall buggy · ${RECALL_KWH} kWh · ${recallSeconds(away)}s`;
    const ring = this.q('#bring'), dug = b.cells.get('0,1')?.dug >= 1, carried = this.h.ringCarried();
    this.q('#bexplore').disabled = !dug;
    this.q('#benter').disabled = !dug;
    ring.disabled = b.ringInstalled || !(dug && carried);
    ring.classList.toggle('done', b.ringInstalled);
    ring.textContent = b.ringInstalled ? 'Home sealed' : !carried ? 'Bring the airlock ring' : !dug ? 'Dig the shaft first' : 'Seal your home';
  }
}
