// The hop console — the pad's display (STRUCTURE.md: consoles are the
// indoors). The Sanctum grammar aimed at the sky: a chart of the local
// world with the FUEL CIRCLE drawn on it, pads and the crown marked, an
// aim you place by hand, the descent ellipse drawn honestly around it,
// payload and tanks as commitments, and one commit button that lights
// the engine. hopper.js owns every number; this only asks it questions.
// Serif + instrument teal on dark — the console language. DOM/SVG only.

import {
  hopRangeKm, fuelForKm, planHop, TANK_FUEL_KG, MAX_TANKS,
  MIN_HOP_KM, CRADLE_BUGGY_KG,
} from './hopper.js';
import { featuresInBox, latLonToWorld } from './mars.js';
import { PlanetChart, nearestWrappedX } from './planetchart.js';

const CSS = `
  #hopc { position: fixed; inset: 0; z-index: 55; display: none;
    background: rgba(10,6,4,.985); color: #f6ede2;
    font-family: Georgia, 'Times New Roman', serif; }
  #hopc.open { display: flex; flex-direction: column; }
  #hopc header { padding: 16px 26px 6px; }
  #hopc h1 { margin: 0; font-size: 17px; letter-spacing: 6px; color: #e8c46a;
    font-weight: normal; }
  #hopc .sub { font-size: 11px; letter-spacing: 2px; opacity: .55; margin-top: 3px; }
  #hopc .x { position: absolute; top: 16px; right: 22px; cursor: pointer;
    opacity: .7; font-size: 15px; } #hopc .x:hover { opacity: 1; }
  #hmain { flex: 1; display: flex; gap: 14px; padding: 10px 22px; min-height: 0; }
  #hside { width: 300px; display: flex; flex-direction: column; gap: 10px; }
  .hpanel { border: 1px solid rgba(232,196,106,.28); border-radius: 4px;
    padding: 10px 14px; background: rgba(28,16,9,.55); font-size: 12.5px;
    line-height: 1.55; }
  .hpanel h2 { margin: 0 0 6px; font-size: 10.5px; letter-spacing: 3px;
    color: #e8c46a; font-weight: normal; }
  .hpanel b { color: #e8c46a; }
  .hpanel .teal { color: #3fd0c9; }
  #hchartwrap { flex: 1; border: 1px solid rgba(63,208,201,.25); border-radius: 4px;
    background: radial-gradient(ellipse at center, rgba(40,22,12,.6), rgba(14,8,5,.9)); }
  #hchart { width: 100%; height: 100%; display: block; cursor: crosshair; }
  #hplanetwrap { position: relative; width: 100%; height: 100%; display: none; }
  #hplanet { width: 100%; height: 100%; display: block; cursor: grab;
    touch-action: none; }
  #hplanet:active { cursor: grabbing; }
  #hlabels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  #hlabels span { position: absolute; transform: translate(-50%, -50%);
    white-space: nowrap; }
  #hlabels .pl-name { font-size: 9.5px; letter-spacing: 2px;
    color: rgba(246,237,226,.75); text-shadow: 0 1px 3px rgba(10,4,2,.9); }
  #hlabels .pl-mark { font-size: 14px; }
  #hlabels .pl-home { color: #e8c46a; }
  #hlabels .pl-craft { color: #3fd0c9; font-size: 10px; }
  #hlabels .pl-aim { color: #e8c46a; font-size: 16px; }
  #hchartwrap.planet #hchart { display: none; }
  #hchartwrap.planet #hplanetwrap { display: block; }
  #hopc footer { display: flex; align-items: center; gap: 16px;
    padding: 8px 22px 14px; font-size: 11.5px; letter-spacing: 1px; }
  #hopc footer .motto { color: #e8c46a; opacity: .85; }
  #hopc footer .hint { opacity: .5; flex: 1; }
  #hopc button { padding: 10px 24px; cursor: pointer; font-family: inherit;
    font-size: 12px; letter-spacing: 3px; border-radius: 4px;
    color: #0c1a18; background: linear-gradient(180deg, #3fd0c9, #2c9b95);
    border: 1px solid #6fe0d8; box-shadow: 0 0 18px rgba(63,208,201,.3); }
  #hopc button.gold { color: #1a0f08;
    background: linear-gradient(180deg, #e8c46a, #c9a04a);
    border-color: #f2d68a; box-shadow: 0 0 18px rgba(232,196,106,.35); }
  #hopc button:disabled { color: rgba(246,237,226,.45);
    background: rgba(232,196,106,.07); border-color: rgba(232,196,106,.3);
    box-shadow: none; cursor: default; }
  #hopc .tk { display: inline-block; width: 15px; height: 15px; margin: 0 3px;
    border-radius: 50%; border: 1px solid rgba(63,208,201,.6); vertical-align: -3px; }
  #hopc .tk.full { background: #3fd0c9; box-shadow: 0 0 8px rgba(63,208,201,.6); }
`;

