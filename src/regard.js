// Regard — the hidden partnership score. Pure, no THREE, no DOM.
// verify-regard.mjs guards it. OVERVIEW §6: across the whole game a
// hidden score weighs not politeness but PARTNERSHIP — plans shared
// before acting, her questions answered, her errors corrected
// (accountability being what equals get), labour divided, advice engaged
// with and sometimes overruled with reasons. The vending-machine player
// and the passive player both score low.
//
// The score NEVER changes her duty — only her warmth (a single felt word
// in the prompt) and, once a season, the coarse official Pairing Review
// from White Harbour: EXEMPLARY / SUFFICIENT / UNDER REVIEW. Never shown
// as a number anywhere the player can see.
//
// Signals are collaboration-shaped and zero-token where possible (the
// game detects them mechanically); the ~5-token [P]/[N]/[D] tag the
// model appends per exchange (vesperbrain.splitPairingTag) carries the
// semantic ones. Everything clamps; nothing is ever terminal.

export const REGARD_START = 52;          // a new pairing: unproven, not cold
export const SIGNALS = {
  'tag-P': 2.2,     // the exchange was partnership-shaped (model-judged)
  'tag-N': 0.3,     // talked, at least — presence is worth a little
  'tag-D': -1.4,    // used as a vending machine
  consulted: 1.6,   // talked to her shortly before committing a plan
  answered: 2.0,    // her question got an answer
  company: 2.4,     // kept her company in the dark hours
  correction: 2.0,  // corrected her error — what equals get
};
// silence decay: sols with no exchange drift the score toward DRIFT_FLOOR
// — the passive player scores low without ever being punished by an event
export const DRIFT_FLOOR = 35;
export const DRIFT_PER_SOL = 1.3;
// review thresholds — coarse on purpose: an official rubber stamp, not
// a friendship meter
export const REVIEW_BANDS = [
  [68, 'EXEMPLARY'],
  [44, 'SUFFICIENT'],
  [0, 'UNDER REVIEW'],
];

export function createRegard() {
  return { score: REGARD_START, lastTalkSol: 0 };
}

export function applySignal(r, kind) {
  const delta = SIGNALS[kind];
  if (delta === undefined) return false;
  r.score = Math.max(0, Math.min(100, r.score + delta));
  return true;
}

export function noteTalk(r, sol) {
  r.lastTalkSol = Math.max(r.lastTalkSol, Math.floor(sol));
}

// called once per sol boundary (or with fractional dSol): quiet sols pull
// toward the floor; a score below the floor is never pulled UP by silence
export function decay(r, sol) {
  const quiet = Math.floor(sol) - r.lastTalkSol;
  if (quiet <= 1) return;
  if (r.score > DRIFT_FLOOR) {
    r.score = Math.max(DRIFT_FLOOR, r.score - DRIFT_PER_SOL);
  }
}

// the single felt word the prompt may carry (vesperbrain STATE_FIELDS
// .pairing): warmth only, never duty
export function tone(r) {
  return r.score >= 68 ? 'warm' : r.score >= 44 ? 'easy' : 'thin';
}

// the seasonal Pairing Review's verdict — coarse, official, from White
// Harbour (an instrument-channel milestone, not her voice)
export function verdict(r) {
  for (const [min, word] of REVIEW_BANDS) if (r.score >= min) return word;
  return 'UNDER REVIEW';
}

export function serializeRegard(r) {
  return { score: +r.score.toFixed(2), lastTalkSol: r.lastTalkSol };
}
export function deserializeRegard(raw) {
  const r = createRegard();
  if (raw && typeof raw === 'object') {
    if (Number.isFinite(raw.score)) r.score = Math.max(0, Math.min(100, raw.score));
    if (Number.isFinite(raw.lastTalkSol)) r.lastTalkSol = Math.max(0, Math.floor(raw.lastTalkSol));
  }
  return r;
}
