// Session controls. Persistence and game-state changes stay in the hooks.
import { normaliseSettings } from './playsettings.js';

const CSS = `
#session-tools,#session-overlay{font-family:Arial,Helvetica,sans-serif;color:#f5eee4;
 font-size:calc(15px * var(--mars-text-scale,1));line-height:1.45}
#session-tools{position:fixed;right:18px;top:160px;z-index:51;display:flex;gap:6px}
#session-tools[hidden]{display:none}
#session-tools button,#session-overlay button,#session-overlay select{
 font:inherit;color:inherit;border:1px solid #a7987c;background:#251a13;border-radius:7px;
 padding:9px 13px;min-height:42px;cursor:pointer}
#session-tools button{background:rgba(24,17,12,.9);font-size:13px}
#session-tools button:hover,#session-overlay button:hover{border-color:#69d7cb;background:#34291c}
#session-overlay :focus-visible,#session-tools :focus-visible{outline:3px solid #78e3d7;outline-offset:3px}
#session-overlay{position:fixed;inset:0;z-index:90;display:none;background:rgba(5,8,9,.8);
 align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
#session-overlay.open{display:flex}
#session-card{width:min(680px,100%);max-height:90vh;overflow:auto;background:#191613;
 border:1px solid #9b8861;border-radius:15px;padding:24px;box-shadow:0 20px 75px #0008}
#session-card h1{font:normal 27px Georgia,serif;color:#efd397;margin:0 0 4px}
#session-card h2{font-size:16px;margin:22px 0 10px;color:#efd397}
#session-card p{margin:8px 0;color:#ddd3c5}
#session-card .session-actions{display:flex;flex-wrap:wrap;gap:8px;margin:17px 0}
#session-card button.primary{background:#32645e;border-color:#75ccbc}
#session-card .session-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 22px}
#session-card label{display:flex;flex-direction:column;gap:6px}
#session-card label.toggle{flex-direction:row;align-items:center;gap:10px}
#session-card input[type=checkbox]{width:20px;height:20px;accent-color:#63cdbd}
#session-card input[type=range]{width:100%;accent-color:#63cdbd;min-height:28px}
#session-card small{color:#c2b5a5;font-size:.85em}
#session-card .session-help{background:#29241c;padding:13px 16px;border-radius:8px}
#session-card .session-help dl{display:grid;grid-template-columns:100px 1fr;gap:7px;margin:8px 0}
#session-card .session-help dt{color:#9ae2d5;font-weight:bold}
#session-card .session-help dd{margin:0}
#session-status{min-height:1.4em;color:#a7e0cf!important}
@media(max-width:600px){#session-tools{top:114px;right:10px}#session-card{padding:18px}
 #session-card .session-grid{grid-template-columns:1fr}#session-card h1{font-size:24px}}
`;

