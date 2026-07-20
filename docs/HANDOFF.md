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

## 2026-07-20 — the release push (v0.0.53+)

Shipped this pass: the WARDEN (hashed key, F9 bench — the fast test
path; key with James, hash in warden.js), hopper flight drama
(ignition hold-down, settle, fractal scour, shake channel), the pad
system KILLED (assemble at the assembler, every landing exact), the
GLOBAL planet (MOLA 4ppd whole + USGS gazetteer, ~97 named features on
the charts), the stratigraphy palette, THE FROST GLINT centrepiece
(sword-of-the-sun corridor on ground frost — dawn blazes, noon quiets,
caps shimmer from altitude; frost.js is the pure model), and THE
SIGNAL CHAIN (marslegends: five beats at real places, band + sweep +
reading act + THE RECORD journal + VESPER moments; mystery rides the
save). The five beats' relics carry the tone ladder and never a plot
word — her ignorance stays real.

## The build queue

1. ~~Bake the agreed canon~~ DONE 2026-07-19 (see OVERVIEW §7's note):
   canon + LORE_FACTS corpus + regard.js + tag + Pairing Review, all
   gated (verify-regard, extended verify-vesperbrain). The relay file
   changed too — EVO deploys now ship server/vesper-relay.mjs alongside
   the three brain files when the tag contract moves.
2. **Stage 3 — the hopper: FLYING since v0.0.49** (2026-07-19). Shipped:
   the flight core (verify-hopper), the pad + assembly + console
   (hopconsole.js — fuel circle, honest descent ellipse, cradle, tanks,
   LIGHT THE ENGINE), the staged flight with the altitudeLight sky
   ladder + limb band (verify-marslight), the per-hop MOLA vista
   (vistalayer.js), saves, VESPER moments + facts. Proofs: live-hop.mjs
   (whole flight in-browser), shot-hop.mjs (ascent/crest/descent
   frames). KNOW THIS: the world is 1:200 (~107 km around) — hopper
   reach is world-compressed via hopper.WORLD_RANGE (1 tank ~1.5 km,
   full rack ~27 km); long hops genuinely change latitude/local time
   (18 km north is the arctic; east flies into evening) — a feature,
   surfaced nowhere yet. REMAINING POLISH, in value order: (a) launch
   scour ring + landing dust cloud in the swirl register (fractal, no
   particles); (b) the cradled buggy visibly riding the hoops in
   flight; (c) depots (far camps) as placeables; (d) leg-squash on
   touchdown; (e) a hop-time/lat-shift readout on the console so the
   climate swing is legible before ignition; (f) James's eye on the
   craft + frames — iterate on his notes.
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
