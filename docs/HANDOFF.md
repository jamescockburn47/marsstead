# HANDOFF — continuing the Marsstead build

*(The standing brief for the next working session. Read order:
CLAUDE.md → docs/DESIGN.md → docs/STRUCTURE.md → docs/OVERVIEW.md →
the session memory files. Then this.)*

## The prime directive this pass: THE VISUALS

James's words: **"this could all be let down by crap visuals."** The
story, the AI co-star and the systems are ahead of the look. Every hour
of this pass should ask: *does the screen deserve the design?* The
standing rules:

- **Light is the king.** The atmosphere is the world's renderer. Spend
  polish on light, dust and motion before geometry — the blue-hour halo,
  Phobos-light, the lamp cones, the furnace glow, the buried-lantern
  crown at night.
- **Zero assets, per-pixel fractal everything.** feTurbulence/fbm is the
  house workhorse in both GLSL and SVG. NO particle systems, ever
  (standing verdict). NO polygonal cloud blobs, ever.
- **The colour law**: Mars owns the warm hues; cool colours are reserved
  for life and choice (the greenhouse green, the teal of drone eyes and
  sockets, Earth in the evening sky). The deep may break the law — that
  is the horror's signature, not a bug.
- **Judge by instrument, not by eyeball-loops**: `npm run shots` (the
  six-light contact sheet) and `node scripts/shot-burrow.mjs` are the
  review tools; the kiosk guard blocks Browser-pane screenshots. One
  first-light screenshot per genuinely new pipeline; after that, numbers
  and the sheets. Send sheets to James — his eye is the gate.

**Concrete visual debts, roughly in value order:**
1. The terrain material's second pass — richer per-pixel detail bands,
   slope-keyed albedo variety, crisper near-field normal work.
2. The crown/drones/works as a *place* — the surface base should read as
   a lived settlement at a glance (glow, wear, cables, dust banks).
3. Sky polish — Milky Way vividness at altitude, dust-storm skies when
   the storm register lands, the sun's dusty shafts.
4. The Seed's visual register when Stage 4 starts — clean geometry and
   cool light, deliberately slightly *wrong* against the planet.
5. The colonist rig's read at distance (silhouette, visor glint).

## State of the build (v0.0.43, all green)

29 verify scripts; deploys via `npm run deploy` from main (gates on
clean/pushed/verify). The EVO brain is a MANUAL three-file deploy:
`scp src/vesperbrain.js src/gamefacts.js src/power.js
evo-tailscale:~/marsstead/brain/src/` + restart `marsstead-brain`.
gamefacts may ONLY import power.js (the MOLA chain crash-loops the
relay). All prices live in power.js.

Shipped: the Burrow (dug warren, Sanctum-logic console, warren report),
power-as-currency (ground-break debits, shed ladder, WAITS ON CHARGE,
landfall economics), the Works chain + console + grid strip, drone
fleet as equipment, minimap + permanent trails, VESPER complete
(live-only personality, phase-scoped canon, mini-RAG facts interpolated
from constants, text + voice, first-sol briefing with offline fallback,
LANDFALL ORDERS sheet, chatter discipline).

## The build queue

1. ~~Bake the agreed canon~~ DONE 2026-07-19 (see OVERVIEW §7's note):
   canon + LORE_FACTS corpus + regard.js + tag + Pairing Review, all
   gated (verify-regard, extended verify-vesperbrain). The relay file
   changed too — EVO deploys now ship server/vesper-relay.mjs alongside
   the three brain files when the tag contract moves.
2. **Stage 3 — the hopper** (STRUCTURE.md): plotted semi-cinematic hops,
   payload/fuel decisions, pads and depots. NEVER continuous low-level
   flight over streamed terrain. The ascent is the showreel — budget its
   look accordingly (the altitude sky ladder, the limb band).
3. **Stage 4 — the Seed** stages 1–2 + engineering console (the console
   language exists; the Halcyon glyph for underived choices from day
   one).
4. Charter-record save export on the title screen when convenient.

## Discipline (non-negotiable)

Pure logic in no-THREE/no-DOM modules, one verify script per feature,
gate green before every deploy. Determinism everywhere shared. Kid-safe
always. VESPER: personality live-only; safety never live-only; no plot
word in any prompt (the gate enforces it); update her brief AND the EVO
with every mechanics change — a stale brief makes her lie. Keep
docs/OVERVIEW.md current as the single narrative truth. When in doubt
about tone or scope: the founding doc's line — beautiful and dangerous,
always fun, always kid-safe.
