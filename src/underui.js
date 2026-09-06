// The excavation's consent screen and instrument HUD. The runtime owns the
// route, interaction eligibility, light modes and saved story state.
const CSS = `
body.underground #minimap,body.underground #planethud,body.underground #hud .signal,
body.underground #hud .prompt,body.underground #hud .bags,
body.underground #touchHud .touch-btn.top{display:none!important}
#under-intro,#under-instruments{font:calc(15px * var(--mars-text-scale,1))/1.45 Arial,Helvetica,sans-serif;color:#ede9df}
#under-intro{position:fixed;inset:0;z-index:78;display:none;align-items:center;
 justify-content:center;background:rgba(3,8,10,.88);padding:18px;box-sizing:border-box}
#under-intro.open{display:flex}
#under-intro .under-card{width:min(490px,100%);max-height:88vh;overflow:auto;
 background:#141b1c;border:1px solid #567675;border-radius:12px;padding:25px;
 box-shadow:0 20px 70px #0008}
#under-intro h1{font:normal calc(25px * var(--mars-text-scale,1)) Georgia,serif;color:#aee2d5;margin:0 0 13px}
#under-intro p{margin:10px 0;color:#d5dad4}
#under-intro label{display:flex;flex-direction:column;gap:7px;margin:19px 0 8px}
#under-intro button,#under-intro select,#under-instruments button{font:inherit;
 color:inherit;background:#202e2e;border:1px solid #769391;border-radius:6px;
 min-height:42px;padding:8px 12px;cursor:pointer}
#under-intro button:hover,#under-instruments button:hover{background:#314544;border-color:#a1d9ce}
#under-intro :focus-visible,#under-instruments :focus-visible{outline:3px solid #a1e5d6;outline-offset:3px}
#under-intro .under-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:19px}
#under-intro .descend{background:#35615a;border-color:#8abdb2}
#under-instruments{position:fixed;left:17px;top:96px;z-index:52;width:300px;
 max-width:calc(100vw - 34px);max-height:calc(100vh - 114px);overflow:auto;box-sizing:border-box;padding:14px;
 background:rgba(7,16,18,.9);border:1px solid #688580;border-radius:9px;font-size:calc(13px * var(--mars-text-scale,1))}
#under-instruments[hidden]{display:none}
#under-instruments .under-eyebrow{font-size:calc(10px * var(--mars-text-scale,1));letter-spacing:1.8px;color:#a1c5bd}
#under-instruments h2{font-size:calc(16px * var(--mars-text-scale,1));font-weight:normal;color:#b4e9da;margin:5px 0}
#under-instruments .under-detail{margin:5px 0 9px;color:#d0d8d1}
#under-instruments .under-readings{display:flex;gap:11px;flex-wrap:wrap;color:#c2cabc;font-size:calc(12px * var(--mars-text-scale,1))}
#under-instruments .under-modes{display:flex;gap:4px;margin-top:10px}
#under-instruments .under-modes button{font-size:calc(11px * var(--mars-text-scale,1));padding:5px 7px;flex:1;min-height:36px}
#under-instruments .under-modes button[aria-pressed=true]{background:#38665c;border-color:#a1d5c4}
#under-instruments .under-act{display:flex;gap:6px;margin-top:8px}
#under-instruments .under-act button{font-size:calc(12px * var(--mars-text-scale,1));padding:7px;flex:1}
#under-instruments .under-message{margin-top:8px;color:#c7dcc8;min-height:0}
#under-instruments .under-message:empty{display:none}
@media(max-width:600px){#under-instruments{left:10px;right:10px;top:170px;width:auto;
 max-width:none;padding:10px;font-size:calc(12px * var(--mars-text-scale,1))}#under-instruments .under-detail{margin:3px 0 5px}
 #under-instruments h2{font-size:calc(14px * var(--mars-text-scale,1));margin:2px 0}#under-instruments .under-modes{margin-top:6px}
 #under-intro .under-card{padding:20px}}
`;

