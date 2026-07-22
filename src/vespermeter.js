// VESPER metering — the pure decision logic for "meter the voice, not the game".
//
// The world (walk, build, descend, save) is always free. Only VESPER's LIVE
// CONVERSATIONAL voice is metered here; the deterministic instrument/safety
// channel is NEVER routed through this module — the relay calls decide() only on
// a conversational /brain/chat, so safety lines always speak, relay-up or down
// (DESIGN.md invariant: safety is never live-only).
//
// James is on the flat £20/mo MiniMax Token Plan: no runaway bill, but a shared
// quota metered on rolling windows. So the guard PACES VESPER's share and YIELDS
// the moment MiniMax signals a platform cap (1002/2056), keeping his own Clawd /
// coding work first in line. Pure + headless (verify-vespermeter drives it).

export const METER_DEFAULTS = {
  freeTier: 30,          // free conversational exchanges per device per UTC day
  windowBudget: 800,     // VESPER's cap of live exchanges per rolling window
  windowSecs: 5 * 3600,  // the plan's rolling window (5 hours)
  yieldCooldownSecs: 20 * 60, // after a MiniMax cap, VESPER stays on the floor this long
};

// Decide whether one conversational VESPER call may go live.
// counters: { deviceUsedToday, deviceCoded, windowUsed, yieldUntil }
// returns { allow, reason, floor, count } — count=true ⇒ the caller increments
// deviceUsedToday + windowUsed for this served call. reason ∈
//   yield   — MiniMax capped us; VESPER backs off so James's own use wins
//   ceiling — VESPER's slice of the quota window is spent
//   coded   — a redeemed invite code lifts this device's meter
//   free    — within the free daily tier
//   metered — free tier spent; the floor says "grab a code to keep talking"
export function decide(counters, cfg = METER_DEFAULTS, now = Date.now() / 1000) {
  const c = { ...METER_DEFAULTS, ...cfg };
  const { deviceUsedToday = 0, deviceCoded = false, windowUsed = 0, yieldUntil = 0 } = counters || {};
  if (now < yieldUntil) return { allow: false, reason: 'yield', floor: true, count: false };
  if (windowUsed >= c.windowBudget) return { allow: false, reason: 'ceiling', floor: true, count: false };
  if (deviceCoded) return { allow: true, reason: 'coded', floor: false, count: true };
  if (deviceUsedToday < c.freeTier) return { allow: true, reason: 'free', floor: false, count: true };
  return { allow: false, reason: 'metered', floor: true, count: false };
}

// The timestamp VESPER should stay on the floor until, after a MiniMax cap.
export function yieldFor(now = Date.now() / 1000, cfg = METER_DEFAULTS) {
  return now + (cfg.yieldCooldownSecs ?? METER_DEFAULTS.yieldCooldownSecs);
}

// Is a MiniMax error a hard platform cap we should yield on?
// 1002 = rate limit, 2056 = usage/quota exhausted.
export function isCapSignal(code) {
  const n = Number(code);
  return n === 1002 || n === 2056;
}

// Human-readable line for the Board / Clint alert when VESPER is capped.
export function capReason(code) {
  if (Number(code) === 1002) return 'MiniMax rate-limited us';
  if (Number(code) === 2056) return 'MiniMax quota exhausted';
  return 'MiniMax error';
}
