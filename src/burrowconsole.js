// The Burrow console — indoors as a display (STRUCTURE.md doctrine 1).
// The scene is a draughtsman's cross-section of a working base, and the
// tool is SVG used PROPERLY: feTurbulence (fbm, native and declarative —
// the family's fractal workhorse in filter form) grains the rock and
// roughens every carved edge via feDisplacementMap; feGaussianBlur pools
// the lamplight; SMIL runs the conduits and the dust motes with no JS per
// frame. Sanctum's LOGIC (card → socket → growth), none of its skin.
// burrow.js owns every truth; this only draws it. Zero assets.

import {
  BURROW_PIECES, COLS, DEPTHS, DIG_KWH, canPlan, parseKey, warrenReport,
} from './burrow.js';

const CS = 64;
const SKY_H = CS * 1.6;

const CSS = `
  #burrow { position: fixed; inset: 0; z-index: 55; display: none;
    background: rgba(12,7,4,.99); color: #f6ede2;
    font-family: Georgia, 'Times New Roman', serif; }
  #burrow.open { display: flex; flex-direction: column; }
  #burrow header { display: flex; align-items: baseline; gap: 14px;
    padding: 12px 22px 9px; }
  #burrow header h1 { margin: 0; font-size: 19px; letter-spacing: 7px;
    font-weight: normal; color: #e8c46a; }
  #burrow header .sub { opacity: .55; font-size: 12px; letter-spacing: 2px; }
  #burrow header .x { margin-left: auto; cursor: pointer; opacity: .7;
    font-size: 17px; padding: 2px 8px; }
  #burrow header .x:hover { opacity: 1; }
  #bmain { flex: 1; display: grid; grid-template-columns: 218px 1fr;
    gap: 12px; padding: 0 22px 10px; min-height: 0; }
  #bside { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .bpanel { border: 1px solid rgba(232,196,106,.22); border-radius: 5px;
    background: linear-gradient(180deg, rgba(38,22,13,.85), rgba(24,13,8,.85));
    padding: 10px; overflow-y: auto; }
  .bpanel h2 { margin: 2px 0 9px; font-size: 10px; letter-spacing: 4px;
    color: #e8c46a; font-weight: normal; opacity: .9; }
  .bcard { display: flex; gap: 9px; align-items: center;
    border: 1px solid rgba(246,237,226,.16); border-radius: 4px;
    padding: 7px 9px; margin-bottom: 7px; cursor: pointer;
    background: rgba(14,8,5,.5); transition: border-color .15s; }
  .bcard:hover { border-color: rgba(232,196,106,.55); }
  .bcard.sel { border-color: #e8c46a; background: rgba(232,196,106,.09);
    box-shadow: 0 0 12px rgba(232,196,106,.12) inset; }
  .bcard svg { width: 34px; height: 34px; flex: none; }
  .bcard b { display: block; font-size: 12px; letter-spacing: 1px; }
  .bcard span { font-size: 10px; opacity: .6; }
  #bvesper { font-size: 11.5px; line-height: 1.55; font-style: italic; opacity: .85; }
  #bstats { font-size: 11.5px; line-height: 1.9; margin-top: 8px; }
  #bstats b { color: #e8c46a; }
  .bmeter { margin: 5px 0 8px; }
  .bmeter .ml { display: flex; justify-content: space-between;
    font-size: 10px; letter-spacing: 2px; opacity: .75; margin-bottom: 3px; }
  .bmeter .mb { height: 5px; border-radius: 3px; background: rgba(246,237,226,.1);
    overflow: hidden; }
  .bmeter .mb i { display: block; height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, #c9a04a, #e8c46a); transition: width .4s; }
  .bmeter.cool .mb i { background: linear-gradient(90deg, #2c9b95, #3fd0c9); }
  #bscene { position: relative; border: 1px solid rgba(232,196,106,.28);
    border-radius: 5px; overflow: hidden; min-height: 0; background: #0e0703; }
  #bscene::before, #bscene::after { content: ''; position: absolute;
    width: 26px; height: 26px; pointer-events: none; z-index: 2;
    border: 2px solid rgba(232,196,106,.55); }
  #bscene::before { top: 8px; left: 8px; border-right: none; border-bottom: none; }
  #bscene::after { bottom: 8px; right: 8px; border-left: none; border-top: none; }
  #bscene svg { width: 100%; height: 100%; display: block; }
  #burrow footer { display: flex; align-items: center; gap: 18px;
    padding: 8px 22px 14px; font-size: 11.5px; letter-spacing: 1px; }
  #burrow footer .motto { color: #e8c46a; opacity: .85; }
  #burrow footer .hint { opacity: .5; }
  #bring, #bdrone { padding: 10px 26px; cursor: pointer;
    font-family: inherit; font-size: 12px; letter-spacing: 3px;
    color: #1a0f08; background: linear-gradient(180deg, #e8c46a, #c9a04a);
    border: 1px solid #f2d68a; border-radius: 4px;
    box-shadow: 0 0 18px rgba(232,196,106,.35); }
  #bdrone { margin-left: auto; color: #0c1a18;
    background: linear-gradient(180deg, #3fd0c9, #2c9b95);
    border-color: #6fe0d8; box-shadow: 0 0 18px rgba(63,208,201,.3); }
  #bring:disabled, #bdrone:disabled { color: rgba(246,237,226,.45);
    background: rgba(232,196,106,.07);
    border-color: rgba(232,196,106,.3); box-shadow: none; cursor: default; }
  #bring.done { color: #3fd0c9; background: rgba(63,208,201,.08);
    border-color: rgba(63,208,201,.5); box-shadow: none; }
  #burrow .sock { cursor: pointer; }
  #burrow .sock .ghost { opacity: .45; transition: opacity .15s; }
  #burrow .sock:hover .ghost { opacity: 1; }
  #burrow .plan { cursor: pointer; }
`;

