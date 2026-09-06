# Plan the home, then live inside it

Implemented 5 September 2026 following James's correction. The old console-only
doctrine is superseded. Completed `burrow.cells` drive both the 2D planning view
and the walkable 3D interior; there is no second invented or separately saved home.

After the first shaft is dug, **Enter your home** in the Burrow opens a first-person
interior. WASD/touch movement passes through door openings into adjacent completed
rooms. Solid walls and furniture block movement. Q/F or ladder buttons change
between finished shaft levels. B opens the actual construction diagram, and newly
completed rooms appear inside without a reload. Surface return remains available.

Sealing the home restores air and warmth while indoors. An unsealed excavation
remains cold and consumes suit supplies. In a sealed bunk, E/R starts the existing
sleep-until-dawn simulation after sunset, restoring supplies and applying the
existing rested benefit. The workshop terminal displays the existing production
chain; it does not add remote fabrication actions. Garden and storage furnishings
are present, but dedicated gardening and indoor cargo-transfer loops remain future
work. The implemented slice is inhabitation, recovery, sleeping, planning and
connected exploration, not every proposed room interaction.

Exploring the workings from home remembers the room to return to; cancelling the
descent also returns there. Interior positions are session state only: saving and
reloading preserves actual rooms, inventory and progression, and starts safely at
the original surface coordinates. Leaving during sleep cancels the unfinished
animation and clears its veil, without carrying it into another scene.

## Evidence

- `npm run verify` includes `scripts/verify-habitat.mjs`: completed-room geometry,
  swept collision through doors, furniture, level isolation, batched geometry and
  bounded lighting/resource disposal.
- `npm run verify:habitat`: real browser walk from shaft through corridor into
  bunk; solid walls; warm/air recovery; night sleep; ladder travel; home-to-workings
  return; planner entry/exploration; interrupted sleep; pause; save/reload;
  actual touch movement and exit. Passed against the local Vite server.
- Production build passed with the existing large-bundle warning.
- One fresh review found sleep-transition and planner-routing defects. Both were
  fixed, regression-tested and rechecked. No further material review findings.

The fixtures use disposable browser saves and accelerated construction setup;
they do not change the player's save. Screenshots: `media/habitat-live/`.

## Teaser

`media/teaser/marsstead-teaser-45s.mp4` is a 45-second 1280×720, 24 fps H.264/AAC
development-gameplay montage with original procedural music. It includes actual
planet/descent, settlement, night buggy, both drone classes, planning, inhabited
home and underground footage. Cinematic cameras and expanded construction states
are staged in an isolated context. No fake VESPER quotation or third-party music
is used. Capture/edit scripts: `scripts/teaser-capture.mjs`,
`scripts/teaser-edit.mjs`; detailed provenance and encoding evidence accompany
the media. The full file decodes successfully and both streams are exactly45s.

Neither the game changes nor the teaser have been deployed or published.

### One-minute revision

The revised master is `media/teaser60/marsstead-teaser-60s.mp4`, with 14 seconds
of habitat/bunk/greenhouse walking, separate 5-second spider-work and flying-haul
shots, and 8 seconds of actual tunnel movement. The old 45-second file is retained.
The garden caption describes visiting, not an unimplemented tending mechanic.

Two recording/runtime defects were corrected: attract-mode buggy spawns now use
the wheel-ground height; the tunnel capture uses one simulation step per frame
and actual input, replacing manual coordinate overrides and duplicate gait steps.
`verify-colonist-contact.mjs` now includes rendered boot contact on the actual cave
floor at 24 fps. `live-work-presentation.mjs` covers grounded reel cuts and confirms
unfunded/power-shed fleets stand by while funded work produces loaded haul visuals.
Flying pickup/delivery paths are deterministic presentation of the shared work
budget, with no new material credits. The production scripts write provenance,
timings and motion evidence beside the master.

### Walking and music revision

The current output is `media/teaser60/marsstead-teaser-60s-v2.mp4`; prior masters
remain available. The earlier recording fix did not address the gait's underlying
false flight: normal walking selected a lope although movement stayed grounded.
Normal surface and interior walking now share 1.55 m/s, with supported alternating
steps, lower boot clearance, opposing arm swing and hip rise over the supporting
leg. Sprint speeds remain unchanged. Rendered six-phase comparison is in
`media/gait-sequence.png`; `media/gait-review.html` provides the moving comparison.
Focused contact, slope, turn, stop and jump tests remain intact, with added normal
walking support/hip/clearance checks. Canonical verify/build, inhabited-home desktop
and touch journeys and fresh gait review passed.

`scripts/teaser-score.mjs` replaces the noise/tick soundbed with an original
24-bar, 96 BPM instrumental arrangement: recurring piano melody, plucked parts,
cello/bowed chords, restrained percussion and a cave harmonic change. Instruments
are synthesized, not sampled orchestra recordings. The 48 kHz stereo source is
`score-v2.wav`; measured source loudness is -15.57 LUFS with -2.05 dBTP peak.
Render this score before running `scripts/teaser-edit.mjs`. The edit preserves
the 60-second duration and uses reshot habitat/greenhouse/tunnel footage.

## Silent art revision — 5 September 2026

The current master is `media/teaser60/marsstead-teaser-60s-v3.mp4`: 60 seconds, H.264, 1280 × 720 at 24 fps, with no audio stream. The former atmosphere-slice shot is replaced by a real hopper descent and touchdown. The disposable capture starts a valid fuelled hop, advances its setup clock to the final descent, and then records the actual flight state machine through its parked state. Planet-wide exploration is explicit in the opening caption; the game uses its existing compressed planetary scale and fuel-limited hops.

Habitat art now has 17.4 m² of growing beds, seven structural plant forms, thin curved foliage, soft bedding and woven cloth. See [habitat art research](HABITAT-ART.md). Greenhouse growth remains visual; this revision does not add a harvest/tending simulation.

The cave uses bends, asymmetric vaults, narrow throats, breakdown shelves and dry rough basalt. The walkable floor and rendered floor share one function. Its morphology draws on [NPS lava-cave observations](https://home.nps.gov/subjects/caves/lava-caves-or-tubes.htm) and [Hawaiian lava-tube formation](https://www.nps.gov/havo/learn/nature/lava-tubes.htm); these are terrestrial analogues, not surveyed Martian interiors. The cinematic camera follows the actual player's walking direction through the curved passage.

Excavation spiders have an articulated rotating auger and braced feet, fabricators a printer boom/spool, repair units separate tools and sensor mast. Cargo and survey flyers have different silhouettes. Visual work remains driven by funded, powered construction; it does not mint additional inventory.

Canonical verify/build and focused habitat, cave and drone checks passed after integration. The actual desktop/touch habitat and underground journeys passed. Independent review found no material defect in the revised geometry, collision or resource handling. This is a local development preview; nothing was published.
