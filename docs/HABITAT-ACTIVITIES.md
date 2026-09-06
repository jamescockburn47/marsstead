# Habitat activities — local playable slice, 5 September 2026

These activities run in the original Marsstead world and the exact completed
`burrow.cells` interior. They do not use the rejected Frontier art prototype.

## Recover and repair a worker

- Find the disabled mechanical spider at the field service hatch beside the
  First Light survey station (world x 118, z -87). Walk close and press E, or tap
  Recover worker. The recovered machine rides with the player or buggy.
- Build a Works Bay, install the airlock ring, and enter the habitat. Approach
  the workbench. Separate E presses place the worker, run its diagnostic,
  refit the recovered drive coupling, and fit/pack the excavation attachment.
- Return to the field hatch on foot and deploy the equipped worker. Its auger
  works for 12 active simulation seconds, clearing the lid and opening a second
  entrance into the existing workings. E opens the usual optional-depth prompt.
  Leaving the workings returns to this field position.

The worker is a unique recovered machine, separate from the ordinary production
fleet. Repair reuses its own coupling; this first repair does not charge inventory.
The diagnostic arm provides a deterministic instrument result. Ask VESPER sends
the player's request through the existing live dialogue channel with actual
activity state. No prerecorded personality or new relay deployment is involved.

## Grow an expedition ration

Build a Garden Room in the sealed habitat. Approach the small nursery pot beside
the central aisle. E plants, then waters it. Visible growth takes 60 active
simulation seconds in this introductory cycle. E harvests a ready plant and
packs one tomato ration. Eat tomato consumes it and grants a rested breathing
bonus for at least one Mars hour, retaining any stronger active rest benefit.
The baseline bonus reduces surface and underground air consumption by 8.75%.

The first seed/water cycle is supplied with the bed. This is one repeatable
nursery crop, not a complete farming economy. Packs hold nine rations; a full
pack leaves the ripe crop available until there is room. Crops neither wither
nor advance while offline. Pause and modal activity screens halt this progress.

## Persistence and room expansion

`activities` is additive save state: ordered worker phase, excavation progress,
crop phase/growth, harvest/ration counts and assigned workshop/garden cells.
Legacy saves start with the unrecovered worker and empty pot. Once assigned,
adding another workshop or garden does not move the activity. Other rooms direct
the player to the assigned diagram cell. One workshop and one pot host this slice.

All actions check proximity, phase, pause and shelter as appropriate. Repeated
input cannot duplicate the recovered machine, excavation unlock or harvest.
Existing home production remains available through Production overview in a bay.

## Evidence and checks

- `npm run verify`: includes pure activity transitions, malformed save bounds,
  room assignment stability and actual save serialization round trips.
- `npm run verify:activities`: isolated browser save; recovery, actual bench
  approach and repair inputs, multiple rooms, real-time crop growth, pause,
  excavation, field descent/return, persistence, eating, and touch buttons.
- `npm run verify:habitat` / `npm run verify:underground`: existing walking,
  collision, shelter, sleep, return, instrument and touch regressions.
- Browser evidence is written to `media/habitat-activities/`. Fixtures build
  through the construction rules with accelerated excavation; surface/room
  checkpoints are staged, then the changed interactions use actual controls.
  Brain requests are deliberately unavailable in these disposable tests; they
  establish the instrument fallback, not the quality of live VESPER dialogue.

This slice has a short repair sequence, one crop and an alternative entrance.
It does not yet contain a branching repair puzzle, multiple crop economies,
cooperative ownership, a new cave campaign or a fully embodied VESPER companion.
