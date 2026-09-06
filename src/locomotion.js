// Transient movement state, never saved. One support/flight clock is shared by
// physics and the suit. Sample the pose AFTER integration, including landing.
import { G_MARS, JUMP_V0, EASY_HOP_V0, LOPE_HOP_V0 } from './physics.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function strideState() {
  return { active: false, phase: 'support', side: -1, age: 0, cycle: 0,
    launch: 0, duration: .25, ahead: .32, distance: 0 };
}
function support(state, speed) {
  state.phase = 'support'; state.age = 0; state.distance = 0; state.cycle++;
  state.duration = Math.min(.24, .56 / Math.max(speed, 1));
  state.ahead = Math.min(.28, Math.max(.08, speed * state.duration * .5));
}
export function stepTravel(state, dt, input) {
  let { y, vy, airborne, ground, speed, moving, manualJump = false } = input;
  const wantsLope = moving && speed > 1.85;
  let seededContact = false;
  if (manualJump && !airborne) {
    state.active = false; state.phase = 'manual';
    vy = JUMP_V0; airborne = true;
  }
  if (!airborne && !state.active && wantsLope && !manualJump) {
    state.active = true; support(state, speed);
    if (input.contact) {
      seededContact = true;
      state.side = input.contact.side;
      state.distance = clamp(state.ahead - input.contact.ahead, 0, state.ahead * 1.7);
    }
  }
  if (!airborne && y - ground > .35) {
    airborne = true; vy = 0; state.active = false; state.phase = 'manual';
  }
  // Substeps bound transition error without tying motion to the render rate.
  const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  for (let i = 0; i < n; i++) {
    if (airborne) {
      const flight = ballisticStep(y, vy, h);
      state.age += h;
      if (flight.y <= ground && flight.vy < 0) {
        y = ground; vy = 0; airborne = false;
        if (state.active) { state.side *= -1; support(state, speed); }
      } else { y = flight.y; vy = flight.vy; }
    } else {
      y = ground; vy = 0;
      if (!state.active) continue;
      state.age += h;
      // A contact hint already includes this frame's resolved displacement.
      if (!seededContact) state.distance += speed * h;
      const u = Math.max(state.distance / (2 * state.ahead), state.age / .30);
      if (u >= 1) {
        if (!wantsLope) { state.active = false; continue; }
        const pace = clamp((speed - 2.5) / 3.5, 0, 1);
        state.launch = EASY_HOP_V0 + (LOPE_HOP_V0 - EASY_HOP_V0) * pace;
        state.phase = 'flight'; state.age = 0;
        vy = state.launch; airborne = true;
      }
    }
  }
  const u = state.phase === 'flight'
    ? clamp((state.launch - vy) / (2 * state.launch), 0, 1)
    : clamp(Math.max(state.distance / (2 * state.ahead), state.age / .30), 0, 1);
  return { y, vy, airborne, gait: state.active ? {
    phase: state.phase, side: state.side, u, cycle: state.cycle,
    ahead: state.ahead, distance: state.distance, launch: state.launch,
    stopping: !wantsLope,
  } : undefined };
}
export function movementEase(dt, airborne, moving) {
  return 1 - Math.exp(-dt * (airborne ? (moving ? 2.4 : 5.5) : (moving ? 9 : 14)));
}
export function ballisticStep(y, vy, dt) {
  return { y: y + vy * dt - .5 * G_MARS * dt * dt, vy: vy - G_MARS * dt };
}

// Face travel through a planted turn rather than flipping the entire skeleton
// when horizontal velocity crosses zero. Input/collision response is unchanged.
export function movementHeading(heading, vx, vz, dt) {
  const speed=Math.hypot(vx,vz);
  if (speed<.15) return heading;
  const target=Math.atan2(vx,vz);
  const delta=Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
  return heading+clamp(delta,-4.5*dt,4.5*dt);
}
