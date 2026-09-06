// Mars physics — pure, no THREE, no DOM. verify-physics.mjs guards it.
//
// One constant, one implementation (DESIGN.md, the 0.38 g pillar): the
// player, thrown matter, vehicles and one day the hopper all integrate
// against G_MARS through these functions. If low gravity ever stops feeling
// like Mars, the bug is here and nowhere else.

export const G_MARS = 3.72076;   // m/s^2 — the planet's one great constant
export const G_EARTH = 9.80665;  // m/s^2 — for the comparisons VESPER makes

// --- ballistics -------------------------------------------------------------

// apex height of a vertical launch (m)
export function jumpApex(v0, g = G_MARS) { return (v0 * v0) / (2 * g); }

// total hang time of a vertical launch returning to launch height (s)
export function hangTime(v0, g = G_MARS) { return (2 * v0) / g; }

// range of a ballistic hop at launch angle (rad) over flat ground (m).
// Thin air: no drag term, on purpose — Mars's air is ~0.6% of Earth's and
// the game rounds that to zero for anything heavier than dust.
export function hopRange(v0, angleRad, g = G_MARS) {
  return (v0 * v0 * Math.sin(2 * angleRad)) / g;
}

// impact speed after falling h metres from rest (m/s)
export function fallSpeed(h, g = G_MARS) { return Math.sqrt(2 * g * h); }

// --- the suit's ledger ------------------------------------------------------

// Falls are survivable — that is the design (DESIGN.md, blackout rule).
// Severity in [0..1]: 0 below a soft landing, 1 at the hardest the game
// deals (a stumble + suit wear, never death). An Earth-lethal impact speed
// (~12 m/s, a 7 m Earth drop) maps to severity 1; on Mars that takes a
// ~19 m fall — and costs you a fright, not a life.
export const SOFT_LANDING = 6;   // m/s — under this, no note taken
export const HARD_LANDING = 12;  // m/s — severity saturates here
export function fallSeverity(impactSpeed) {
  const t = (Math.abs(impactSpeed) - SOFT_LANDING) / (HARD_LANDING - SOFT_LANDING);
  return Math.max(0, Math.min(1, t));
}

// --- the bound (how walking feels) ------------------------------------------

// The EVA stride is a low, floating bound: same muscles, a third of the
// pull. Stride length stretches vs Earth by roughly the g-ratio's benefit
// on the ballistic phase; the numbers below are the tuned feel Phase 0
// gates on, expressed as pure data so the walker and the verify agree.
export const HABITAT_WALK_SPEED = 1.55; // precise movement around furnishings
export const WALK_SPEED = 2.5;    // m/s — an easy outdoor lope
export const LOPE_SPEED = 6.0;    // m/s — the bounding run
export const JUMP_V0 = 2.3;       // m/s — an honest suited jump (apex ~0.71 m,
                                  // hang ~1.24 s). Mars is 0.38 g, NOT the
                                  // Moon's 0.17: the read is "springy", never
                                  // "floating". Tuned down from 3.2 after the
                                  // playtest read as exaggerated moon-jumping.
export const LOPE_HOP_V0 = 1.03; // max travelling push; .143 m apex, .554 s flight
export const EASY_HOP_V0 = .70;  // .066 m apex; alternating low travelling steps

// --- integration ------------------------------------------------------------

// one Euler step of a vertical velocity under Mars gravity — the single
// line every jumping/falling thing in the game shares
export function fallStep(vy, dt, g = G_MARS) { return vy - g * dt; }
