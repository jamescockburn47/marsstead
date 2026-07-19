// The Burrow console — indoors as a display (STRUCTURE.md doctrine 1).
// The scene is an ANT-FARM CROSS-SECTION of a real base: the live Mars sky
// over a rocky surface line, the crown drawn as a structure, strata that
// darken with depth, and dug volumes carved out of the rock — shared
// walls, open doorways, lamplight, furniture per room. Sanctum's LOGIC
// (pick a card, tap a socket, the base grows), none of its skin.
// burrow.js owns every truth; this only draws it. Zero assets: every
// glyph is SVG drawn here.

import {
  BURROW_PIECES, COLS, DEPTHS, canPlan, parseKey,
} from './burrow.js';

const CS = 64; // cell size in scene units
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
  #bvesper { font-size: 11.5px; line-height: 1.55; font-style: italic;
    opacity: .85; }
  #bstats { font-size: 11.5px; line-height: 1.9; margin-top: 8px; }
  #bstats b { color: #e8c46a; }
  #bscene { position: relative; border: 1px solid rgba(232,196,106,.22);
    border-radius: 5px; overflow: hidden; min-height: 0;
    background: #120905; }
  #bscene svg { width: 100%; height: 100%; display: block; }
  #burrow footer { display: flex; align-items: center; gap: 18px;
    padding: 8px 22px 14px; font-size: 11.5px; letter-spacing: 1px; }
  #burrow footer .motto { color: #e8c46a; opacity: .85; }
  #burrow footer .hint { opacity: .5; }
  #bring { margin-left: auto; padding: 10px 26px; cursor: pointer;
    font-family: inherit; font-size: 12px; letter-spacing: 3px;
    color: #1a0f08; background: linear-gradient(180deg, #e8c46a, #c9a04a);
    border: 1px solid #f2d68a; border-radius: 4px;
    box-shadow: 0 0 18px rgba(232,196,106,.35); }
  #bring:disabled { color: rgba(246,237,226,.45); background: rgba(232,196,106,.07);
    border-color: rgba(232,196,106,.3); box-shadow: none; cursor: default; }
  #bring.done { color: #3fd0c9; background: rgba(63,208,201,.08);
    border-color: rgba(63,208,201,.5); box-shadow: none; }
  #burrow .sock { cursor: pointer; }
  #burrow .sock .ghost { opacity: .5; transition: opacity .15s; }
  #burrow .sock:hover .ghost { opacity: 1; }
  #burrow .sock circle.pulse { animation: bpulse 1.6s ease-in-out infinite; }
  @keyframes bpulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
  #burrow .plan { cursor: pointer; }
