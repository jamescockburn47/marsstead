// The suit HUD — DOM layer. Sol clock and season top-left, air and warmth
// top-right, VESPER's line breathing along the bottom. All text is set via
// textContent (the escHtml discipline: no raw strings as HTML, ever).

const CSS = `
  #hud { position: fixed; inset: 0; pointer-events: none; color: #f6ede2;
    font-family: Georgia, 'Times New Roman', serif;
    text-shadow: 0 1px 4px rgba(20,8,4,.85); }
  #hud .clock { position: absolute; top: 16px; left: 18px; font-size: 14px;
    letter-spacing: 1px; line-height: 1.7; opacity: .92; }
  #hud .clock .sub { font-size: 11px; opacity: .65; letter-spacing: 2px; }
  #hud .vitals { position: absolute; top: 16px; right: 18px; width: 170px;
    font-size: 11px; letter-spacing: 2px; text-align: right; }
  #hud .bar { height: 5px; margin: 4px 0 10px; border-radius: 2px;
    background: rgba(246,237,226,.14); overflow: hidden; }
  #hud .bar i { display: block; height: 100%; border-radius: 2px;
    background: #e8c46a; transition: width .4s; }
  #hud .bar.cold i { background: #7fa8c9; }
  #hud .vesper { position: absolute; bottom: 40px; left: 0; width: 100%;
    text-align: center; font-size: 15px; font-style: italic; opacity: 0;
    transition: opacity 1.2s; letter-spacing: .4px; }
  #hud .vesper .who { font-style: normal; font-size: 10px; letter-spacing: 4px;
    opacity: .6; display: block; margin-bottom: 4px; }
  #hud .badge { position: absolute; bottom: 12px; right: 14px; font-size: 9px;
    letter-spacing: 2px; opacity: .4; }
  #hud .prompt { position: absolute; bottom: 86px; left: 0; width: 100%;
    text-align: center; font-size: 13px; letter-spacing: 1px; opacity: .95; }
  #hud .prompt b { color: #e8c46a; font-weight: normal; letter-spacing: 2px; }
  #hud .bags { position: absolute; top: 96px; right: 18px; text-align: right;
    font-size: 11px; letter-spacing: 1px; opacity: .85; line-height: 1.8; }
  #hud .veil { position: absolute; inset: 0; background: #060302;
    opacity: 0; transition: opacity 1.2s ease; }
`;

export class Hud {
  constructor(placeholderBadge) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'hud';
    document.body.appendChild(this.root);

    this.clock = el(this.root, 'div', 'clock');
    this.clockMain = el(this.clock, 'div');
    this.clockSub = el(this.clock, 'div', 'sub');

    const vitals = el(this.root, 'div', 'vitals');
    el(vitals, 'div').textContent = 'AIR';
    this.airBar = el(el(vitals, 'div', 'bar'), 'i');
    el(vitals, 'div').textContent = 'WARMTH';
    this.warmBar = el(el(vitals, 'div', 'bar cold'), 'i');
    this.tempLabel = el(vitals, 'div');

    this.prompt = el(this.root, 'div', 'prompt');
    this.bags = el(this.root, 'div', 'bags');
    this.veil = el(this.root, 'div', 'veil'); // the sleep blackout

    this.vesper = el(this.root, 'div', 'vesper');
    el(this.vesper, 'span', 'who').textContent = 'VESPER';
    this.vesperLine = el(this.vesper, 'span');
    this.vesperUntil = 0;

    if (placeholderBadge) {
      el(this.root, 'div', 'badge').textContent =
        'PLACEHOLDER SKELETON · AWAITING MOLA';
    }
  }

  setClock(main, sub) {
    this.clockMain.textContent = main + (this.speedLine || '');
    this.clockSub.textContent = sub;
  }

  // km/h while driving, null on foot
  setSpeed(kmh) {
    if (kmh === null) { this.speedLine = ''; return; }
    this.speedLine = ` · ${Math.round(kmh)} km/h`;
  }

  setVitals(air01, warm01, tempC) {
    this.airBar.style.width = `${Math.round(air01 * 100)}%`;
    this.warmBar.style.width = `${Math.round(warm01 * 100)}%`;
    this.tempLabel.textContent = `${Math.round(tempC)}°C`;
  }

  // the interaction prompt, bottom-centre; html-free (innerHTML never)
  setPrompt(text) {
    if (!text) { this.prompt.textContent = ''; return; }
    this.prompt.textContent = '';
    // bold the key tokens: segments wrapped in | | render highlighted
    for (const seg of text.split('|')) {
      const isKey = seg.startsWith('*');
      const node = document.createElement(isKey ? 'b' : 'span');
      node.textContent = isKey ? seg.slice(1) : seg;
      this.prompt.appendChild(node);
    }
  }

  // suit line always; rover line when given
  setBags(suitLine, roverLine = null) {
    this.bags.textContent = '';
    const s = document.createElement('div');
    s.textContent = suitLine;
    this.bags.appendChild(s);
    if (roverLine) {
      const r = document.createElement('div');
      r.textContent = roverLine;
      this.bags.appendChild(r);
    }
  }

  // the sleep fade: 0 clear, 1 black — CSS eases it over ~a second
  setVeil(opacity01) {
    this.veil.style.opacity = String(opacity01);
  }

  say(line, now, holdSeconds = 7) {
    if (!line) return;
    this.vesperLine.textContent = line; // textContent: never HTML
    this.vesper.style.opacity = '1';
    this.vesperUntil = now + holdSeconds;
  }

  update(now) {
    if (this.vesperUntil && now > this.vesperUntil) {
      this.vesper.style.opacity = '0';
      this.vesperUntil = 0;
    }
  }
}

function el(parent, tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}
