# Marsstead — working instructions

Procedural survival-homesteading game on the real Mars (Vite + Three.js) —
third sibling to Moorstead (`C:\Users\James\Desktop\Moorcraft`) and Saltstead
(`jamescockburn47/saltstead`), same identity: **procedural-only, zero assets,
browser-first, deterministic, verify-gated**. Public client:
**www.marsstead.app** (Vercel project `marsstead`, GitHub `jamescockburn47/marsstead`).

## Start here

- **First fifteen minutes (6 September 2026):** `docs/OPENING-FIFTEEN.md` records the morning arrival, supplied small habitat, local worker commands and single rover outing. New-game seeding is versioned and does not retrofit existing saves. `npm run verify:opening` checks the fresh journey in a disposable browser.

- **Multiplayer/time correction (5 September 2026):** `docs/SETTLEMENT-NETWORK.md`
  is the approved target: separated settlements, independent pause and night
  skipping, asynchronous cargo/cooperation, own landers and optional arranged
  visits sharing time temporarily. This is a plan, not implemented multiplayer.

- **Visual identity correction (5 September 2026):** [docs/VISUAL-IDENTITY.md](docs/VISUAL-IDENTITY.md) records the original-game reference and matched comparisons. James rejected `prototypes/frontier`: do not migrate its cartoon geology or above-ground house. Improve credibility within the existing Mars atmosphere, open rover and protective buried-base language. Cooperative gameplay plans do not supersede this identity.

- **Cooperative frontier direction (5 September 2026):** see [docs/COOPERATIVE-FRONTIER.md](docs/COOPERATIVE-FRONTIER.md). Multiple useful bases, separated landings, optional cooperation and embodied VESPER supersede the solitary/one-home campaign direction. This is target design; runtime migration and multiplayer are not yet implemented. Retain existing saves. VESPER stays trustworthy; rogue machinery supplies optional soft horror.

- **Habitat correction (5 September 2026):** the player plans in the 2D diagram,
  then walks the exact completed layout in 3D. The former console-only doctrine
  is superseded by James's explicit instruction. Sealed interiors provide warmth,
  air and usable bunks; the workings are an excursion from home. `burrow.cells`
  remains the single source of truth for construction and interior geometry.

- **[docs/DESIGN.md](docs/DESIGN.md)** — the founding contract: the two USPs (the
  AI co-star VESPER; the terrifying descent), the beautiful-and-dangerous physics
  pillar (0.38 g, dust, harsh day/night), the real-Mars world model, base-building,
  the panspermia mystery, the phase plan and named risks.
- `src/` modules are small and single-purpose. Pure logic modules (mars, marsdata
  decode, marsterrain height, physics, noise, dust, marslight, steadparts,
  steadsim, marslegends, marssky maths, vesper prompt+fallback, colonistrig
  gait/IK) have **no THREE/DOM imports** and each is guarded by a
  `scripts/verify-*.mjs` check.
- `src/marsdata.js` is **generated** by `scripts/build-marsdata.mjs` from public
  NASA/USGS data (MOLA global topography + the USGS Gazetteer of Planetary
  Nomenclature) — never edit by hand. Enforced: a PreToolUse hook
  (`.Codex/settings.json` → `scripts/hook-guard-marsdata.mjs`) denies Edit/Write
  to it and shell writes at it (redirects, `sed -i`, `tee`, `cp`/`mv` onto it,
  `rm`, `Set-Content`…); reads and regeneration pass. No binary asset files at
  runtime, ever.

## Working discipline

### Delivery workflow (5 September 2026)

- The default unit of work is a playable slice, with a short acceptance list.
  Classify consequences once at the start; do not repeat A/B/C labels per file.
  James has asked for leaner execution: the tiers are a routing aid, not a
  ceremony or a reason to serialize independent work.
- The lead owns integration, shared entrypoints, save wiring and the final
  browser journey. Use up to three implementers for genuinely independent
  systems, with explicit file ownership and a brief API contract. Reuse an idle
  agent for a new bounded job; avoid repeated full-repository onboarding.
- Each implementer runs its focused checks once. The lead runs the canonical
  verify and build after integration, plus a browser pass for changed visuals
  and input. One fresh reviewer checks the final diff and real failure paths;
  fix material findings and rerun only affected checks before the final gate.
- Additional scrutiny follows a concrete risk (lost saves/materials, live
  dialogue handling, permissions, shared authority), not module count. Use
  deterministic counterexamples at those boundaries. Do not broaden a gameplay
  task into a security/compliance sweep without evidence it needs one.
- Do not build orchestration infrastructure for this workflow. Short handoffs,
  a maintained implementation note, ordinary tools and the existing verify gate
  suffice. Commit/push/deploy still require authorisation.
- New handwritten source should stay within 300 logical lines; the existing
  large modules are named exceptions in `scripts/verify-source-size.mjs`.
  Extract coherent new features
  rather than splitting legacy modules mechanically during unrelated work.

