// The title — a DOM veil over the dark, in the landing page's registers.
// Fronts the one-slot save: CONTINUE carries the sol you left; NEW LANDING
// asks twice before it wipes a life. The Game is not constructed until the
// choice is made, so nothing ticks, speaks, or persists behind the title.
// ?play in the query skips it (live checks and the dev loop want the game).

import { marsSolDate } from './marstime.js';
import { cleanName } from './vesper.js';

const CSS = `
  #title { position: fixed; inset: 0; z-index: 60; display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; color: #f6ede2; text-align: center;
    font-family: Georgia, 'Times New Roman', serif;
    background: radial-gradient(ellipse at 50% 120%, #7a3a22 0%, #170a06 70%);
    text-shadow: 0 1px 4px rgba(20,8,4,.85); }
  #title h1 { margin: 0 0 2px; font-size: 46px; letter-spacing: 10px;
    font-weight: normal; }
  #title .sub { opacity: .78; letter-spacing: 2px; font-size: 13px;
    margin-bottom: 26px; }
  #title button { display: block; width: 300px; margin: 7px 0; padding: 12px 26px;
    font-family: inherit; font-size: 14px; letter-spacing: 5px; cursor: pointer;
    color: #e8c46a; background: rgba(232,196,106,.08);
    border: 1px solid rgba(232,196,106,.55); border-radius: 3px; }
  #title button:hover { background: rgba(232,196,106,.18); }
  #title button.warn { color: #d1685a; border-color: rgba(209,104,90,.6);
    background: rgba(209,104,90,.08); }
  #title .namelabel { font-size: 11px; letter-spacing: 3px; opacity: .6;
    margin: 10px 0 4px; }
  #title input { display: block; width: 300px; margin: 0 0 12px;
    padding: 11px 14px; box-sizing: border-box; text-align: center;
    font-family: inherit; font-size: 15px; letter-spacing: 3px;
    color: #f6ede2; background: rgba(246,237,226,.06); outline: none;
    border: 1px solid rgba(246,237,226,.3); border-radius: 3px; }
  #title input:focus { border-color: rgba(232,196,106,.6); }
  #title input::placeholder { color: rgba(246,237,226,.32); }
  #title .keys { position: fixed; bottom: 20px; left: 0; width: 100%;
    font-size: 11px; letter-spacing: 1px; opacity: .55; line-height: 1.9; }
`;

export class TitleScreen {
  // save: the accepted save (or null); onChoice('continue'|'new') fires once
  constructor(save, onChoice) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'title';
    const h1 = document.createElement('h1');
    h1.textContent = 'MARSSTEAD';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'the tide went out four billion years ago';
    this.root.append(h1, sub);

    // the settler's name: VESPER uses it, the save keeps it. Prefilled
    // from the save; laundered (cleanName) before it goes anywhere.
    const nameLabel = document.createElement('div');
    nameLabel.className = 'namelabel';
    nameLabel.textContent = "SETTLER'S NAME";
    const nameInput = document.createElement('input');
    nameInput.maxLength = 16;
    nameInput.placeholder = 'settler';
    nameInput.value = save?.settlerName || '';
    this.root.append(nameLabel, nameInput);

    const choose = (choice) => {
      this.root.remove();
      onChoice(choice, cleanName(nameInput.value));
    };
    // Enter in the field takes the door you'd expect
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') choose(save ? 'continue' : 'new');
    });

    if (save) {
      const cont = document.createElement('button');
      cont.textContent = `CONTINUE — SOL ${Math.floor(marsSolDate(save.simMillis))}`;
      cont.onclick = () => choose('continue');
      this.root.appendChild(cont);
    }
    const fresh = document.createElement('button');
    fresh.textContent = save ? 'NEW LANDING' : 'LAND';
    let armed = false;
    fresh.onclick = () => {
      if (save && !armed) {
        // the second ask: a homestead is not wiped by a slip of the mouse
        armed = true;
        fresh.textContent = 'WIPE THE HOMESTEAD — SURE?';
        fresh.classList.add('warn');
        return;
      }
      choose('new');
    };
    this.root.appendChild(fresh);

    const keys = document.createElement('div');
    keys.className = 'keys';
    keys.textContent = 'WASD move · SHIFT lope · SPACE jump · E interact · '
      + 'B build · M map · R sleep · H hitch · T fabricate · L lamp';
    this.root.appendChild(keys);
    document.body.appendChild(this.root);
  }
}
