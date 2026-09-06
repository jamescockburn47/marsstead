// Mars timekeeping — pure, no THREE, no DOM. verify-marstime.mjs guards it.
//
// Implements the Mars24 recipe (Allison & McEwen 2000, "A post-Pathfinder
// evaluation of areocentric solar coordinates...", as maintained at NASA GISS
// https://www.giss.nasa.gov/tools/mars24/help/algorithm.html). Implemented
// fresh from the published equations per docs/DATA.md rule 2.
//
// TODO(data): pin verify-marstime to the GISS worked-example values when the
// page is reachable; until then the gate holds astronomical invariants
// (sol length, tropical year period, published Mars-year epoch dates).
//
// One clock, many readers: the sol HUD, the seasons (Ls drives climate and
// frost line), the light rig's sun position, and one day the weather replay.

const DEG = Math.PI / 180;

// TT-UTC offset: 32.184 s (TT-TAI) + 37 leap seconds (stable since 2017-01).
export const TT_MINUS_UTC = 69.184; // seconds

export const SOL_SECONDS = 88775.244; // 24h 39m 35.244s
export const SOLS_PER_YEAR = 668.5991; // mean tropical, in sols

// AM2000 Table 5 — planetary perturbers of Mars's orbit.
const PERTURBERS = [
  { A: 0.0071, tau: 2.2353, phi: 49.409 },
  { A: 0.0057, tau: 2.7543, phi: 168.173 },
  { A: 0.0039, tau: 1.1177, phi: 191.837 },
  { A: 0.0037, tau: 15.7866, phi: 21.736 },
  { A: 0.0021, tau: 2.1354, phi: 15.704 },
  { A: 0.0020, tau: 2.4694, phi: 95.528 },
  { A: 0.0018, tau: 32.8493, phi: 49.095 },
];

function mod(a, n) { return ((a % n) + n) % n; }

// Unix millis (UTC) -> Julian Date, Terrestrial Time
export function jdTT(millis) {
  const jdUT = 2440587.5 + millis / 86400000;
  return jdUT + TT_MINUS_UTC / 86400;
}

// days since the J2000 epoch, TT
export function deltaJ2000(millis) { return jdTT(millis) - 2451545.0; }

// Mars mean anomaly, degrees (AM2000 eq. 16)
export function meanAnomaly(dt) { return mod(19.3871 + 0.52402073 * dt, 360); }

// angle of Fiction Mean Sun, degrees (AM2000 eq. 17)
export function alphaFMS(dt) { return mod(270.3871 + 0.524038496 * dt, 360); }

// planetary perturbation sum, degrees (AM2000 eq. 18)
export function pbs(dt) {
  let s = 0;
  for (const { A, tau, phi } of PERTURBERS) {
    s += A * Math.cos(((0.985626 * dt) / tau + phi) * DEG);
  }
  return s;
}

// equation of center nu - M, degrees (AM2000 eq. 19)
export function equationOfCenter(dt) {
  const M = meanAnomaly(dt) * DEG;
  return (10.691 + 3.0e-7 * dt) * Math.sin(M)
    + 0.623 * Math.sin(2 * M)
    + 0.050 * Math.sin(3 * M)
    + 0.005 * Math.sin(4 * M)
    + 0.0005 * Math.sin(5 * M)
    + pbs(dt);
}

// areocentric solar longitude, degrees — THE season angle (AM2000 eq. 19)
export function solarLongitude(millis) {
  const dt = deltaJ2000(millis);
  return mod(alphaFMS(dt) + equationOfCenter(dt), 360);
}

// equation of time, degrees (AM2000 eq. 20); x15 gives minutes-ish feel,
// /15 gives hours: EOT hours = eotDeg / 15.
export function equationOfTime(millis) {
  const dt = deltaJ2000(millis);
  const ls = solarLongitude(millis) * DEG;
  return 2.861 * Math.sin(2 * ls) - 0.071 * Math.sin(4 * ls)
    + 0.002 * Math.sin(6 * ls) - equationOfCenter(dt);
}

// Mars Sol Date — the sol count analogue of the Julian Date (AM2000 eq. 32)
export function marsSolDate(millis) {
  return (deltaJ2000(millis) - 4.5) / 1.0274912517 + 44796.0 - 0.00096;
}

// Coordinated Mars Time — mean solar time at lon 0, hours [0, 24)
export function mtc(millis) { return mod(24 * marsSolDate(millis), 24); }

// local mean solar time at a west-positive... we keep EAST-positive lon
// (the map convention everywhere else in the game): LMST = MTC + lonE/15.
export function lmst(millis, lonE) { return mod(mtc(millis) + lonE / 15, 24); }

// local TRUE solar time — what the sun actually does (LMST + EOT)
export function ltst(millis, lonE) {
  return mod(lmst(millis, lonE) + equationOfTime(millis) / 15, 24);
}

// subsolar latitude, degrees — sun's declination on Mars (obliquity 25.19)
export function subsolarLat(millis) {
  const ls = solarLongitude(millis) * DEG;
  return Math.asin(Math.sin(25.19 * DEG) * Math.sin(ls)) / DEG;
}

// sun elevation above the horizon at (lat, lonE), degrees. The light rig
// hangs off this one number.
export function sunElevation(millis, lat, lonE) {
  const dec = subsolarLat(millis) * DEG;
  const h = (ltst(millis, lonE) - 12) * 15 * DEG; // hour angle
  const phi = lat * DEG;
  const sinEl = Math.sin(phi) * Math.sin(dec)
    + Math.cos(phi) * Math.cos(dec) * Math.cos(h);
  return Math.asin(Math.max(-1, Math.min(1, sinEl))) / DEG;
}

// sun azimuth, degrees clockwise from north — pairs with sunElevation
export function sunAzimuth(millis, lat, lonE) {
  const dec = subsolarLat(millis) * DEG;
  const h = (ltst(millis, lonE) - 12) * 15 * DEG;
  const phi = lat * DEG;
  const az = Math.atan2(
    Math.sin(h),
    Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi),
  );
  return mod(az / DEG + 180, 360);
}

// the season, northern-hemisphere named (Ls 0 = N spring equinox)
export function season(millis) {
  const ls = solarLongitude(millis);
  if (ls < 90) return 'northern spring';
  if (ls < 180) return 'northern summer';
  if (ls < 270) return 'northern autumn';
  return 'northern winter';
}

// "Sol 44796, 13:42" — the HUD line
export function solClock(millis) {
  const msd = marsSolDate(millis);
  const h = mtc(millis);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `Sol ${Math.floor(msd)}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} MTC`;
}

// Player-facing expedition day and local sunlight clock; scientific MSD stays available above.
export function missionClock(millis, start, lonE) {
  const day = Math.max(1, Math.floor((millis - start) / 88775244) + 1);
  const hours = ltst(millis, lonE);
  return `Sol ${day} · ${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')} local`;
}
