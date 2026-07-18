// The lander's console — DOM layer, only alive in the cabin. A compact
// card of the numbers that keep you alive; C expands it to the full
// mission board: parameters, survival, logistics, and VESPER's own pane.
// All text via textContent (escHtml discipline), family registers.

const CSS = `
  #console { position: fixed; left: 18px; top: 50%; transform: translateY(-50%);
    width: 250px; color: #f6ede2; font-family: Georgia, 'Times New Roman', serif;
    background: rgba(18,8,5,.82); border: 1px solid rgba(232,196,106,.45);
    border-radius: 3px; padding: 12px 14px; font-size: 12px; line-height: 1.8;
    text-shadow: 0 1px 4px rgba(20,8,4,.85); z-index: 30; }
  #console.full { left: 50%; top: 50%; transform: translate(-50%,-50%);
    width: min(880px, 92vw); max-height: 88vh; overflow: auto; padding: 20px 26px; }
  #console h3 { margin: 0 0 6px; font-size: 11px; letter-spacing: 4px;
    color: #e8c46a; font-weight: normal; }
  #console .row { display: flex; justify-content: space-between; gap: 12px; }
  #console .row b { font-weight: normal; color: #f0c9a0; }
  #console .cols { display: none; }
  #console.full .cols { display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 22px; margin-top: 8px; }
  #console.full .compactRows { display: none; }
  #console .foot { margin-top: 10px; font-size: 10px; letter-spacing: 2px;
    opacity: .55; text-align: center; }
  #console .obj::before { content: '· '; color: #e8c46a; }
  #console .obj.done { opacity: .55; text-decoration: line-through; }
  #console .vesper { margin-top: 14px; border-top: 1px solid rgba(232,196,106,.25);
    padding-top: 10px; font-style: italic; display: none; }
  #console.full .vesper { display: block; }
  #console .vesper .who { font-style: normal; font-size: 9px; letter-spacing: 4px;
    opacity: .6; display: block; margin-bottom: 3px; }
`;

function el(parent, tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}
function row(parent, label) {
  const r = el(parent, 'div', 'row');
  const b = el(r, 'b'); b.textContent = label;
  return el(r, 'span');
}

export class LanderConsole {
  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'console';
    this.root.style.display = 'none';

    const title = el(this.root, 'h3');
    title.textContent = 'LANDER CONSOLE';

    // the compact card: the six numbers that matter
    const c = el(this.root, 'div', 'compactRows');
    this.cSol = row(c, 'mission sol');
    this.cPhase = row(c, 'phase');
    this.cAir = row(c, 'air / warmth');
    this.cTemp = row(c, 'outside');
    this.cLoad = row(c, 'suit');
    this.cBench = row(c, 'fabricator');

    // the full board
    const cols = el(this.root, 'div', 'cols');
    const m = el(cols, 'div');
    el(m, 'h3').textContent = 'MISSION';
    this.mSol = row(m, 'sol');
    this.mClock = row(m, 'clock');
    this.mSeason = row(m, 'season');
    this.mPhase = row(m, 'phase');
    this.objBox = el(m, 'div');

    const s = el(cols, 'div');
    el(s, 'h3').textContent = 'SURVIVAL';
    this.sAir = row(s, 'air');
    this.sWarm = row(s, 'warmth');
    this.sTemp = row(s, 'outside');
    this.sSun = row(s, 'sun');
    this.sDust = row(s, 'dust');
    this.sShelter = row(s, 'shelter');

    const l = el(cols, 'div');
    el(l, 'h3').textContent = 'LOGISTICS';
    this.lSuit = row(l, 'suit');
    this.lRover = row(l, 'rover deck');
    this.lHull = row(l, 'hull stock');
    this.lFab = row(l, 'fabricator');
    this.lMachines = row(l, 'refinery');
    this.lRig = row(l, 'drill rig');
    this.lOre = row(l, 'ore marked');

    const v = el(this.root, 'div', 'vesper');
    el(v, 'span', 'who').textContent = 'VESPER';
    this.vLine = el(v, 'span');

    this.foot = el(this.root, 'div', 'foot');
    document.body.appendChild(this.root);
  }

  setVisible(on) { this.root.style.display = on ? 'block' : 'none'; }
  toggleExpand() { this.root.classList.toggle('full'); }
  get expanded() { return this.root.classList.contains('full'); }

  // model: plain strings/numbers assembled by the game each frame
  update(md) {
    this.cSol.textContent = md.sol;
    this.cPhase.textContent = md.phase;
    this.cAir.textContent = `${md.air}% / ${md.warm}%`;
    this.cTemp.textContent = md.temp;
    this.cLoad.textContent = md.suit;
    this.cBench.textContent = md.fab;

    this.mSol.textContent = md.sol;
    this.mClock.textContent = md.clock;
    this.mSeason.textContent = md.season;
    this.mPhase.textContent = md.phase;
    this.objBox.textContent = '';
    for (const [label, done] of md.objectives) {
      const o = el(this.objBox, 'div', done ? 'obj done' : 'obj');
      o.textContent = label;
    }
    this.sAir.textContent = `${md.air}%`;
    this.sWarm.textContent = `${md.warm}%`;
    this.sTemp.textContent = md.temp;
    this.sSun.textContent = md.sun;
    this.sDust.textContent = md.dust;
    this.sShelter.textContent = md.shelter;
    this.lSuit.textContent = md.suit;
    this.lRover.textContent = md.rover;
    this.lHull.textContent = md.hull;
    this.lFab.textContent = md.fab;
    this.lMachines.textContent = md.machines;
    this.lRig.textContent = md.rig;
    this.lOre.textContent = md.ore;
    this.vLine.textContent = md.vesper || '…all quiet. I like quiet; it files easily.';
    this.foot.textContent = this.expanded
      ? 'C COLLAPSE · M MAP · E STEP OUT' : 'C FULL BOARD · M MAP · E STEP OUT';
  }
}