`;

// tiny procedural glyphs for the palette cards (viewBox 0 0 34 34)
const GLYPH = {
  shaft: '<rect x="12" y="3" width="10" height="28" rx="1" fill="none" stroke="#e8c46a"/><path d="M14 8h6M14 14h6M14 20h6M14 26h6" stroke="#e8c46a" stroke-width="1.2"/>',
  corridor: '<rect x="3" y="12" width="28" height="10" rx="2" fill="none" stroke="#e8c46a"/><path d="M7 14h4M15 14h4M23 14h4" stroke="#e8c46a" stroke-width="1.2"/>',
  bunk: '<rect x="4" y="9" width="26" height="17" rx="2" fill="none" stroke="#e8c46a"/><rect x="7" y="17" width="16" height="5" rx="1.5" fill="#e8c46a" opacity=".8"/><circle cx="25" cy="19.5" r="2.4" fill="#e8c46a"/>',
  store: '<rect x="5" y="9" width="24" height="17" rx="2" fill="none" stroke="#e8c46a"/><rect x="8" y="18" width="7" height="6" fill="#e8c46a" opacity=".7"/><rect x="17" y="18" width="7" height="6" fill="#e8c46a" opacity=".5"/><rect x="12" y="12" width="7" height="5" fill="#e8c46a" opacity=".6"/>',
  bay: '<rect x="4" y="9" width="26" height="17" rx="2" fill="none" stroke="#e8c46a"/><circle cx="13" cy="17" r="4" fill="none" stroke="#e8c46a" stroke-width="1.4"/><path d="M13 12v-2M13 24v-2M8 17H6M20 17h-2" stroke="#e8c46a" stroke-width="1.2"/><rect x="21" y="19" width="6" height="5" fill="#e8c46a" opacity=".6"/>',
  garden: '<rect x="4" y="9" width="26" height="17" rx="2" fill="none" stroke="#e8c46a"/><path d="M17 24v-7M17 19c0-3 3-4 5-4M17 21c0-3-3-4-5-4" stroke="#3fd0c9" stroke-width="1.4" fill="none"/><path d="M13 5h8" stroke="#e8c46a"/><path d="M15 5l2 4 2-4" fill="none" stroke="#e8c46a" opacity=".7"/>',
};

// per-room furniture, drawn inside a CS box at (0,0) — warm silhouettes
function dressing(piece, x, y) {
  const g = (inner) => `<g transform="translate(${x},${y})">${inner}</g>`;
  switch (piece) {
    case 'bunk': return g(`<rect x="${CS * 0.14}" y="${CS * 0.62}" width="${CS * 0.5}" height="${CS * 0.16}" rx="3" fill="#8a5a30"/><rect x="${CS * 0.16}" y="${CS * 0.56}" width="${CS * 0.14}" height="${CS * 0.1}" rx="2" fill="#d8c6a4"/><rect x="${CS * 0.7}" y="${CS * 0.4}" width="${CS * 0.16}" height="${CS * 0.38}" rx="2" fill="#5a3a1e"/>`);
    case 'store': return g(`<rect x="${CS * 0.12}" y="${CS * 0.5}" width="${CS * 0.24}" height="${CS * 0.28}" fill="#7a4e28"/><rect x="${CS * 0.4}" y="${CS * 0.58}" width="${CS * 0.22}" height="${CS * 0.2}" fill="#8a5a30"/><rect x="${CS * 0.24}" y="${CS * 0.3}" width="${CS * 0.2}" height="${CS * 0.17}" fill="#6b4522"/><rect x="${CS * 0.68}" y="${CS * 0.44}" width="${CS * 0.18}" height="${CS * 0.34}" fill="#5a3a1e"/>`);
    case 'bay': return g(`<rect x="${CS * 0.12}" y="${CS * 0.58}" width="${CS * 0.56}" height="${CS * 0.08}" fill="#8a5a30"/><rect x="${CS * 0.16}" y="${CS * 0.66}" width="${CS * 0.06}" height="${CS * 0.12}" fill="#5a3a1e"/><rect x="${CS * 0.58}" y="${CS * 0.66}" width="${CS * 0.06}" height="${CS * 0.12}" fill="#5a3a1e"/><circle cx="${CS * 0.34}" cy="${CS * 0.44}" r="${CS * 0.09}" fill="none" stroke="#e8c46a" stroke-width="2" opacity=".7"/><rect x="${CS * 0.72}" y="${CS * 0.34}" width="${CS * 0.14}" height="${CS * 0.44}" rx="2" fill="#5a3a1e"/>`);
    case 'garden': return g(`<rect x="${CS * 0.12}" y="${CS * 0.66}" width="${CS * 0.64}" height="${CS * 0.12}" rx="2" fill="#6b4522"/><path d="M${CS * 0.24} ${CS * 0.66} v-${CS * 0.16} M${CS * 0.24} ${CS * 0.56} c0,-${CS * 0.1} ${CS * 0.1},-${CS * 0.12} ${CS * 0.16},-${CS * 0.12}" stroke="#3fd0c9" stroke-width="2" fill="none"/><path d="M${CS * 0.46} ${CS * 0.66} v-${CS * 0.22} M${CS * 0.46} ${CS * 0.5} c0,-${CS * 0.08} -${CS * 0.09},-${CS * 0.1} -${CS * 0.14},-${CS * 0.1}" stroke="#3fd0c9" stroke-width="2" fill="none"/><path d="M${CS * 0.64} ${CS * 0.66} v-${CS * 0.13}" stroke="#3fd0c9" stroke-width="2"/>`);
    default: return '';
  }
}

export class BurrowConsole {
  // hooks: { getBurrow, getDroneCount, ringCarried(), onPlan(piece,c,d),
  //   onCancel(c,d), onInstallRing(), line(), sky() -> {hor,zen,sunI} }
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
          <aside class="bpanel"><h2>VESPER</h2><div id="bvesper"></div>
            <div id="bstats"></div></aside>
        </div>
        <div id="bscene"><svg id="bsvg" preserveAspectRatio="xMidYMin meet"></svg></div>
      </div>
      <footer><span class="motto">spoil is ore — the house pays for itself as it is dug</span>
        <span class="hint">pick a piece · tap a socket · tap a dashed plan to cancel</span>
        <button id="bring"></button></footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('#bx').onclick = () => this.close();
    this.root.querySelector('#bring').onclick = () => { this.h.onInstallRing(); this.render(); };
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
    if (this._t > 0.33) { this._t = 0; this._anim += 0.33; this.render(); }
  }

  render() {
    const b = this.h.getBurrow();
    const cellAt = (c, d) => b.cells.get(`${c},${d}`);
    const dugAt = (c, d) => { const x = cellAt(c, d); return x && x.dug >= 1; };

    // ---- palette
    this.root.querySelector('#bcards').innerHTML = Object.entries(BURROW_PIECES)
      .map(([id, p]) => `<div class="bcard${id === this.sel ? ' sel' : ''}" data-id="${id}">
        <svg viewBox="0 0 34 34">${GLYPH[id] || ''}</svg>
        <div><b>${p.name.toUpperCase()}</b>
        <span>${p.bedworthy ? 'sleepable · ' : ''}${p.lightPipe ? 'light-pipe · ' : ''}dig ${Math.round(p.cost)}</span></div></div>`).join('');

    // ---- the scene: crop to the lived depth — the warren fills the frame
    // and the rock below is a promise, not a void
    let deepest = 1;
    for (const k of b.cells.keys()) deepest = Math.max(deepest, parseKey(k).depth);
    const SHOW_D = Math.min(DEPTHS, deepest + 2);
    const W = (COLS * 2 + 1) * CS;
    // fill the panel exactly: the scene extends into undisturbed deep rock
    // to match the panel's aspect — never a letterbox, never a void
    const panel = this.root.querySelector('#bscene');
    const aspect = panel.clientWidth > 0 ? panel.clientHeight / panel.clientWidth : 0.62;
    const H = Math.max(SKY_H + SHOW_D * CS + CS * 0.4, W * aspect);
    const X = (c) => (c + COLS) * CS, Y = (d) => SKY_H + (d - 1) * CS;
    const sky = this.h.sky ? this.h.sky() : { hor: '#c07840', zen: '#5a3020', sunI: 1 };

    let svg = `<defs>
      <linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky.zen}"/><stop offset="1" stop-color="${sky.hor}"/></linearGradient>
      <linearGradient id="brock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#33200f"/><stop offset=".35" stop-color="#28170b"/>
        <stop offset=".7" stop-color="#1c0f07"/><stop offset="1" stop-color="#110804"/></linearGradient>
      <radialGradient id="blamp" cx=".5" cy=".38" r=".75">
        <stop offset="0" stop-color="#6b4522"/><stop offset=".55" stop-color="#4a2c14"/>
        <stop offset="1" stop-color="#331d0c"/></radialGradient>
      <pattern id="bgrit" width="26" height="26" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="7" r="1.1" fill="#000" opacity=".28"/>
        <circle cx="17" cy="3" r="0.8" fill="#f6ede2" opacity=".05"/>
        <circle cx="21" cy="17" r="1.3" fill="#000" opacity=".22"/>
        <circle cx="9" cy="21" r="0.9" fill="#f6ede2" opacity=".04"/>
        <circle cx="14" cy="12" r="0.7" fill="#000" opacity=".2"/></pattern>
      <linearGradient id="bpipe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6d98a" stop-opacity=".8"/>
        <stop offset="1" stop-color="#f6d98a" stop-opacity=".08"/></linearGradient>
    </defs>`;

    // sky, sun, haze, rocky surface line
    svg += `<rect x="0" y="0" width="${W}" height="${SKY_H}" fill="url(#bsky)"/>
      <circle cx="${W * 0.78}" cy="${SKY_H * 0.42}" r="${CS * 0.16}" fill="#fff2d8" opacity="${0.25 + sky.sunI * 0.75}"/>
      <circle cx="${W * 0.78}" cy="${SKY_H * 0.42}" r="${CS * 0.4}" fill="#f6d98a" opacity="${sky.sunI * 0.18}"/>
      <rect x="0" y="${SKY_H - CS * 0.32}" width="${W}" height="${CS * 0.32}" fill="${sky.hor}" opacity=".35"/>`;
    let ground = `M0 ${SKY_H}`;
    for (let i = 0; i <= 24; i++) {
      const gx = (W / 24) * i;
      const gy = SKY_H - 2 - Math.abs(Math.sin(i * 2.7)) * 5;
      ground += ` L${gx} ${gy}`;
    }
    svg += `<rect x="0" y="${SKY_H}" width="${W}" height="${H - SKY_H}" fill="url(#brock)"/>
      <rect x="0" y="${SKY_H}" width="${W}" height="${H - SKY_H}" fill="url(#bgrit)"/>
      <path d="${ground} L${W} ${SKY_H} Z" fill="#3a2413"/>
      <line x1="0" y1="${SKY_H}" x2="${W}" y2="${SKY_H}" stroke="#8a5a30" stroke-width="1.4" opacity=".8"/>`;
    // strata seams + depth ticks
    for (let d = 2; d <= SHOW_D; d++) {
      svg += `<path d="M0 ${Y(d)} q ${W * 0.25} 4 ${W * 0.5} 0 t ${W * 0.5} 0" stroke="#000" stroke-opacity=".14" fill="none"/>
        <text x="8" y="${Y(d) - 6}" fill="#e8c46a" opacity=".28" font-size="10">${d * 3} m</text>`;
    }

    // ---- the crown: collar, hatch, ring seat, mast + beacon, drones
    const cx = X(0) + CS / 2;
    const ringCol = b.ringInstalled ? '#e8c46a' : '#6a6f76';
    svg += `<g>
      <path d="M${cx - CS * 0.5} ${SKY_H} l ${CS * 0.12} -${CS * 0.3} h ${CS * 0.76} l ${CS * 0.12} ${CS * 0.3} Z" fill="#5a3a1e" stroke="#8a5a30"/>
      <ellipse cx="${cx}" cy="${SKY_H - CS * 0.3}" rx="${CS * 0.34}" ry="${CS * 0.1}" fill="none" stroke="${ringCol}" stroke-width="4"/>
      <path d="M${cx - CS * 0.2} ${SKY_H - CS * 0.34} a ${CS * 0.2} ${CS * 0.16} 0 0 1 ${CS * 0.4} 0" fill="#8a8f96"/>
      <rect x="${cx + CS * 0.62}" y="${SKY_H - CS * 0.78}" width="3" height="${CS * 0.78}" fill="#9aa0a6"/>
      <circle cx="${cx + CS * 0.635}" cy="${SKY_H - CS * 0.82}" r="4.2" fill="#ffd98a">
        <animate attributeName="opacity" values="1;.4;1" dur="2.2s" repeatCount="indefinite"/></circle>
      <text x="${cx}" y="${SKY_H * 0.28}" text-anchor="middle" fill="#e8c46a" font-size="13" letter-spacing="4">THE CROWN${b.ringInstalled ? ' · SEALED' : ''}</text>`;
    // drones: working the cut when a dig runs, perched otherwise
    const digging = b.queue.length > 0;
    for (let i = 0; i < this.h.getDroneCount(); i++) {
      const a = this._anim * (digging ? 1.1 : 0.15) + i * 2.1;
      const dx = cx + Math.cos(a) * CS * (digging ? 0.9 : 1.5);
      const dy = SKY_H - CS * 0.5 - Math.abs(Math.sin(a * 1.7)) * CS * 0.3;
      svg += `<g transform="translate(${dx},${dy})">
        <rect x="-6" y="-3" width="12" height="6" rx="2" fill="#d8d2c6"/>
        <rect x="-10" y="-1.2" width="4" height="1.8" fill="#8a8f96"/>
        <rect x="6" y="-1.2" width="4" height="1.8" fill="#8a8f96"/>
        <rect x="-2.4" y="-1.6" width="4.8" height="2.4" fill="#3fd0c9"/></g>`;
    }
    svg += '</g>';

    // ---- carved volumes: interiors first (merged), then edge-aware walls,
    // then dressings and light — rooms genuinely open into one another
    const carved = [];
    for (const [k, cell] of b.cells) {
      const { col, depth } = parseKey(k);
      if (cell.dug >= 1) carved.push({ col, depth, cell });
    }
    for (const { col, depth } of carved) {
      svg += `<rect x="${X(col)}" y="${Y(depth)}" width="${CS}" height="${CS}" fill="url(#blamp)"/>`;
    }
    for (const { col, depth, cell } of carved) {
      const p = BURROW_PIECES[cell.piece];
      const x = X(col), y = Y(depth);
      const wall = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0d0704" stroke-width="5"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8a5a30" stroke-width="1.4" opacity=".75"/>`;
      const open = (c2, d2) => { const n = cellAt(c2, d2); return n && n.dug > 0; };
      if (!open(col, depth - 1) && depth > 1) svg += wall(x, y, x + CS, y);
      if (depth === 1 && col !== 0) svg += wall(x, y, x + CS, y); // only the shaft opens the sky
      if (!open(col, depth + 1)) svg += wall(x, y + CS, x + CS, y + CS);
      if (!open(col - 1, depth)) svg += wall(x, y, x, y + CS);
      if (!open(col + 1, depth)) svg += wall(x + CS, y, x + CS, y + CS);
      if (p.kind === 'shaft') {
        svg += `<line x1="${x + CS * 0.36}" y1="${y}" x2="${x + CS * 0.36}" y2="${y + CS}" stroke="#8a5a30" stroke-width="2"/>
          <line x1="${x + CS * 0.56}" y1="${y}" x2="${x + CS * 0.56}" y2="${y + CS}" stroke="#8a5a30" stroke-width="2"/>`;
        for (let r = 1; r < 5; r++) {
          svg += `<line x1="${x + CS * 0.36}" y1="${y + (CS / 5) * r}" x2="${x + CS * 0.56}" y2="${y + (CS / 5) * r}" stroke="#a06a38" stroke-width="1.6"/>`;
        }
      } else {
        svg += `<rect x="${x}" y="${y + CS - 5}" width="${CS}" height="5" fill="#2a180c"/>`;
        svg += `<rect x="${x + CS * 0.2}" y="${y + 2.5}" width="${CS * 0.6}" height="2.2" rx="1" fill="#f6d98a" opacity=".75"/>`;
        svg += dressing(cell.piece, x, y);
      }
      if (p.lightPipe) {
        svg += `<rect x="${x + CS * 0.42}" y="${SKY_H - 6}" width="${CS * 0.16}" height="${y - SKY_H + 12}" fill="url(#bpipe)"/>`;
      }
    }

    // ---- digs in progress + plans (ghosts in the rock)
    for (const [k, cell] of b.cells) {
      if (cell.dug >= 1) continue;
      const { col, depth } = parseKey(k);
      const x = X(col), y = Y(depth), frac = cell.dug;
      svg += `<g class="plan" data-c="${col}" data-d="${depth}">
        <rect x="${x + 2}" y="${y + 2}" width="${CS - 4}" height="${CS - 4}" rx="3"
          fill="rgba(232,196,106,.04)" stroke="#e8c46a" stroke-opacity=".45" stroke-dasharray="6 5"/>`;
      if (frac > 0) {
        svg += `<rect x="${x + 2}" y="${y + 2 + (CS - 4) * (1 - frac)}" width="${CS - 4}" height="${(CS - 4) * frac}" rx="3" fill="url(#blamp)" opacity=".8"/>
          <text x="${x + CS / 2}" y="${y + CS / 2 + 4}" text-anchor="middle" fill="#f6ede2" font-size="11">${Math.round(frac * 100)}%</text>`;
      } else {
        svg += `<text x="${x + CS / 2}" y="${y + CS / 2 + 4}" text-anchor="middle" fill="#e8c46a" opacity=".6" font-size="9" letter-spacing="1">QUEUED</text>`;
      }
      svg += '</g>';
    }

    // ---- sockets: ghost previews of the SELECTED piece, breathing
    for (let d = 1; d <= SHOW_D; d++) {
      for (let c = -COLS; c <= COLS; c++) {
        if (!canPlan(b, this.sel, c, d)) continue;
        const x = X(c), y = Y(d);
        svg += `<g class="sock" data-c="${c}" data-d="${d}">
          <g class="ghost"><rect x="${x + 5}" y="${y + 5}" width="${CS - 10}" height="${CS - 10}" rx="4"
            fill="rgba(63,208,201,.06)" stroke="#3fd0c9" stroke-opacity=".55" stroke-dasharray="4 4"/></g>
          <circle class="pulse" cx="${x + CS / 2}" cy="${y + CS / 2}" r="${CS * 0.17}"
            fill="rgba(63,208,201,.14)" stroke="#3fd0c9" stroke-width="1.4"/>
          <text x="${x + CS / 2}" y="${y + CS / 2 + 5}" text-anchor="middle" fill="#3fd0c9"
            font-size="15" pointer-events="none">+</text></g>`;
      }
    }

    const el = this.root.querySelector('#bsvg');
    el.setAttribute('viewBox', `0 0 ${W} ${H}`);
    el.innerHTML = svg;

    // ---- drawer, ledger, the ring
    this.root.querySelector('#bvesper').textContent = `“${this.h.line()}”`;
    this.root.querySelector('#bstats').innerHTML = `drones <b>${this.h.getDroneCount()}</b> · queue <b>${b.queue.length}</b><br>
      spoil — regolith <b>${b.spoil.regolith}</b> · ore <b>${b.spoil.ore}</b>`;
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
