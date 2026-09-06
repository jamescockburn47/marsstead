// Forgiving, explicit suit budgets. No cargo loss and no dependence on live AI.
const clamp = n => Math.max(0, Math.min(1, n));
export function suitStep({ air, warm, temp, sheltered = false, mode = 'gentle', rested = 0, storm = 0 }, dt) {
  dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
  if (sheltered) return { air: clamp(air + dt * 0.06), warm: clamp(warm + dt * 0.06), rescue: false };
  const minutes = mode === 'expedition' ? 10 : mode === 'standard' ? 15 : 25;
  const chill = Math.max(0, (-45 - temp) / 39);
  const coldRate = mode === 'expedition' ? 1 / 120 : mode === 'standard' ? 1 / 180 : 1 / 300;
  const a = clamp(air - dt / (minutes * 60) * (1 - clamp(rested) * 0.25));
  const exposure = clamp(Number.isFinite(storm) ? storm : 0);
  const stormRate = mode === 'expedition' ? 1 / 70 : mode === 'standard' ? 1 / 100 : 1 / 140;
  const w = clamp(warm + dt * ((temp > -35 && exposure === 0 ? .012 : -chill * coldRate) - exposure * stormRate));
  return { air: a, warm: w, rescue: a <= 0 || w <= 0 };
}

export function freezeSimulation(game) {
  return !game.attract && !!(game.paused || game.under?.ui.visible || game.orders?.visible || game.map?.visible
    || game.journalUI?.visible || game.fieldUI?.visible || game.chatBar?.style.display === 'block');
}
