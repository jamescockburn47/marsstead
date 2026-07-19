// The hop console — the pad's display (STRUCTURE.md: consoles are the
// indoors). The Sanctum grammar aimed at the sky: a chart of the local
// world with the FUEL CIRCLE drawn on it, pads and the crown marked, an
// aim you place by hand, the descent ellipse drawn honestly around it,
// payload and tanks as commitments, and one commit button that lights
// the engine. hopper.js owns every number; this only asks it questions.
// Serif + instrument teal on dark — the console language. DOM/SVG only.

import {
  hopRangeKm, fuelForKm, planHop, descentEllipseM, TANK_FUEL_KG, MAX_TANKS,
  MIN_HOP_KM, CRADLE_BUGGY_KG,
} from './hopper.js';

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
  // hooks: { getHopper, isBuilt, canAssemble -> {ok, missing}, onAssemble,
  //   getPads -> [{x,z}], getHome -> {x,z}, buggyNear -> bool,
  //   tanksCarried -> n, onLoadTank, onIgnite(tx, tz, cradle, onPad),
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
        <div id="hchartwrap"><svg id="hchart" preserveAspectRatio="xMidYMid meet"></svg></div>
      </div>
      <footer><span class="motto">a pad is a promise — open ground is an ellipse</span>
        <span class="hint" id="hhint"></span>
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
      if (this.assembleMode) { this.h.onAssemble(); this.render(); return; }
      if (!this.aim) return;
      const pad = this.padAt(this.aim[0], this.aim[1]);
      this.h.onIgnite(pad ? pad.x : this.aim[0], pad ? pad.z : this.aim[1],
        this.cradle, !!pad);
      this.close();
    };
    this.svg = this.root.querySelector('#hchart');
    this.svg.addEventListener('click', (e) => {
      if (this.assembleMode) return;
      const r = this.svg.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      const { cx, cz, span } = this.view;
      this.aim = [cx + (u - 0.5) * span, cz + (v - 0.5) * span];
      this.render();
    });
  }

  padAt(x, z) {
    return (this.h.getPads() || []).find((p) => Math.hypot(p.x - x, p.z - z) < 900);
  }

  open() { this.visible = true; this.root.classList.add('open'); this.render(); }
  close() { this.visible = false; this.root.classList.remove('open'); }
  toggle() { this.visible ? this.close() : this.open(); }

  update(dt) {
    if (!this.visible) return;
    this._t += dt;
    if (this._t > 0.6) { this._t = 0; this.render(); }
  }

  render() {
    const H = this.h.getHopper();
    const built = this.h.isBuilt();
    this.assembleMode = !built;
    const payload = this.cradle ? CRADLE_BUGGY_KG : 0;
    const rangeKm = hopRangeKm(H.fuelKg, payload);
    const home = this.h.getHome();

    // ---- the craft panel
    const tanks = Math.round(H.fuelKg / TANK_FUEL_KG);
    const slots = Array.from({ length: MAX_TANKS }, (_, i) =>
      `<span class="tk${i < tanks ? ' full' : ''}"></span>`).join('');
    this.root.querySelector('#hcraft').innerHTML = built
      ? `<h2>THE CRAFT</h2>
        tanks ${slots}<br>
        fuel <b>${Math.round(H.fuelKg)}</b> kg · payload <b>${payload}</b> kg<br>
        reach <b class="teal">${rangeKm.toFixed(0)} km</b> ${this.cradle ? '(buggy cradled)' : ''}`
      : `<h2>ASSEMBLY</h2>
        The pad stands ready; the craft does not exist yet.<br>${this.h.canAssemble().text}`;

    // ---- the plot panel
    let plotHtml = '<h2>THE PLOT</h2>mark a target on the chart.';
    let goOk = false, goLabel = '⌁ LIGHT THE ENGINE';
    if (!built) {
      const a = this.h.canAssemble();
      goOk = a.ok; goLabel = '⬡ ASSEMBLE THE HOPPER';
    } else if (this.aim) {
      const pad = this.padAt(this.aim[0], this.aim[1]);
      const to = pad ? [pad.x, pad.z] : this.aim;
      const plan = planHop(H, [H.x, H.z], to, payload);
      const e = descentEllipseM(plan.distKm);
      plotHtml = `<h2>THE PLOT</h2>
        distance <b>${plan.distKm}</b> km · needs <b>${plan.fuelNeed === Infinity ? '∞' : plan.fuelNeed}</b> kg<br>
        ${pad ? '<span class="teal">pad landing — exact, on the mark</span>'
          : `open ground — ellipse <b>${(e.along / 1000).toFixed(1)}×${(e.cross / 1000).toFixed(1)}</b> km`}<br>
        ${plan.ok ? '<span class="teal">inside the circle — the engine will light</span>'
          : plan.distKm < MIN_HOP_KM ? 'too near — the buggy is the answer'
            : 'beyond the circle — more tanks or less mass'}`;
      goOk = plan.ok;
    }
    this.root.querySelector('#hplot').innerHTML = plotHtml;
    const go = this.root.querySelector('#hgo');
    go.disabled = !goOk;
    go.textContent = goLabel;

    // ---- footer buttons
    const load = this.root.querySelector('#hload');
    const carried = this.h.tanksCarried();
    load.style.display = built ? '' : 'none';
    load.disabled = !(carried > 0 && tanks < MAX_TANKS);
    load.textContent = carried > 0
      ? `⛽ LOAD A TANK (${carried} aboard)` : '⛽ NO TANKS IN REACH (THE ASSEMBLER)';
    const cr = this.root.querySelector('#hcradle');
    cr.style.display = built ? '' : 'none';
    const buggyNear = this.h.buggyNear();
    cr.disabled = !buggyNear && !this.cradle;
    cr.textContent = this.cradle ? '⊔ BUGGY CRADLED — RELEASE'
      : buggyNear ? '⊔ CRADLE THE BUGGY' : '⊔ PARK THE BUGGY AT THE PAD TO CRADLE';
    this.root.querySelector('#hhint').textContent = built
      ? `tanks are spent whole at ignition · minimum hop ${MIN_HOP_KM} km`
      : '';
    this.root.querySelector('#hvesper').textContent = `“${this.h.line()}”`;

    // ---- the chart
    this.renderChart(H, rangeKm, home, built);
  }

  renderChart(H, rangeKm, home, built) {
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
    if (built && rangeKm > 0) {
      s += `<circle cx="${S / 2}" cy="${S / 2}" r="${km(rangeKm * 1000)}" fill="rgba(63,208,201,.05)"
        stroke="rgba(63,208,201,.65)" stroke-width="1.6" stroke-dasharray="7 5"/>`;
    }
    // home (the crown), pads, the craft
    if (home) {
      s += `<text x="${px(home.x)}" y="${pz(home.z) + 4}" fill="#e8c46a" font-size="13"
        text-anchor="middle">⌂</text>`;
    }
    for (const p of this.h.getPads() || []) {
      s += `<text x="${px(p.x)}" y="${pz(p.z) + 4}" fill="#3fd0c9" font-size="12"
        text-anchor="middle">◇</text>`;
    }
    s += `<circle cx="${S / 2}" cy="${S / 2}" r="3.4" fill="#3fd0c9"/>`;
    // the aim + its honest ellipse
    if (built && this.aim) {
      const pad = this.padAt(this.aim[0], this.aim[1]);
      const ax = px(pad ? pad.x : this.aim[0]), az = pz(pad ? pad.z : this.aim[1]);
      const distKm = Math.hypot(this.aim[0] - H.x, this.aim[1] - H.z) / 1000;
      const e = descentEllipseM(distKm);
      const ang = Math.atan2(this.aim[1] - H.z, this.aim[0] - H.x) * 180 / Math.PI;
      if (!pad) {
        s += `<ellipse cx="${ax}" cy="${az}" rx="${Math.max(3, km(e.along))}"
          ry="${Math.max(2, km(e.cross))}" transform="rotate(${ang} ${ax} ${az})"
          fill="rgba(232,196,106,.10)" stroke="rgba(232,196,106,.55)" stroke-width="1"/>`;
      }
      s += `<line x1="${ax - 8}" y1="${az}" x2="${ax + 8}" y2="${az}" stroke="#e8c46a" stroke-width="1.2"/>
        <line x1="${ax}" y1="${az - 8}" x2="${ax}" y2="${az + 8}" stroke="#e8c46a" stroke-width="1.2"/>`;
      s += `<line x1="${S / 2}" y1="${S / 2}" x2="${ax}" y2="${az}"
        stroke="rgba(63,208,201,.3)" stroke-width="1" stroke-dasharray="3 4"/>`;
    }
    s += '</svg>';
    this.svg.outerHTML = s.replace('<svg ', `<svg id="hchart" preserveAspectRatio="xMidYMid meet" `);
    this.svg = this.root.querySelector('#hchart');
    this.svg.addEventListener('click', (e) => {
      if (this.assembleMode) return;
      const r = this.svg.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      this.aim = [this.view.cx + (u - 0.5) * this.view.span,
        this.view.cz + (v - 0.5) * this.view.span];
      this.render();
    });
  }
}
