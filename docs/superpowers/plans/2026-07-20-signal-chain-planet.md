# The Whole Planet & The Signal Chain — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the landing-pad system, make the whole real planet exist
(global MOLA + gazetteer), make it beautiful (real-elevation palette +
the frost-glint centrepiece), and give flying its reason (the five-beat
signal chain wired to the agreed storyline).

**Architecture:** Pure modules first (bake → mars.js → frost.js →
marslegends.js), each with a verify script; visual layers read pure
state through uniforms; main.js wires the ritual. Spec:
`docs/superpowers/specs/2026-07-20-signal-chain-planet-design.md`.

**Tech stack:** Vite + Three.js, Node verify scripts, the family GLSL
idioms (fbm, the sword-of-the-sun corridor from Saltstead `ocean.js`).

---

### Task 1: Fetch source data (permission granted 2026-07-20)

- [ ] `mkdir tools` and download:
  - `https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/megt90n000cb.img` → `tools/megt90n000cb.img` (~2.0 MB)
  - Gazetteer: `https://planetarynames.wr.usgs.gov/shapefiles/MARS_nomenclature.csv` (or the site's CSV export for target=MARS) → `tools/mars_nomenclature.csv`
- [ ] Verify sizes: `.img` exactly 2,073,600 bytes (1440×720×2); CSV non-empty with `Feature_Name` header (adjust parser to the real header row).

### Task 2: Global bake + gazetteer (`scripts/build-marsdata.mjs`)

- [ ] Extend the script: after the regional grid, bake a **global table**
  — downsample-free copy of the 4ppd grid, converting big-endian to
  little-endian Int16 base64 (same encoder as the region):
  `GLOBAL_B64`, `G_W = 1440`, `G_H = 720`, `G_PPD = 4`.
- [ ] Parse the gazetteer CSV; keep features where
  `kind ∈ {Mons, Montes, Planitia, Planum, Vallis, Valles, Chasma, Tholus, Patera, Terra, Crater(d>150km), Labyrinthus}`
  ranked by diameter, cap at ~90, ALWAYS including: Olympus Mons,
  Tharsis Montes trio, Valles Marineris (Melas/Coprates), Hellas
  Planitia, Argyre, Elysium Mons, Jezero, Gale, Arsia Mons, Isidis,
  Utopia, Acidalia, Syrtis Major. Emit
  `export const FEATURES = [[name, latDeg, lonEDeg, kindCode, diamKm], ...]`.
- [ ] Rebake: `node scripts/build-marsdata.mjs` → src/marsdata.js grows
  the two tables; regional table byte-identical to before (diff check).
- [ ] Commit.

### Task 3: `mars.js` — the planet answers everywhere

- [ ] Add failing checks to `scripts/verify-mars.mjs`:

```js
// the whole planet: published landmarks answer with real elevations
const olympus = elevationReal(18.65, 226.2);   // ~21,000 m area summit
check('Olympus stands', olympus > 14000, `${olympus}`);
const hellas = elevationReal(-33, 65);          // deep basin floor
check('Hellas sinks', hellas < -5500, `${hellas}`);
// the fine window and the globe agree at the seam (< 120 m disagreement,
// the 4ppd cell scale)
const seam = Math.abs(elevationReal(21.99, 77) - elevationReal(22.01, 77));
check('the window seam holds', seam < 120, `${seam}`);
// the gazetteer names the land
check('features baked', FEATURES.length >= 60);
const near = nearestFeature(latLonToWorld(18.44, 77.45).x, latLonToWorld(18.44, 77.45).z);
check('home knows its name', /jezero/i.test(near.name));
```

- [ ] Run: FAIL (no global table consumer, no nearestFeature).
- [ ] Implement in `src/mars.js`: `globalElevation(lat, lonE)` bilinear
  over the global table (lon wraps, lat clamps); `elevationReal` = fine
  window where covered, else global; export `FEATURES` (decoded to
  `{name, lat, lonE, kind, diamKm, x, z}` once), `nearestFeature(x, z)`,
  `featuresInBox(x0, z0, x1, z1)`. Longitude wrap: world x wraps at
  ±(180 × M_PER_DEG); nearestFeature uses wrapped Δx.
- [ ] Run verify-mars: PASS. Commit.

### Task 4: `src/frost.js` — the pure frost model (new)

- [ ] Write `scripts/verify-frost.mjs` first:

```js
import { frostCover, FROST_FULL_LAT } from '../src/frost.js';
// caps: high latitudes carry frost in their winter, lose it in summer
check('north cap in northern winter', frostCover(75, 300, 0.5) > 0.8);
check('north cap thins in northern summer', frostCover(75, 90, 0.5) < frostCover(75, 300, 0.5));
check('south cap mirrors', frostCover(-75, 90, 0.5) > 0.8);
// morning frost: the plain glitters at dawn, bare by mid-morning
const dawn = frostCover(18, 0, 0.26), mid = frostCover(18, 0, 0.45), noon = frostCover(18, 0, 0.5);
check('dawn frost lies on the plain', dawn > 0.25);
check('burned off by mid-morning', mid < dawn * 0.35);
check('gone by noon', noon < 0.03);
// monotonic burn-off after sunrise; bounded 0..1 everywhere
let last = 1;
for (let h = 0.25; h <= 0.55; h += 0.02) {
  const c = frostCover(18, 0, h);
  check(`burnoff monotonic @${h.toFixed(2)}`, c <= last + 1e-9); last = c;
}
```

- [ ] Run: FAIL (module missing).
- [ ] Implement `src/frost.js` (pure, no imports beyond nothing):

```js
// frostCover(latDeg, seasonLs, hourFrac 0..1 local) -> 0..1
// caps: cover grows past the seasonal frost line toward the pole;
// the line rides Ls (northern winter ~Ls 270: line ~45N; summer ~70N)
// morning: overnight condensation everywhere, peaking before dawn,
// burning off on an exponential after sunrise, weaker at low latitude
export function frostLineLat(seasonLs, north = true) { ... }
export function frostCover(latDeg, seasonLs, hourFrac) {
  const capN = smooth((latDeg - frostLineLat(seasonLs, true)) / 12);
  const capS = smooth((frostLineLat(seasonLs, false) - latDeg) / 12);
  const cap = Math.max(capN, capS);
  const dawnPeak = Math.exp(-Math.pow((hourFrac - 0.23), 2) / 0.012); // pre-dawn crest
  const burn = hourFrac > 0.27 ? Math.exp(-(hourFrac - 0.27) / 0.055) : 1;
  const morning = 0.55 * Math.min(dawnPeak, burn) * (0.4 + 0.6 * Math.min(1, Math.abs(latDeg) / 40 + 0.5));
  return Math.min(1, Math.max(cap, morning));
}
```

  (Exact curve tuned until verify passes; the SHAPE is the contract.)
- [ ] PASS. Add `verify-frost` to package.json chain. Commit.

### Task 5: The palette — geology in the vertex colours

- [ ] `marschunk.js` `colourFor(h, x, z, steep)` rewritten (stays pure &
  positional — frost is NOT here, it is time-varying shader work):
  bands from game-height h (VERT = 0.025: real ±8 km → game ±200 m):
  deep basins (h < -75) pale ochre dust; lowland plain rust;
  highland (h > 30) darkening basalt; Tharsis heights (h > 100)
  pale ochre again; steep basalt unchanged; wind-streak fbm modulation.
- [ ] verify-marschunk: palette determinism + distinct bands
  (`colourFor(-100,…) != colourFor(120,…)`), colour-law hold (no green:
  g < r for every band).
- [ ] Vista inherits automatically (shares colourFor). Commit.

### Task 6: The frost glint — the centrepiece (GLSL + drive)

- [ ] `src/glsl.js`: add `FROST_GLINT_GLSL` — a function
  `vec3 frostGlint(vec3 base, vec3 wpos, float frost)` implementing the
  family corridor law (port of Saltstead ocean.js lines 70–88, ground
  idiom): corridor `pow(align, mix(6, 26, uSunLow))`, per-cell hash on
  `floor(wpos.xz * 1.7)`, anti-pulse twinkle (per-cell speed AND phase),
  distance fade 10→45 m, additive cold-white sparkle
  `vec3(1.0, 0.97, 0.9)` × sun colour at low sun; entire term × frost.
- [ ] Terrain chunk material (find the Lambert onBeforeCompile in
  `terrain.js`): add uniforms `uSunAzimXZ, uSunLow, uGlintK, uCamPos,
  uTime, uFrostLineN, uFrostLineS, uMorning` + varying world pos; frost
  factor in-shader: latitude from `wpos.z` (world → lat is linear:
  `lat = HOME.lat - wpos.z / M_PER_DEG`… sign per worldToLatLon), cap
  bands via the two line uniforms + morning term × whitening ALSO tints
  the base colour toward frost white (`mix(base, frostWhite, frost*0.5)`)
  so the ground *looks* frosted, then glints.
- [ ] Same term into `vistalayer.js`'s material (it already has an
  onBeforeCompile) — the caps shimmer from altitude.
