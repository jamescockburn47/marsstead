# The reason to fly: the whole planet, and the signal chain

*Approved direction (James, 2026-07-20): kill the landing-pad system — fly
anywhere; give flying its reason — signals from real places wired to the
agreed storyline (the pattern, the Seed, the trust-break); the planet must
LOOK like Mars from altitude (colouration, features, labelled landmarks,
polar frost glint).*

## Why this is one build

The baked MOLA today is Phase 0's single 8°×8° Jezero window
(`src/marsdata.js`: lat 14–22 N, lon 73–81 E). One kilometre of world
travel exhausts it; everything beyond is procedural fallback with a
three-band palette — which is exactly why a hop reads as "the middle of
nowhere". Flying anywhere is only worth anything if there is a real
*anywhere*. So the pad-kill, the global bake, the look, and the signals
ship as one arc (in verify-gated slices).

## Slice 1 — the planet is real everywhere (Phase 1's bake)

- `scripts/build-marsdata.mjs` additionally bakes **global MOLA 4ppd**
  (1440×720 Int16, ~2.8 MB base64 — acceptable; gzip halves it) alongside
  the existing fine Jezero window.
- `mars.js` `elevationReal` becomes: fine window where covered → global
  grid elsewhere (bilinear) → the same procedural skin on top everywhere.
  No behaviour change inside the window (verify asserts this).
