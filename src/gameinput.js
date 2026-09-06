// A single world-input boundary. UI clicks never orbit the camera or place parts.
export function installGameInput(game) {
  const blocked = () => game.paused || game.orders.visible || game.map.visible
    || game.journalUI.visible || game.burrowUI.visible || game.worksUI.visible
    || game.weatherSession?.visible || game.crew?.visible || game.hopUI.visible || game.fieldUI?.visible || game.under?.ui.visible || game.chatBar.style.display === 'block';
  const clear = () => {
    game.keys = {}; game.touch?._clearMoveKeys?.(); game.touchStick = null;
    game.voice.stopListening(); game.hud.setEar(false);
  };
  game.clearInput = clear;
  game.renderer.domElement.tabIndex = -1;
  game.focusWorld = () => game.renderer.domElement.focus({ preventScroll: true });
  const closePanel = () => {
    for (const panel of [game.weatherSession, game.crew, game.under?.ui, game.fieldUI, game.burrowUI, game.worksUI, game.hopUI, game.orders, game.map, game.journalUI]) {
      if (panel?.visible) { panel.close ? panel.close() : panel.toggle(); game.focusWorld(); return true; }
    }
    return false;
  };
  addEventListener('keydown', e => {
    if (game.attract || document.activeElement === game.chatBar) return;
    if (e.code === 'Escape') {
      e.preventDefault(); clear();
      if (!closePanel()) game.experience?.pause(!game.paused);
      return;
    }
    const tag = e.target?.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) return;
    if (game.paused) return;
    if (e.code === 'Enter' && !blocked() && !game.buildMode) {
      e.preventDefault(); game.experience?.openChat(); return;
    }
    if (blocked()) {
      if (!e.repeat && ['KeyO', 'KeyM', 'KeyJ', 'KeyE'].includes(e.code)) {
        if ((e.code === 'KeyO' && game.orders.visible) || (e.code === 'KeyM' && game.map.visible)
          || (e.code === 'KeyJ' && game.journalUI.visible) || e.code === 'KeyE') closePanel();
      }
      return;
    }
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    game.keys[e.code] = true; game.voice.poke();
    if (!e.repeat) game.devKeys(e);
    if (blocked()) clear();
  });
  addEventListener('keyup', e => {
    game.keys[e.code] = false;
    if (e.code === 'KeyV') { game.voice.stopListening(); game.hud.setEar(false); }
  });
  addEventListener('blur', clear);
  let dragging = false;
  game.renderer.domElement.addEventListener('pointerdown', e => {
    if (!game.attract && !blocked() && e.button === 0) { dragging = true; game.focusWorld(); }
  });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointercancel', () => { dragging = false; clear(); });
  addEventListener('mousemove', e => {
    if (!dragging || blocked()) return;
    game.camYaw -= e.movementX * 0.005;
    game.camPitch = Math.max(0.05, Math.min(1.2, game.camPitch + e.movementY * 0.004));
  });
}
