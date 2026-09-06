# Fractured workings art pass — 5 September 2026

Scope: original underground scene. No new cave campaign, collision law, save fields or light sources.

- Roof relief uses joined linear fracture profiles rather than smooth sine rings.
- Shoulder and ceiling masses are closed, folded solids whose outer faces penetrate the original enclosing rock. Shoulder bottoms sit below the exact floor; roof backs extend into the ceiling. Overlapping staggered masses create dark joints and recesses rather than separate floating stones.
- Broad facets retain the existing protected walk corridor. Triangle samples check curved-corridor clearance between vertices and move a mass outward when needed; the pure floor remains untouched.
- Basalt has quieter albedo/grain, broken bedding and restrained mineral highlights. Existing lamp, amber route cable, fear modes and four-light budget remain.
- Wall spiders probe nearby rendered fracture geometry, adopting the actual point/normal instead of crawling behind the older smooth shell. The probe is limited to nearby z-bounds and low-polygon fracture meshes.

Files: under-geometry.js, under-material.js, underlayer.js, under-swarm.js. The shell remains closed and the three instruments remain at their existing coordinates.

Evidence: media/cave-art-pass/before-{23,72,116}.png captured before editing; after-{23,72,116}.png uses the same underground checkpoints/heading and 1280x800 real renderer. Concurrent astronaut work changes the character between captures, so these are cave comparisons rather than byte-matched whole-scene pairs. Capture code is disposable at media/cave-art-pass/capture.mjs. Browser shader/runtime error array was empty.

Focused verification: verify-under-render, verify-underworld and verify-source-size passed. Existing verify-under-render checks exact lower-shell floor agreement, enclosed/inward normals, outward solids, clearance, lamps, reduced-motion marks and resource disposal.

Visual limitation: the protected route still has the old channel floor, chamber sizes and linear progression. This pass makes the workings more fractured and less uniformly rounded; it does not establish a branching natural cave network or surveyed Martian geology. No imported assets, state migration, commit or deployment.

Live verification: original live-underworld run was interrupted by concurrent Vite hot reload (window.marsstead disappeared). A disposable copy with its own HMR WebSocket closed passed the full descent/input/pause, three instruments, checkpoint save/reload, return upgrade, intense/lamp-off, narrow layout and actual touch joystick/return checks. Evidence is in media/cave-art-pass/live/. Maintained shared capture scripts were not changed.
