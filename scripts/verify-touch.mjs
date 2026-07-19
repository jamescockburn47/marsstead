// verify-touch: the pure gesture->signal helpers (importing touch.js under
// Node IS the first assertion — no DOM at module level), plus source-level
// wiring checks in Moorstead's documented style (main.js boots THREE at
// import, so Node reads the text instead).

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  joystickToKeys, lookDelta, isTouchPrimary, touchMode,
  stateOf, controlsFor, MORE_ITEMS, LOOK_YAW_SENS, LOOK_PITCH_SENS,
} from '../src/touch.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// ---- joystickToKeys: dy<0 is "pushed up" = forward. radius 40.
const R = 40;
const centre = joystickToKeys(0, 0, R);
ok(!centre.KeyW && !centre.KeyA && !centre.KeyS && !centre.KeyD && !centre.ShiftLeft,
  'centre/deadzone -> nothing pressed');
ok(!joystickToKeys(0, -5, R).KeyW, 'inside deadzone (5 < 0.18*40) -> not forward');
const up = joystickToKeys(0, -20, R);
ok(up.KeyW && !up.KeyS && !up.KeyA && !up.KeyD && !up.ShiftLeft,
  'half-up -> forward only, no lope');
const fullUp = joystickToKeys(0, -40, R);
ok(fullUp.KeyW && fullUp.ShiftLeft, 'full-up (mag >= 0.85*40) -> forward + lope (ShiftLeft)');
ok(!('KeyZ' in fullUp), 'no KeyZ: Marsstead lopes on ShiftLeft, not Moorstead sprint');
const upRight = joystickToKeys(28, -28, R);
ok(upRight.KeyW && upRight.KeyD && !upRight.KeyA && !upRight.KeyS,
  'up-right -> forward + right (diagonal)');
const down = joystickToKeys(0, 30, R);
ok(down.KeyS && !down.KeyW && !down.ShiftLeft, 'pushed down -> back, never a lope');
const left = joystickToKeys(-30, 0, R);
ok(left.KeyA && !left.KeyD, 'pushed left -> KeyA (steer left in the buggy too)');

// ---- lookDelta: mirrors the mousemove contract (yaw and pitch sens differ)
const ld = lookDelta(100, 50);
ok(Math.abs(ld.dYaw - 100 * LOOK_YAW_SENS) < 1e-12
  && Math.abs(ld.dPitch - 50 * LOOK_PITCH_SENS) < 1e-12, 'lookDelta scales by the two senses');
ok(LOOK_YAW_SENS > 0.005 && LOOK_PITCH_SENS > 0.004,
  'touch look is hotter than the mouse (0.005/0.004)');

// ---- isTouchPrimary: coarse + no-hover => true; a fine pointer => false
const mmTrue = (q) => ({ matches: q.includes('coarse') || q.includes('none') });
ok(isTouchPrimary(mmTrue, { maxTouchPoints: 5 }) === true, 'coarse + no-hover -> touch primary');
ok(isTouchPrimary((q) => ({ matches: q.includes('fine') }), { maxTouchPoints: 0 }) === false,
  'fine pointer, no touch -> not primary');

// ---- touchMode: a touch device may opt on/off; a computer is auto-detect only
ok(touchMode('on', true) === true, 'mode on -> touch on a touch device');
ok(touchMode('on', false) === false, 'mode on -> NOT forced on a computer');
ok(touchMode('off', true) === false, 'mode off -> never touch');
ok(touchMode('auto', true) === true && touchMode('auto', false) === false,
  'mode auto -> follows detection');

// ---- stateOf: sleep outranks the cabin outranks the saddle outranks build
ok(stateOf({ sleeping: true, inLander: true, driving: true, buildMode: true }) === 'sleeping',
  'sleeping wins');
ok(stateOf({ inLander: true, driving: false }) === 'lander', 'the cabin');
ok(stateOf({ driving: true, buildMode: true }) === 'driving', 'the saddle beats build');
ok(stateOf({ buildMode: true }) === 'building', 'build mode');
ok(stateOf({}) === 'foot', 'on foot is the floor');

// ---- controlsFor: the context contract
const names = (s) => controlsFor(s).buttons.map((b) => b.name);
const byName = (s, name) => controlsFor(s).buttons.find((b) => b.name === name);
ok(controlsFor('sleeping').buttons.length === 0 && !controlsFor('sleeping').move,
  'sleeping shows nothing (inputs sit the night out)');
ok(!controlsFor('lander').move, 'no joystick in the cabin');
ok(byName('lander', 'do').code === 'KeyE' && byName('lander', 'view').code === 'KeyC',
  'cabin: E steps out, C is the console');
ok(names('driving').includes('jump') && byName('driving', 'jump').label === 'BRAKE'
  && byName('driving', 'jump').code === 'Space' && byName('driving', 'jump').hold,
  'driving: the Space slot is the held handbrake');
ok(!names('driving').includes('build'), 'no build toggle from the saddle (devKeys gates B too)');
ok(names('building').includes('slot') && byName('building', 'slot').code === 'KeyV',
  'build mode: KeyV is wall/roof…');
ok(!names('building').includes('talk'), '…so TALK is absent there (KeyV would collide)');
for (const s of ['foot', 'driving', 'lander']) {
  const t = byName(s, 'talk');
  ok(t && t.code === 'KeyV' && t.hold, `push-to-talk rides ${s} (VESPER by thumb, USP 1)`);
}
ok(byName('foot', 'do').code === 'KeyE' && byName('foot', 'jump').hold,
  'on foot: E is the doing key, jump is held');
ok(MORE_ITEMS.every(([, code]) => /^Key[A-Z]$/.test(code)),
  'every MORE item is a plain key dispatch (devKeys gates them)');

// ---- source-level wiring: the adapter is constructed, ticked, and speaks
// only through the keyboard's own door
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const main = readFileSync(join(SRC, 'main.js'), 'utf8');
const touch = readFileSync(join(SRC, 'touch.js'), 'utf8');
const html = readFileSync(join(SRC, '..', 'index.html'), 'utf8');
ok(/new TouchControls\(this\)/.test(main) && /this\.touch\.sync\(\)/.test(main),
  'main.js constructs and syncs the touch adapter');
ok(/this\.touch\.tick\(\)/.test(main), 'main.js ticks the adapter each frame');
ok(/dispatchEvent\(new KeyboardEvent\(type, \{ code \}\)\)/.test(touch),
  'buttons go through synthetic KeyboardEvents (devKeys owns all context)');
ok(!/import .*three/i.test(touch), 'touch.js imports no THREE (identity invariant 3)');
ok(/viewport-fit=cover/.test(html) && /user-scalable=no/.test(html),
  'index.html viewport is touch-ready (safe areas, no pinch-zoom of the page)');

console.log(`verify-touch: ${n} assertions OK`);
