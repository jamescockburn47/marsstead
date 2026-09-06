// The Works console — Stage 2's display (STRUCTURE.md): the production
// chain as a living flow diagram, in the Burrow console's design language.
// Four stations left to right — FABRICATOR (the lander's bench), SMELTER,
// MILL, ASSEMBLER — each drawn as an instrument card on the line, with a
// gold conduit that FLOWS while anything cooks. Read-only by design: T at
// the bench feeds and empties (the hands stay in the world); this screen
// is where the chain becomes legible. burrow-language CSS, zero assets.

import { RECIPES } from './refine.js';
import { MACHINE_TYPES } from './machines.js';
import { ITEMS } from './inventory.js';

const CSS = `
  #works { position: fixed; inset: 0; z-index: 55; display: none;
    background: rgba(12,7,4,.99); color: #f6ede2;
    font-family: Georgia, 'Times New Roman', serif; }
  #works.open { display: flex; flex-direction: column; }
  #works header { display: flex; align-items: baseline; gap: 14px;
    padding: 12px 22px 9px; }
  #works header h1 { margin: 0; font-size: 19px; letter-spacing: 7px;
    font-weight: normal; color: #e8c46a; }
  #works header .sub { opacity: .55; font-size: 12px; letter-spacing: 2px; }
  #works header .x { margin-left: auto; cursor: pointer; opacity: .7;
    font-size: 17px; padding: 2px 8px; }
  #works header .x:hover { opacity: 1; }
  #wgrid { display: flex; align-items: center; gap: 18px; margin: 0 30px;
    padding: 10px 14px; border: 1px solid rgba(232,196,106,.25);
    border-radius: 6px; font-size: 11.5px; letter-spacing: 1px;
    background: linear-gradient(180deg, rgba(38,22,13,.9), rgba(22,12,7,.9)); }
  #wgrid b { color: #e8c46a; }
  #wgrid .bank { flex: 1; max-width: 220px; height: 6px; border-radius: 3px;
    background: rgba(246,237,226,.1); overflow: hidden; }
  #wgrid .bank i { display: block; height: 100%;
    background: linear-gradient(90deg, #2c9b95, #3fd0c9); }
  #wgrid .shed { color: #d1685a; letter-spacing: 2px; }
  #wgrid .cast { opacity: .7; }
  #wmain { flex: 1; display: flex; align-items: center; padding: 0 30px;
    min-height: 0; overflow-x: auto; gap: 0; }
  .wstation { flex: 1; min-width: 200px; border: 1px solid rgba(232,196,106,.25);
    border-radius: 6px; padding: 14px; position: relative;
    background: linear-gradient(180deg, rgba(38,22,13,.9), rgba(22,12,7,.9)); }
  .wstation h2 { margin: 0 0 4px; font-size: 12px; letter-spacing: 3px;
    color: #e8c46a; font-weight: normal; }
  .wstation .built { font-size: 10px; letter-spacing: 2px; opacity: .55;
    margin-bottom: 10px; }
  .wstation .built.none { color: #d1685a; opacity: .85; }
  .wrec { font-size: 11px; opacity: .8; line-height: 1.7; }
  .wrec b { color: #e8c46a; }
  .wtray { margin-top: 10px; font-size: 11px; }
  .wtray b { color: #3fd0c9; }
  .wlink { width: 46px; flex: none; height: 3px; position: relative;
    background: rgba(232,196,106,.18); }
  .wlink.live { background: repeating-linear-gradient(90deg,
    #e8c46a 0 7px, rgba(232,196,106,.15) 7px 14px);
    animation: wflow 0.9s linear infinite; }
  @keyframes wflow { to { background-position: 14px 0; } }
  #works footer { display: flex; gap: 20px; align-items: center;
    padding: 10px 26px 16px; font-size: 11.5px; letter-spacing: 1px; }
  #works footer .motto { color: #e8c46a; opacity: .85; }
  #works footer .hint { opacity: .5; }
`;

// what each station is FOR — the legible chain
const STATIONS = [
  {
    key: 'fab', name: 'FABRICATOR', sub: 'the lander bench',
    recipes: Object.entries(RECIPES).map(([raw, r]) => [raw, r]),
  },
  { key: 'smelter', name: 'SMELTER', sub: 'ore to stock' },
  { key: 'mill', name: 'MILL', sub: 'stock to parts' },
  { key: 'assembler', name: 'ASSEMBLER', sub: 'parts to expedition' },
];

const nm = (id) => (ITEMS[id] ? ITEMS[id].name : id);