export class HopConsole {
  // hooks: { getHopper, getHome -> {x,z}, buggyNear -> bool,
  //   tanksCarried -> n, onLoadTank, onIgnite(tx, tz, cradle),
  //   getBank, line }
  constructor(hooks) {
    this.h = hooks;
    this.visible = false;
    this.aim = null;          // world [x, z] the settler marked
    this.cradle = false;
    this._t = 0;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hopc';
    this.root.innerHTML = `
      <header><h1>THE HOPPER</h1>
        <div class="sub">the horizon is a fuel problem — plot inside the circle</div>
        <div class="x" id="hx">✕</div></header>
      <div id="hmain">
        <div id="hside">
          <aside class="hpanel" id="hcraft"></aside>
          <aside class="hpanel" id="hplot"></aside>
          <aside class="hpanel"><h2>VESPER</h2><div id="hvesper"></div></aside>
        </div>
        <div id="hchartwrap"><svg id="hchart" preserveAspectRatio="xMidYMid meet"></svg>
          <div id="hplanetwrap"><canvas id="hplanet"></canvas><div id="hlabels"></div></div></div>
      </div>
      <footer><span class="motto">the horizon is a fuel problem — you land where you aim</span>
        <span class="hint" id="hhint"></span>
        <button id="hview"></button>
        <button id="hload"></button>
        <button id="hcradle"></button>
        <button id="hgo" class="gold"></button></footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('#hx').onclick = () => this.close();
    this.root.querySelector('#hload').onclick = () => { this.h.onLoadTank(); this.render(); };
    this.root.querySelector('#hcradle').onclick = () => {
      this.cradle = !this.cradle; this.render();
    };
    this.root.querySelector('#hgo').onclick = () => {
      if (!this.aim) return;
      this.h.onIgnite(this.aim[0], this.aim[1], this.cradle);
      this.close();
    };
    this.svg = this.root.querySelector('#hchart');
    this.svg.addEventListener('click', (e) => {
      const r = this.svg.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      const { cx, cz, span } = this.view;
      this.aim = [cx + (u - 0.5) * span, cz + (v - 0.5) * span];
      this.render();
    });

    // ---- THE PLANET: the orbital page — the actual globe, live in its
    // own view; drag turns it, a click anywhere is an aim resolved
    // wrap-shortest from the craft
    this.planetMode = false;
    this.planet = new PlanetChart(
      this.root.querySelector('#hplanet'),
      this.root.querySelector('#hlabels'),
      ({ lat, lonE }) => {
        const H = this.h.getHopper();
        const w = latLonToWorld(lat, lonE);
        this.aim = [nearestWrappedX(w.x, H.x), w.z];
        this.render();
      },
      this.h.season ? this.h.season() : 0,
    );
    this.root.querySelector('#hview').onclick = () => {
      this.planetMode = !this.planetMode;
      this.root.querySelector('#hchartwrap').classList.toggle('planet', this.planetMode);
      this.render();
    };
  }

  open() { this.visible = true; this.root.classList.add('open'); this.render(); }
  close() { this.visible = false; this.root.classList.remove('open'); }
  toggle() { this.visible ? this.close() : this.open(); }

  update(dt) {
    if (!this.visible) return;
    this._t += dt;
    if (this._t > 0.6) { this._t = 0; this.render(); }
    // the planet is a LIVE view: it turns every frame while open
    if (this.planetMode) {
      const H = this.h.getHopper();
      const payload = this.cradle ? CRADLE_BUGGY_KG : 0;
      this.planet.tick(dt, {
        homes: this.h.homes ? this.h.homes() : [],
        craft: { x: H.x, z: H.z },
        aim: this.aim ? { x: this.aim[0], z: this.aim[1] } : null,
        rangeKm: hopRangeKm(H.fuelKg, payload),
      });
    }
  }

  render() {
    const H = this.h.getHopper();
    const payload = this.cradle ? CRADLE_BUGGY_KG : 0;
    const rangeKm = hopRangeKm(H.fuelKg, payload);
    const home = this.h.getHome();

    // ---- the craft panel
    const tanks = Math.round(H.fuelKg / TANK_FUEL_KG);
    const slots = Array.from({ length: MAX_TANKS }, (_, i) =>
      `<span class="tk${i < tanks ? ' full' : ''}"></span>`).join('');
    this.root.querySelector('#hcraft').innerHTML = `<h2>THE CRAFT</h2>
        tanks ${slots}<br>
        fuel <b>${Math.round(H.fuelKg)}</b> kg · payload <b>${payload}</b> kg<br>
        reach <b class="teal">${rangeKm.toFixed(0)} km</b> ${this.cradle ? '(buggy cradled)' : ''}`;

    // ---- the plot panel
    let plotHtml = '<h2>THE PLOT</h2>mark a target on the chart — you land where you aim.';
    let goOk = false;
    if (this.aim) {
      const plan = planHop(H, [H.x, H.z], this.aim, payload);
      plotHtml = `<h2>THE PLOT</h2>
        distance <b>${plan.distKm}</b> km · needs <b>${plan.fuelNeed === Infinity ? '∞' : plan.fuelNeed}</b> kg<br>
        <span class="teal">exact landing on the mark</span><br>
        ${plan.ok ? '<span class="teal">inside the circle — the engine will light</span>'
          : plan.distKm < MIN_HOP_KM ? 'too near — the buggy is the answer'
            : 'beyond the circle — more tanks or less mass'}`;
      goOk = plan.ok;
    }
    this.root.querySelector('#hplot').innerHTML = plotHtml;
    const go = this.root.querySelector('#hgo');
    go.disabled = !goOk;
    go.textContent = '⌁ LIGHT THE ENGINE';

    // ---- footer buttons
    const load = this.root.querySelector('#hload');
    const carried = this.h.tanksCarried();
    load.disabled = !(carried > 0 && tanks < MAX_TANKS);
    load.textContent = carried > 0
      ? `⛽ LOAD A TANK (${carried} aboard)` : '⛽ NO TANKS IN REACH (THE ASSEMBLER)';
    const cr = this.root.querySelector('#hcradle');
    const buggyNear = this.h.buggyNear();
    cr.disabled = !buggyNear && !this.cradle;
    cr.textContent = this.cradle ? '⊔ BUGGY CRADLED — RELEASE'
      : buggyNear ? '⊔ CRADLE THE BUGGY' : '⊔ PARK THE BUGGY BESIDE THE CRAFT TO CRADLE';
    this.root.querySelector('#hhint').textContent = `tanks are spent whole at ignition · minimum hop ${MIN_HOP_KM} km`;
    this.root.querySelector('#hvesper').textContent = `“${this.h.line()}”`;
    this.root.querySelector('#hview').textContent = this.planetMode
      ? '⊞ THE COUNTRY' : '⊕ THE PLANET';

    // ---- the chart page (the planet page renders itself in update())
    if (!this.planetMode) this.renderChart(H, rangeKm, home);
  }

  renderChart(H, rangeKm, home) {
    const S = 640;
    const span = Math.max(6000, rangeKm * 2 * 1150); // the circle fills most of it
    this.view = { cx: H.x, cz: H.z, span };
    const px = (wx) => ((wx - H.x) / span + 0.5) * S;
    const pz = (wz) => ((wz - H.z) / span + 0.5) * S;
    const km = (m) => (m / span) * S;
    let s = `<svg viewBox="0 0 ${S} ${S}">`;
    // range rings with honest labels
    for (const rKm of [2, 5, 10, 20]) {
      const r = km(rKm * 1000);
      if (r > S * 0.7) continue;
      s += `<circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none"
        stroke="rgba(232,196,106,.16)" stroke-width="1"/>
        <text x="${S / 2 + r + 4}" y="${S / 2 - 4}" fill="rgba(232,196,106,.4)"
        font-size="11">${rKm} km</text>`;
    }
    // THE FUEL CIRCLE
    if (rangeKm > 0) {
      s += `<circle cx="${S / 2}" cy="${S / 2}" r="${km(rangeKm * 1000)}" fill="rgba(63,208,201,.05)"
        stroke="rgba(63,208,201,.65)" stroke-width="1.6" stroke-dasharray="7 5"/>`;
    }
    // the land's own names: the gazetteer inside the drawn box — places,
    // not markers (nothing pulses; wanting to see one is a plan)
    const half = span / 2;
    for (const f of featuresInBox(H.x - half, H.z - half, H.x + half, H.z + half)) {
      s += `<text x="${px(f.x)}" y="${pz(f.z)}" fill="rgba(246,237,226,.55)"
        font-size="10.5" letter-spacing="2" text-anchor="middle">${f.name.toUpperCase()}</text>`;
    }
    // every roof you own — the way home is always on the chart
    for (const hm of (this.h.homes ? this.h.homes() : (home ? [{ ...home, glyph: '⌂', label: '', colour: '#e8c46a' }] : []))) {
      s += `<text x="${px(hm.x)}" y="${pz(hm.z) + 4}" fill="${hm.colour}" font-size="13"
        text-anchor="middle">${hm.glyph}</text>
        <text x="${px(hm.x)}" y="${pz(hm.z) + 15}" fill="${hm.colour}" font-size="8"
        letter-spacing="1.5" opacity="0.75" text-anchor="middle">${hm.label}</text>`;
    }
    s += `<circle cx="${S / 2}" cy="${S / 2}" r="3.4" fill="#3fd0c9"/>`;
    // the aim: exact — the mark IS the landing
    if (this.aim) {
      const ax = px(this.aim[0]), az = pz(this.aim[1]);
      s += `<line x1="${ax - 8}" y1="${az}" x2="${ax + 8}" y2="${az}" stroke="#e8c46a" stroke-width="1.2"/>
        <line x1="${ax}" y1="${az - 8}" x2="${ax}" y2="${az + 8}" stroke="#e8c46a" stroke-width="1.2"/>`;
      s += `<line x1="${S / 2}" y1="${S / 2}" x2="${ax}" y2="${az}"
        stroke="rgba(63,208,201,.3)" stroke-width="1" stroke-dasharray="3 4"/>`;
    }
    s += '</svg>';
    this.svg.outerHTML = s.replace('<svg ', `<svg id="hchart" preserveAspectRatio="xMidYMid meet" `);
    this.svg = this.root.querySelector('#hchart');
    this.svg.addEventListener('click', (e) => {
      const r = this.svg.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      this.aim = [this.view.cx + (u - 0.5) * this.view.span,
        this.view.cz + (v - 0.5) * this.view.span];
      this.render();
    });
  }
}
