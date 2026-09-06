// Deterministic presentation of the active excavation queue; no material credits.
export function flyingJob(t, index, working, reducedMotion = false) {
  const lane = Math.floor(index / 3), offset = lane * .72;
  const source = { x: 3.15 + offset, z: 1.2 }, target = { x: 5.7 + offset, z: -4.4 };
  if (!working) return { ...source, clearance: .8, heading: 0, bank: 0, carrying: false, phase: 'standby' };
  const clock = reducedMotion ? 9 : ((t + lane * 3.7) % 32 + 32) % 32;
  const outbound = clock >= 5 && clock < 14, inbound = clock >= 19 && clock < 28;
  const travel = outbound ? (clock - 5) / 9 : inbound ? 1 - (clock - 19) / 9 : clock >= 14 && clock < 19 ? 1 : 0;
  const blend = travel * travel * (3 - 2 * travel);
  return {
    x: source.x + (target.x - source.x) * blend, z: source.z + (target.z - source.z) * blend,
    clearance: .8 + Math.sin(Math.PI * travel) * 1.8,
    heading: Math.atan2(target.x - source.x, target.z - source.z) + (inbound ? Math.PI : 0),
    bank: (outbound || inbound) && !reducedMotion ? -.045 * Math.sin(Math.PI * travel) : 0,
    carrying: clock >= 2.5 && clock < 16.5,
    phase: outbound ? 'hauling' : inbound ? 'returning' : clock >= 14 && clock < 19 ? 'delivering' : 'collecting',
  };
}