export class WorksConsole {
  // hooks: { getFab, getMachines, line }
  constructor(hooks) {
    this.h = hooks;
    this.visible = false;
    this._t = 0;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'works';
    this.root.innerHTML = `
      <header><h1>THE WORKS</h1>
        <div class="sub">ore in the west door, the expedition out the east — Stage 2 of the demonstration</div>
        <div class="x" id="wx">✕</div></header>
      <div id="wgrid"></div>
      <div id="wmain"></div>
      <footer><span class="motto" id="wvesper"></span>
        <span class="hint">T at a bench feeds and empties it · B places new stations · E closes</span></footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('#wx').onclick = () => this.close();
  }

  open() { this.visible = true; this.root.classList.add('open'); this.render(); }
  close() { this.visible = false; this.root.classList.remove('open'); }
  toggle() { this.visible ? this.close() : this.open(); }

  update(dt) {
    if (!this.visible) return;
    this._t += dt;
    if (this._t > 0.5) { this._t = 0; this.render(); }
  }

  render() {
    const fab = this.h.getFab();
    const machines = this.h.getMachines();
    const byType = (t) => machines.filter((m) => m.type === t);

    const stationHtml = (st) => {
      let built, queue = 0, out = {}, weatherPaused = 0;
      let recipes;
      if (st.key === 'fab') {
        built = 1; queue = fab.queue.length; out = fab.out;
        recipes = STATIONS[0].recipes;
      } else {
        const ms = byType(st.key);
        built = ms.length;
        for (const m of ms) {
          queue += m.queue.length;
          if (m.exposure?.secured || (m.exposure?.dust ?? 0) >= .6) weatherPaused++;
          for (const [id, n] of Object.entries(m.out)) out[id] = (out[id] || 0) + n;
        }
        recipes = Object.entries(MACHINE_TYPES[st.key].recipes);
      }
      const rec = recipes.map(([raw, r]) =>
        `<div>${nm(raw)} <b>→</b> ${nm(r.out)} <span style="opacity:.45">· ${r.seconds}s</span></div>`).join('');
      const tray = Object.entries(out).map(([id, n]) => `${nm(id)} <b>×${n}</b>`).join(' · ');
      // STAGE 3 (pads dead 2026-07-20): the assembler is where the
      // hopper is born — one commit row until the craft exists
      let hopRow = '';
      if (st.key === 'assembler' && built && this.h.hopBuilt && !this.h.hopBuilt()) {
        const can = this.h.hopCan();
        hopRow = `<div class="wtray">THE HOPPER — ${can.text}<br>
          <button id="wassemble" ${can.ok ? '' : 'disabled'}
            style="margin-top:6px;padding:7px 16px;cursor:pointer;font-family:inherit;
            font-size:11.5px;letter-spacing:2px;border-radius:4px;color:#0c1a18;
            background:linear-gradient(180deg,#3fd0c9,#2c9b95);border:1px solid #6fe0d8;">
            ⬡ ASSEMBLE THE HOPPER</button></div>`;
      }
      return `<div class="wstation">
        <h2>${st.name}</h2>
        <div class="built${built ? '' : ' none'}">${st.sub} · ${built ? `${built} standing` : 'NOT BUILT — B to place'}</div>
        <div class="wrec">${rec}</div>
        <div class="wtray">${queue ? `queued <b>${queue}</b> · ` : ''}${tray || 'tray empty'}${weatherPaused ? `<br>${weatherPaused} paused by covers / dust · use Weather to restore` : ''}</div>
        ${hopRow}
      </div>`;
    };

    const cooking = (st) => (st.key === 'fab' ? fab.queue.length > 0
      : byType(st.key).some((m) => m.queue.length > 0 && !m.exposure?.secured && (m.exposure?.dust ?? 0) < .6));
    let html = '';
    STATIONS.forEach((st, i) => {
      if (i) html += `<div class="wlink${cooking(STATIONS[i - 1]) || cooking(st) ? ' live' : ''}"></div>`;
      html += stationHtml(st);
    });
    this.root.querySelector('#wmain').innerHTML = html;
    const ab = this.root.querySelector('#wassemble');
    if (ab) {
      ab.onclick = () => { this.h.hopAssemble(); this.render(); };
    }

    // ---- the grid strip: the thermostat's whole truth in one line
    const g = this.h.getGrid ? this.h.getGrid() : null;
    const gridEl = this.root.querySelector('#wgrid');
    if (g) {
      const frac = g.capacity > 0 ? g.charge / g.capacity : 0;
      const cast = this.h.getForecast ? this.h.getForecast() : null;
      const castTxt = cast
        ? (cast.tomorrow > cast.today + 0.12
          ? 'tomorrow runs dustier — charge tonight'
          : cast.tomorrow < cast.today - 0.12
            ? 'tomorrow runs clearer' : 'steady skies ahead')
        : '';
      gridEl.innerHTML = `<span>GRID <b>${g.supply}</b> kW in · <b>${g.served}</b>/${g.demand} kW served</span>
        <div class="bank"><i style="width:${Math.round(frac * 100)}%"></i></div>
        <span>bank <b>${g.charge}</b>/${g.capacity || 0}</span>
        ${g.shed.length ? `<span class="shed">QUIET: ${g.shed.join(' · ')}</span>` : ''}
        <span class="cast">${castTxt}</span>`;
    } else {
      gridEl.innerHTML = '<span class="cast">grid telemetry warms up with the first frame</span>';
    }
    this.root.querySelector('#wvesper').textContent = `“${this.h.line()}”`;
  }
}
