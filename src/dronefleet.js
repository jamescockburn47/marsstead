// A presentation split within the deployed count, not a second inventory.
export const droneClass = index => index % 3 === 2 ? 'flying' : 'spider';
export function fleetCounts(count = 3) {
  const total = Math.max(0, Math.min(24, Math.floor(Number.isFinite(count) ? count : 3)));
  const flying = Math.floor(total / 3);
  return { total, flying, spider: total - flying };
}
