# Weather preparation and recovery

Playable local slice, 6 September 2026. Tier B: forecast → prepare exposed
equipment → enter the buried home/control hub → weather passes → uncover and
clean → resume production. Existing saves and finite inventories are retained.

The fresh arrival keeps its opening grace. At the current 40× clock, the first
storm warning starts after 15 playing minutes, with three minutes to prepare.
The storm lasts two playing minutes; subsequent storms repeat every 30 minutes.
These are deliberately compressed gameplay timings, not a Mars climate model.
Night follows the existing solar clock and can arrive before the first storm.
The Weather button shows the forecast, exposure/warmth warning and cleanup needs.
Warnings also use the deterministic instrument channel, including relay-down.

## Actions and consequences

- Stand within 4 m of a machine, rover or mining rig and open Weather to secure
  its cover. Covers and straps are procedural geometry. Covered machinery pauses;
  battery banks remain connected and the lander's RTG remains available.
- Recall the worker crew from the sealed habitat, lander or home entrance.
  Excavation stops and the visible fleet returns to the service dock. Release
  restores its previous command mode; a previously parked crew still needs its
  ordinary Resume excavation command. The short recovered-worker hatch activity
  is separate from this fleet.
- Enter the actual sealed habitat or cabin for protection. Standing above a
  bunker or beside the lander is outside. Sleep requires the actual cabin or a
  suitable sealed bunk, including the dusk interval before full night.
- Night slows exposed production and rover drive power. Full night warmth budgets
  from a full suit are about 300/180/120 seconds for gentle/standard/expedition.
  Peak storm exposure adds warmth consumption; the two can compound. Exhaustion
  uses the existing safe return with cargo retained. The open rover is not shelter.
- Storm tau rises smoothly to 4.6 through the existing dust, fog, sky and sunlight
  system. Solar collection falls with the same atmospheric state.
- A fully exposed storm adds 65% dust; a covered one adds 8%. At 60% dust,
  production equipment and the fleet stop until cleaned. Lesser dust reduces
  output. Banks keep their stored charge/capacity; dirty rover drive power retains
  a 40% floor so cleanup is never required merely to escape.
- After the storm, stand beside an item and use Clean. Four seconds restores its
  condition, without consuming or granting inventory. Closing the panel, moving,
  leaving reach or a new storm cancels the work. Uncover equipment to restart it.
  Light dust on protected equipment is optional cleanup after a single storm;
  it can accumulate across later storms. Queued inputs, finished goods, paid
  construction and vehicle cargo survive exposure.

The panel shows counts and condition; the workshop terminal identifies queues
paused by covers/dust. Battery dust is visual maintenance, not a capacity loss.
This slice does not simulate broken structural parts, wind-blown vehicles,
permanent equipment destruction or a separate repair-material economy.

## State and verification

`weather.js` is the pure timing/exposure ledger. An authored save epoch supplies
the local schedule. `processedThrough` advances monotonically: pausing stops
exposure, sleeping accounts for crossed storms, reloading does not repeat them,
and time spent with the tab closed does not advance the saved clock. Old saves
receive a new epoch with full grace and clean equipment. Machine `exposure` and
rover/rig `weatherEquipment` are bounded additive save fields. Each physical
action accounts for elapsed exposure before changing protection.

`npm run verify` includes timing, sleep-skip equivalence, high-watermark/reload,
legacy grace, suit exposure, physical maintenance guards and save/material
regressions. `npm run verify:weather` exercises actual desktop/touch controls,
crew recall/release, surface versus interior warmth, dusk sleep rejection, real
bunk sleep crossing a storm, atmosphere pixels, clogged/restarted production,
solar cover output, cleanup and IndexedDB reload in disposable contexts.
The browser fixture explicitly positions actors, supplies test machinery and
advances weather; it is not evidence of an unassisted 20-minute playthrough.
Run against the local Vite server on configurable `FIRSTLIGHT_URL` (default
`http://127.0.0.1:5207`); no production deployment is involved.

Evidence: `/media/weather/index.html`. The canonical headless gate, build, normal
desktop/touch first-use journey and walkable-habitat journey are the final gates.

## Physical reference

The design uses dust occlusion and equipment fouling rather than Earth-hurricane
forces. NASA describes the thin atmosphere, dust infiltration and solar-power
hazard in [The Fact and Fiction of Martian Dust Storms](https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/),
and records reduced solar output from deposited dust in
[Dust Accumulation on Mars](https://science.nasa.gov/photojournal/dust-accumulation-on-mars/).
Suit endurance, protective-cover efficiency and storm cadence above are game
balance values, not measured engineering specifications.
