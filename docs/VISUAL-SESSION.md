# Sustained visual pass — 5 September 2026

Authorised: improve all visual areas while retaining original Marsstead character.
Local reversible render work; no deployment or player-save changes. The rejected
Frontier prototype remains excluded. Source stays procedural-only.

Ownership: habitat art (Dewey), geological workings (Meitner), astronaut/rig
(Raman), surface equipment/materials and integration (lead). Each captures its
baseline before editing, checks its changed renderer, and supplies focused proof.

Priorities: believable materials under limited practical lights; varied organic
greenhouse; protective inhabited rooms; geological irregularity and machine
intrusion; pressure-suited astronaut; purposeful lander and drone detail. Keep
terrain height/collision, room layout, save state and existing game verbs intact.

Root comparison capture: `node scripts/shots-visual-session.mjs before|after`.
The completed comparison is `/media/visual-session/index.html`.

## Delivered

- Habitat: directional overhead/bedside/grow lighting, pressure-lined ceiling,
  service panels, berth storage, softer cloth and branching compound foliage.
  Three pooled lights and one shadow light; original room/collision dimensions.
- Astronaut: shaped cloth limbs, smaller joint masses, framed visor, helmet
  protection, hoses, pockets/gloves and pack hardware. Original skeleton/physics.
- Workings: jointed roofs, wall-rooted geological masses and quieter basalt.
  Wall workers attach to new rock faces. Floor/path unchanged, four-light budget.
  Existing near light moved lower to clarify supported boot contact.
- Worker machines: deep rotor ducts/stators, sensor recess, radiator, service
  seams and muted industrial coatings; same fleet counts and tool contacts.
- Surface industry: original kiln, tanks, mill, assembler, PV array, battery,
  towable rig and build-panel fittings; deployment pivots and work glows retained.
- Lander: corrected canopy/hull intersection, service-bay fittings, hull joints,
  inspection covers, pistons and cooling detail. Night reflection fill falls so
  the studio environment no longer illuminates the whole hull.
- Surface rocks: physically lit rough material and small fracture/dust shading
  on the original rock geometry. Terrain height/colour laws remain unchanged.
- Instruments: restrained consistent panels, primary action emphasis, irrelevant
  disabled ladder buttons omitted. Text scaling preserved.

## Evidence and verification

The review page contains 15 before/after pairs and silent actual walking clips.
Rooms, machines and industry use controlled renderer stages importing game modules.
Surface/cave images use staged positions in the game. Cave imagery also includes
concurrently improved suit detail; do not claim a pixel-identical whole-scene
baseline. A rock camera intersected scene equipment and is excluded; the
stone-refinement stage isolates the original geometry under the same lamp instead.

Actual WASD recordings cover surface/cave walking and release to stop. Supported
foot telemetry and the visual sequence did not justify rewriting the gait. The
near-light adjustment addresses an apparent cave contact ambiguity; recordings
predate that small correction. No soundtrack was added.

Independent review found two text-scale overrides, now corrected and guarded by
computed desktop/mobile font-size checks in live-visual-review.mjs. No outstanding
material review findings. Review covered shaders, clearance, ownership/disposal,
light/batch limits and accidental simulation/save changes.

Passed: canonical verify/build; First Light desktop/touch; habitat shelter,
sleep, walking and return; underground instruments/fear/pause/touch; worker/crop
actions with real growth, save/reload and touch; comparison images/controls/phone
width and text scaling. New suit, ship and industry render checks are in the
canonical gate. Existing large-bundle warning remains; this does not establish
universal low-end-device frame rates.

A First Light run was interrupted by development HMR while styling changed.
Disposable test contexts now block HMR, consistent with habitat tests; the rerun
passed. The application's runtime networking is unchanged.

## Remaining limits

This is refinement within the established style, not photoreal replacement art.
The caves remain the existing linear route. Complete embodied VESPER, richer
campaign geography and asynchronous multiplayer remain separate gameplay work.
No deployment, commit/push, binary runtime assets, save migration or changes to
the player's actual stored world were made by this session.