export class SessionUI {
  constructor(hooks = {}) {
    this.h = hooks;
    this.settings = normaliseSettings(hooks.settings);
    this.paused = false;
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.toolbar = document.createElement('nav');
    this.toolbar.id = 'session-tools';
    this.toolbar.setAttribute('aria-label', 'Session controls');
    this.toolbar.innerHTML = '<button data-action="pause">Ⅱ Pause</button>'
      + '<button data-action="chat" aria-label="Type to VESPER"><span class="comms-prefix">Type to </span>VESPER</button><button data-action="help">? Help</button><button data-action="home" title="Return aboard the lander with your cargo">⌂ Safe return</button>';
    this.root = document.createElement('div');
    this.root.id = 'session-overlay';
    this.root.innerHTML = `<section id="session-card" role="dialog" aria-modal="true" aria-labelledby="session-heading">
      <h1 id="session-heading">A moment on Mars</h1><p>The game is paused. Take your time.</p>
      <div class="session-actions"><button data-action="resume" class="primary">Resume</button>
        <button data-action="save-title">Save &amp; title</button><button data-action="home">Return home</button>
        <button data-action="fullscreen">Fullscreen</button></div>
      <div class="session-help" hidden><strong>A few useful controls</strong><dl>
        <dt>WASD</dt><dd>Walk · Shift to lope · Space to jump</dd>
        <dt>E</dt><dd>Use the nearby object or vehicle</dd>
        <dt>B / Q</dt><dd>Build mode / choose a part</dd>
        <dt>T</dt><dd>Work the nearby fabricator or machine</dd>
        <dt>M / Enter</dt><dd>Map / type to VESPER</dd>
      </dl><p>Return home is available when you need a fresh start from shelter.</p></div>
      <div class="session-actions"><button data-action="orders">Mission orders</button>
        <button data-action="record">Discovery record</button><button data-action="chat">Type to VESPER</button>
        <button data-action="help">Controls</button><button data-action="feedback">Playtest feedback</button></div>
      <h2>Play your way</h2><div class="session-grid">
        <label class="toggle"><input data-setting="guidance" type="checkbox">Show next-step guidance</label>
        <label class="toggle"><input data-setting="reducedMotion" type="checkbox">Reduce camera motion</label>
        <label>Survival pressure<select data-setting="survival"><option value="gentle">Gentle</option>
          <option value="standard">Standard</option><option value="expedition">Expedition</option></select>
          <small>Choose how demanding your suit's reserves feel.</small></label>
        <label>Atmosphere preference<select data-setting="fear"><option value="gentle">Gentle</option>
          <option value="uneasy">Uneasy</option><option value="intense">Intense</option></select>
          <small>Changes underground visibility, worker density and atmosphere.</small></label>
        <label>Text size <input data-setting="textScale" type="range" min="0.9" max="1.5" step="0.1">
          <small data-value="textScale"></small></label>
        <label>Audio volume <input data-setting="volume" type="range" min="0" max="1" step="0.05">
          <small data-value="volume"></small></label>
        <label class="toggle"><input data-setting="muted" type="checkbox">Mute all audio</label>
      </div><h2>Your companion</h2>
      <p>Hold V to speak, or Enter to type. Try “crew follow me”, “crew hold position”,
        “crew resume excavation”, “recall the crew” or “release the crew”. Nearby worker
        commands still need you beside the crew; recall works from home. Direct controls remain available.</p>
      <p>VESPER's conversation is generated by an AI service and can be mistaken. Chat is optional;
        written controls and game instruments remain available.</p>
      <p id="vesper-link-status"></p>
      <p id="session-status" role="status" aria-live="polite"></p></section>`;
    document.body.append(this.toolbar, this.root);
    this.onClick = (event) => {
      event.stopPropagation();
      const button = event.target.closest('button[data-action]');
      if (button) this.action(button.dataset.action);
    };
    this.stopEvent = (event) => event.stopPropagation();
    for (const surface of [this.toolbar, this.root]) {
      surface.addEventListener('click', this.onClick);
      for (const name of ['pointerdown', 'pointerup', 'mousedown', 'mouseup',
        'touchstart', 'touchmove', 'touchend', 'wheel', 'keyup']) surface.addEventListener(name, this.stopEvent);
    }
    this.toolbar.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape') event.stopPropagation();
    });
    this.root.addEventListener('keydown', (event) => this.onKey(event));
    this.root.addEventListener('input', (event) => {
      const key = event.target.dataset.setting;
      if (!key) return;
      const value = event.target.type === 'checkbox' ? event.target.checked
        : event.target.type === 'range' ? Number(event.target.value) : event.target.value;
      this.setSettings({ ...this.settings, [key]: value });
      this.h.onSettings?.({ ...this.settings });
    });
    this.setSettings(this.settings);
  }

  setSettings(raw) {
    this.settings = normaliseSettings(raw);
    this.root.style.setProperty('--mars-text-scale', this.settings.textScale);
    for (const el of this.root.querySelectorAll('[data-setting]')) {
      if (el.type === 'checkbox') el.checked = this.settings[el.dataset.setting];
      else el.value = this.settings[el.dataset.setting];
    }
    this.root.querySelector('[data-value=textScale]').textContent = `${Math.round(this.settings.textScale * 100)}%`;
    this.root.querySelector('[data-value=volume]').textContent = `${Math.round(this.settings.volume * 100)}%`;
  }

  setPaused(paused) {
    if (paused === this.paused) return;
    this.paused = paused;
    this.root.classList.toggle('open', paused);
    if (paused) {
      this.previousFocus = document.activeElement;
      this.root.querySelector('[data-action=resume]').focus();
    } else this.h.onResumeFocus?.();
  }

  pause(paused) { this.setPaused(paused); this.h.onPause?.(paused); }
  showHelp() { this.root.querySelector('.session-help').hidden = false; this.pause(true); }

  onKey(event) {
    if (event.code === 'Escape') return; // the game owns Escape consistently
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const all = [...this.root.querySelectorAll('button,input,select')].filter((el) => !el.disabled);
    const first = all[0], last = all.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async action(name) {
    if (name === 'pause') return this.pause(true);
    if (name === 'resume') return this.pause(false);
    if (name === 'help') return this.showHelp();
    if (name === 'fullscreen') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else this.status('Fullscreen is unavailable in this browser.');
      } catch { this.status('Fullscreen was not opened. You can keep playing here.'); }
      return;
    }
    const callback = { 'save-title': 'onSaveTitle', home: 'onHome', orders: 'onOrders',
      record: 'onRecord', chat: 'onChat', feedback: 'onFeedback' }[name];
    if (!callback || !this.h[callback]) return;
    // Close the overlay before opening another panel. Root chooses whether
    // that panel keeps the simulation paused; Save/title remains paused.
    if (!['save-title', 'feedback'].includes(name)) this.pause(false);
    try { await this.h[callback](); }
    catch { this.pause(true); this.status('That action did not complete. Your session is still open.'); }
  }

  status(message) { this.root.querySelector('#session-status').textContent = message; }
  dispose() { this.toolbar.remove(); this.root.remove(); this.style.remove(); }
}
