# Marsstead — the structure contract

*(Drafted with James 2026-07-19. This is the working plan for the game's
shape: ranges, doctrines, systems, and build order. DESIGN.md holds the
founding identity; this holds the campaign.)*

## The spine

Every range is BUILT, not granted. Twenty-ish hours, mapped to the acts:

| Stretch | Hours | Range gained | Gate project | Story beat |
|---|---|---|---|---|
| Landfall | 0–2 | on foot + buggy | the Burrow's first room | the demonstration begins |
| Industry | 2–5 | deeper economy | the Works | the manifest arrives |
| The Hopper | 5–8 | 50–300 km hops | pad + hopper | the Seed survey needs range |
| The Descent | 8–13 | the underground wild | winch rig + seals | the trail turns down |
| The Reveal | ~13 | the deep vault | — | what the Seed is a body for |
| The Inversion | 13–18 | the whole network | countermeasures | the war of cold and dark |
| She Holds | 18–20 | the deep, once more | — | the choice |

## Doctrines (James's rulings, binding)

1. **Plan in 2D, inhabit in 3D (revised 5 September 2026).** The diagram is
   the construction interface; the player enters the exact completed layout,
   walks between rooms and uses the home for warmth, air, sleep and industry.
   Both views derive from the same room state. This supersedes the former
   console-only rule following James's explicit clarification.
2. **The hab is underground.** Radiation and cold make surface housing a
   lie; the warren is dug behind the salvaged airlock ring (the one part
   we can't make twice — now the front door of the homestead). Surface
   carries the crown: airlock head, arrays, masts, the Works, the pad,
   and — on the horizon — the Seed. Light pipes bring day below.
3. **Robots from minute one, and they MINE.** Constructor drones —
   VESPER's hands — have one verb: dig. Digging a room and digging ore
   are the same action; **spoil is ore** — the house pays for itself as
   it is dug. The player plans, approves, supplies; drones execute.
   (Story mirror, never stated: the player normalises helpful diggers
   for ten hours before meeting the wrong ones.)
4. **No damage economy.** No repair trees, no wear. The blackout tithe is
   the ONE universal cost. A botched landing scatters cargo; the buggy
   self-rights; VESPER comments.
5. **Hard = scale, not punishment.** Generous margins; the difficulty is
   orchestrating the Seed — big logistics, well-run nights — plus the
   storm calendar. Tension spikes are the horror's budget, nowhere else.
6. **The early win.** First room dug, ring installed, pressure holding
   inside ~20 minutes, drone-built while the player watches or wanders.
   The lander stays the day-one refuge; the warren beats it because it
   grows ("Nobody doubts you can survive in the can we shipped you in.
   The Review needs a house.").

## Systems

- **The Burrow** (`burrow.js`, pure): side-view cross-section lattice —
  shaft descending from the airlock head, corridors off the shaft, rooms
  off corridors, Sanctum socket rules. Cells carry dig cost and spoil
  yield (ore fraction rises with depth). Room kinds grow over the game:
  bunk (bedworthy), store, works-bay, greenhouse (light-pipe), and later
  the war-room additions. Pressure logic is trivial by construction:
  rock seals everything but the openings — the ring is the boundary.
- **The Hands** (same module): N drones, auto-assigned to the dig queue;
  deterministic tick; spoil accrues to stores. Surface visual: drones at
  the crown, a growing spoil heap, fractal dust at the dig head.
- **The Works** (surface): intake → smelter → mill → assembler modules;
  product families: surface parts, expedition gear, Seed components
  (precision parts demand a stable power baseline through the night —
  the survival sim converges on the centrepiece). Console = flow diagram.
- **The Hopper** (semi-cinematic): plot a hop inside the fuel ellipse
  (payload mass matters: the buggy rides a cradle); ascent/arc plays as
  a staged sequence over the baked global MOLA vista (NO low-level
  free flight over streamed terrain — the one architectural stretch,
  deliberately avoided); the descent-ellipse choice lands while the
  destination streams in. Pads are free landings; depots are far camps.
- **The Caves** (the wild underground, beyond the inhabited home): real
  MGC³ skylights, winch entry, lamp cones, the palette-break by depth.
  The horror theatre. The Moorstead second-frame pattern serves both
  this and any interior we ever do walk.
- **The Seed** (the centrepiece): six visible stages a kilometre out,
  the progress bar you can stand under; clean geometry and cool light —
  deliberately slightly wrong against the planet. Its console: STAGES &
  SYSTEMS palette, element-manifest budget bar, Halcyon intel drawer
  (underived choices carry a glyph from hour one — the seam in plain
  sight), LIGHT THE STAGE commits with spectacle, WALK THE SITE flips
  schematic to world. Post-reveal the same console becomes the war room.
- **Power** (`power.js`, pure — the game's thermostat): SOURCES — the
  lander's RTG (a small steady floor, night- and storm-proof) + solar
  arrays (output rides sunEl × the deterministic dust cycle: the weather
  FORECAST is real, so power planning is real); BANKS — batteries charge
  by day and carry the night; LOADS — digging drones, cooking benches,
  the pressurised warren's comforts. Deficit SHEDS in a fixed, visible
  priority order (assembler → mill → smelter/fab → drones → warren) —
  the base goes quiet, never dead. Stage 4's rule stands on this: Seed
  precision parts demand an unbroken baseline through the night.
- **Saves**: one IndexedDB slot per browser today. Step 1: CHARTER
  RECORD export/import on the title screen (a file, loads anywhere).
  Step 2: cloud saves on the EVO relay keyed to a short charter code.
  Never accounts, never passwords.

## Visual register (each an entry in the cohesive language)

Hopper + plume + scour + the altitude sky ladder (marssky limb); the
Seed's six silhouettes; the Works' furnace-glow; the crown at night (a
buried lantern in the plain); light-pipe columns in console art; cave
lamp cones and the palette-break; console UI language (serif +
instrument-teal on dark, Sanctum-derived, DOM/SVG like the map).

## Risk table (honest)

| System | Risk |
|---|---|
| Consoles, Burrow, Works, drones, Seed geometry | low — proven family patterns |
| Caves frame | low — Saltstead below-decks / Moorstead pub template |
| Hopper sequence + global vista | MODERATE — the far-field MOLA render and the transition hide |
| Continuous low-altitude flight | avoided by doctrine |

## Build order

1. **Phase 1 — the Warren and the Hands**: burrow.js (+drones) pure +
   verify; the airlock-head crown on the surface; the Burrow console
   (first Sanctum-grammar display); early-game flow rewired to the dig;
   bedworthy = dug bunk. Old wall/roof building demoted to surface
   infrastructure only.
2. The Works + its console (reuses the console language).
3. Hopper + pads + depots + far survey content.
4. Seed stages 1–2 + engineering display.
5. Caves frame + descent gear.
6. Story wiring: manifest → legends chain → phase flips → the war.
