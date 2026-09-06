// Local storm exposure: authored epoch, deterministic simulation clock, no I/O.
// One active-equivalent second is 40,000 simulation milliseconds. Pausing the
// simulation pauses the weather; sleeping still accounts for the skipped storm.
export const WEATHER_CLOCK_MS = 40000;
export const WEATHER_PERIOD_SECONDS = 1800;
export const WEATHER_WARNING_SECONDS = 900;
export const WEATHER_STORM_START_SECONDS = 1080;
export const WEATHER_STORM_END_SECONDS = 1200;
const STORM_DURATION = WEATHER_STORM_END_SECONDS - WEATHER_STORM_START_SECONDS;
const RAMP_SECONDS = 15;
const boundedTime = value => Number.isFinite(value)
  ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value)) : 0;
const dustOf = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export function createWeather(simMillis) {
  const now = boundedTime(simMillis);
  return { version: 1, epochMillis: now, processedThrough: now, crewSecured: false, crewCondition: acceptCondition(null) };
}
export function acceptWeather(raw, simMillis) {
  const now = boundedTime(simMillis);
  if (!raw || raw.version !== 1 || !Number.isFinite(raw.epochMillis)
    || raw.epochMillis < 0 || raw.epochMillis > Number.MAX_SAFE_INTEGER) return createWeather(now);
  // Preserve a valid high-watermark when a clock is rewound. Clamping it back
  // to 'now' would charge for the same storm again after the next reload.
  const processed = Number.isFinite(raw.processedThrough) && raw.processedThrough >= 0
    && raw.processedThrough <= Number.MAX_SAFE_INTEGER ? raw.processedThrough : now;
  return { version: 1, epochMillis: raw.epochMillis,
    processedThrough: Math.max(raw.epochMillis, processed), crewSecured: raw.crewSecured === true,
    crewCondition: acceptCondition(raw.crewCondition) };
}
export function weatherAt(state, simMillis, sunEl) {
  const now = boundedTime(simMillis), accepted = acceptWeather(state, now);
  const elapsed = Math.max(0, (now - accepted.epochMillis) / WEATHER_CLOCK_MS);
  const cycle = elapsed % WEATHER_PERIOD_SECONDS;
  const storm = cycle >= WEATHER_STORM_START_SECONDS && cycle < WEATHER_STORM_END_SECONDS;
  const warning = cycle >= WEATHER_WARNING_SECONDS && cycle < WEATHER_STORM_START_SECONDS;
  const secondsToStorm = storm ? 0 : cycle < WEATHER_STORM_START_SECONDS
    ? WEATHER_STORM_START_SECONDS - cycle : WEATHER_PERIOD_SECONDS - cycle + WEATHER_STORM_START_SECONDS;
  const intensity = storm ? Math.max(0, Math.min(1,
    (cycle - WEATHER_STORM_START_SECONDS) / RAMP_SECONDS,
    (WEATHER_STORM_END_SECONDS - cycle) / RAMP_SECONDS)) : 0;
  return { phase: storm ? 'storm' : warning ? 'warning' : 'clear', intensity, secondsToStorm,
    secondsRemaining: storm ? WEATHER_STORM_END_SECONDS - cycle : warning ? secondsToStorm : 0,
    cold: Number.isFinite(sunEl) && sunEl < -4 };
}
export function acceptCondition(raw) {
  return { secured: raw?.secured === true, dust: dustOf(raw?.dust) };
}
// Integral of time spent inside storms. Constant-time arithmetic handles any
// number of skipped cycles without looping over days or replaying frame ticks.
function stormSecondsThrough(seconds) {
  const elapsed = Math.max(0, seconds), cycles = Math.floor(elapsed / WEATHER_PERIOD_SECONDS);
  const within = elapsed - cycles * WEATHER_PERIOD_SECONDS;
  return cycles * STORM_DURATION + Math.max(0, Math.min(STORM_DURATION, within - WEATHER_STORM_START_SECONDS));
}
export function advanceWeather(state, simMillis, conditions = []) {
  if (!state || typeof state !== 'object' || !Array.isArray(conditions)) return 0;
  if (!Number.isFinite(simMillis) || simMillis < 0 || simMillis > Number.MAX_SAFE_INTEGER) return 0;
  const accepted = acceptWeather(state, simMillis);
  // Keep the crew condition's identity: callers may already have included it
  // in this interval's target list alongside rover and machine conditions.
  if (state.crewCondition && typeof state.crewCondition === 'object') {
    Object.assign(state.crewCondition, accepted.crewCondition);
    accepted.crewCondition = state.crewCondition;
  }
  Object.assign(state, accepted);
  if (simMillis <= state.processedThrough) return 0;
  const start = (state.processedThrough - state.epochMillis) / WEATHER_CLOCK_MS;
  const end = (simMillis - state.epochMillis) / WEATHER_CLOCK_MS;
  const overlap = Math.max(0, stormSecondsThrough(end) - stormSecondsThrough(start));
  // A condition shared by two display objects still represents one machine.
  for (const condition of new Set(conditions)) {
    if (!condition || typeof condition !== 'object') continue;
    const before = acceptCondition(condition);
    condition.secured = before.secured;
    condition.dust = Math.min(1, before.dust + overlap / STORM_DURATION * (before.secured ? .08 : .65));
  }
  state.processedThrough = simMillis;
  return overlap;
}
export function equipmentEfficiency(condition, sunEl) {
  const { secured, dust } = acceptCondition(condition);
  if (secured || dust >= .6) return 0;
  return (1 - dust * .7) * (Number.isFinite(sunEl) && sunEl < -4 ? .5 : 1);
}
export function cleanCondition(condition) {
  if (!condition || typeof condition !== 'object') return false;
  const changed = condition.dust !== 0;
  condition.dust = 0;
  return changed;
}
