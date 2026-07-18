# Phase 2 — The Homestead (working plan)

*Drafted 2026-07-17 with James's four calls locked: **panel-by-panel**
construction; a **gentle start** (survival ramps only after the first hab
seals); the mining machine as a **towed trailer with an anchoring
deployment**; **hard mass limits** with the rover as the only bulk hauler.*

## The loop

**salvage → prospect → haul the machine out → mine → haul back → refine →
build sealed volumes.** Scarcity does the design work: Mars provides bulk,
only Earth (the lander) provides finish.

## The material chain

| Tier | Source | Items |
|---|---|---|
| **Salvage** (finite) | unbolted from the lander | alloy panel, window pane, seal kit, cable, electronics, **one airlock ring**, the RTG |
| **Bulk** (free, heavy) | shovel / rover scraping | regolith |
| **Mined** (the expedition) | the drill rig at prospected deposits | iron ore, deep ice, silica |
| **Refined** (power + time) | smelter / electrolyser at base | steel panel, water, glass, O₂ (methalox later) |

The lander is also the only shelter until the first hab holds pressure —
stripping it is a commitment the player feels.

## Airtight by flood-fill (`pressure.js`, pure)

Panels live on the **faces of a 2 m cell grid**. Enclosure is computed, not
declared: flood-fill from outside; cells unreachable from outside form
volumes; a volume pressurises only when closed AND doored by an airlock AND
fed air. The leak finder points at the exact open faces on the escape path —
"well designed" means the game shows you your seams. Depressurisation is an
event (the breach, VESPER's gauges); the airlock cycle is the colour-law
threshold moment.

## The build grammar (`build.js`, pure)

- 2 m cells; parts occupy **faces** (canonical keys, no duplicates).
- Types: `panel` (steel/alloy), `window` (glass, sealed), `airlock` (sealed,
  passable via cycle), `foundation` behaviour comes free (floor faces).
- Placement rule: a part must root to the ground or share an edge with an
  existing part (no floating construction).
- The stead stays **pure data over the catalogue** (DESIGN.md): rides the
  save, later the relay.

## Logistics (`inventory.js`, pure)

Hard limits: the suit carries ~one panel; the rover deck carries a build's
worth. Mass is the currency of movement — load runs are gameplay, the rover
earns its keep.

## The expedition (`trailer.js` + `mine.js`, pure — next slice)

The drill rig rides a towed trailer: hitch-angle dynamics behind buggy.js
(sway, jackknife risk under drift/braking — the towing IS the skill), then an
anchor-and-level deployment at a prospected deposit. Deposits deterministic
from the world seed; the machine produces while powered; hauls come home by
trailer.

## The gentle start

Survival stays soft (slow air, forgiving cold, the lander as a free refill)
until the first volume pressurises — then the full ledger switches on and the
planet starts keeping score. VESPER narrates the change of terms.

## The bedroom bar (James's call, 2026-07-18)

The lander stays the only bed until the player builds a pressurised hab that
**beats it**: `HAB_MIN_CELLS` (6) cells or more. Salvage stock can seal at
most a 2×2 (4 cells), so the first real bedroom needs mined steel — the sleep
mechanic itself pulls the player into the expedition loop. Small sealed
volumes still shelter (air, warmth, a door against the dust); they just
aren't anywhere to sleep through a −80° night. VESPER explains the refusal.

## Build order (each step verify-gated, playable at every stop)

1. **Foundations (this commit):** `inventory.js`, `build.js`, `pressure.js` —
   pure, verified. The contract layer.
2. **The lander + salvage:** lander model at the drop site, E-to-unbolt,
   the inventory HUD, first panels placeable.
3. **The first hab:** build UI (ghost placement on faces), interiors,
   pressurisation + the leak finder on the HUD, the airlock cycle, the
   survival ramp switch-on.
4. **The trailer + the machine:** towing dynamics, prospecting, deposits,
   deployment, the mining loop.
5. **Refining:** smelter/electrolyser, the full chain closed.
