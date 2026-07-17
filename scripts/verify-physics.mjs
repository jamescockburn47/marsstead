// verify-physics: 0.38 g is the pillar — hold its numbers.

import {
  G_MARS, G_EARTH, jumpApex, hangTime, hopRange, fallSpeed, fallSeverity,
  fallStep, strideBob, JUMP_V0, WALK_SPEED, LOPE_SPEED,
} from '../src/physics.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// the constant itself — the one number the whole pillar hangs on
check('G_MARS is Mars', Math.abs(G_MARS - 3.72076) < 1e-6);
check('g ratio ~ 0.379', Math.abs(G_MARS / G_EARTH - 0.3794) < 0.001);

// closed-form ballistics
check('apex v0^2/2g', Math.abs(jumpApex(3.2) - (3.2 * 3.2) / (2 * G_MARS)) < 1e-12);
check('suit jump apex ~1.38 m', Math.abs(jumpApex(JUMP_V0) - 1.376) < 0.01, `${jumpApex(JUMP_V0)}`);
check('same jump on Earth ~0.52 m', Math.abs(jumpApex(JUMP_V0, G_EARTH) - 0.522) < 0.01);
check('Mars jump ~2.64x Earth jump', Math.abs(jumpApex(3, G_MARS) / jumpApex(3, G_EARTH) - G_EARTH / G_MARS) < 1e-9);
check('hang time 2v0/g', Math.abs(hangTime(JUMP_V0) - (2 * JUMP_V0) / G_MARS) < 1e-12);
check('45deg hop range v0^2/g', Math.abs(hopRange(10, Math.PI / 4) - 100 / G_MARS) < 1e-9);

// integration agrees with the closed form: simulate the jump
{
  let y = 0, vy = JUMP_V0, apex = 0;
  const dt = 1 / 1000;
  for (let i = 0; i < 4000 && y >= 0; i++) {
    vy = fallStep(vy, dt);
    y += vy * dt;
    apex = Math.max(apex, y);
  }
  check('Euler apex matches closed form', Math.abs(apex - jumpApex(JUMP_V0)) < 0.01, `${apex}`);
}

// falls are survivable by design: severity bounded, never lethal
check('soft landing free', fallSeverity(fallSpeed(3)) === 0);
check('19 m Mars fall = severity ~1', fallSeverity(fallSpeed(19.4)) > 0.99);
check('severity clamps at 1', fallSeverity(1000) === 1);

// the gait table is ordered and the bob envelope bounded
check('lope beats walk', LOPE_SPEED > WALK_SPEED);
check('bob grows with speed', strideBob(LOPE_SPEED) > strideBob(WALK_SPEED));
check('bob bounded', strideBob(999) <= 0.2 && strideBob(0) >= 0.03);

if (failed) { console.error(`verify-physics: ${failed} FAILED`); process.exit(1); }
console.log('verify-physics: all green');
