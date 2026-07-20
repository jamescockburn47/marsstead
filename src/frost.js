// Frost — the pure cover model behind the glint centrepiece. No THREE,
// no DOM; verify-frost.mjs guards it.
//
// Two frosts, both real Mars:
//   THE CAPS — seasonal CO₂/H₂O cover advancing past the frost line in
//   each hemisphere's winter (Ls 270 is northern winter solstice) and
//   retreating in summer.
//   THE MORNING — thin surface frost condensed overnight on the open
//   plain (Viking 2 photographed it; methane/CO₂ ground frosts are the
//   speculative cousins). It crests just before dawn and burns off on an
//   exponential once the sun is up — by mid-morning the plain is bare.
//   Step outside at sunrise and the ground toward the sun is a field of
//   cold pinpricks: the shot this module exists to make honest.
//
// frostCover(latDeg, seasonLs, hourFrac) -> 0..1 — hourFrac is LOCAL
// true solar time as a day fraction (0.25 ≈ sunrise, 0.5 = noon).

const smooth = (k) => {
  const t = Math.min(1, Math.max(0, k));
  return t * t * (3 - 2 * t);
};

// the seasonal frost line: the latitude the cap's edge has reached.
// Northern winter (Ls ~270): the line rides down to ~48N; northern
// summer (Ls ~90): it retreats to ~72N. The south mirrors at Ls+180.
export function frostLineLat(seasonLs, north = true) {
  const phase = north ? seasonLs : (seasonLs + 180) % 360;
  // coldest at Ls 270 for the north: cos peaks the advance there
  const winterness = (1 - Math.cos(((phase - 90) / 180) * Math.PI)) / 2; // 0 @ Ls90, 1 @ Ls270
  const line = 72 - 24 * winterness;   // 72° summer .. 48° deep winter
  return north ? line : -line;
}

// the morning term alone, before the latitude boost — the shader twin
// (FROST_GLINT_GLSL's marsFrost) takes exactly this as its uniform
export function morningFrost(hourFrac) {
  const night = hourFrac < 0.23
    ? 0.35 + 0.65 * smooth(hourFrac / 0.23 + 0.25)      // deepening small hours
    : 1;
  const burn = hourFrac > 0.27
    ? Math.exp(-(hourFrac - 0.27) / 0.05)               // sunrise takes it fast
    : 1;
  const evening = hourFrac > 0.85 ? smooth((hourFrac - 0.85) / 0.15) * 0.3 : 0;
  return 0.6 * Math.min(night, burn) + evening * 0.5;
}

export function frostCover(latDeg, seasonLs, hourFrac) {
  // the caps: cover ramps over ~12° past the line toward the pole
  const capN = smooth((latDeg - frostLineLat(seasonLs, true)) / 12 + 0.5);
  const capS = smooth((frostLineLat(seasonLs, false) - latDeg) / 12 + 0.5);
  const cap = Math.max(capN, capS);
  // stronger toward the cold latitudes, never zero even at the equator
  const latBoost = 0.55 + 0.45 * smooth(Math.abs(latDeg) / 55);
  return Math.min(1, Math.max(cap, morningFrost(hourFrac) * latBoost));
}