- [ ] Drive per frame in main.js `frameWorld`: compute
  `frostCover`-derived uniforms from marstime (Ls, local hour) +
  marslight sun azimuth/elevation. Glint master `uGlintK` ramps with
  low sun exactly like Saltstead's uGlitter.
- [ ] Live proof: warden clock to DAWN, screenshot the sunward plain;
  clock to NOON, confirm the sparkle pools/quiets; arctic teleport for
  the cap shimmer. One contact-sheet run (`npm run shots`) — this is a
  milestone visual. Commit.

### Task 7: The pad dies

- [ ] `machines.js`: delete `landing-pad` entry. `verify-machines`:
  assert absent.
- [ ] `hopper.js`: `landingPoint(from, to)` returns `to` exactly; delete
  `descentEllipseM`, ELLIPSE_MIN_M, the hash scatter, `onPad` params
  (beginHop(h, from, to, payloadKg)). verify-hopper: rewrite section 3b
  to the exact-landing law (aim === land, deterministic), drop scatter
  checks.
- [ ] `hopconsole.js`: remove pads panel/`getPads`/`onPad`/ellipse
  drawing; chart keeps fuel circle + crown/home + (Task 9) labels.
- [ ] `main.js`: delete pad-console interact block (craft-console block
  stays), `nearestPad`, pad refs in hopUI hooks; warden `raiseHopper`
  places the craft directly (no pad); attract yard: pad → nothing
  (hopper sits on open ground at the same spot).
