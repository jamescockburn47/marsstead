// THE RECORD — the journal of the signal chain. Console grammar
// (serif, gold-and-teal on dark), DOM only; marslegends owns every
// word. J opens and closes; a relic lands here the moment the ground
// gives it up, and reading is how the settler holds the story.

import { SITES } from './marslegends.js';

const CSS = `
  #recj { position: fixed; inset: 0; z-index: 56; display: none;
    background: rgba(10,6,4,.985); color: #f6ede2;
    font-family: Georgia, 'Times New Roman', serif; }
  #recj.open { display: flex; flex-direction: column; }
  #recj header { padding: 16px 26px 6px; }
  #recj h1 { margin: 0; font-size: 17px; letter-spacing: 6px; color: #e8c46a;
    font-weight: normal; }
  #recj .sub { font-size: 11px; letter-spacing: 2px; opacity: .55; margin-top: 3px; }
  #recj .x { position: absolute; top: 16px; right: 22px; cursor: pointer;
    opacity: .7; font-size: 15px; } #recj .x:hover { opacity: 1; }
  #rmain { flex: 1; overflow-y: auto; padding: 14px 26px; max-width: 720px; }
  .rentry { border: 1px solid rgba(232,196,106,.28); border-radius: 4px;
    padding: 14px 18px; margin-bottom: 14px; background: rgba(28,16,9,.55);
    font-size: 13px; line-height: 1.6; }
  .rentry h2 { margin: 0 0 2px; font-size: 12px; letter-spacing: 3px;
    color: #e8c46a; font-weight: normal; }
  .rentry .where { font-size: 10.5px; letter-spacing: 2px; color: #3fd0c9;
    opacity: .8; margin-bottom: 8px; }
  .rentry.sealed { opacity: .45; font-style: italic; }
  #recj footer { padding: 8px 26px 14px; font-size: 11px;
    letter-spacing: 1px; opacity: .55; }
`;

export class Journal {
  constructor() {
    this.visible = false;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'recj';
    this.root.innerHTML = `
      <header><h1>THE RECORD</h1>
        <div class="sub">what the ground has given up</div>
        <div class="x" id="rx">✕</div></header>
      <div id="rmain"></div>
      <footer>J opens and closes · the signal band knows the way to the next page</footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('#rx').addEventListener('click', () => this.close());
  }

  open(mystery) {
    this.visible = true;
    this.root.classList.add('open');
    this.render(mystery);
    // opening is reading: every held relic becomes a read one
    mystery.read = SITES.filter((s) => mystery.found.includes(s.id))
      .map((s) => s.relic.id);
  }

  close() { this.visible = false; this.root.classList.remove('open'); }
  toggle(mystery) { this.visible ? this.close() : this.open(mystery); }

  unread(mystery) {
    return SITES.filter((s) => mystery.found.includes(s.id)
      && !mystery.read.includes(s.relic.id)).length;
  }

  render(mystery) {
    const main = this.root.querySelector('#rmain');
    const entries = [];
    for (const s of SITES) {
      if (mystery.found.includes(s.id)) {
        entries.push(`<div class="rentry"><h2>${s.relic.name.toUpperCase()}</h2>
          <div class="where">${s.place.toUpperCase()}</div>${s.relic.journal}</div>`);
      } else {
        // the next page is a shape, not a spoiler; later pages are silence
        entries.push(`<div class="rentry sealed">an unwritten page — the band knows more than this book does</div>`);
        break;
      }
    }
    if (!entries.length) entries.push('<div class="rentry sealed">nothing yet — listen for the band</div>');
    main.innerHTML = entries.join('');
  }
}