const GLYPH = {
  shaft: '<rect x="12" y="3" width="10" height="28" rx="1" fill="none" stroke="#e8c46a"/><path d="M14 8h6M14 14h6M14 20h6M14 26h6" stroke="#e8c46a" stroke-width="1.2"/>',
  corridor: '<rect x="3" y="12" width="28" height="10" rx="2" fill="none" stroke="#e8c46a"/><path d="M7 14h4M15 14h4M23 14h4" stroke="#e8c46a" stroke-width="1.2"/>',
  bunk: '<rect x="4" y="9" width="26" height="17" rx="2" fill="none" stroke="#e8c46a"/><rect x="7" y="17" width="16" height="5" rx="1.5" fill="#e8c46a" opacity=".8"/><circle cx="25" cy="19.5" r="2.4" fill="#e8c46a"/>',
  store: '<rect x="5" y="9" width="24" height="17" rx="2" fill="none" stroke="#e8c46a"/><rect x="8" y="18" width="7" height="6" fill="#e8c46a" opacity=".7"/><rect x="17" y="18" width="7" height="6" fill="#e8c46a" opacity=".5"/><rect x="12" y="12" width="7" height="5" fill="#e8c46a" opacity=".6"/>',
  bay: '<rect x="4" y="9" width="26" height="17" rx="2" fill="none" stroke="#e8c46a"/><circle cx="13" cy="17" r="4" fill="none" stroke="#e8c46a" stroke-width="1.4"/><path d="M13 12v-2M13 24v-2M8 17H6M20 17h-2" stroke="#e8c46a" stroke-width="1.2"/><rect x="21" y="19" width="6" height="5" fill="#e8c46a" opacity=".6"/>',
  garden: '<rect x="4" y="9" width="26" height="17" rx="2" fill="none" stroke="#e8c46a"/><path d="M17 24v-7M17 19c0-3 3-4 5-4M17 21c0-3-3-4-5-4" stroke="#3fd0c9" stroke-width="1.4" fill="none"/><path d="M13 5h8" stroke="#e8c46a"/><path d="M15 5l2 4 2-4" fill="none" stroke="#e8c46a" opacity=".7"/>',
};

