// The Burrow console — the first display-based interior (STRUCTURE.md
// doctrine 1: the player never walks the hab; indoors IS this screen).
// The Sanctum's grammar, reskinned: a palette of pieces on the left, the
// warren as a side-view SVG cross-section in the centre (tap a card, tap
// a glowing socket), VESPER's drawer on the right, the ledger and the
// ring along the foot. burrow.js owns every truth; this only draws it.

import {
  BURROW_PIECES, COLS, DEPTHS, canPlan, parseKey, digCost,
} from './burrow.js';

const CS = 56; // cell size in SVG units

const CSS = `
  #burrow { position: fixed; inset: 0; z-index: 55; display: none;
    background: rgba(16,9,6,.94); color: #f6ede2;
    font-family: Georgia, 'Times New Roman', serif; }
  #burrow.open { display: flex; flex-direction: column; }
  #burrow header { display: flex; align-items: baseline; gap: 14px;
    padding: 14px 22px 10px; border-bottom: 1px solid rgba(232,196,106,.25); }
  #burrow header h1 { margin: 0; font-size: 20px; letter-spacing: 6px;
    font-weight: normal; color: #e8c46a; }
  #burrow header .sub { opacity: .6; font-size: 12px; letter-spacing: 2px; }
  #burrow header .x { margin-left: auto; cursor: pointer; opacity: .7;
    font-size: 18px; padding: 2px 8px; }
  #burrow header .x:hover { opacity: 1; }
  #bmain { flex: 1; display: grid; grid-template-columns: 220px 1fr 240px;
    gap: 12px; padding: 12px 22px; min-height: 0; }
  .bpanel { border: 1px solid rgba(232,196,106,.25); border-radius: 4px;
    background: rgba(28,16,10,.6); padding: 10px; overflow-y: auto; }
  .bpanel h2 { margin: 2px 0 10px; font-size: 11px; letter-spacing: 3px;
    color: #e8c46a; font-weight: normal; }
  .bcard { border: 1px solid rgba(246,237,226,.25); border-radius: 3px;
    padding: 8px 10px; margin-bottom: 8px; cursor: pointer; }
  .bcard:hover { background: rgba(232,196,106,.08); }
  .bcard.sel { border-color: #3fd0c9; background: rgba(63,208,201,.08); }
  .bcard b { display: block; font-size: 13px; letter-spacing: 1px; }
  .bcard span { font-size: 11px; opacity: .65; }
  #bscene { display: flex; min-height: 0; }
  #bscene svg { width: 100%; height: 100%; }
  #bvesper { font-size: 12px; line-height: 1.6; font-style: italic;
    opacity: .85; }
  #bstats { font-size: 12px; line-height: 2; margin-top: 10px; }
  #bstats b { color: #e8c46a; }
  #burrow footer { display: flex; align-items: center; gap: 18px;
    padding: 10px 22px 14px; border-top: 1px solid rgba(232,196,106,.25);
    font-size: 12px; letter-spacing: 1px; }
  #burrow footer .hint { opacity: .55; }
  #bring { margin-left: auto; padding: 9px 20px; cursor: pointer;
    font-family: inherit; font-size: 12px; letter-spacing: 3px;
    color: #e8c46a; background: rgba(232,196,106,.1);
    border: 1px solid rgba(232,196,106,.55); border-radius: 3px; }
  #bring:disabled { opacity: .35; cursor: default; }
  #bring.done { color: #3fd0c9; border-color: rgba(63,208,201,.5); }
  /* the scene's ink */
  #burrow .cellR { rx: 4; }
  #burrow .sock { cursor: pointer; }
  #burrow .sock circle { fill: rgba(63,208,201,.16); stroke: #3fd0c9;
    stroke-width: 1.2; }
  #burrow .sock:hover circle { fill: rgba(63,208,201,.35); }
  #burrow .sock text { fill: #3fd0c9; font-size: 15px; text-anchor: middle;
    pointer-events: none; }
  #burrow .plan { cursor: pointer; }
`;

