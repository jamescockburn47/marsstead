// Only the playfield suppresses accidental drag/context gestures. Fullscreen is optional.
export function installKiosk() {
  document.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'CANVAS') e.preventDefault();
  });
  document.addEventListener('dragstart', e => {
    if (e.target.tagName === 'CANVAS') e.preventDefault();
  });
}
