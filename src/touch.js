// touch.js — touch-screen controls for phones & tablets. An INPUT ADAPTER
// (Moorstead's pattern): it renders a DOM HUD over the canvas and speaks to
// the game ONLY through the channels the keyboard already uses — the
// joystick writes the key bus (game.keys), the look zone writes the orbit
// camera, and every button dispatches a synthetic KeyboardEvent so devKeys
// keeps owning ALL context logic (E is the doing key on foot, the dismount
// while driving, the placer in build mode — this file never re-decides
// that). The gesture->signal logic lives in pure helpers (headlessly
// tested); the class below is thin DOM glue. NO module-level DOM access —
// verify-touch.mjs imports this under Node.

const DEADZONE = 0.18;  // fraction of joystick radius below which we read no movement
const LOPE_AT = 0.85;   // fraction of radius beyond which a forward push also lopes
export const LOOK_YAW_SENS = 0.009;    // touch look (mouse is 0.005; touch wants more)
export const LOOK_PITCH_SENS = 0.0072; // touch pitch (mouse is 0.004)

// Joystick knob offset (dx,dy screen px; dy<0 = pushed up = forward) ->
// key-bus booleans. 8-way: an octant around the push angle sets one or two
// of W/A/S/D. A full forward push lopes (ShiftLeft — under 0.38 g the lope
// is the low-g bound, Marsstead's sprint). Driving reads the same keys as
// throttle/steer, so one stick serves boots and buggy alike.
export function joystickToKeys(dx, dy, radius) {
  const out = { KeyW: false, KeyA: false, KeyS: false, KeyD: false, ShiftLeft: false };
  const mag = Math.hypot(dx, dy);
  if (mag < DEADZONE * radius) return out;
  const ang = Math.atan2(-dy, dx); // -dy so "up" (negative screen y) is +90deg = forward
  const deg = (ang * 180 / Math.PI + 360) % 360;
  if (deg > 22.5 && deg < 157.5) out.KeyW = true;   // forward arc
  if (deg > 202.5 && deg < 337.5) out.KeyS = true;  // back arc
  if (deg > 112.5 && deg < 247.5) out.KeyA = true;  // left arc
  if (deg < 67.5 || deg > 292.5) out.KeyD = true;   // right arc
  if (mag >= LOPE_AT * radius && out.KeyW) out.ShiftLeft = true;
  return out;
}

// Drag delta (screen px) -> yaw/pitch deltas the caller applies exactly as
// the mousemove handler does (camYaw -= dYaw; camPitch += dPitch, clamped).
export function lookDelta(dx, dy) {
  return { dYaw: dx * LOOK_YAW_SENS, dPitch: dy * LOOK_PITCH_SENS };
}

// Is touch the PRIMARY pointer? mm = matchMedia fn, nav = navigator-like.
// Injected for tests.
export function isTouchPrimary(mm, nav) {
  const coarse = mm('(pointer: coarse)').matches;
  const noHover = mm('(hover: none)').matches;
  const fine = mm('(pointer: fine)').matches;
  if (coarse && noHover) return true;
  return (nav.maxTouchPoints || 0) > 0 && !fine;
}

// Resolve the stored mode ('auto'|'on'|'off') against detection. A touch
// device may opt out ('off'); a COMPUTER (non-touch-primary) is auto-detect
// ONLY — a stored 'on' can't force the HUD on, so a stray setting never
// lumbers a desktop player with on-screen sticks.
export function touchMode(stored, isPrimary) {
  if (stored === 'off') return false;
  if (stored === 'on') return !!isPrimary; // 'on' is honoured only on a touch device
  return !!isPrimary;                      // auto
}

// The game's shape -> one control-state word. Marsstead has no formal state
// machine (flags on the Game), so this is the touch HUD's read of it.
export function stateOf(f) {
  if (f.sleeping) return 'sleeping';
  if (f.inLander) return 'lander';
  if (f.driving) return 'driving';
  if (f.buildMode) return 'building';
  return 'foot';
}

