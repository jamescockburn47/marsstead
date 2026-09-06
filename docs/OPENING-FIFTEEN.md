# The first fifteen minutes

New landings now begin with a small home already prepared by the worker fleet. This replaces the empty-shaft opening for new games only. Existing saves retain their exact settlement, clock, inventory and automatic fleet behaviour.

The opening offers projects, not a compulsory tutorial. The player can build, travel or explore out of order; guidance follows actual room, crew, expedition and workshop state.

| Approximate player time | Invitation | Immediate payoff |
| --- | --- | --- |
| 0–2 minutes | Follow the approach lights; walk through the buried home | A sealed bunk, workshop and a lower shaft to explore |
| 2–4 minutes | Meet two spiders and a survey flyer; call, hold and direct them | The prepaid lower passage takes ten active working seconds to finish and becomes walkable |
| 4–8 minutes | Take the open rover to the marked survey station | Align three sensors; return with one solar wing and a damaged worker |
| 8–12 minutes | Install the recovered array; use the workshop bench | A useful power upgrade and a repaired, equipped worker |
| 12–15 minutes | Add a shallow garden; plant, water and harvest | A first ration, a stronger air loop and an optional field-hatch expedition |

These are design pacing targets, not user-study retention measurements. Automated route evidence is recorded separately in `media/opening/results.json`; it uses an informed route and cannot prove a novice will find the game engaging.

New arrivals begin in morning light, facing their home. The surface has a grounded maintenance mat, secured tools, approach lights and offset survey chevrons. The protective buried habitat, open rover and existing Mars terrain remain the visual language. The new dressing adds 24 draw calls, 4,032 vertices, no lights and no runtime image assets.

## Finite supplies and player control

The starter layout is six completed cells: upper shaft, two corridors, bunk and workshop, plus a lower shaft. One lower corridor is prepaid and queued. The lander's real airlock ring is installed once. A supplied battery raises capacity to 18 kWh; initial charge is 12 kWh. Prebuilt rooms grant no excavation spoil. Excavating additional rooms uses the existing charge, crew and spoil rules.

Crew commands require an actual nearby visible worker, on foot, within the 18 m home area. Call over and Hold position suspend excavation; Resume excavation works the existing queue. They reuse the deployed fleet. This is bounded local movement, not general obstacle-aware robotics. When the player enters home or leaves the local area, following workers return to their dock.

The survey wing and rescued worker remain the existing single-award mechanics. The revised guidance groups both into one rover outing. Workshop repair and nursery actions use the actual furnished rooms. VESPER's personality remains live; written instructions are the instrument channel. The remote relay was not deployed as part of this local change.

## Verification

`npm run verify` includes opening state, legal starter layout, power economy, crew commands/actual excavation, renderer budget, save round trips, missing legacy state, no regrant, cancellation and sub-rounding paid excavation.

`npm run verify:opening` runs a disposable fresh-browser journey against `FIRSTLIGHT_URL` (default `http://127.0.0.1:5207`). It uses normal movement/steering and UI actions, without teleporting actors, awarding materials or advancing the simulation clock. Brain/visit calls are blocked; this checks deterministic instruments offline. The player's browser profile and save are untouched.

`npm run verify:browser`, `npm run verify:habitat` and `npm run verify:activities` retain explicitly marked legacy/earned-layout fixtures for their existing regressions. `npm run build` remains the build gate. No commit, push or deployment is part of this change.

Verified fresh-route result (6 September 2026): first harvest at 4m 21s; actual IndexedDB reload at 4m 22s. This is an informed automated route with normal controls, real excavation/growth time and no injected materials, actor teleports or clock skips. Screenshots and the review viewer are at `/media/opening/index.html`.

Final visual regression: rock normal derivatives are evaluated across whole fragment quads, and degenerate normal vectors retain the original normal. This fixes an actual black rover view caused by invalid fragments spreading through bloom. `npm run verify:rover-view` reads the real fine-tier framebuffer at three driving angles with MSAA and bloom enabled; dark/black counterexamples fail its pixel predicate. The opening command includes this probe. The preview uses its explicitly identified rover capture alongside the fresh-route screenshots.

Final checks passed: canonical verify/build; fresh opening and real save/reload; legacy construction/browser and touch crew controls; habitat walking/shelter/sleep; worker repair, field hatch, nursery and touch actions. Independent review findings on held-crew reach and paused guidance were fixed and rechecked. The existing large-bundle build warning remains.
