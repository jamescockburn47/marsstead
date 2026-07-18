// The towed trailer — pure hitch kinematics, no THREE, no DOM.
// verify-trailer.mjs guards it. PHASE2, James's call: the mining machine
// rides a towed trailer and THE TOWING IS THE SKILL. The model is the
// honest kinematic tow: the axle chases the hitch pin at fixed drawbar
// length, which gives real cut-in on corners for free; articulation is
// tracked so sway (big hitch angle at speed) and the jackknife (the pin's
// geometric limit, mostly earned while reversing) fall out as flags, not
// scripts.

export const DRAWBAR = 2.7;          // m, hitch pin to trailer axle
export const JACKKNIFE_RAD = 1.15;   // pushed past this, the pin shears
export const FOLD_RAD = 2.5;         // pulled past this, frames touch — shear
export const SWAY_RAD = 0.45;        // articulation that reads as sway...
export const SWAY_SPEED = 7;         // ...once you carry this much speed

export function createTrailer(x, z, heading = 0) {
  return { x, z, heading };
}

const wrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

// one step behind the pin at (hx, hz); towHeading/u are the tractor's.
// returns { phi, sway, jackknife } — phi is the signed hitch angle.
export function stepTrailer(t, hx, hz, towHeading, u, dt) {
  const dx = hx - t.x, dz = hz - t.z;
  const dist = Math.hypot(dx, dz);

  if (dist >= DRAWBAR * 0.999) {
    // pulled: the axle turns toward the pin and trails it at drawbar length
    t.heading = Math.atan2(dx, dz);
    t.x = hx - Math.sin(t.heading) * DRAWBAR;
    t.z = hz - Math.cos(t.heading) * DRAWBAR;
  } else if (dist < DRAWBAR * 0.98) {
    // pushed (reversing): the drawbar is rigid — the trailer backs along
    // its OWN heading while the articulation does whatever geometry says
    const back = DRAWBAR - dist;
    t.x -= Math.sin(t.heading) * back;
    t.z -= Math.cos(t.heading) * back;
  }

  const phi = wrap(towHeading - t.heading);
  // the jackknife is a PUSHED failure: pulling self-straightens (a tractor
  // can drag a trailer out of full articulation), reversing folds it. The
  // only pulled shear is the geometric fold — frame against frame.
  return {
    phi,
    sway: Math.abs(phi) > SWAY_RAD && Math.abs(u) > SWAY_SPEED,
    jackknife: (u < -0.4 && Math.abs(phi) > JACKKNIFE_RAD)
      || Math.abs(phi) > FOLD_RAD,
  };
}