- **Guarantees are instruments, not prose.** A rule that must never fail belongs in a
  verify script, a hook, or the deploy gate — a AGENTS.md sentence has a nonzero
  failure rate. Before adding a "never/always" rule here, ask whether it should be a
  check. (The marsdata guard hook and the instrument-channel/live-speech split are
  both this principle: safety is never live-only.)
- **Big sweeps get delegated by subsystem.** Assign bounded ownership and then
  review integration once. Trivial single-file changes: just do them.
- **Review is a fresh pair of eyes.** The session that wrote a change is a poor
  reviewer of it; use an independent subagent or /code-review before deploy-worthy work.
- **Long explorations persist findings as they go** — write phase summaries to a
  scratchpad/doc before moving on, not after context is already thin.

## The two USPs (don't let a feature erode them)

1. **VESPER, the AI co-star.** A real LLM (MiniMax M3 via the EVO relay) is
   the player's personal AI companion — ALL personality is live (the rapport rule:
   canned personality is dead), with persistent memory riding the save. The
   deterministic floor is the **instrument channel** only: terse verify-gated
   safety/mechanics calls that must work relay-down. Safety is never
   live-only. VESPER never turns on the player (design rule).
2. **The terrifying aim.** The mystery pulls the player *down* into genuine
   horror — atmospheric, never graphic; opt-in by depth; always escapable (no
   death). Beautiful and dangerous, always fun, always kid-safe.

## Build & verify

- `docs/VESPER.md` records the current live-context, voice and worker-command contract.
  `npm run verify:vesper-browser` checks the browser flow with disposable state.

- `docs/WEATHER.md` records weather preparation, real sealed shelter and cleanup.
  `npm run verify:weather` covers this loop with disposable weather fixtures.

- `docs/WALKABLE-HABITAT.md` records inhabited-home behaviour and teaser evidence.
  `npm run verify:habitat` covers the walk/shelter/sleep/return/save journey.
- `docs/HABITAT-ACTIVITIES.md` records the recovered-worker and nursery loops;
  `npm run verify:activities` exercises their controls, rewards and persistence.
- `docs/VISUAL-SESSION.md` records the broad original-identity refinement and
  `/media/visual-session/index.html` comparisons. `npm run verify:visual` checks
  the comparison viewer and actual desktop/mobile text scaling.

- `docs/UNDERGROUND.md` records the playable workings, controls, save boundary
  and remaining cave campaign scope. `npm run verify:underground` exercises the
  descent against the local dev server with disposable saves.

- `npm run verify` — the headless gate. **Must be green before deploy.** Add a
  verify script with every feature; prefer testing pure modules headlessly over
  eyeballing. Browser checks (`scripts/live-*.mjs`, need the dev server)
  cover anything that only exists in a browser (the low-g walk, the streamer, the
  descent).
- `npm run verify:browser` — the First Light journey and actual touch-context
  checks against a running local server; setup and evidence in
  `docs/PLAYABLE-SLICE.md`. Test browser contexts and expanded-home art fixtures
  are disposable; do not treat them as the player's save or earned progress.
- Dev: `npm run dev` (Vite). `window.marsstead` is the live handle.

## Deploy

Use **`npm run deploy`** (`scripts/deploy.mjs`, inherited from the siblings) — not
bare `vercel`. Gates on clean tree / on-main / pushed, runs verify + build,
patch-bumps, commits, pushes, ships to Vercel. Domain: marsstead.app → www.marsstead.app.

## The EVO (home server) and VESPER

**VESPER is live** — see [docs/VESPER.md](docs/VESPER.md). Unlike the siblings'
local-Gemma brains, VESPER speaks through the MiniMax cloud API (M3 chat +
speech-2.8-hd TTS): `marsstead-brain.service` on the EVO (`:8012`, the relay in
`server/vesper-relay.mjs`) holds the key (`~/marsstead/brain/brain.env`, never
in git), Caddy `:8092` fronts it, the tunnel serves `marsstead.sovren.xyz`.
Player voice input is the browser's own SpeechRecognition (MiniMax has no ASR).
The Admiralty Board (`:8099`) still wants a Marsstead "brain" card like
Moorstead's. Reachable via `ssh evo-tailscale`.

## Identity invariants (inherited, non-negotiable)

1. Browser-first, procedural-only, **zero binary assets**. Smooth-shaded with
   per-pixel procedural shader detail (never displacing the drawn surface),
   `BufferGeometry` in code. (Amended from "low-poly flat-shaded" — see
   DESIGN.md invariant 1. Never port Saltstead's polygonal cloud fleet.)
2. Kid-safe shared worlds: server-authoritative caps, `escHtml` everywhere, no
   griefing surface, horror never graphic, add-only shared steads.
3. The verify gate is the contract: pure logic imports no THREE/DOM so Node runs it.
4. Determinism: terrain/weather/ore/mystery from stable seeds + baked tables.
   Never `Math.random()` for anything shared. The two authored non-deterministic
   things — the player's stead and VESPER's live speech — carry explicit data and
   a deterministic floor respectively.