export class UnderUI {
  constructor(hooks = {}) {
    this.h = hooks;
    this.active = false;
    this.paused = false;
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.intro = document.createElement('div');
    this.intro.id = 'under-intro';
    this.intro.innerHTML = `<section class="under-card" role="dialog" aria-modal="true" aria-labelledby="under-heading">
      <h1 id="under-heading">Below the homestead</h1>
      <p>These are human-excavated workings: a dark gallery with mechanical workers and three instruments to investigate.</p>
      <p>Exploring below is optional. The route stays safe, and <strong>Return to surface</strong> is always available.</p>
      <label>Atmosphere<select aria-label="Underground atmosphere"><option value="gentle">Gentle</option>
        <option value="uneasy">Uneasy</option><option value="intense">Intense</option></select></label>
      <p>Choose how unsettling the lighting and mechanical workers feel. You can stay outside and keep building.</p>
      <div class="under-actions"><button class="descend" data-action="enter">Descend</button>
        <button data-action="cancel">Stay outside</button></div></section>`;
    this.hud = document.createElement('aside');
    this.hud.id = 'under-instruments';
    this.hud.hidden = true;
    this.hud.setAttribute('aria-label', 'Excavation instruments');
    this.hud.innerHTML = `<div class="under-eyebrow">EXCAVATION INSTRUMENTS</div><h2></h2>
      <div class="under-detail"></div><div class="under-readings"><span data-read="distance"></span>
        <span data-read="depth"></span><span data-read="progress"></span></div>
      <div class="under-modes" role="group" aria-label="Suit light mode"><button data-mode="0">Survey</button>
        <button data-mode="1">Worklight</button><button data-mode="2">Beacon</button></div>
      <div class="under-act"><button data-action="interact">E · Use instrument</button>
        <button data-action="exit">Return to surface</button></div>
      <div class="under-message" role="status" aria-live="polite"></div>`;
    document.body.append(this.intro, this.hud);
    const stop = (e) => e.stopPropagation();
    for (const surface of [this.intro, this.hud]) {
      for (const event of ['pointerdown', 'pointerup', 'mousedown', 'mouseup',
        'touchstart', 'touchmove', 'touchend', 'wheel', 'keyup']) surface.addEventListener(event, stop);
    }
    this.intro.addEventListener('keydown', (e) => this.introKey(e));
    this.hud.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
    this.intro.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'enter') {
        const fear = this.intro.querySelector('select').value;
        this.close(); this.h.onEnter?.(fear);
      } else if (action === 'cancel') this.cancel();
    });
    this.hud.addEventListener('click', (e) => {
      e.stopPropagation();
      const button = e.target.closest('button');
      if (!button) return;
      button.blur();
      if (button.dataset.mode !== undefined) this.h.onMode?.(Number(button.dataset.mode));
      else if (button.dataset.action === 'interact') this.h.onInteract?.();
      else if (button.dataset.action === 'exit') this.h.onExit?.();
      this.h.onFocusWorld?.();
    });
  }

  get visible() { return this.intro.classList.contains('open'); }
  showIntro(fear = 'gentle') {
    this.previousFocus = document.activeElement;
    this.intro.querySelector('select').value = ['gentle', 'uneasy', 'intense'].includes(fear) ? fear : 'gentle';
    this.intro.classList.add('open');
    this.intro.querySelector('select').focus();
  }
  close() { this.intro.classList.remove('open'); this.previousFocus?.focus?.(); }
  cancel() { this.close(); this.h.onCancel?.(); }
  setActive(active) { this.active = !!active; this.hud.hidden = !this.active || this.paused; }

  introKey(e) {
    e.stopPropagation();
    if (e.code === 'Escape') { e.preventDefault(); this.cancel(); return; }
    if (e.key !== 'Tab') return;
    const all = [...this.intro.querySelectorAll('select,button')];
    const first = all[0], last = all.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  update({ title = '', detail = '', distance, depth, mode = 0, progress = '', message = '', paused = false } = {}) {
    this.paused = !!paused;
    this.hud.hidden = !this.active || this.paused;
    this.hud.querySelector('h2').textContent = title;
    this.hud.querySelector('.under-detail').textContent = detail;
    const metres = (value) => Number.isFinite(value) ? `${Math.round(value)} m` : '—';
    this.hud.querySelector('[data-read=distance]').textContent = `Instrument ${metres(distance)}`;
    this.hud.querySelector('[data-read=depth]').textContent = `Depth ${metres(depth)}`;
    this.hud.querySelector('[data-read=progress]').textContent = typeof progress === 'number' ? `${progress}/3 read` : progress;
    this.hud.querySelector('.under-message').textContent = message;
    for (const button of this.hud.querySelectorAll('[data-mode]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.mode) === mode));
    }
  }

  dispose() { this.intro.remove(); this.hud.remove(); this.style.remove(); }
}
