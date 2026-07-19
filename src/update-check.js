// Client version-check + in-app update prompt, ported from Moorstead.
//
// One source of truth: package.json "version" (semver). The build bakes that into
// the client as __APP_VERSION__ (see vite.config.js `define`) and emits a fresh
// version.json into the deploy ({ version, min }). A running client fetches
// version.json (cache-busted) and compares it against its own baked version:
//
//   Silent  — versions match: do nothing. (A routine deploy that did NOT bump
//             "version" is invisible; users still pick up the new code on their
//             next natural reload, because index.html revalidates + assets are
//             hash-busted. This is the whole point — little changes mustn't nag.)
//   Notify  — deployed version is AHEAD of ours: a dismissible toast ("a new
//             version is ready — tap to reload"); tap → location.reload().
//   Force   — our version is BELOW the deployed `min`: a brief "updating…" notice
//             then an automatic location.reload(), for breaking changes only.
//
// Marsstead has no shared toast system (the HUD is textContent-only), so the
// toast here is self-contained: its own container + injected CSS, styled to the
// HUD's look. All text is set via textContent (the escHtml discipline).

// Baked at build time by Vite's define. Guarded with typeof so this module is
// also importable headless (the verify script imports cmp/decideUpdate, where
// __APP_VERSION__ is not defined).
const RUNNING = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : '0.0.0';

// Semver compare: -1 if a<b, 0 if equal, 1 if a>b. Numeric per dotted segment
// (so 1.10.0 > 1.2.0), tolerant of differing segment counts and a leading 'v'.
export function cmp(a, b) {
  const parse = (s) => String(s).trim().replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a), pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

// Pure tier decision (no DOM, no fetch) so it can be unit-tested.
//   running — the client's baked version
//   info    — { version, min } parsed from version.json
// → 'force' | 'notify' | 'none'
export function decideUpdate(running, info) {
  if (!info || typeof info !== 'object') return 'none';
  // Force: we're below the explicit floor the deploy demands (breaking change).
  // Only an explicit `min` forces a reload — a missing min is never a hard floor,
  // it just means "no breaking change", so we fall through to the Notify check.
  if (info.min && cmp(running, info.min) < 0) return 'force';
  // Notify: a newer version is live than the one we're running.
  if (info.version && cmp(running, info.version) < 0) return 'notify';
  return 'none';
}

const CSS = `
  #update-toasts { position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
    z-index: 40; display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: #f6ede2; font-family: Georgia, 'Times New Roman', serif;
    text-shadow: 0 1px 4px rgba(20,8,4,.85); }
  #update-toasts .toast { display: flex; align-items: center; gap: 10px;
    background: rgba(23,10,6,.92); border: 1px solid #e8c46a; border-radius: 5px;
    padding: 7px 16px; font-size: 14px; letter-spacing: .4px; cursor: pointer;
    pointer-events: auto; animation: update-toast-in .25s ease-out; }
  #update-toasts .toast:hover { background: rgba(232,196,106,.14); }
  #update-toasts .toast b { color: #e8c46a; font-weight: normal; }
  #update-toasts .toast.quiet { cursor: default; }
  #update-toasts .update-x { flex: none; margin-left: 2px; width: 20px; height: 20px;
    line-height: 18px; padding: 0; border-radius: 4px; cursor: pointer;
    background: rgba(10,5,3,.4); border: 1px solid rgba(246,237,226,.3);
    color: #f6ede2; font-size: 15px; font-family: inherit; }
  #update-toasts .update-x:hover { color: #e8c46a; border-color: #e8c46a; }
  @keyframes update-toast-in { from { opacity: 0; transform: translateY(-8px); } }
`;

// Lazily create the toast container (+ its CSS) on first use.
function toastBox() {
  let box = document.getElementById('update-toasts');
  if (box) return box;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  box = document.createElement('div');
  box.id = 'update-toasts';
  document.body.appendChild(box);
  return box;
}

// Wire the live check. Idempotent; safe to call once at boot.
let state = null;
export function startUpdateCheck() {
  if (state || typeof document === 'undefined') return state;
  state = { running: RUNNING, notified: false, forcing: false, checking: false };

  const reload = () => { try { location.reload(); } catch { /* nothing to do */ } };

  const onForce = () => {
    if (state.forcing) return;
    state.forcing = true;
    // Brief notice, then auto-reload — for breaking changes only.
    const t = document.createElement('div');
    t.className = 'toast quiet';
    const msg = document.createElement('span');
    msg.textContent = 'Marsstead has updated — reloading…';
    t.appendChild(msg);
    toastBox().appendChild(t);
    setTimeout(reload, 2000);
  };

  const onNotify = () => {
    if (state.notified || state.forcing) return; // once per session; don't re-spam
    state.notified = true;
    // A tappable toast. Tap reloads; the × dismisses for the rest of the session.
    const t = document.createElement('div');
    t.className = 'toast';
    const msg = document.createElement('span');
    msg.textContent = 'A new version of Marsstead is ready — ';
    const tap = document.createElement('b');
    tap.textContent = 'tap to reload';
    msg.appendChild(tap);
    const close = document.createElement('button');
    close.className = 'update-x';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.onclick = (e) => { e.stopPropagation(); t.remove(); };
    t.appendChild(msg);
    t.appendChild(close);
    t.onclick = reload;
    toastBox().appendChild(t);
  };

  const check = async () => {
    if (state.checking || state.forcing) return; // no overlap; once forcing, we're done
    state.checking = true;
    try {
      const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return; // 404 on the dev server (no version.json emitted) — stay silent
      const info = await res.json();
      const tier = decideUpdate(state.running, info);
      if (tier === 'force') onForce();
      else if (tier === 'notify') onNotify();
    } catch { /* network blip / offline / bad JSON — silent, try again next tick */ }
    finally { state.checking = false; }
  };

  // Check when the tab comes back to the foreground (a backgrounded tab is the
  // commonest stale client) and on a slow heartbeat (~15 min) for tabs left open.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  state.timer = setInterval(check, 15 * 60 * 1000);

  // A first check shortly after boot, so an already-stale open tab learns quickly
  // without racing the rest of start-up.
  setTimeout(check, 8000);

  return state;
}
