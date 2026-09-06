# Whole-game reset: first review package

> Visual direction rejected by James. The Frontier art study lost the original character and must not be migrated. See [Visual identity correction](VISUAL-IDENTITY.md). The gameplay audit remains evidence; its existence does not justify replacing the original visual language.

5 September 2026. Local prototype and evidence only; no deployment or save changes.

## Delivered

- Whole-game expert audit with 22 renderer screenshots and explicit staged-coverage limits: `docs/reviews/2026-09-05-whole-game-play.md`.
- Architecture keep/rebuild assessment: `docs/reviews/2026-09-05-redesign-architecture.md`.
- Navigable, separate Three.js art study: `/prototypes/frontier/index.html`.
- Visual comparison and decisions: `/prototypes/frontier/review.html`.
- New geometry for geological basin, station, rover, suit and VESPER body. Three light conditions, four camera presets, modest graphics toggle and touch/keyboard camera movement. This is camera exploration, not a new gameplay controller.

## Acceptance and judgement

The review establishes that the shortfall spans the whole game. Preserve tested geography, simulation and home-layout foundations, but rebuild the presentation and physical activity loop. No old visual subsystem is automatically the quality standard.

The prototype is an exploratory model/composition study, not an approved replacement. Its first pass was rejected for flat ground, striped cake-like rock forms and a glossy bubble canopy. Subsequent iterations corrected the cliff winding/culling defect, smoothed shared rock normals, revised mineral shading, windshield/frame, pressure windows, astronaut proportions and batching. Those corrections do not establish final art quality. Geological forms remain too regular; materials and architecture still need more convincing detail and variation; the suit is a static/idle study and does not establish animation quality. Do not transfer this wholesale into the game or claim an across-the-board visual improvement.

## Checks

`node scripts/shots-frontier.mjs` exercises four views in three light treatments, modest graphics, real keyboard movement, mobile touch input and outward geological normals, with browser/shader error checks. Captures and diagnostics are in `media/redesign/`. Runtime `npm run verify` and `npm run build` pass; the existing large-bundle warning remains. The normal build still packages the normal game, not this dev-only HTML entrypoint. A fresh harness review found no material defect. No child playtest or live dialogue-quality evaluation was performed.

## Next implementation boundary

Use the audit to build the first complete expedition in an isolated route: land, help VESPER, restore a refuge, drive toward an identifiable destination, solve a physical task and bring back a visible reward. First settle the art direction through these ordinary views; adding content or trailers must not conceal the unresolved visual quality gap. The separate prototype preserves a direct baseline comparison and cannot activate persistence, telemetry or VESPER calls.