- **The gazetteer lands**: the USGS Gazetteer of Planetary Nomenclature,
  filtered to ~80 major features (largest craters, montes, valles, planitiae
  + every chain site's home feature), baked as `FEATURES = [{name, lat,
  lon, kind, radiusKm}]`. Pure helper `nearestFeature(x, z)` and
  `featuresInBox()` for the charts.
- Verify: worked-example elevations for Olympus Mons / Hellas / home
  window seam continuity; gazetteer presence + projection round-trip.

## Slice 2 — the planet LOOKS real (the uniformity fix)

- `colourFor` grows up, still pure and cheap: base tint from **real
  elevation** (deep basins pale-dust, highlands dark basalt, Tharsis
  ochre), **latitude** (the frost line via `frostLine(lat, season)` —
  CO₂/H₂O frost whitening toward the caps), wind-streak fbm, crater-rim
  darkening from slope. Same function feeds walked chunks, the vista and
  the maps — one palette, no drift.
- **The frost glint — a centrepiece visual** (confirmed by James
  2026-07-20): the family's *sword-of-the-sun* rig (Moorstead
  `mesher.js` addWater → Saltstead `ocean.js` glitter), ported to
  GROUND FROST and improved. The corridor law: sparkle lives only
  along the camera→sun-azimuth corridor, its power blending from a
  broad noon pool to a narrow blazing blade at low sun; per-cell
  hashed glints with individual twinkle speed AND phase (the
  anti-pulse rule); distance fade-in. Gated by a new pure
  `frostCover(lat, season, hourFrac)`: the seasonal caps (the
  `frostLine` law) plus **morning surface frost everywhere in
  season** — condensed overnight, blazing at dawn, burned off by
  mid-morning (real Mars: Viking 2's frost; the possible methane/CO₂
  ground frosts). The intended shot: step out at sunrise and the
  whole plain toward the sun is a field of cold pinpricks —
  otherworldly, beautiful, gone within the hour. From hopper
  altitude the caps shimmer on the horizon. Terrain chunks and the
  vista share the same shader term; `verify-marslight` (or a new
  `verify-frost`) locks the pure cover model (seasonality, the
  morning burn-off curve, cap latitudes).
- The vista (`vistalayer.js`) inherits all of it via `colourFor` — the
  arc's view becomes the planet's portrait.

## Slice 3 — the pad dies

- `landing-pad` leaves `MACHINE_TYPES`; old saves launder it away
  silently (the sanitizer already drops unknown types).
- The hopper assembles at the **assembler** (works console gains the
  ASSEMBLE panel; same costs).
- `landingPoint` loses `onPad` and the descent ellipse: **every landing is
  exact where you aim**. The fuel circle is the only constraint.
  MIN_HOP_KM stays. The hop console loses the pads panel and gains the
  chart upgrades (Slice 4).
- E-beside-the-craft (already live, v0.0.54) is the console, everywhere.

## Slice 4 — the signal chain (`src/marslegends.js`, pure, new)

The surface on-ramp of the agreed storyline. The five beats at REAL
places, projected through `latLonToWorld`:

1. **The old shoreline** — the dichotomy boundary north of home.
   Wonder. Relic: the waterline record.
2. **The delta** — Jezero's own delta, nearly home. Wonder, first
   unease. Relic: the mineral signature that shouldn't repeat.
3. **The seep** — an RSL slope + methane spike (Gale-ward). The cosy
   leaves. Relic: a survey fragment with the pattern's fingerprint —
   the first hint the anomalies are *in the data*, decades deep.
4. **The skylight** — an Arsia-class lava-tube mouth. Dread; VESPER
   goes quiet. Arrival + relic ship now; the way DOWN is a sealed
   threshold naming what it needs (the winch rig — Stage 5).
5. **The deep dark** — the vault's mouth in the deepest ground.
   Terror held at the door: the relic here is addressed — the first
   time the signal has a recipient. It is not addressed to you.
   (The trust-break's fuse, lit exactly as OVERVIEW §6 designs it.)

Distances escalate with real geography (≈2 km → ≈48 km world): beats 1–2
are a first-tank flight; 3 is an expedition; 4–5 demand the cradled
buggy loaded with spare tanks — the works economy becomes the reason the
reach exists. **No content here names the pattern, the Seed, or the
betrayal** — VESPER's no-plot-word gate holds; the relics carry tone and
evidence, never the secret.

Mechanics (pure): `chainActive(found)` — one signal live; `signalStrength
(site, x, z)` — log falloff 0..1; `sweepAt` — the fine on-foot gradient
inside ~250 m; arrival act at the ~30 m sweep heart: `E — read the
ground`, a held act, then the relic.

Surfacing: the **SIGNAL band** on the HUD (warmth, no bearing, no pin);
after first detection the M map draws a coarse quantized range ring.
The journal (console grammar) holds relics + entries; `mystery: {found,
relics}` rides the save additively, laundered like everything else.

**Landmark labels** (the choose-to-visit layer): the hop console chart
and the M map label major gazetteer features in small serif caps —
Olympus Mons is on the chart, so wanting to see it is a plan, not a
menu. Labels are places, not markers: nothing pulses, nothing floats
in-world.

## Slice 5 — VESPER and the docs keep up

- New gamefacts: signals/journal/chain mechanics (never plot), landmark
  chart, exact landings, assembler-built hopper. Scene moments per beat
  (deterministic floor + live colour, tags only).
- Three-file EVO deploy + relay if the tag contract moves.
- OVERVIEW.md §5 updated (pads/depots line dies; the chain is live),
  HANDOFF.md build queue updated.

## Testing

- `verify-marsdata`/`verify-mars`: global elevations vs published values,
  window seam, gazetteer round-trip.
- `verify-marschunk`: palette determinism, frost line seasonality.
- `verify-hopper`: exact landings (ellipse gone), unchanged flight drama.
- `verify-machines`: pad gone; assembler contract.
- **`verify-marslegends`** (new): five beats at real coords, one-live
  law, falloff monotonic, sweep finds the heart, relic text lengths,
  no plot word in any fact/prompt-visible string (extends the existing
  no-plot-word gate to the new surface).
- `verify-save`: mystery rides + launders.
- Live: `live-hop.mjs` updated; a `live-signal.mjs` walk of beat 1.

## Out of scope (named, not forgotten)

The underground frame (beats 4–5's descent), the Seed's construction
(Stage 4), the weavers, depots as placeables, hop-time/latitude console
readout (still queued), touch-screen SIGNAL band ergonomics beyond the
basic arc.