// Which controls a state shows — pure data the DOM glue renders. Every
// button carries the KeyboardEvent code it dispatches; hold buttons keep
// the key down for as long as the thumb does (jump, the handbrake, and
// push-to-talk — VESPER must be reachable by thumb, she's USP 1). TALK is
// absent in build mode because KeyV means wall/roof there.
export function controlsFor(state) {
  if (state === 'sleeping') return { move: false, look: false, buttons: [] };
  if (state === 'lander') {
    return {
      move: false, look: false, buttons: [
        { name: 'do', label: 'STEP OUT', code: 'KeyE' },
        { name: 'view', label: 'CONSOLE', code: 'KeyC' },
        { name: 'sleep', label: 'SLEEP', code: 'KeyR' },
        { name: 'talk', label: 'TALK', code: 'KeyV', hold: true },
        { name: 'map', label: 'MAP', code: 'KeyM' },
      ],
    };
  }
  if (state === 'driving') {
    return {
      move: true, look: true, buttons: [
        { name: 'do', label: 'LEAVE', code: 'KeyE' },
        { name: 'jump', label: 'BRAKE', code: 'Space', hold: true },
        { name: 'view', label: 'VIEW', code: 'KeyC' },
        { name: 'talk', label: 'TALK', code: 'KeyV', hold: true },
        { name: 'map', label: 'MAP', code: 'KeyM' },
        { name: 'more', label: 'MORE' },
      ],
    };
  }
  if (state === 'building') {
    return {
      move: true, look: true, buttons: [
        { name: 'do', label: 'PLACE', code: 'KeyE' },
        { name: 'jump', label: 'JUMP', code: 'Space', hold: true },
        { name: 'part', label: 'PART', code: 'KeyQ' },
        { name: 'slot', label: 'WALL·ROOF', code: 'KeyV' },
        { name: 'remove', label: 'CLEAR', code: 'KeyX' },
        { name: 'build', label: 'DONE', code: 'KeyB' },
      ],
    };
  }
  return {
    move: true, look: true, buttons: [
      { name: 'do', label: 'DO', code: 'KeyE' },
      { name: 'jump', label: 'JUMP', code: 'Space', hold: true },
      { name: 'talk', label: 'TALK', code: 'KeyV', hold: true },
      { name: 'map', label: 'MAP', code: 'KeyM' },
      { name: 'build', label: 'BUILD', code: 'KeyB' },
      { name: 'more', label: 'MORE' },
    ],
  };
}

// The MORE panel: rarer verbs, one tap each (the panel closes after). Every
// one is a plain key dispatch — devKeys gates them by distance and state,
// exactly as it does for the keyboard.
export const MORE_ITEMS = [
  ['Sleep till dawn', 'KeyR'],
  ['Lamp', 'KeyL'],
  ['Hitch · unhitch the rig', 'KeyH'],
  ['Fabricate', 'KeyT'],
  ['Load the rover', 'KeyF'],
  ['Take one off the rover', 'KeyG'],
  ['Next salvage part', 'KeyQ'],
  ['Pack up the rig', 'KeyX'],
];

const MODE_KEY = 'marsstead-touch'; // localStorage: 'auto' | 'on' | 'off'

