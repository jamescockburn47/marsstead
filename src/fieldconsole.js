import { FIELD_BANDS, FIELD_TARGETS, alignment, fieldAligned, turnDial } from './fieldwork.js';

const CSS = `
 #fieldConsole {position:fixed;inset:0;z-index:55;display:none;align-items:center;justify-content:center;
 background:rgba(8,12,14,.74);color:#eee5d3;font:calc(16px * var(--ui-scale,1))/1.5 system-ui,sans-serif;padding:18px;box-sizing:border-box}
 #fieldConsole .field-panel {width:min(760px,100%);max-height:90vh;overflow:auto;background:linear-gradient(135deg,#283432,#151d20);
 border:1px solid #b39a6c;border-radius:8px;padding:clamp(18px,4vw,38px);box-shadow:0 24px 100px #0008}
 #fieldConsole h2 {font:24px Georgia,serif;letter-spacing:3px;margin:8px 0 12px}
 #fieldConsole .overline {color:#8ed7c6;font-size:11px;letter-spacing:3px}
 #fieldConsole .field-dials {display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0}
 #fieldConsole .field-dial {text-align:center;padding:12px 6px;background:#09151766;border:1px solid #b09a6a33;border-radius:5px}
 #fieldConsole svg {display:block;width:100%;max-height:160px;margin:8px auto}
 #fieldConsole button {font:inherit;cursor:pointer;min-height:44px;border:1px solid #aa997566;border-radius:4px;background:#dae9df12;color:#eee5d3;padding:8px 16px}
 #fieldConsole button:hover,#fieldConsole button:focus-visible {background:#8bd6c12a;outline:2px solid #8ed7c6}
 #fieldConsole button:disabled {opacity:.45;cursor:default}
 #fieldConsole .field-actions {display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
 #fieldConsole .field-status {min-height:48px;color:#a9e0ca}
 #fieldConsole .close {float:right}
 @media(max-width:540px){#fieldConsole .field-dials{gap:6px}#fieldConsole .field-dial{padding:8px 2px}
 #fieldConsole button{padding:8px 12px}#fieldConsole h2{font-size:20px}}
`;
const button = (text, action, parent) => {
  const el = document.createElement('button'); el.type = 'button'; el.textContent = text;
  el.onclick = action; parent.append(el); return el;
};
export class FieldConsole {
  constructor(hooks) {
    this.hooks = hooks; this.visible = false; this.previousFocus = null;
    const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
    this.root = document.createElement('section'); this.root.id = 'fieldConsole';
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'First light survey');
    this.root.innerHTML = '<div class="field-panel"><div class="field-top"></div><div class="overline">MERIDIAN / LANDING SURVEY 01</div>'
      + '<h2>Catch the first light</h2><p>Turn each sensor until its needle lines up with the gold mark. A full ring means a clear reading.</p>'
      + '<div class="field-dials"></div><div class="field-status" role="status"></div><div class="field-actions"></div></div>';
    this.closeButton = button('Close · Esc', () => this.close(), this.root.querySelector('.field-top'));
    this.closeButton.className = 'close';
    this.dials = FIELD_BANDS.map((band, i) => {
      const box = document.createElement('div'); box.className = 'field-dial';
      const label = document.createElement('div'); label.textContent = band; box.append(label);
      const face = document.createElement('div'); box.append(face);
      for (const [label, direction] of [['↶', -1], ['↷', 1]]) {
        const b = button(label, () => { turnDial(hooks.getState(), i, direction); this.draw(); hooks.onTurn?.(); }, box);
        b.setAttribute('aria-label', `${band}: turn ${direction < 0 ? 'left' : 'right'}`);
      }
      this.root.querySelector('.field-dials').append(box); return { box, face };
    });
    const actions = this.root.querySelector('.field-actions');
    this.collect = button('Recover solar wing · 18 kg', () => {
      const ok = hooks.onCollect(); this.draw();
      if (!ok) this.root.querySelector('.field-status').textContent = 'Make 18 kg of space in your suit, or park the buggy beside the station.';
    }, actions);
    button('Help me align one sensor', () => {
      const s = hooks.getState(); const i = FIELD_TARGETS.findIndex((v, n) => s.dials[n] !== v);
      if (i >= 0 && !s.claimed) { s.dials[i] = FIELD_TARGETS[i]; hooks.onTurn?.(); }
      this.draw();
    }, actions);
    this.root.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      if (e.key === 'Tab') {
        const bs = [...this.root.querySelectorAll('button:not(:disabled)')];
        if (e.shiftKey && document.activeElement === bs[0]) { e.preventDefault(); bs.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === bs.at(-1)) { e.preventDefault(); bs[0].focus(); }
      }
    });
    document.body.append(this.root);
  }
  draw() {
    const s = this.hooks.getState();
    this.dials.forEach(({ box, face }, i) => {
      const angle = s.dials[i] * 45, target = FIELD_TARGETS[i] * 45;
      const strength = Math.round(alignment(s.dials[i], FIELD_TARGETS[i]) * 100);
      face.innerHTML = `<svg viewBox="0 0 140 140" role="img" aria-label="${FIELD_BANDS[i]} ${strength} percent aligned">
        <circle cx="70" cy="70" r="53" fill="#102628" stroke="#69817b"/>
        <circle cx="70" cy="70" r="46" fill="none" stroke="#6cd9b8" stroke-width="3" opacity="${0.2 + strength / 130}"/>
        <path d="M70 10 L66 23 L74 23 Z" fill="#e5c589" transform="rotate(${target} 70 70)"/>
        <path d="M70 70 L70 29" stroke="#eee5d3" stroke-width="3" transform="rotate(${angle} 70 70)"/>
        <circle cx="70" cy="70" r="5" fill="#e5c589"/><text x="70" y="112" fill="#bde6d3" text-anchor="middle" font-size="14">${strength}%</text></svg>`;
      box.querySelectorAll('button').forEach(b => { b.disabled = s.claimed; });
    });
    this.collect.disabled = s.claimed || !fieldAligned(s);
    this.root.querySelector('.field-status').textContent = s.claimed
      ? 'Survey recorded. The solar wing is in your cargo. Take it home and build an array.'
      : fieldAligned(s) ? 'Three clear readings. The station can spare its solar wing for your home.'
        : 'Each sensor responds as you turn it. Follow the brightening ring.';
  }
  open() { this.visible = true; this.previousFocus = document.activeElement; this.draw(); this.root.style.display = 'flex'; this.closeButton.focus(); }
  close() { this.visible = false; this.root.style.display = 'none'; this.hooks.onClose?.(); }
}