// furniture, second cut: two tones, shadows, a life of its own. Drawn in a
// CS box at (x, y); every shape is ink — no images, ever.
function dressing(piece, x, y) {
  const u = CS / 100; // draw in percent units
  const g = (inner) => `<g transform="translate(${x},${y}) scale(${u})">${inner}</g>`;
  switch (piece) {
    case 'bunk': return g(`
      <rect x="12" y="58" width="52" height="6" rx="2" fill="#5a3a1e"/>
      <rect x="14" y="48" width="48" height="11" rx="3" fill="#8a5a30"/>
      <rect x="14" y="48" width="48" height="4" rx="2" fill="#a06a38"/>
      <rect x="17" y="43" width="13" height="8" rx="3" fill="#d8c6a4"/>
      <rect x="34" y="47" width="27" height="5" rx="2" fill="#b5793e"/>
      <rect x="12" y="62" width="4" height="16" fill="#3a2210"/>
      <rect x="60" y="62" width="4" height="16" fill="#3a2210"/>
      <rect x="70" y="34" width="18" height="3" fill="#5a3a1e"/>
      <rect x="73" y="27" width="5" height="7" rx="1" fill="#c9a04a"/>
      <rect x="80" y="24" width="4" height="10" rx="1" fill="#8a8f96"/>`);
    case 'store': return g(`
      <rect x="10" y="52" width="22" height="26" rx="2" fill="#7a4e28"/>
      <rect x="10" y="52" width="22" height="6" fill="#956136"/>
      <path d="M21 52v26" stroke="#5a3a1e" stroke-width="2"/>
      <rect x="35" y="60" width="18" height="18" rx="2" fill="#6b4522"/>
      <rect x="35" y="60" width="18" height="5" fill="#8a5a30"/>
      <rect x="20" y="30" width="20" height="19" rx="2" fill="#8a5a30"/>
      <rect x="20" y="30" width="20" height="5" fill="#a06a38"/>
      <ellipse cx="70" cy="74" rx="10" ry="4" fill="#3a2210"/>
      <path d="M60 74 v-18 a10 6 0 0 1 20 0 v18" fill="#9aa0a6"/>
      <ellipse cx="70" cy="56" rx="10" ry="5" fill="#c2c8ce"/>
      <path d="M63 60h14M63 68h14" stroke="#6a6f76" stroke-width="1.6"/>`);
    case 'bay': return g(`
      <rect x="10" y="56" width="56" height="7" rx="2" fill="#8a5a30"/>
      <rect x="10" y="56" width="56" height="2.5" fill="#a06a38"/>
      <rect x="14" y="63" width="5" height="15" fill="#4a2c14"/>
      <rect x="57" y="63" width="5" height="15" fill="#4a2c14"/>
      <circle cx="30" cy="49" r="8" fill="none" stroke="#c9a04a" stroke-width="3"/>
      <circle cx="30" cy="49" r="2.4" fill="#c9a04a"/>
      <rect x="44" y="48" width="14" height="8" rx="2" fill="#6a6f76"/>
      <rect x="72" y="30" width="18" height="34" rx="2" fill="#3a2210"/>
      <circle cx="78" cy="38" r="2" fill="#e8c46a"/><circle cx="85" cy="44" r="2" fill="#e8c46a"/>
      <circle cx="79" cy="52" r="2" fill="#c9a04a"/><rect x="76" y="57" width="9" height="3" fill="#8a8f96"/>
      <rect x="20" y="70" width="16" height="8" rx="2" fill="#5a3a1e"/>`);
    case 'garden': return g(`
      <rect x="10" y="66" width="62" height="12" rx="3" fill="#5a3a1e"/>
      <rect x="12" y="63" width="58" height="6" rx="2" fill="#3d2a14"/>
      <path d="M22 63 v-16 m0 6 c0,-8 8,-10 13,-10 m-13 14 c0,-6 -7,-8 -11,-8"
        stroke="#3fd0c9" stroke-width="2.4" fill="none"/>
      <path d="M44 63 v-22 m0 8 c0,-8 -9,-9 -13,-9 m13 15 c0,-6 8,-8 12,-8"
        stroke="#4fe0d0" stroke-width="2.4" fill="none"/>
      <path d="M62 63 v-12 m0 5 c0,-6 6,-7 10,-7" stroke="#3fd0c9" stroke-width="2.2" fill="none"/>
      <rect x="16" y="18" width="52" height="4" rx="2" fill="#8a8f96"/>
      <rect x="20" y="22" width="44" height="2.4" fill="#3fd0c9" opacity=".5"/>`);
    default: return '';
  }
}