// The HUD's dress: Marsstead's registers — Georgia serif, bone text,
// butterscotch-gold accents, the dark of the night side. Injected once at
// first build (no module-level DOM).
const CSS = `
  html.touch canvas { touch-action: none; }
  html.touch body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; }
  #touchHud { position: fixed; inset: 0; z-index: 40; pointer-events: none;
    touch-action: none; font-family: Georgia, 'Times New Roman', serif; }
  #touchHud > * { pointer-events: auto; }
  .touch-zone { position: absolute; bottom: 0; touch-action: none; }
  .touch-move { left: 0; width: 42%; height: 60%; }
  .touch-look { right: 0; width: 58%; height: 70%; }
  .touch-move::before { content: ''; position: absolute;
    left: var(--jx, calc(env(safe-area-inset-left) + 92px));
    top: var(--jy, calc(100% - env(safe-area-inset-bottom) - 96px));
    width: 108px; height: 108px; margin: -54px 0 0 -54px; border-radius: 50%;
    border: 2px solid rgba(246,237,226,.4); background: rgba(246,237,226,.06); }
  .touch-knob { position: absolute;
    left: var(--jx, calc(env(safe-area-inset-left) + 92px));
    top: var(--jy, calc(100% - env(safe-area-inset-bottom) - 96px));
    width: 42px; height: 42px; margin: -21px 0 0 -21px; border-radius: 50%;
    background: rgba(246,237,226,.75); }
  .touch-btn { position: absolute; width: 62px; height: 62px; border-radius: 50%;
    border: 1.5px solid rgba(246,237,226,.55); background: rgba(23,10,6,.42);
    color: #f6ede2; font: 10px/1.2 Georgia, serif; letter-spacing: 2px;
    touch-action: none; text-shadow: 0 1px 3px rgba(20,8,4,.9); padding: 0; }
  .touch-btn:active { background: rgba(232,196,106,.28); }
  .touch-btn[data-touch=do] { width: 76px; height: 76px; font-size: 12px;
    right: calc(env(safe-area-inset-right) + 16px);
    bottom: calc(env(safe-area-inset-bottom) + 104px);
    border-color: rgba(232,196,106,.75); color: #e8c46a; }
  .touch-btn[data-touch=jump] { right: calc(env(safe-area-inset-right) + 104px);
    bottom: calc(env(safe-area-inset-bottom) + 118px); }
  .touch-btn[data-touch=talk] { right: calc(env(safe-area-inset-right) + 104px);
    bottom: calc(env(safe-area-inset-bottom) + 34px);
    border-color: rgba(232,196,106,.6); color: #e8c46a; }
  .touch-btn[data-touch=talk].listening { background: rgba(232,196,106,.4); color: #170a06; }
  .touch-btn[data-touch=view], .touch-btn[data-touch=sleep] {
    width: 54px; height: 54px;
    right: calc(env(safe-area-inset-right) + 22px);
    bottom: calc(env(safe-area-inset-bottom) + 32px); }
  .touch-btn[data-touch=part] { right: calc(env(safe-area-inset-right) + 104px);
    bottom: calc(env(safe-area-inset-bottom) + 34px); }
  .touch-btn[data-touch=slot] { right: calc(env(safe-area-inset-right) + 22px);
    bottom: calc(env(safe-area-inset-bottom) + 28px); width: 58px; height: 58px; }
  .touch-btn[data-touch=remove] { right: calc(env(safe-area-inset-right) + 186px);
    bottom: calc(env(safe-area-inset-bottom) + 34px);
    border-color: rgba(209,104,90,.7); color: #d1685a; }
  .touch-btn.top { top: calc(env(safe-area-inset-top) + 10px); width: 54px;
    height: 42px; border-radius: 9px; }
  .touch-btn[data-touch=map] { left: calc(50% - 88px); }
  .touch-btn[data-touch=build] { left: calc(50% - 27px); }
  .touch-btn[data-touch=more] { left: calc(50% + 34px); }
  .touch-more { position: absolute; left: 50%; transform: translateX(-50%);
    top: calc(env(safe-area-inset-top) + 60px); width: 232px; max-height: 62%;
    overflow: auto; display: none; flex-direction: column; gap: 6px;
    padding: 10px; border-radius: 10px; background: rgba(23,10,6,.93);
    border: 1px solid rgba(232,196,106,.4); }
  .touch-more.open { display: flex; }
  .touch-more-item { min-height: 42px; border-radius: 7px;
    border: 1px solid rgba(246,237,226,.25); background: rgba(246,237,226,.07);
    color: #f6ede2; font: 12px/1.2 Georgia, serif; letter-spacing: 1px; }
  /* narrow (portrait phone): the centred top row would sit on the sol
     clock — drop it below the clock, left-aligned, and the panel with it */
  @media (max-width: 520px) {
    .touch-btn.top { top: calc(env(safe-area-inset-top) + 74px); }
    .touch-btn[data-touch=map] { left: calc(env(safe-area-inset-left) + 10px); }
    .touch-btn[data-touch=build] { left: calc(env(safe-area-inset-left) + 70px); }
    .touch-btn[data-touch=more] { left: calc(env(safe-area-inset-left) + 130px); }
    .touch-more { left: calc(env(safe-area-inset-left) + 10px); transform: none;
      top: calc(env(safe-area-inset-top) + 124px); }
    /* VESPER's line and the prompt climb clear of the thumb clusters */
    html.touch #hud .vesper { bottom: 196px; }
    html.touch #hud .prompt { bottom: 252px; }
  }
`;

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.root = null;
    this.zones = {};
    this.btns = {};
    this._state = null;
    try { this._mode = localStorage.getItem(MODE_KEY) || 'auto'; } catch { this._mode = 'auto'; }
    // ?touch forces the HUD on any device — the dev loop and the live
    // checks drive it from a desktop browser
    this._forced = new URLSearchParams(location.search).has('touch');
  }

  wanted() {
    if (this._forced) return true;
    const primary = isTouchPrimary((q) => matchMedia(q), navigator);
    return touchMode(this._mode, primary);
  }

  cycleMode() { // live-handle lever: auto -> on -> off -> auto
    this._mode = this._mode === 'auto' ? 'on' : this._mode === 'on' ? 'off' : 'auto';
    try { localStorage.setItem(MODE_KEY, this._mode); } catch { /* session only */ }
    this.sync();
    return this._mode;
  }

  // Build (or tear down) the HUD to match wanted(). Idempotent.
  sync() {
    if (this.wanted() && !this.active) this._build();
    else if (!this.wanted() && this.active) this._destroy();
  }

  // Per-frame hook (from game.frame). Cheap; only rebuilds on state change.
  tick() {
    if (!this.active) return;
    const g = this.game;
    const state = stateOf({
      sleeping: !!g.sleepAnim, inLander: !!g.inLander,
      driving: !!g.driving, buildMode: !!g.buildMode,
    });
    if (state !== this._state) this._setState(state);
    // the TALK button mirrors the mic (onend can drop it without a keyup)
    if (this.btns.talk) this.btns.talk.classList.toggle('listening', !!g.voice?.listening);
  }

  _build() {
    this.active = true;
    if (!document.getElementById('touchCss')) {
      const style = document.createElement('style');
      style.id = 'touchCss';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    document.documentElement.classList.add('touch');
    const root = document.createElement('div');
    root.id = 'touchHud';
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.appendChild(root);
    this.root = root;
    this._buildMove();
    this._buildLook();
    this._buildMore();
    this._state = null; // force the first _setState to lay out buttons
  }

  _destroy() {
    this.active = false;
    document.documentElement.classList.remove('touch');
    if (this.root) { this.root.remove(); this.root = null; }
    this.zones = {}; this.btns = {}; this._more = null; this._state = null;
    this._clearMoveKeys();
  }

  _clearMoveKeys() {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) {
      this.game.keys[k] = false;
    }
  }

  // one door to the game: the same events the keyboard sends
  _key(type, code) {
    dispatchEvent(new KeyboardEvent(type, { code }));
  }

  // Lay the buttons out for a state. Buttons are cheap — rebuild the set
  // rather than juggling hidden flags across four states.
  _setState(state) {
    this._state = state;
    const spec = controlsFor(state);
    for (const b of Object.values(this.btns)) b.remove();
    this.btns = {};
    this.zones.move.style.display = spec.move ? '' : 'none';
    this.zones.look.style.display = spec.look ? '' : 'none';
    if (!spec.move) this._clearMoveKeys();
    if (this._more) this._more.classList.remove('open');
    for (const c of spec.buttons) {
      const b = document.createElement('button');
      b.className = 'touch-btn' + (['map', 'build', 'more'].includes(c.name) ? ' top' : '');
      b.dataset.touch = c.name;
      b.textContent = c.label;
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      if (c.name === 'more') {
        b.addEventListener('touchstart', (e) => { e.preventDefault(); this._more.classList.toggle('open'); }, { passive: false });
      } else {
        // down->keydown, up->keyup: taps and holds share one shape, and
        // the real keydown listener gives us voice.poke (the audio
        // unlock browsers demand) for free
        b.addEventListener('touchstart', (e) => { e.preventDefault(); this._key('keydown', c.code); }, { passive: false });
        const up = (e) => { e.preventDefault(); this._key('keyup', c.code); };
        b.addEventListener('touchend', up);
        b.addEventListener('touchcancel', up);
      }
      this.root.appendChild(b);
      this.btns[c.name] = b;
    }
  }

  _buildMove() {
    const z = document.createElement('div');
    z.className = 'touch-zone touch-move';
    this.root.appendChild(z);
    this.zones.move = z;
    const knob = document.createElement('div');
    knob.className = 'touch-knob';
    z.appendChild(knob);
    let id = null, ox = 0, oy = 0;
    const RADIUS = 54; // px the knob can travel
    const setKeys = (k) => {
      const g = this.game;
      for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) g.keys[key] = !!k[key];
    };
    const clear = () => {
      id = null; knob.style.transform = 'translate(0,0)'; setKeys({});
      z.style.removeProperty('--jx'); z.style.removeProperty('--jy'); // stick drifts home
    };
    z.addEventListener('touchstart', (e) => {
      if (id !== null) return;
      const t = e.changedTouches[0]; id = t.identifier; ox = t.clientX; oy = t.clientY;
      // float the ring+knob to the thumb: the stick is wherever it was grabbed
      const rect = z.getBoundingClientRect();
      z.style.setProperty('--jx', `${t.clientX - rect.left}px`);
      z.style.setProperty('--jy', `${t.clientY - rect.top}px`);
      this.game.voice?.poke(); // any gesture may be the audio unlock
      e.preventDefault();
    }, { passive: false });
    z.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const m = Math.hypot(dx, dy);
        if (m > RADIUS) { dx *= RADIUS / m; dy *= RADIUS / m; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        setKeys(joystickToKeys(dx, dy, RADIUS));
        e.preventDefault();
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) clear(); };
    z.addEventListener('touchend', end);
    z.addEventListener('touchcancel', end);
  }

  _buildLook() {
    const z = document.createElement('div');
    z.className = 'touch-zone touch-look';
    this.root.appendChild(z);
    this.zones.look = z;
    let id = null, lx = 0, ly = 0;
    z.addEventListener('touchstart', (e) => {
      if (id !== null) return;
      const t = e.changedTouches[0]; id = t.identifier; lx = t.clientX; ly = t.clientY;
      this.game.voice?.poke();
      e.preventDefault();
    }, { passive: false });
    z.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        const { dYaw, dPitch } = lookDelta(t.clientX - lx, t.clientY - ly);
        lx = t.clientX; ly = t.clientY;
        const g = this.game;
        g.camYaw -= dYaw; // the mousemove contract, verbatim
        g.camPitch = Math.max(0.05, Math.min(1.2, g.camPitch + dPitch));
        e.preventDefault();
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) id = null; };
    z.addEventListener('touchend', end);
    z.addEventListener('touchcancel', end);
  }

  _buildMore() {
    const panel = document.createElement('div');
    panel.className = 'touch-more';
    this.root.appendChild(panel);
    this._more = panel;
    for (const [label, code] of MORE_ITEMS) {
      const b = document.createElement('button');
      b.className = 'touch-more-item';
      b.textContent = label;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._key('keydown', code);
        this._key('keyup', code);
        panel.classList.remove('open');
      }, { passive: false });
      panel.appendChild(b);
    }
  }
}
