# Original surface industry fittings — 5 September 2026

The original kiln, horizontal tanks/mill, ring assembler, tilted array, battery rack, towable rig and surface build grammar remain. `industry-fittings.js` adds fitted hardware at those original coordinates: service flanges and unions, clamps, valve wheel, motor fins, workbed rails, panel-cell divisions, battery busbars, mast guide rails, an auger following the existing mast fold pivot, stabiliser feet, panel fasteners and airlock seals/latches. No source lights or gameplay state were introduced.

Parts batch by finish within their own attachment group. Moving parts attach to the existing parent (mast and legs); original queue glows remain independently controlled. The normal machine placement ghost retains the original coarse silhouette, appropriate for the unchanged footprint.

Evidence is an exact Three renderer stage importing the real layers, with a fixed camera/light/counterpart arrangement: media/industry-art/before-machines.png and after-machines.png, corresponding rig and stead pairs. This is equipment inspection on a plain ground stage, not a claim of a complete gameplay journey. The script and stage remain disposable in that media directory; no player save is loaded.

Checks: verify-industry-fittings, verify-machines, verify-mine, verify-build and verify-source-size passed. The rendering check verifies state immutability, work-glow transitions, mast/leg attachment, bounded finish batches, finite geometry and no added lights. The source functions add detail to existing geometry rather than changing the collision or production contract.
