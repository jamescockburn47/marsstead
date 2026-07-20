// The warden's bench — the test kit behind the hashed key (warden.js).
// Console grammar (serif, gold-and-teal on dark), DOM only, opened by
// F9 when the mark is held. Every button performs AUTHORED state changes
// the settler could have earned — nothing here rides the save schema.

const CSS = `
  #wpc { position: fixed; inset: 0; z-index: 60; display: none;
    background: rgba(10,6,4,.985); color: #f6ede2;
    font-family: Georgia, 'Times New Roman', serif; }
  #wpc.open { display: flex; flex-direction: column; }
  #wpc header { padding: 16px 26px 6px; }
  #wpc h1 { margin: 0; font-size: 17px; letter-spacing: 6px; color: #e8c46a;
    font-weight: normal; }
  #wpc .sub { font-size: 11px; letter-spacing: 2px; opacity: .55; margin-top: 3px; }
  #wpc .x { position: absolute; top: 16px; right: 22px; cursor: pointer;
    opacity: .7; font-size: 15px; } #wpc .x:hover { opacity: 1; }
  #wmain { flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start;
    gap: 14px; padding: 14px 26px; overflow-y: auto; }
  .wpanel { width: 300px; border: 1px solid rgba(232,196,106,.28); border-radius: 4px;
    padding: 12px 16px; background: rgba(28,16,9,.55); font-size: 12.5px; }
  .wpanel h2 { margin: 0 0 8px; font-size: 10.5px; letter-spacing: 3px;
    color: #e8c46a; font-weight: normal; }
  #wpc button { display: block; width: 100%; margin: 6px 0; padding: 9px 14px;
    cursor: pointer; font-family: inherit; font-size: 12px; letter-spacing: 2px;
    text-align: left; border-radius: 4px; color: #f6ede2;
    background: rgba(63,208,201,.08); border: 1px solid rgba(63,208,201,.4); }
  #wpc button:hover { background: rgba(63,208,201,.2); }
  #wpc button.gold { border-color: rgba(232,196,106,.5);
    background: rgba(232,196,106,.08); }
  #wpc button.gold:hover { background: rgba(232,196,106,.2); }
  #wpc button.done { border-color: #3fd0c9; background: rgba(63,208,201,.3); }
  #wpc footer { padding: 8px 26px 14px; font-size: 11px; letter-spacing: 1px;
    opacity: .55; }
`;

export class WardenPanel {
  // hooks: { fillBags, fullCharge, refit, raiseWorks, raiseHopper,
  //   digBurrow, setHour(h), teleport(id), sites -> [{id,label}],
  //   renounce }
  constructor(hooks) {
    this.h = hooks;
    this.visible = false;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'wpc';
    const site = (s) => `<button data-act="teleport" data-arg="${s.id}">➤ ${s.label}</button>`;
    this.root.innerHTML = `
      <header><h1>THE WARDEN</h1>
        <div class="sub">the whole homestead, on demand — a bench for proving builds</div>
        <div class="x" id="wx">✕</div></header>
      <div id="wmain">
        <div class="wpanel"><h2>PROVISION</h2>
          <button data-act="fillBags">FILL THE BAGS — every item, suit and rover</button>
          <button data-act="fullCharge">FULL CHARGE — the bank to its brim</button>
          <button data-act="refit">REFIT — air and warmth to full</button></div>
        <div class="wpanel"><h2>RAISE</h2>
          <button class="gold" data-act="raiseWorks">RAISE THE WORKS — the full yard</button>
          <button class="gold" data-act="raiseHopper">REFIT THE SHIP — six tanks aboard</button>
          <button class="gold" data-act="digBurrow">DIG THE BURROW — the warren below</button></div>
        <div class="wpanel"><h2>THE CLOCK</h2>
          <button data-act="setHour" data-arg="6">DAWN</button>
          <button data-act="setHour" data-arg="12">NOON</button>
          <button data-act="setHour" data-arg="18">DUSK</button>
          <button data-act="setHour" data-arg="0">MIDNIGHT</button></div>
        <div class="wpanel"><h2>THE GROUND</h2>${this.h.sites().map(site).join('')}</div>
        <div class="wpanel"><h2>THE MARK</h2>
          <button data-act="renounce">RENOUNCE — drop the mark, close the bench</button></div>
      </div>
      <footer>F9 opens and closes · every act is an authored state the settler could have earned · saves stay ordinary saves</footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('#wx').addEventListener('click', () => this.close());
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const { act, arg } = b.dataset;
      if (act === 'renounce') { this.h.renounce(); this.close(); return; }
      if (act === 'setHour') this.h.setHour(Number(arg));
      else if (act === 'teleport') this.h.teleport(arg);
      else this.h[act]();
      b.classList.add('done');
      setTimeout(() => b.classList.remove('done'), 450);
    });
  }

  open() { this.visible = true; this.root.classList.add('open'); }
  close() { this.visible = false; this.root.classList.remove('open'); }
  toggle() { this.visible ? this.close() : this.open(); }
}