export class BurrowConsole {
  // hooks: { getBurrow, getDroneCount, ringCarried(), onPlan(piece,c,d),
  //          onCancel(c,d), onInstallRing(), line() -> vesper text }
  constructor(hooks) {
    this.h = hooks;
    this.visible = false;
    this.sel = 'shaft';
    this._t = 0;
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
        <aside class="bpanel"><h2>PIECES</h2><div id="bcards"></div></aside>
        <div id="bscene" class="bpanel"><svg id="bsvg"></svg></div>
        <aside class="bpanel"><h2>VESPER</h2><div id="bvesper"></div>
          <div id="bstats"></div></aside>
      </div>
      <footer><span id="bledger"></span>
        <span class="hint">pick a piece · tap a + socket · tap a dashed plan to cancel</span>
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

  // called every frame while open; redraws at ~3 Hz so digs visibly creep
  update(dt) {
    if (!this.visible) return;
    this._t += dt;
    if (this._t > 0.33) { this._t = 0; this.render(); }
  }

  render() {
    const b = this.h.getBurrow();
    // ---- palette
    this.root.querySelector('#bcards').innerHTML = Object.entries(BURROW_PIECES)
      .map(([id, p]) => `<div class="bcard${id === this.sel ? ' sel' : ''}" data-id="${id}">
        <b>${p.name.toUpperCase()}</b><span>${p.kind}${p.bedworthy ? ' · sleepable' : ''}${p.lightPipe ? ' · light-pipe' : ''} · dig ${Math.round(p.cost)}</span></div>`).join('');

    // ---- scene: surface band, cells, sockets
    const W = (COLS * 2 + 1) * CS, H = (DEPTHS + 1.4) * CS;
    const X = (c) => (c + COLS) * CS, Y = (d) => (d - 1 + 1.2) * CS;
    let svg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a2013"/><stop offset="1" stop-color="#150a06"/>
      </linearGradient></defs>
      <rect x="0" y="${1.2 * CS}" width="${W}" height="${H - 1.2 * CS}" fill="url(#bg)"/>
      <rect x="0" y="0" width="${W}" height="${1.2 * CS}" fill="#241209"/>
      <line x1="0" y1="${1.2 * CS}" x2="${W}" y2="${1.2 * CS}" stroke="#e8c46a" stroke-opacity=".5"/>
      <text x="${X(0) + CS / 2}" y="${0.75 * CS}" text-anchor="middle" fill="#e8c46a" font-size="12" letter-spacing="2">⌂ THE CROWN${b.ringInstalled ? ' · RING SEALED' : ''}</text>`;

    for (const [k, cell] of b.cells) {
      const { col, depth } = parseKey(k);
      const p = BURROW_PIECES[cell.piece];
      const x = X(col) + 3, y = Y(depth) + 3, s = CS - 6;
      if (cell.dug >= 1) {
        const warm = p.kind === 'room' ? '#4a2c16' : '#38210f';
        svg += `<rect class="cellR" x="${x}" y="${y}" width="${s}" height="${s}"
          fill="${warm}" stroke="#e8c46a" stroke-opacity=".55"/>
          <text x="${x + s / 2}" y="${y + s / 2 + 4}" text-anchor="middle"
          fill="#f6ede2" fill-opacity=".85" font-size="10">${p.name.split(' ')[0].toUpperCase()}</text>`;
      } else {
        const frac = cell.dug;
        svg += `<g class="plan" data-c="${col}" data-d="${depth}">
          <rect class="cellR" x="${x}" y="${y}" width="${s}" height="${s}"
          fill="rgba(63,208,201,.05)" stroke="#f6ede2" stroke-opacity=".4" stroke-dasharray="5 4"/>
          <rect x="${x}" y="${y + s * (1 - frac)}" width="${s}" height="${s * frac}"
          fill="rgba(232,196,106,.28)"/>
          <text x="${x + s / 2}" y="${y + s / 2 + 4}" text-anchor="middle"
          fill="#f6ede2" fill-opacity=".6" font-size="9">${frac > 0 ? `${Math.round(frac * 100)}%` : p.name.split(' ')[0].toUpperCase()}</text></g>`;
      }
    }
    // sockets for the selected piece
    for (let d = 1; d <= DEPTHS; d++) {
      for (let c = -COLS; c <= COLS; c++) {
        if (!canPlan(b, this.sel, c, d)) continue;
        svg += `<g class="sock" data-c="${c}" data-d="${d}">
          <circle cx="${X(c) + CS / 2}" cy="${Y(d) + CS / 2}" r="${CS * 0.26}"/>
          <text x="${X(c) + CS / 2}" y="${Y(d) + CS / 2 + 5}">+</text></g>`;
      }
    }
    const el = this.root.querySelector('#bsvg');
    el.setAttribute('viewBox', `0 0 ${W} ${H}`);
    el.innerHTML = svg;

    // ---- drawer, ledger, the ring
    this.root.querySelector('#bvesper').textContent = `“${this.h.line()}”`;
    this.root.querySelector('#bstats').innerHTML = `drones <b>${this.h.getDroneCount()}</b><br>
      spoil banked — regolith <b>${b.spoil.regolith}</b> · ore <b>${b.spoil.ore}</b><br>
      queue <b>${b.queue.length}</b>`;
    this.root.querySelector('#bledger').textContent = 'spoil is ore — the house pays for itself as it is dug';
    const ring = this.root.querySelector('#bring');
    const shaftDug = b.cells.get('0,1')?.dug >= 1;
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
