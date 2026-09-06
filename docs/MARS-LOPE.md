# Mars gait rebuild — 6 September 2026

Implemented and locally verified. No commit, push or deployment; unrelated dirty-tree work and the player's save preserved. Runtime remains procedural-only. Analysis videos and captures are ignored media, not game assets.

## Change and diagnosis

The rejected gait had independent physics/animation clocks, frozen flight poses and two-foot resets. Its final foot solve also erased toe-off styling. Passing isolated foot-contact tests did not establish coherent movement.

`stepTravel` now owns alternating support/flight state and publishes the current state after physics integration, including touchdown. Surface and workings consume the same state. `colonistlope` derives supporting toe pivot, hip load/extension, restrained recovery, balance arms and torso/pack movement from it. Initial support uses the actual planted boot without counting the resolved displacement twice. Habitat remains at precision pace; input and collision response retain their existing paths.

Stopping preserves the recovering boot and lowers the supporting heel, followed by a .24s settling step. Heading rotates through turns instead of flipping with velocity; flight starts from actual ankle offsets in world axes. Manual jumping preserves takeoff joint seeds. Manual landing no longer reinterprets a newly planted boot as a fictitious mid-walk swing; slow movement resumes through the existing settling step.

## Actual video reference and visual iteration

Apollo footage was downloaded and inspected in sequential frames, including close passages and distinct gait types. `/media/lunar-reference/index.html` provides original-rate and slow playback:

- Apollo 15 `a15v.1475315.mpg`: travelling astronauts, comparatively long legs and lateral torso/pack transfer; NASA footage digitised by Ken Glover. https://apollojournals.org/alsj/a15/a15.heatflow2.html#1475315
- Apollo 11 `a11v_1101342.mpg`: Aldrin's mobility experiments, turns and recovery steps; digitised by Kipp Teague. TV ghosting limits joint inference. https://history.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.mobility.html#1101342
- Apollo 17 `a17v_1670930.mov`: deliberate downhill two-foot hopping, distinct from alternating travel; digitised by Peter Dayton. https://www.apollojournals.org/alsj/a17/video17.html

The first rebuild overworked the knees and arms. The next close capture still brought both boots ahead of the body and looked seated. The final pass keeps the unloaded boot lower and behind the hip, with quieter arms and a pack carried with the torso. These are observed lunar coordination references and an artistic Mars adaptation, not measured Mars motion capture. Supplementary reduced-weight evidence: Keime et al.2023, Table1, https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1201253/full .

Lead inspection covered normal/quarter-speed lope playback, successive fast-bound frames, startup/release, turning, the exact manual landing frames, and actual surface/workings camera samples. Close views show low trailing-foot recovery and distinguish contact from flight. The routes cross rising terrain, which shortens flights; they are not level-ground laboratory timing fixtures. Camera tracking was corrected to follow local ground and retain the full astronaut. Old motion in `/media/visual-session/index.html` is explicitly rejected/superseded.

## Deliverables and verification

- Motion preview: http://localhost:5207/media/mars-gait/index.html — five actual-game clips: easy lope, fast bound, turn/manual jump, workings and surface camera. Play/Pause, 1x/.5x/.25x, frame stepping and scrubbing checked; one active clip at a time.
- Play: http://localhost:5207/?play . Controls remain WASD/touch, Shift for faster bounds and Space for manual jump where allowed.
- Reproduce capture: dev server on configurable `LOCOMOTION_URL` (default http://127.0.0.1:5207), then `node scripts/live-locomotion.mjs`; installed Edge/`CHROMIUM_PATH`, ffmpeg, 60Hz simulation/30fps images, sequential disposable browser contexts. `LOCOMOTION_CLIPS` optionally selects comma-separated clip IDs.
- `media/mars-gait/evidence.json`: all five final captures, no browser/shader errors. Side-view full-actor framing enforced, at least318 projected pixels. Manual jump reached .571m above actual terrain. Numbered PNGs and60Hz telemetry remain with each clip. Earlier iterations retained separately.
- `npm run verify` and `npm run build` pass. Existing bundle-size warning remains.
- `npm run verify:browser`, `npm run verify:habitat`, `npm run verify:underground` pass: first-use movement/jump, touch, pause, connected habitat walking/collision/shelter/sleep, underground entry/tasks/return, and disposable save/reload. Logs: media/mars-gait/{verify,build,browser,habitat,underground}.log.
- Actual Three.js hierarchy regressions: contacts at30/60/120Hz;36 phase-specific releases;18 reversals;12 loaded manual takeoffs;9 manual landings and resumed travel. These bound discontinuities/contact errors, not visual quality.

Fresh independent review confirmed the material fixes in original reproducers: release handoff ankle discontinuity323mm→.23mm; reversal's425mm takeoff snap eliminated; manual landing root-relative846mm→39.9mm and pelvis drop140mm→6.9mm. No remaining material regression found in reviewed scope.
