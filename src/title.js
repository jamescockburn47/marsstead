// The title — a vignette over the ATTRACT REEL (attract.js): the world
// itself plays behind these letters — the descent from space, the stead
// at dusk, the night drive — sealed (no saves, no speech, no input; see
// main.js's attract mode). Fronts the one-slot save: CONTINUE carries
// the sol you left; NEW LANDING asks twice before it wipes a life. The
// choice reloads into a clean real start, so nothing of the reel leaks.
// ?play in the query skips it (live checks and the dev loop want the game).

import { cleanName } from './vesper.js';

const CSS = `
  #title { position: fixed; inset: 0; z-index: 60; display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; color: #f6ede2; text-align: center;
    font-family: Georgia, 'Times New Roman', serif;
    background: radial-gradient(ellipse at center,
      rgba(23,10,6,.10) 0%, rgba(23,10,6,.42) 62%, rgba(23,10,6,.78) 100%);
    text-shadow: 0 1px 4px rgba(20,8,4,.9), 0 0 22px rgba(20,8,4,.75); }
  #title h1 { margin: 0; font-size: 46px; letter-spacing: 10px;
    font-weight: normal; }
  #title .tagline { font-style: italic; font-size: 14px; letter-spacing: 2px;
    opacity: .78; margin: 6px 0 10px; }
  #title .summary { font-size: 13px; line-height: 1.65; max-width: 480px;
    opacity: .82; margin: 0 18px 18px; }
  #title .strip { position: fixed; bottom: 44px; left: 0; width: 100%;
    font-size: 11px; letter-spacing: 2px; opacity: .65; }
  #title .strip a { color: #e8c46a; text-decoration: none; }
  #title .strip a:hover { text-decoration: underline; }
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
    // the family landing pattern (Saltstead's): tagline, a concise summary,
    // then the doors — the reel still plays underneath every word
    const tagline = document.createElement('div');
    tagline.className = 'tagline';
    tagline.textContent = 'the sand kept its secrets for four billion years';
    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.textContent = 'A survival homestead on the real Mars — true NASA '
      + 'terrain, thin air, killing cold. Build your stead, mine the regolith, '
      + 'and go down after what’s waiting. VESPER, a live AI companion, is '
      + 'the only other voice out here. Drawn entirely by code — free, no '
      + 'downloads, no ads.';
    this.root.append(h1, tagline, summary);

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
      cont.textContent = `CONTINUE — SOL ${Math.max(1, Math.floor((save.simMillis - (save.missionStart ?? save.simMillis)) / 88775244) + 1)}`;
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

    // the sibling strip — one homestead, three worlds
    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.append('part of THE STEADS — ');
    const links = [
      ['moorstead.app', 'https://www.moorstead.app'],
      ['saltstead.app', 'https://www.saltstead.app'],
      ['steadgames.com', 'https://www.steadgames.com'],
    ];
    links.forEach(([label, href], i) => {
      if (i) strip.append(' · ');
      const a = document.createElement('a');
      a.href = href; a.textContent = label;
      strip.appendChild(a);
    });
    this.root.appendChild(strip);

    const keys = document.createElement('div');
    keys.className = 'keys';
    keys.textContent = 'WASD move · SHIFT lope · SPACE jump · E interact · '
      + 'B build · M map · R sleep · H hitch · T fabricate · L lamp';
    this.root.appendChild(keys);
    document.body.appendChild(this.root);
  }
}