- [ ] The assembler offers assembly: `worksconsole.js` — when the works
  view shows the assembler station and the hopper is unbuilt, an
  ASSEMBLE THE HOPPER row (same canAssemble/onAssemble hooks passed
  through from main). After built: E at the craft is the console.
- [ ] Full verify + live: warden-raise works, assemble path works, hop
  lands EXACTLY on the aim. Commit.

### Task 8: `src/marslegends.js` — the chain (pure, new)

- [ ] `scripts/verify-marslegends.mjs` first: five beats; real coords
  (beat 1 dichotomy ~lat 25N near-north of home, beat 2 Jezero delta
  ~18.5N 77.4E ≈ 2 km world of home, beat 3 Gale-ward seep, beat 4
  Arsia flank skylight, beat 5 deeper Tharsis vault mouth); distances
  from home strictly increasing; `chainActive([])` = beat 1,
  `chainActive([b1])` = beat 2, all-found → null; `signalStrength`
  monotonic-in-distance, 0 at antipode, 1 at site; `sweepAt` gradient
  sharper than signalStrength inside 250 m; every text payload < 400
  chars, ≥ 3 keywords… and **no plot word** (`pattern|seed|betray|
  weaver|replicat|halcyon-secret`) in any player-visible string
  (reuse vesper.js's gate list + these).
- [ ] Implement: `SITES = [{id, name, place, lat, lonE, tone,
  arriveM: 250, sweepM: 30, relic: {id, name, journal}, scene:
  [floorLines], next}]`, `siteXZ(site)` via latLonToWorld,
  `chainActive(foundIds)`, `signalStrength(site, x, z)` =
  `1 / (1 + (d/8000)^1.7)` clamped, `sweepAt(site, x, z)` fine
  gradient, `serializeMystery/deserializeMystery` (found + relics,
  laundered against SITES ids).
- [ ] PASS. Add to verify chain. Commit.

### Task 9: The instruments — band, ring, labels

- [ ] `hud.js`: the SIGNAL band — a slim arc by the minimap: warmth
  bar (cool teal → white-hot), no bearing. Hidden until the chain's
  first detection (strength > 0.02).
- [ ] `marsmap.js`: after first detection of the active site, a coarse
  range ring: centre HOME-quantized 4 km grid cell of the site,
  radius quantized to 2 km steps — honest vagueness; label chain
  relics' FOUND sites by their place name (they are known ground now).
  Gazetteer labels: `featuresInBox` drawn in small caps at their
  world positions (culled by zoom).
- [ ] `hopconsole.js` chart: gazetteer labels inside the drawn box +
  the fuel circle; the active signal draws NOTHING (the band is the
  only tell in flight planning — flying toward warmth is the game).
- [ ] Commit.

### Task 10: The ritual — arrival, act, journal, scenes

- [ ] `src/journal.js` (DOM, console grammar like wardenpanel): THE
  RECORD — relics as entries (name, place, journal text), opened with
  J; unread pip on the HUD.
- [ ] `main.js`: per-frame chain logic: active site strength → HUD
  band; crossing arriveM fires VESPER moment `signal-close-<n>` once;
  inside sweepM the prompt `|*E| read the ground` (only on foot, not
  driving); E starts a 4 s held act (the anchoring pattern —
  `this.reading = {t, need}`); completion → relic into
  `this.mystery`, journal entry + pip, VESPER scene moment
  `signal-found-<n>` (floor lines from marslegends.scene), next
  signal wakes silently.
- [ ] `vesper.js`: EVENTS grow `signal-close-1..5`, `signal-found-1..5`
  with the floor lines (tone ladder: wonder → unease → cosy-leaves →
  VESPER-quiet (the beat-4 lines are terse) → the beat-5 line about
  the address). The no-plot-word gate covers them (verify-vesper
  already scans EVENTS lines).
- [ ] `save.js`: `mystery` rides snapshot/accept (laundered via
  marslegends.deserializeMystery). verify-save: rides + launders.
- [ ] Full verify; live: `scripts/live-signal.mjs` — boot, warden-raise
  hopper, fly toward beat 1 by warmth (probe strength while moving),
  land, walk the sweep, read the ground, assert relic + journal +
  next-signal state. Commit.

### Task 11: VESPER + docs keep up

- [ ] `gamefacts.js`: facts for signals/band/journal ("follow the
  warmth"), exact landings (ellipse fact dies), assembler-built
  hopper (pad fact rewritten), landmark chart, morning frost & the
  glint (a beauty fact — VESPER may point at the dawn).
- [ ] OVERVIEW.md §5 (pads/depots line → the chain, the planet,
  the glint), HANDOFF.md build queue rewrite.
- [ ] EVO: scp vesperbrain/gamefacts/power + restart + health check.
- [ ] Commit.

### Task 12: Release

- [ ] `npm run verify` green; `npm run shots` contact sheet for the
  glint milestone; live-hop + live-signal green.
- [ ] `npm run deploy` → vX. Send James the dawn-glint shot.

## Execution note

James directed "plan and build all of this" — inline execution
(superpowers:executing-plans) in this session, task order as above,
commit per task.
