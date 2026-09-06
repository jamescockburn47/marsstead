# The workings — playable expedition

Implemented locally, 5 September 2026. This follows First Light: build the first
shaft, open the Burrow console and choose **Explore the workings**. These are
human-excavated galleries below the settlement, not a claim about surveyed natural
Martian caves. The home cutaway remains a separate management view.

## Experience

A 150 m descending route connects three chambers. Fractured strata, projecting
rock shelves, procedural mineral veins and roughness variation catch the suit's
narrow beam. Warm cable markers indicate the route back. One shadow-casting lamp
and a small local light budget keep darkness meaningful without lighting every
worker individually. Chamber machinery gives each stop a distinct silhouette.

Six-legged mechanical workers share a procedural rig and ceramic, graphite and
copper design with the surface drones. Digging, fabrication and repair variants
have different tools. Underground workers crawl across the floor, walls and
ceiling; the beacon gathers nearby floor workers. They are unsettling industry,
not enemies that attack the player.

Three ordered instruments teach the light modes: Worklight at the relay, Beacon
at the worker colony, Survey at the lattice. Hold position during each 2.5-second
reading; moving away, jumping, extinguishing the lamp or changing to an incorrect
mode interrupts it. Returning with all readings grants a persistent 15% excavation
speed improvement. Repeating the route cannot multiply that reward.

Keyboard: WASD, Shift to hurry, Space to jump, F/C to change light mode, L for
lamp, E to use an instrument or leave near the entrance, V for voice. Touch has
movement, instrument and mode controls. Return to surface is always available.
Gentle, Uneasy and Intense adjust atmosphere independently of survival pressure.

## State and evidence

The underground session owns its position, camera and collision frame. Surface
coordinates remain the save authority; readings persist, but a reload starts
safely above ground. Surface industry continues while exploring; pausing freezes
simulation. The avatar and renderer return to their surface parents/settings on
exit. No inventory reward is minted by scanning or reloading.

- `npm run verify`: canonical headless checks, including route geometry, saved
  progression, worker gait and procedural rendering contracts — passed.
- `npm run build`: passed; existing large bundle warning remains.
- `npm run verify:underground`: against the local Vite server, passed entry,
  walking, pause, interrupted/ordered readings, save/reload, reward, avatar return,
  text scaling, voice dispatch and real touch joystick input. Set `FIRSTLIGHT_URL`
  to change its default `http://127.0.0.1:5207` target; `CHROMIUM_PATH` can override
  the installed Edge executable. Tests use disposable saves and station checkpoints.
- One fresh integration review found voice dispatch and text scaling defects;
  both were fixed and rechecked. Screenshots live in ignored `media/underworld/`.

This is the first complete expedition, not the full cave campaign. Branching
natural caves tied to real entrance candidates, richer excavation/manufacturing
simulation and a longer mystery remain future work. Current worker tools and
chamber machinery communicate industry visually; they do not cut arbitrary
player-authored tunnel geometry. Child/adult playtests, controller support and
hosted VESPER evaluation have not been established by these automated checks.
Nothing was committed, pushed or deployed.

## Surface fleet follow-up

The surface fleet now has two presentation classes, with a shared deterministic
classification in `src/dronefleet.js`: the default three units are two spiders
and one flying drone. Flyers have four guarded rotors, a survey camera and a
light-haul carrier; spiders keep their digging/fabrication tools. The habitat
cutaway and fleet readout use the same classification. Total deployed count,
saves and the existing shared work budget are unchanged. Separate class-specific
job allocation and resource economics are not yet simulated.

Canonical verify/build and focused fleet checks pass; a fresh review found no
material defects. A browser-rendered model comparison is in
`media/fleet/two-classes.png`. `node scripts/demo-home.mjs` generates an eight-step
habitat walkthrough at `/media/habitat/index.html` on the dev server, using real
planning/excavation/rendering code with accelerated time and available power.
It never touches a player save. Browser checks cover its navigation and phone
width. This disposable demonstration is not shipped game UI.

## Delivery

Used three bounded subsystem owners (route/progression, cave rendering, worker
rig), one integration owner and one fresh reviewer. Focused checks stayed with
their owners; the assembled journey was tested after material fixes. Keep
this pattern for subsequent playable slices, with the project workflow in
AGENTS.md; do not add a tier ceremony or orchestration framework per feature.