export class BurrowConsole {
  // hooks: { getBurrow, getDroneCount, ringCarried(), onPlan, onCancel,
  //   onInstallRing(), line(), sky() -> {hor,zen,sunI} }
  constructor(hooks) {
    this.h = hooks;
    this.visible = false;
    this.sel = 'shaft';
    this._t = 0;
    this._anim = 0;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'burrow';
    this.root.innerHTML = `
      <header><h1>THE BURROW</h1>
        <div class="sub">the warren under the crown — VESPER's hands do the digging</div>
        <div class="x" id="bx">✕</div></header>
      <div id="bmain">
        <div id="bside">
          <aside class="bpanel"><h2>PIECES</h2><div id="bcards"></div></aside>
          <aside class="bpanel"><h2>WARREN REPORT</h2><div id="breport"></div></aside>
          <aside class="bpanel"><h2>VESPER</h2><div id="bvesper"></div>
            <div id="bstats"></div></aside>
        </div>
        <div id="bscene"><svg id="bsvg" preserveAspectRatio="xMidYMin meet"></svg></div>
      </div>
      <footer><span class="motto">spoil is ore — the house pays for itself as it is dug</span>
        <span class="hint">plans are free · the nanofab debits ⚡ when the drones break ground · the hands draw ½ kW each while they work</span>
        <button id="bdrone"></button>
        <button id="bring"></button></footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('#bx').onclick = () => this.close();
    this.root.querySelector('#bring').onclick = () => { this.h.onInstallRing(); this.render(); };
    this.root.querySelector('#bdrone').onclick = () => {
      if (this.h.onDeployDrone) this.h.onDeployDrone();
      this.render();
    };
    this.root.querySelector('#bcards').onclick = (e) => {
      const card = e.target.closest('.bcard');
      if (card) { this.sel = card.dataset.id; this.render(); }
    };
    this.root.querySelector('#bsvg').addEventListener('click', (e) => {
      const sock = e.target.closest('.sock');
      if (sock) { this.h.onPlan(this.sel, +sock.dataset.c, +sock.dataset.d); this.render(); return; }
      const plan = e.target.closest('.plan');
      if (plan) { this.h.onCancel(+plan.dataset.c, +plan.dataset.d); this.render(); }
    });
  }

  open() { this.visible = true; this.root.classList.add('open'); this.render(); }
  close() { this.visible = false; this.root.classList.remove('open'); }
  toggle() { this.visible ? this.close() : this.open(); }

  update(dt) {
    if (!this.visible) return;
    this._t += dt;
    if (this._t > 0.4) { this._t = 0; this._anim += 0.4; this.render(); }
  }

  render() {
    const b = this.h.getBurrow();
    const cellAt = (c, d) => b.cells.get(`${c},${d}`);
    const dugAt = (c, d) => { const x = cellAt(c, d); return x && x.dug >= 1; };

    this.root.querySelector('#bcards').innerHTML = Object.entries(BURROW_PIECES)
      .map(([id, p]) => `<div class="bcard${id === this.sel ? ' sel' : ''}" data-id="${id}">
        <svg viewBox="0 0 34 34">${GLYPH[id] || ''}</svg>
        <div><b>${p.name.toUpperCase()}</b>
        <span>${p.bedworthy ? 'sleepable · ' : ''}${p.lightPipe ? 'light-pipe · ' : ''}⚡${DIG_KWH[id] ?? 2} kWh · dig ${Math.round(p.cost)}</span></div></div>`).join('');

    let deepest = 1;
    for (const k of b.cells.keys()) deepest = Math.max(deepest, parseKey(k).depth);
    const SHOW_D = Math.min(DEPTHS, deepest + 2);
    const W = (COLS * 2 + 1) * CS;
    const panel = this.root.querySelector('#bscene');
    const aspect = panel.clientWidth > 0 ? panel.clientHeight / panel.clientWidth : 0.62;
    const H = Math.max(SKY_H + SHOW_D * CS + CS * 0.4, W * aspect);
    const X = (c) => (c + COLS) * CS, Y = (d) => SKY_H + (d - 1) * CS;
    const sky = this.h.sky ? this.h.sky() : { hor: '#c07840', zen: '#5a3020', sunI: 1 };

    // ---- defs: the filters ARE the craft — fbm as feTurbulence
    let svg = `<defs>
      <linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky.zen}"/><stop offset="1" stop-color="${sky.hor}"/></linearGradient>
      <linearGradient id="brock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#38230f"/><stop offset=".3" stop-color="#2a180b"/>
        <stop offset=".65" stop-color="#1c0f07"/><stop offset="1" stop-color="#100703"/></linearGradient>
      <radialGradient id="blamp" cx=".5" cy=".34" r=".8">
        <stop offset="0" stop-color="#75492150"/><stop offset="0" stop-color="#75492180"/>
        <stop offset=".5" stop-color="#4e2d1380"/><stop offset="1" stop-color="#331d0c00"/></radialGradient>
      <radialGradient id="broom" cx=".5" cy=".4" r=".85">
        <stop offset="0" stop-color="#6b4522"/><stop offset=".6" stop-color="#47290f"/>
        <stop offset="1" stop-color="#2f1a09"/></radialGradient>
      <linearGradient id="bpipe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6d98a" stop-opacity=".7"/>
        <stop offset="1" stop-color="#f6d98a" stop-opacity=".05"/></linearGradient>
      <radialGradient id="bvig" cx=".5" cy=".42" r=".85">
        <stop offset=".55" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
      <filter id="bgrain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="7" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .9 .6 0 0 0"/>
        <feComposite operator="in" in2="SourceGraphic"/></filter>
      <filter id="bstrata" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.16" numOctaves="2" seed="3" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="0 0 0 0 .95  0 0 0 0 .78  0 0 0 0 .5  .5 0 0 0 0"/>
        <feComposite operator="in" in2="SourceGraphic"/></filter>
      <filter id="brough" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="11"/>
        <feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>
      <filter id="bglow" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="6"/></filter>
      <filter id="bglowBig" x="-160%" y="-160%" width="420%" height="420%">
        <feGaussianBlur stdDeviation="14"/></filter>
    </defs>`;

    // ---- sky: gradient, sun with true glow, haze shelf, drifting dust band
    svg += `<rect x="0" y="0" width="${W}" height="${SKY_H}" fill="url(#bsky)"/>
      <circle cx="${W * 0.8}" cy="${SKY_H * 0.36}" r="${CS * 0.34}" fill="#f6d98a"
        opacity="${sky.sunI * 0.5}" filter="url(#bglowBig)"/>
      <circle cx="${W * 0.8}" cy="${SKY_H * 0.36}" r="${CS * 0.13}" fill="#fff2d8"
        opacity="${0.3 + sky.sunI * 0.7}"/>
      <rect x="0" y="${SKY_H * 0.62}" width="${W}" height="${SKY_H * 0.38}" fill="${sky.hor}" opacity=".3"/>`;

    // the lander on the western horizon — the whole homestead in one line
    const lx = W * 0.09, lyy = SKY_H - 4;
    svg += `<g opacity=".85">
      <path d="M${lx - 16} ${lyy} l 5 -26 h 22 l 5 26" fill="#2a180d"/>
      <path d="M${lx - 11} ${lyy - 26} a 16 12 0 0 1 22 0" fill="#3a2413"/>
      <path d="M${lx - 22} ${lyy} l 8 -10 M${lx + 22} ${lyy} l -8 -10" stroke="#2a180d" stroke-width="3"/>
      <circle cx="${lx}" cy="${lyy - 30}" r="2.2" fill="#ffd98a" filter="url(#bglow)"/></g>`;

    // ---- the ground: displaced surface line, deep rock, grain, strata
    svg += `<rect x="0" y="${SKY_H}" width="${W}" height="${H - SKY_H}" fill="url(#brock)"/>
      <rect x="0" y="${SKY_H}" width="${W}" height="${H - SKY_H}" filter="url(#bgrain)" fill="#000" opacity=".5"/>
      <rect x="0" y="${SKY_H}" width="${W}" height="${H - SKY_H}" filter="url(#bstrata)" fill="#000" opacity=".16"/>
      <g filter="url(#brough)"><rect x="0" y="${SKY_H - 3}" width="${W}" height="8" fill="#472c14"/></g>
      <line x1="0" y1="${SKY_H}" x2="${W}" y2="${SKY_H}" stroke="#8a5a30" stroke-width="1" opacity=".5"/>`;
    for (let d = 2; d <= SHOW_D; d++) {
      svg += `<text x="10" y="${Y(d) - 6}" fill="#e8c46a" opacity=".3" font-size="10">— ${d * 3} m</text>`;
    }
    // a few surface stones
    for (let i = 0; i < 7; i++) {
      const sx = (W / 7) * i + ((i * 53) % 30);
      if (Math.abs(sx - X(0) - CS / 2) < CS * 1.4) continue;
      svg += `<ellipse cx="${sx}" cy="${SKY_H - 2}" rx="${5 + (i * 7) % 9}" ry="${3 + (i * 5) % 4}" fill="#241409"/>`;
    }

    // ---- the crown: a real head-frame — legs, dome, the gold ring, mast
    const cx = X(0) + CS / 2;
    const ringCol = b.ringInstalled ? '#e8c46a' : '#6a6f76';
    svg += `<g>
      <path d="M${cx - CS * 0.55} ${SKY_H + 2} L${cx - CS * 0.34} ${SKY_H - CS * 0.44} h${CS * 0.68} L${cx + CS * 0.55} ${SKY_H + 2} Z" fill="#4a2f18" stroke="#8a5a30" stroke-width="1.2"/>
      <path d="M${cx - CS * 0.24} ${SKY_H - CS * 0.46} a ${CS * 0.24} ${CS * 0.2} 0 0 1 ${CS * 0.48} 0 Z" fill="#8a8f96"/>
      <path d="M${cx - CS * 0.24} ${SKY_H - CS * 0.46} a ${CS * 0.24} ${CS * 0.2} 0 0 1 ${CS * 0.24} -${CS * 0.2} l 0 ${CS * 0.2} Z" fill="#c2c8ce" opacity=".7"/>
      <ellipse cx="${cx}" cy="${SKY_H - CS * 0.44}" rx="${CS * 0.3}" ry="${CS * 0.085}" fill="none" stroke="${ringCol}" stroke-width="4.5"/>
      ${b.ringInstalled ? `<ellipse cx="${cx}" cy="${SKY_H - CS * 0.44}" rx="${CS * 0.3}" ry="${CS * 0.085}" fill="none" stroke="#e8c46a" stroke-width="2" filter="url(#bglow)"/>` : ''}
      <rect x="${cx + CS * 0.66}" y="${SKY_H - CS * 0.9}" width="2.6" height="${CS * 0.9}" fill="#9aa0a6"/>
      <circle cx="${cx + CS * 0.673}" cy="${SKY_H - CS * 0.94}" r="3.6" fill="#ffd98a" filter="url(#bglow)">
        <animate attributeName="opacity" values="1;.35;1" dur="2.4s" repeatCount="indefinite"/></circle>
      <text x="${cx}" y="${SKY_H * 0.24}" text-anchor="middle" fill="#e8c46a" font-size="13" letter-spacing="4">THE CROWN${b.ringInstalled ? ' · SEALED' : ''}</text></g>`;

    // surface drones (they perch or ferry; the working one is underground)
    const digging = b.queue.length > 0;
    for (let i = 0; i < Math.max(0, this.h.getDroneCount() - (digging ? 1 : 0)); i++) {
      const a = this._anim * 0.45 + i * 2.4;
      const dx = cx + Math.cos(a) * CS * 1.6;
      const dy = SKY_H - CS * 0.62 - Math.abs(Math.sin(a * 1.3)) * CS * 0.22;
      svg += `<g transform="translate(${dx},${dy})">
        <rect x="-6" y="-3" width="12" height="6" rx="2" fill="#d8d2c6"/>
        <rect x="-10" y="-1.2" width="4" height="1.8" fill="#8a8f96"/>
        <rect x="6" y="-1.2" width="4" height="1.8" fill="#8a8f96"/>
        <rect x="-2.4" y="-1.6" width="4.8" height="2.4" fill="#3fd0c9"/></g>`;
    }

    // ---- carved volumes: rough-hewn halo, merged interiors, edge-aware
    // walls, floors, strip lights, furniture, conduits
    const carved = [];
    for (const [k, cell] of b.cells) {
      const { col, depth } = parseKey(k);
      if (cell.dug >= 1) carved.push({ col, depth, cell });
    }
    // the rough-cut halo: a displaced dark outline one step larger, so
    // every volume reads as blasted out of rock, not stamped
    svg += '<g filter="url(#brough)">';
    for (const { col, depth } of carved) {
      svg += `<rect x="${X(col) - 4}" y="${Y(depth) - 4}" width="${CS + 8}" height="${CS + 8}" fill="#0a0502"/>`;
    }
    svg += '</g>';
    for (const { col, depth } of carved) {
      svg += `<rect x="${X(col)}" y="${Y(depth)}" width="${CS}" height="${CS}" fill="url(#broom)"/>`;
    }
    // conduits: one gold line of life from the ring down the shaft and
    // along every dug corridor ceiling — dashes flow while drones work
    let conduit = '';
    for (const { col, depth, cell } of carved) {
      const p = BURROW_PIECES[cell.piece];
      if (p.kind === 'shaft') conduit += `M${X(col) + CS * 0.12} ${Y(depth)} v${CS} `;
      else conduit += `M${X(col)} ${Y(depth) + 7} h${CS} `;
    }
    if (conduit) {
      svg += `<path d="${conduit}" stroke="#c9a04a" stroke-width="1.8" fill="none" opacity=".8"
        stroke-dasharray="7 5">${digging ? '<animate attributeName="stroke-dashoffset" values="0;-24" dur="1.6s" repeatCount="indefinite"/>' : ''}</path>`;
    }
    for (const { col, depth, cell } of carved) {
      const p = BURROW_PIECES[cell.piece];
      const x = X(col), y = Y(depth);
      const wall = (x1, y1, x2, y2) => `<g filter="url(#brough)"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0d0704" stroke-width="6"/></g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8a5a30" stroke-width="1.3" opacity=".7"/>`;
      const open = (c2, d2) => { const n = cellAt(c2, d2); return n && n.dug > 0; };
      if ((depth > 1 && !open(col, depth - 1)) || (depth === 1 && col !== 0)) svg += wall(x, y, x + CS, y);
      if (!open(col, depth + 1)) svg += wall(x, y + CS, x + CS, y + CS);
      if (!open(col - 1, depth)) svg += wall(x, y, x, y + CS);
      if (!open(col + 1, depth)) svg += wall(x + CS, y, x + CS, y + CS);
      if (p.kind === 'shaft') {
        svg += `<line x1="${x + CS * 0.38}" y1="${y}" x2="${x + CS * 0.38}" y2="${y + CS}" stroke="#8a5a30" stroke-width="2.2"/>
          <line x1="${x + CS * 0.58}" y1="${y}" x2="${x + CS * 0.58}" y2="${y + CS}" stroke="#8a5a30" stroke-width="2.2"/>`;
        for (let r = 0; r < 5; r++) {
          svg += `<line x1="${x + CS * 0.38}" y1="${y + (CS / 5) * (r + 0.5)}" x2="${x + CS * 0.58}" y2="${y + (CS / 5) * (r + 0.5)}" stroke="#a06a38" stroke-width="1.8"/>`;
        }
        svg += `<line x1="${x + CS * 0.8}" y1="${y}" x2="${x + CS * 0.8}" y2="${y + CS}" stroke="#6a6f76" stroke-width="1"/>`;
      } else {
        svg += `<rect x="${x}" y="${y + CS - 6}" width="${CS}" height="6" fill="#26150a"/>
          <rect x="${x}" y="${y + CS - 6}" width="${CS}" height="1.6" fill="#8a5a30" opacity=".5"/>`;
        svg += `<rect x="${x + CS * 0.22}" y="${y + 3}" width="${CS * 0.56}" height="2.4" rx="1.2" fill="#f6d98a"/>
          <ellipse cx="${x + CS / 2}" cy="${y + CS * 0.3}" rx="${CS * 0.42}" ry="${CS * 0.3}" fill="#f6d98a" opacity=".1" filter="url(#bglow)"/>`;
        svg += dressing(cell.piece, x, y);
      }
      if (p.lightPipe) {
        const px = x + CS * 0.44;
        svg += `<rect x="${px}" y="${SKY_H - 6}" width="${CS * 0.12}" height="${y - SKY_H + 10}" fill="url(#bpipe)"/>
          <circle cx="${px + CS * 0.06}" cy="${y - CS * 0.4}" r="1.6" fill="#f6d98a" opacity=".8">
            <animate attributeName="cy" values="${SKY_H + 8};${y + 4}" dur="5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;.8;0" dur="5s" repeatCount="indefinite"/></circle>`;
      }
    }

    // ---- digs in progress: rubble rising, one drone at the face
    let workDrawn = false;
    for (const [k, cell] of b.cells) {
      if (cell.dug >= 1) continue;
      const { col, depth } = parseKey(k);
      const x = X(col), y = Y(depth), frac = cell.dug;
      svg += `<g class="plan" data-c="${col}" data-d="${depth}">
        <rect x="${x + 2}" y="${y + 2}" width="${CS - 4}" height="${CS - 4}" rx="3"
          fill="rgba(232,196,106,.03)" stroke="#e8c46a" stroke-opacity=".4" stroke-dasharray="6 5"/>`;
      if (frac > 0) {
        const hollow = (CS - 8) * frac;
        svg += `<rect x="${x + 4}" y="${y + 4}" width="${CS - 8}" height="${hollow}" rx="3" fill="url(#broom)" opacity=".85"/>`;
        for (let r = 0; r < 5; r++) {
          const rx = x + 8 + ((r * 37 + col * 13) % (CS - 20));
          svg += `<ellipse cx="${rx}" cy="${y + CS - 8 - (r % 2) * 5}" rx="${4 + (r * 3) % 5}" ry="3" fill="#1c0f07"/>`;
        }
        if (digging && !workDrawn && b.queue[0] === k) {
          workDrawn = true;
          const wx = x + CS / 2 + Math.sin(this._anim * 2.6) * CS * 0.14;
          const wy = y + 4 + hollow - 6;
          svg += `<g transform="translate(${wx},${wy})">
            <rect x="-6" y="-3" width="12" height="6" rx="2" fill="#d8d2c6"/>
            <rect x="-2.4" y="-1.6" width="4.8" height="2.4" fill="#3fd0c9"/>
            <path d="M-8 4 l-3 4 M8 4 l3 4" stroke="#8a8f96" stroke-width="1.6"/></g>
            <circle cx="${wx}" cy="${wy + 9}" r="6" fill="#c07840" opacity=".25" filter="url(#bglow)"/>`;
        }
        svg += `<text x="${x + CS / 2}" y="${y - 4}" text-anchor="middle" fill="#e8c46a" opacity=".8" font-size="10">${Math.round(frac * 100)}%</text>`;
      } else {
        const waiting = cell.waiting;
        svg += `<text x="${x + CS / 2}" y="${y + CS / 2 + 4}" text-anchor="middle"
          fill="${waiting ? '#d1685a' : '#e8c46a'}" opacity=".7" font-size="9" letter-spacing="1">${waiting ? 'WAITS ON CHARGE' : 'QUEUED'}</text>`;
      }
      svg += '</g>';
    }

    // ---- sockets: bracketed ghost of the selected piece
    for (let d = 1; d <= SHOW_D; d++) {
      for (let c = -COLS; c <= COLS; c++) {
        if (!canPlan(b, this.sel, c, d)) continue;
        const x = X(c), y = Y(d), t = 9;
        svg += `<g class="sock" data-c="${c}" data-d="${d}">
          <rect x="${x + 4}" y="${y + 4}" width="${CS - 8}" height="${CS - 8}" fill="rgba(63,208,201,.001)"/>
          <g class="ghost" stroke="#3fd0c9" stroke-width="1.6" fill="none">
            <path d="M${x + 5} ${y + 5 + t} v-${t} h${t} M${x + CS - 5 - t} ${y + 5} h${t} v${t}
              M${x + CS - 5} ${y + CS - 5 - t} v${t} h-${t} M${x + 5 + t} ${y + CS - 5} h-${t} v-${t}"/></g>
          <circle cx="${x + CS / 2}" cy="${y + CS / 2}" r="${CS * 0.15}" fill="rgba(63,208,201,.12)" stroke="#3fd0c9" stroke-width="1.3">
            <animate attributeName="r" values="${CS * 0.13};${CS * 0.17};${CS * 0.13}" dur="1.8s" repeatCount="indefinite"/></circle>
          <text x="${x + CS / 2}" y="${y + CS / 2 + 5}" text-anchor="middle" fill="#3fd0c9" font-size="15" pointer-events="none">+</text></g>`;
      }
    }

    // ---- the report's verdict marks, drawn ON the rooms: a teal leaf-tick
    // for every bonus earned, a rust flag for every penalty — the design
    // teaches itself at a glance
    const rep = warrenReport(b);
    const byKey = new Map();
    for (const n of rep.notes) {
      if (!byKey.has(n.key)) byKey.set(n.key, []);
      byKey.get(n.key).push(n);
    }
    for (const [k, notes] of byKey) {
      const { col, depth } = parseKey(k);
      const x = X(col), y = Y(depth);
      notes.slice(0, 2).forEach((n, i) => {
        const mx = x + CS - 11 - i * 13, my = y + 11;
        svg += n.kind === 'bonus'
          ? `<g><circle cx="${mx}" cy="${my}" r="6" fill="rgba(63,208,201,.18)" stroke="#3fd0c9" stroke-width="1.2"/>
             <path d="M${mx - 2.6} ${my} l2 2.4 l3.4 -4.4" stroke="#3fd0c9" stroke-width="1.5" fill="none"/>
             <title>${n.why}</title></g>`
          : `<g><circle cx="${mx}" cy="${my}" r="6" fill="rgba(209,104,90,.18)" stroke="#d1685a" stroke-width="1.2"/>
             <path d="M${mx} ${my - 3.2} v3.6 m0 1.8 v.8" stroke="#d1685a" stroke-width="1.6"/>
             <title>${n.why}</title></g>`;
      });
    }

    // the instrument vignette over everything
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bvig)" pointer-events="none"/>`;

