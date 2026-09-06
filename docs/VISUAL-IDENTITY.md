# Original Marsstead: refinement, not replacement

James rejected the Frontier prototype on 5 September 2026: its cartoon geological forms and above-ground house lost the character of the game. That direction is rejected, not an alternative to migrate later. Its files remain only as a record. This correction governs visual work alongside the cooperative gameplay direction.

## Creative reference

The existing game supplies the identity: vast exposed Mars, real planetary geography, harsh day/night contrast, dust and atmospheric distance, the open utility rover, low buried-base shaft heads, protected underground rooms and limited practical illumination. Strengthen physical credibility within this language. Above-ground domestic houses, whimsical rock masses and a generic stylised space settlement do not fit.

Human warmth belongs inside engineered protection. Surface equipment should show its purpose through pressure seals, structural connections, shielding, tools and wear. Equipment detail must support the night image, not require extra unmotivated lights. No approved ambition requires replacing the terrain shader, sky, existing vehicle silhouette or underground habitat with the rejected prototype.

## First matched pass

View `/prototypes/original/index.html`. Five pairs use the real game renderer and the same camera, orientation, clock, exposure, terrain, vehicle position and lamps within each pair. Capture uses a disposable developed-settlement fixture and never a player save. The baseline disables only the new finish groups and restores the original wheels and seat pieces. Original source geometry remains available for this exact comparison.

- Open rover: preserves chassis, axle positions, sensor mast, roll hoop, solar deck, seat location and headlights. Adds smoother wheel drums, restrained metal rim/spoke/grouser detail, padded covers, foot rests, fittings and solar-cell divisions. New wheel geometry follows the existing steering, spin and suspension groups.
- Buried crown: preserves collar, hatch, ring and lights. Adds shallow locking clamps, gaskets, inspection joints, fasteners and lifting grips within the original footprint. No surface building or additional room is introduced.

This is deliberately a small equipment refinement. It does not solve geological variety, astronaut animation, embodied VESPER or the larger gameplay redesign. At wide night viewing distances differences should remain subtle. No new lighting, gameplay, save or collision rule was introduced.

## Evidence

- `node scripts/shots-original-refinement.mjs`: five exactly matched image pairs, real day/night lamp checks, browser/shader checks, slider viewer and narrow layout.
- `node scripts/verify-equipment-render.mjs`: unchanged chassis/wheel/light transforms under toggles, bounded wheel dimensions, existing entrance footprint and mesh batching. Included in `npm run verify`.
- Canonical verify and build passed; existing large-bundle warning remains.
- One independent review found no material issue with attachment, visibility toggles, material ownership, state isolation or capture invariants.

No deployment, commit or save migration. Further visual work should begin from a named original-game reference, show matched evidence and preserve the qualities that reference demonstrates.

## Sustained refinement pass

The later broad pass is recorded in [VISUAL-SESSION.md](VISUAL-SESSION.md), with
15 before/after comparisons at `/media/visual-session/index.html`. It covers
habitat lighting/materials/plants, astronaut construction, fractured workings,
worker classes, the lander, surface industry and stone materials. This develops
the original identity; the rejected Frontier prototype remains rejected.
