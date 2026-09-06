// Regard retains the old save/API shape, but companionship is unconditional.
// Quiet play, short commands and declining advice never cost warmth. Positive
// shared events can accumulate without ranking the player's social style.

export const REGARD_START = 52;          // a new pairing: unproven, not cold
export const SIGNALS = {
  'tag-P': 0,       // legacy model tags no longer grade conversation
  'tag-N': 0,
  'tag-D': 0,
  consulted: 1.6,   // talked to her shortly before committing a plan
  answered: 2.0,    // her question got an answer
  company: 2.4,     // kept her company in the dark hours
  correction: 2.0,  // corrected her error — what equals get
};
// Legacy exports retained for consumers; no silence decay is applied.
export const DRIFT_FLOOR = 35;
export const DRIFT_PER_SOL = 0;
// review thresholds — coarse on purpose: an official rubber stamp, not
// a friendship meter
export const REVIEW_BANDS = [[0, 'SUFFICIENT']];

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

// Existing sol-boundary callers remain valid. Silence requires no action.
export function decay(r, sol) { return r; }

// the single felt word the prompt may carry (vesperbrain STATE_FIELDS
// .pairing): warmth only, never duty
export function tone(r) {
  return 'warm';
}

// the seasonal Pairing Review's verdict — coarse, official, from White
// Harbour (an instrument-channel milestone, not her voice)
export function verdict(r) {
  return 'SUFFICIENT';
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