    const el = this.root.querySelector('#bsvg');
    el.setAttribute('viewBox', `0 0 ${W} ${H}`);
    el.innerHTML = svg;

    const meter = (label, v, cool) => `<div class="bmeter${cool ? ' cool' : ''}">
      <div class="ml"><span>${label}</span><span>${Math.round(v * 100)}%</span></div>
      <div class="mb"><i style="width:${Math.round(v * 100)}%"></i></div></div>`;
    this.root.querySelector('#breport').innerHTML = meter('SHELTER — wake rested', rep.shelter)
      + meter('AIR — gardens scrub', rep.air, true)
      + meter('HAUL — stores stage', rep.haul * 2)
      + `<div style="font-size:10px;opacity:.55;line-height:1.5">deep bunks shield · gardens beside bunks loop air · light-pipes reach ${2 * 3} m · stores near the spine speed the dig</div>`;
    this.root.querySelector('#bvesper').textContent = `“${this.h.line()}”`;
    const bank = this.h.getBank ? this.h.getBank() : null;
    this.root.querySelector('#bstats').innerHTML = `drones <b>${this.h.getDroneCount()}</b> · queue <b>${b.queue.length}</b><br>
      spoil — regolith <b>${b.spoil.regolith}</b> · ore <b>${b.spoil.ore}</b>
      ${bank ? `<br>bank <b>${bank.charge}</b>/${bank.capacity} kWh — structure is charge` : ''}`;
    const droneBtn = this.root.querySelector('#bdrone');
    const canFrame = this.h.droneCarried && this.h.droneCarried();
    const funded = bank && bank.charge >= 3;
    droneBtn.disabled = !(canFrame && funded);
    droneBtn.textContent = canFrame
      ? (funded ? '⬡ DEPLOY A HAND · 3 kWh' : '⬡ A HAND WAITS ON CHARGE')
      : '⬡ A HAND NEEDS A FRAME (THE MILL)';
    const ring = this.root.querySelector('#bring');
    const shaftDug = dugAt(0, 1);
    if (b.ringInstalled) {
      ring.textContent = '⍟ THE RING HOLDS';
      ring.disabled = true; ring.classList.add('done');
    } else {
      ring.disabled = !(shaftDug && this.h.ringCarried());
      ring.textContent = this.h.ringCarried()
        ? (shaftDug ? '⍟ INSTALL THE RING' : '⍟ RING WAITS FOR THE SHAFT')
        : '⍟ THE RING IS ON THE LANDER';
      ring.classList.remove('done');
    }
  }
}
