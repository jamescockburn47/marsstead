# Marsstead — working instructions

Procedural survival-homesteading game on the real Mars (Vite + Three.js) —
third sibling to Moorstead (`C:\Users\James\Desktop\Moorcraft`) and Saltstead
(`jamescockburn47/saltstead`), same identity: **procedural-only, zero assets,
browser-first, deterministic, verify-gated**. Public client:
**www.marsstead.app** (Vercel project `marsstead`, GitHub `jamescockburn47/marsstead`).

## Start here

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
  (`.claude/settings.json` → `scripts/hook-guard-marsdata.mjs`) denies Edit/Write
  to it and shell writes at it (redirects, `sed -i`, `tee`, `cp`/`mv` onto it,
  `rm`, `Set-Content`…); reads and regeneration pass. No binary asset files at
  runtime, ever.

## Working discipline

- **Guarantees are instruments, not prose.** A rule that must never fail belongs in a
  verify script, a hook, or the deploy gate — a CLAUDE.md sentence has a nonzero
  failure rate. Before adding a "never/always" rule here, ask whether it should be a
  check. (The marsdata guard hook and the instrument-channel/live-speech split are
  both this principle: safety is never live-only.)
- **Big sweeps get delegated.** Multi-module audits/reviews: per-file subagent passes,
  then one cross-file integration pass — one context over dozens of files dilutes
  attention. Trivial single-file changes: just do them, no ceremony.
- **Review is a fresh pair of eyes.** The session that wrote a change is a poor
  reviewer of it; use an independent subagent or /code-review before deploy-worthy work.
- **Long explorations persist findings as they go** — write phase summaries to a
  scratchpad/doc before moving on, not after context is already thin.

## The two USPs (don't let a feature erode them)

1. **VESPER, the AI co-star.** A real LLM (MiniMax M3 via the EVO relay) is
   the player's only companion — ALL personality is live (the rapport rule:
   canned personality is dead), with persistent memory riding the save. The
   deterministic floor is the **instrument channel** only: terse verify-gated
   safety/mechanics calls that must work relay-down. Safety is never
   live-only. VESPER never turns on the player (design rule).
2. **The terrifying aim.** The mystery pulls the player *down* into genuine
   horror — atmospheric, never graphic; opt-in by depth; always escapable (no
   death). Beautiful and dangerous, always fun, always kid-safe.

## Build & verify

- `npm run verify` — the headless gate. **Must be green before deploy.** Add a
  verify script with every feature; prefer testing pure modules headlessly over
  eyeballing. Live puppeteer checks (`scripts/live-*.mjs`, need the dev server)
  cover anything that only exists in a browser (the low-g walk, the streamer, the
  descent).
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
