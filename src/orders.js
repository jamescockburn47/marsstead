// LANDFALL ORDERS — the written briefing (James's rule: a proper written
// explanation at mission start). Deterministic and built from the game's
// REAL constants, so this document can never lie or drift; VESPER is the
// living voice, this is the paper she'd hand you. O reopens it any time.

import { RTG_KW, ARRAY_KW, BUILD_KWH, LANDER_BANK_KWH } from './power.js';
import { DIG_KWH } from './burrow.js';

const CSS = `
  #orders { position: fixed; inset: 0; z-index: 58; display: none;
    align-items: center; justify-content: center;
    background: rgba(10,5,3,.9); font-family: Georgia, serif; }
  #orders.open { display: flex; }
  #orders .sheet { width: min(620px, 88vw); max-height: 86vh; overflow-y: auto;
    background: linear-gradient(180deg, #241309, #180c06); color: #f6ede2;
    border: 1px solid rgba(232,196,106,.5); border-radius: 4px;
    padding: 26px 34px; line-height: 1.55; font-size: 13.5px; }
  #orders h1 { font-size: 16px; letter-spacing: 5px; color: #e8c46a;
    font-weight: normal; margin: 0 0 2px; }
  #orders .sub { font-size: 11px; letter-spacing: 2px; opacity: .55;
    margin-bottom: 16px; }
  #orders h2 { font-size: 11px; letter-spacing: 3px; color: #e8c46a;
    font-weight: normal; margin: 16px 0 4px; }
  #orders b { color: #e8c46a; }
  #orders .ask { margin-top: 18px; padding: 10px 14px; text-align: center;
    border: 1px solid rgba(63,208,201,.45); border-radius: 4px;
    color: #3fd0c9; letter-spacing: 1px; }
  #orders .x { float: right; cursor: pointer; opacity: .7; }
  #orders .x:hover { opacity: 1; }
`;

export class MissionOrders {
  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'orders';
    this.root.innerHTML = `<div class="sheet">
      <span class="x" id="ox">✕ close (O)</span>
      <h1>LANDFALL ORDERS</h1>
      <div class="sub">MERIDIAN · WHITE HARBOUR UPLINK · FRANCHISE DEMONSTRATION ONE</div>

      <h2>THE MISSION</h2>
      You and VESPER are Meridian's demonstration: one settler, one mind,
      one homestead raised from Mars itself. Everything you build is
      evidence. There is no return vehicle; this is a founding.

      <h2>THE HOME</h2>
      The homestead is dug <b>underground</b> — radiation and cold make
      surface living a lie. Your three drones do the digging, planned from
      the console at <b>the crown</b> (southwest of the lander, press
      <b>E</b>). The salvaged <b>airlock ring</b> caps the shaft and its
      only job is holding the warren's air — <b>nothing else waits on it</b>.
      Deep bunks shield sleepers; gardens need the shallows (light-pipes
      reach two levels); a store by the shaft speeds every dig.

      <h2>POWER — THE CURRENCY</h2>
      Structure is charge. The lander's RTG makes <b>${RTG_KW} kW</b>, always;
      a solar array adds up to <b>${ARRAY_KW} kW</b> in clear sun; batteries
      bank it for the night. The nanofab <b>spends the bank</b>: digging a
      space costs <b>${DIG_KWH.corridor}–${DIG_KWH.garden} kWh</b>, a bench
      <b>${BUILD_KWH.machine}</b>, a new drone <b>${BUILD_KWH.drone}</b>. You
      landed with <b>4 kWh</b> of the lander's ${LANDER_BANK_KWH}-kWh cells —
      enough to break first ground, not enough for ambition. A queue the bank
      cannot fund <b>waits on charge</b>. Keep ahead: more panels, more banks.

      <h2>THE LOOP</h2>
      Dig spoil pays <b>iron ore</b> at the crown → the lander
      <b>fabricator</b> turns ore to <b>steel panels</b> (stand at the
      lander, press <b>T</b> — it works from sol one, no prerequisites) →
      panels become <b>solar arrays</b> (<b>B</b> to place) → sunlight
      becomes charge → charge becomes structure. Close that loop and the
      base feeds itself. Then: mill, assembler, more hands, deeper rooms.

      <h2>KEYS</h2>
      WASD move · SHIFT lope · E interact/consoles · T work a bench ·
      B build · M map · O these orders · R sleep · V talk · ENTER type

      <div class="ask">Anything unclear — press <b>ENTER</b> and ask VESPER.
      She reads your live telemetry and answers from where you stand.</div>
    </div>`;
    document.body.appendChild(this.root);
    this.root.querySelector('#ox').onclick = () => this.close();
  }

  get visible() { return this.root.classList.contains('open'); }
  open() { this.root.classList.add('open'); }
  close() { this.root.classList.remove('open'); }
  toggle() { this.visible ? this.close() : this.open(); }
}
