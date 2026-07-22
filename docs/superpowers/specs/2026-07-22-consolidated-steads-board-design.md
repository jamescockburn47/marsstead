# Consolidated Steads ops board + Marsstead diagnostics — design spec

**Date:** 2026-07-22
**Status:** Draft for sign-off
**Author:** James Cockburn (with Claude)
**Scope:** Project 1 of 2. This spec covers the internal, always-on operations
dashboard and the Marsstead instrumentation it needs. The public-facing
**Steads family front** (hub, family domain, cross-links, public muster,
VESPER-meter funnel UX) is **Project 2** and gets its own spec next.

---

## 1. Goal

Give James one always-on dashboard on his Windows PC that shows, for all three
games (Moorstead, Saltstead, Marsstead), **how many real people visit and play**
— with his own dogfooding and bots peeled off — plus live service/brain health,
token minting, feedback, deploy versions, and alerts. In the same pass, close
the Marsstead instrumentation gap (it currently records visits only) and put a
cost guard on VESPER (the only per-call paid dependency). **Clint (Clawd, the
existing WhatsApp agent) becomes the cross-game notification and control layer**
— curated WhatsApp DMs when real people arrive, and owner-only admin ops from the
phone — reviving and globalising the warden design's Phase 1–2.

### Success criteria

1. The Admiralty Board is a first-class **three-game** view; Marsstead has its
   own tab with real *played* numbers and a VESPER health card.
2. Every audience metric defaults to a **"real audience"** figure that excludes
   James's own devices, loopback/LAN/tailnet traffic, and known bots — with the
   raw/house/bot breakdown one toggle away (nothing deleted).
3. Marsstead fires **play** and **heartbeat** beacons, and its own ledger holds
   Mars-specific telemetry (sol, descent depth, O₂, VESPER turns, live-now).
4. VESPER conversational voice is **metered** per device with a hard global
   spend ceiling; the deterministic safety/instrument channel is never metered.
5. The Board opens on this PC as a one-click, auto-starting app window over the
   tailnet.
6. `npm run verify` stays green; new pure-logic modules are verify-gated.
7. Clint (Clawd) is the notification + control layer: curated WhatsApp DMs for
   *real* events across all three games, and owner-only, DM-only, confirm-gated
   admin ops (status, mint/revoke, broadcast, mute) from WhatsApp.

### Non-goals (this spec)

- The public family hub / single entry-point URL / family domain — **Project 2**.
- Cross-linking the three games' front pages — **Project 2**.
- Any change to the games' worldsim, rendering, or VESPER personality.
- Unifying player identity across games (each game keeps its own `pid`; the
  insider tag is per-game). A shared cross-game identity is explicitly deferred.
- **In-world Merlin embodiment beyond Moorstead.** This build is *operator*-Clint
  only (out-of-world). Embodying Merlin in Saltstead is a later project; Marsstead
  never gets an in-world Clint — VESPER is its in-world co-star (USP 1).

---

## 2. Current state (verified on the EVO, 2026-07-22)

- **Admiralty Board** — `evo-admin.service`, `/home/james/admin/app.py`
  (FastAPI), bound `0.0.0.0:8099`, tailnet-only at `100.90.66.54:8099` (never
  tunnelled). Thin aggregator over two upstreams: `MOOR=127.0.0.1:8095`,
  `SALT=127.0.0.1:8097`. Tabs: overview / salt / moor / server. Polls
  `/api/board` every 15s. No auth (network boundary only). Canonical source
  currently lives in the **Saltstead** repo (`tools/admin-app.py`) — copy-drift
  risk now that this is a three-game concern.
- **Moorstead dash** (`:8095`) — full ledger: visits, ~per-minute play pings,
  invite codes + accounts + 7-day ws tokens, feedback/bug inbox, live roster,
  per-world progress, brain/LLM/GPU health. Records raw client `ip` per event.
- **Saltstead dash** (`:8097`) — invite/token ledger + the muster beacon.
  **Also owns Marsstead's visit counts** via `VISIT_SITES=('saltstead',
  'marsstead')`. Stores only the hashed `uid` in aggregates — **no raw client
  IP**. Dedupe: `uid = sha1('pid:'+pid)[:12]` (or `sha1('ip:'+ip+'|'+ua[:80])`
  fallback); UTC day = `int(time//86400)`; per site `{days:{day:{v,uv,p,up}},
  seen:{day:{uid:bitmask}}, ever:{uid:[firstDay,lastDay,playCount]}}`;
  `EVER_CAP=20000`, `SEEN_KEEP_DAYS=45`.
- **Marsstead** — brain-only. `marsstead-brain.service`, Node
  `vesper-relay.mjs`, `127.0.0.1:8012`, fronted by Caddy `:8092`
  (`/brain/{health,chat,tts}` only). MiniMax key in
  `/home/james/marsstead/brain/brain.env`. **No ledger, no play beacon, no
  tokens, no Board tab.** Relay rate-limits per IP (chat 6 cap/8 per-min, tts 10
  cap/30 per-min, inflight 4) but has **no per-device daily cap and no global
  spend ceiling**.
- **Infra** — all services `Restart=always` + enabled. Caddy `/etc/caddy/
  Caddyfile` (`:8090` moor, `:8091` salt, `:8092` mars). Cloudflared
  `/home/james/.cloudflared/config.yml` maps `marsstead.sovren.xyz → :8092`.
  Marsstead `vercel.json` rewrites `/dash/* → saltstead.sovren.xyz/dash/*` and
  `/brain/* → marsstead.sovren.xyz/brain/*`. EVO tailnet `james-nucbox-evo-x2`
  / `100.90.66.54`; Windows PC `desktop-8nppn6c` / `100.67.198.63`.
- **Clint / Clawd** — `clawdbot.service` (WhatsApp admin assistant, `:3000`,
  `sendProactiveMessage → WhatsApp`, HMAC Sentry-webhook pattern, a
  `moorstead-digest.js` task), `clawdbot-memory.service` (`:5100`),
  `clint-graph.service` (`:5101`), and the in-world `clint-body`/`clint-body-
  bairns` (Merlin) presences on the Moorstead relay. All running + enabled. The
  awareness/notification pipeline (warden Phase 1) exists only as the Moorstead
  digest — not global, not real-time.

### The measurement reality (why this matters)

Sampled from the live ledgers: Moorstead's `visits.json` is **740 of 769 events
from `127.0.0.1`** (James's own localhost testing); only ~29 events from public
IPs, several of which are **Googlebot** (`66.249.66.x`). The "588 visited / 40
played" headline is ~96% James. Marsstead/Saltstead keep no IP, so their 181/85
"unique browsers" include James's devices and crawler-fallback `uid`s. **Uniques
are already computed correctly; the problem is *whose* uniques.**

---

## 3. Architecture overview

```
 game clients (browser)                         EVO (always-on, tailnet)
 ─────────────────────                          ────────────────────────
 Moorstead ──/dash/*──▶ moorstead-dash :8095 ─┐
 Saltstead ──/dash/*──▶ saltstead-dash :8097 ─┤     evo-admin :8099
 Marsstead ──/dash/*──▶ marsstead-dash :8098 ─┼──▶  (Admiralty Board)  ──▶ Windows
             (NEW, this repo)                 │      /api/board (15s)        app-window
 Marsstead ──/brain/*─▶ vesper-relay  :8012 ──┘      + service health        (MagicDNS)
                        (meter + telemetry)
```

Each ledger owns its own data and computes **public / house / bot** partitions.
The Board is still a thin aggregator: it adds a `mars` upstream, folds VESPER
health into the Mars card, lists all brains/relays in service health, and
defaults every audience number to the public partition with a house/bot toggle.

**Clint layer.** Each ledger + the Board POST **clean-filtered** curated events
to **Clawd** (`clawdbot.service`, `:3000`, HMAC-verified — mirrors the existing
Sentry webhook) → `sendProactiveMessage(ownerJid)` → a WhatsApp DM to James.
Clawd's owner-only `steads` tool calls each ledger's shared-secret admin API back
(status / mint / revoke / broadcast / mute). No shared process — HTTP over the
tailnet, exactly the warden design's loose-bridge seam.

---

## 4. Components

### C1 — Marsstead ledger (`marsstead-dash`, new)

- **Where:** new Node module in this repo, `server/mars-ledger.mjs`, beside
  `vesper-relay.mjs` (zero external deps: `node:http` + JSON files — matches the
  identity invariant). Runs as `marsstead-dash.service` on the EVO,
  `WorkingDirectory=/home/james/marsstead/dash`, bound `0.0.0.0:8098`
  (tailnet-reachable, like the siblings), data in
  `/home/james/marsstead/dash/*.json`. Separate process from the relay.
- **Reuse** Saltstead's proven visit/dedupe maths (the `{days,seen,ever}`
  bitmask; `uid` scheme; UTC-day key). Port it to JS as a small pure module so
  it can be verify-tested headlessly.
- **Data files** (`/home/james/marsstead/dash/`): `visits.json`
  (`{days,seen,ever}`), `sessions.json` (heartbeats), `players.json` (per-pid
  rollup incl. `insider`/`bot` flags), `feedback.json`, and the code/account/
  token trio `codes.json` / `accounts.json` / `tokens.json` (active — they lift
  the VESPER meter, see C4), plus `insiders.json` and `visit_rate.json`.
- **Public endpoints** (via tunnel, new Caddy `:8092` `/dash/*` allowlist):
  `POST /dash/visit`, `/dash/play`, `/dash/ping`, `/dash/feedback`,
  `POST /dash/insider` (tag this device — secret-gated), and
  `POST /dash/redeem` (redeem a VESPER code → binds this `pid` to the
  unlimited tier; the relay reads that binding, see C4).
- **House endpoints** (tailnet only, Board reads): `GET /api/summary` (the one
  Mars call — public/house/bot partitions of visited·played today/7d/ever, live
  roster, Mars telemetry rollup, VESPER health+stats folded in from `:8012`,
  recent feedback, deployed version), `GET /api/visits`, `GET /api/feedback`,
  and the mint desk `POST /api/mint` / `POST /api/revoke` / `GET /api/codes`
  (these are **live** — Mars codes lift the VESPER meter).
- **Reroute + migration:** flip Marsstead `vercel.json` `/dash/* →
  marsstead.sovren.xyz/dash/*`; add a path-allowlisted `/dash/*` handle to the
  Caddy `:8092` block (`/dash/visit|play|ping|feedback|insider` only; house
  endpoints stay off the tunnel). One-time migration copies
  `salt_visits.json["marsstead"]` into the new Mars `visits.json`, then removes
  `marsstead` from Saltstead's `VISIT_SITES`. Reversible; the CSP `connect-src`
  already permits same-origin `/dash/*`.

### C2 — Marsstead client diagnostics (verify-gated)

- **Play beacon:** in `src/main.js`, inside `start()` (the boot block at
  ~line 3108) — fire `POST /dash/play {site:'marsstead', kind:'play', pid,
  choice}` only for a real CONTINUE / NEW LANDING. **Never** the attract reel
  (`new Game(null,'',true)`), **never** `?play`, **never** `coming-soon.html`.
  This is also what finally separates teaser hits from real game loads.
- **Ping heartbeat:** in the game loop (Moorstead-style, ~60s), `POST /dash/ping
  {pid, name, sol, depth, o2, vesperTurns, loc}` — gated to real play. Feeds the
  live roster and Mars-specific telemetry (max descent depth, sols survived,
  VESPER turns).
- **Visit beacon:** already exists; now hits Mars's own door via the reroute.
- **Verify:** new `scripts/verify-diagnostics.mjs` (pure) proves beacons fire
  only in real play, never from the attract reel or teaser, and payloads are
  well-formed. Added to `npm run verify`.

### C3 — VESPER relay telemetry

- Add in-memory counters to `vesper-relay.mjs`: chat/tts request counts, cache
  hit-rate, 429/502 rates, rolling p50/p95 latency, and a rough MiniMax
  token/cost estimate (from usage in the API response where available).
- Expose on a **loopback-only** `GET /brain/stats` (not tunnelled; the Mars
  ledger reads it at `127.0.0.1:8012`). `/brain/health` stays as-is (already
  Caddy-allowlisted). The ledger folds stats into `/api/summary` so the Board
  gets **one** Marsstead card covering play + brain.

### C4 — VESPER metering (the "meter the voice, not the game" model)

- **Invariant (non-negotiable, from DESIGN.md):** metering applies to
  **conversational/personality** VESPER only. The deterministic
  **instrument/safety channel** is *never* metered and always answers, relay-up
  or relay-down. When a player is metered out, live personality falls back to
  the canned floor; safety/mechanics lines keep firing.
- **Free tier:** each device (`pid`) gets a generous free daily allowance of
  conversational exchanges (default **30/day**, tunable via env) so casual
  players never notice the meter. Redeeming a (free) Marsstead invite code lifts
  the device to unlimited (or a higher tier) and captures the wait-list lead.
- **Enforcement (server-side, cannot trust the client):** on each `/brain/chat`
  the relay checks, in order: (a) bot filter → refuse; (b) global daily spend
  ceiling reached → refuse (everyone gets the floor); (c) device within free
  tier or holds a redeemed code → serve; else refuse with a specific
  `{ok:false, why:'meter'}` so the client shows the floor line + "grab a code to
  keep talking." The relay authorizes codes via a loopback call to the Mars
  ledger (`marsstead-dash`), which owns `codes/accounts/tokens`; it caches
  validity briefly to stay at radio speed.
- **Quota-window guard (not a £ cap — James is on the flat £20/mo Token Plan).**
  A flat subscription has **no runaway bill**; the real limit is the plan's
  **5-hour-rolling + weekly quota windows**, a pool **shared across the whole
  MiniMax account** (VESPER *and* Clint's M3 auto-coder *and* Clawd's MiniMax
  tier). So the guard **paces** VESPER's share — a configurable budget per
  rolling window that **reserves headroom for James's own agent/coding use** —
  degrading conversational VESPER to the canned floor before a burst of strangers
  can drain the window. TTS paced alongside chat.
- **Cost/usage is informational on this plan.** The relay still parses MiniMax's
  per-call `usage` × an M3 price table, but on a flat subscription it reads as
  *quota drawn* ("~X% of today's window"), not a bill. No confirmed public
  MiniMax balance/usage endpoint exists — usage lives in their console — so the
  relay's own count is the number the Board shows.
- **Detecting MiniMax's *own* caps (distinct from ours).** The relay classifies
  MiniMax error codes — **`1002` rate limit**, **`2056` quota/credit exhausted**
  (Plus plan: 5-hour-rolling + weekly windows) — treating either as an immediate
  degrade-to-floor plus a distinct Clint alert ("MiniMax rate-limited us" vs
  "quota exhausted"). So VESPER-capped fires whether *we* hit our ceiling first
  or MiniMax does.
- **Board surface:** the Mars VESPER card shows today's spend vs ceiling, free
  vs coded exchange split, and meter-refusals; the Mars mint desk mints codes.

### C5 — Clean-numbers layer (all three ledgers + Board)

Every audience metric is computed as three partitions, never deleted:
**public** (default) / **house** (insiders) / **bot**.

- **IP-class exclusion** (ledgers that keep IP — Moorstead now, Mars sessions):
  loopback / RFC1918 LAN / tailnet `100.64.0.0/10` → `house`. This alone removes
  Moorstead's ~740-event localhost mountain, zero maintenance.
- **Bot filter:** classify by UA (`bot|crawl|spider|Googlebot|bingbot|...`) and
  known crawler IP ranges (Google `66.249.x`, etc.) → `bot`. Bots never reach
  the VESPER meter.
- **Insider device tag:** an `insiders` set keyed by `uid`/`pid` per ledger.
  Seeded automatically for any warden-authenticated session (Moorstead/Saltstead
  warden; Marsstead `?warden=`), plus a one-click **"mark this device as mine"**
  — a `POST /dash/insider` triggered by visiting any game with `?insider=<secret>`
  (secret in ledger env, never in git). Tag laptop/phone/kids' devices once →
  excluded everywhere, across IP changes, and on Mars where no IP exists.
- **Invited players stay real.** Insider = James (warden + tagged devices).
  Invited codes/accounts are genuine players and remain in the public count.
- **Board default = public**, with a per-tab toggle to reveal house + bot lines.
  The muster book shows public headline numbers; house/bot are auditable.

### C6 — Consolidated Board (`evo-admin` / `app.py`)

- Add `MARS=127.0.0.1:8098` upstream; `/api/board` gains a `mars` block from
  `GET /api/summary`. Service-health list gains `marsstead-brain`,
  `marsstead-dash`, `saltstead-brain` (all missing today).
- **Marsstead tab** (`renderMars`) using the existing `--mars #d88a5a` accent:
  public visited/played, live roster, VESPER card (model/uptime/usage/cache/
  errors/spend-vs-ceiling), Mars telemetry (max depth, sols, VESPER turns),
  deploy chip, feedback.
- **Muster book:** replace Mars's hardcoded `null` play columns with real
  numbers; all rows honour the public/house/bot toggle.
- **Mint desk:** Moorstead + Saltstead (as today) + **Marsstead live** (mints
  VESPER-meter codes).
- **Reports inbox** (extra): one panel aggregating moor + salt + mars feedback,
  newest first, each with game context (Mars in Mars vocabulary: sol/depth/O₂).
- **Deploy/version per game** (extra): each ledger reports live version +
  last-deploy stamp; Board shows a chip per game linking the live site.
- **Connection-health** (extra): the Moorstead client POSTs a `Net.report()`
  digest on the ping cadence; Board surfaces drop-by-cause / RTT / downtime.
  Moorstead-first — the panel states plainly that Salt/Mars multiplayer isn't
  built yet (no silent gaps).
- **Down-service alerts** (extra): a prominent Board banner when any service is
  down or disk/GPU crosses a threshold, plus a **Clint WhatsApp ping** (via C9)
  as the primary push. An opt-in ntfy/Pushover topic remains a dumb fallback;
  the on-screen banner always works.

### C7 — Always-on Windows launcher

- A desktop shortcut + `shell:startup` entry launching Edge in `--app=` mode
  (chromeless, native-feel) at the EVO's **MagicDNS** name (stable; falls back
  to `100.90.66.54` if MagicDNS is off). Auto-opens on login; one click any
  time.
- Verify `systemctl is-enabled tailscaled` on the EVO and Tailscale
  run-unattended on Windows. On a dropped tailnet the app window shows a
  reconnect state and the Board's 15s poll recovers — acceptable; no new
  single-point dependency introduced.

### C8 — Board source relocation + deploy

- Move the Board's canonical source into **this repo** under
  `ops/admin-board/app.py`, with a documented deploy step (scp to
  `~/admin/app.py` + `systemctl restart evo-admin`) and a light verify. Kills
  the current Saltstead-repo copy-drift.

### C9 — Clint awareness (global notifications)

Reuses **Clawd** (`clawdbot.service`, `:3000`, `sendProactiveMessage(ownerJid,
text)` → WhatsApp DM). This revives + globalises the warden design's Phase 1
(currently only a `moorstead-digest.js` task).

- **Seam:** a new **HMAC-verified** `POST /api/steads-event` on Clawd (mirrors
  the existing `src/lqcouncil/sentry-webhook.js`). Each ledger + the Board post
  curated events; Clawd formats and DMs James. The Clawd-side digest reuses the
  scheduler (`moorstead-digest.js` → a `steads` digest across all three ledgers).
- **Only real events.** Events are drawn from the **clean-filtered** stream
  (insider + bot excluded), so a ping means a genuine stranger — never James or a
  crawler. **Notable = immediate** (first real visitor of the day, a new player,
  a bug/error, a service down, VESPER hitting its quota ceiling); **routine =
  digest** ("today: N strangers across the steads, M played, VESPER spend £X").
- **Board surface:** a Clint card — WhatsApp-connected status, relay/brain
  status, the last N notifications, and a **mute + verbosity dial**
  (off / notable-only / everything) that writes through to Clawd.
- **Fail-soft (warden §5.1):** event POSTs are fire-and-forget, ~1s timeout — an
  unreachable Clawd never blocks a ledger. ntfy/Pushover stays a dumb fallback
  for service-down only.

### C10 — Clint admin ops (WhatsApp, global — warden Phase 2)

A Clawd `steads` tool (extends the existing `moorstead` tool), in
`OWNER_ONLY_TOOLS`, **DM-only**, **confirm-gated** on anything mutating, and
**audited** to `data/audit.json` — the warden security model, reusing Clawd's
existing owner-only / confirm / audit machinery.

- **Verbs:** status / who's-on (all three), mint / revoke an invite code (per
  game), broadcast to a game, mute/unmute Clint, VESPER-meter status. Read verbs
  immediate; mutating verbs confirm-gated (the token is bound to one action and
  expires).
- **Seam:** the tool calls each ledger's house admin API over the tailnet.
  Because an agent now reaches these, the **mutating** endpoints (`/api/mint`,
  `/api/revoke`, broadcast) gain a **shared-secret bearer token** (EVO env, never
  git, tailnet-only, never tunnelled) — closing the "no auth on mutating LAN
  endpoints" gap the recon flagged. Read-only summaries stay boundary-gated.
- **Kill-switch:** a global `steads mute` silences notifications; the existing
  body kill-switches (recall/despawn Merlin) are unaffected.

---

## 5. Security & privacy boundaries

- All house/admin endpoints stay **off** the Cloudflare tunnel — tailnet-only,
  as today. Only the public beacon doors (`/dash/visit|play|ping|feedback|
  insider`, `/brain/health|chat|tts`) are exposed, via the Caddy allowlists.
- **Do not** copy the weak `?key=warden1981` query-string pattern. The Board
  stays network-boundary-gated; any new house call is tailnet-only. Secrets
  (insider secret, MiniMax key) live in EVO env files, never in git, never in
  URLs.
- No raw PII in query strings. Insider tagging stores a hashed `uid`, not IP.
- **Clint admin ops (warden §4).** Mutating ledger endpoints require a
  shared-secret bearer token (EVO env, tailnet-only, never tunnelled). All
  WhatsApp admin ops are owner-only, DM-only, confirm-gated on mutation, and
  audited. Clawd↔ledger event/admin traffic never touches the public tunnel.

---

## 6. Migration

1. Snapshot `saltstead/dash/visits.json`.
2. Copy its `["marsstead"]` sub-object into a fresh `marsstead/dash/visits.json`.
3. Deploy `marsstead-dash`; flip the Vercel rewrite + add the Caddy `/dash/*`
   allowlist; confirm new Mars beacons land in the Mars ledger.
4. Remove `marsstead` from Saltstead's `VISIT_SITES` and restart salt dash.
   Continuity preserved; salt's own data untouched; fully reversible.

---

## 7. Verification strategy

- **Pure verify scripts (headless, in `npm run verify`):** `verify-diagnostics`
  (beacon gating), a ported `verify-marsledger` (dedupe/partition maths:
  uniques, played, insider/bot exclusion), `verify-vesper-meter` (free-tier /
  code / ceiling decision table incl. the safety-floor invariant).
- **Live checks (EVO + browser):** hit the new ledger endpoints; confirm the
  Board renders three tabs with public/house/bot toggle; confirm a real play
  from the Windows browser increments Mars *played* while an attract-reel load
  does not; confirm a warden/insider visit lands in `house`, not `public`.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Mars reroute + migration are the only non-additive moves | One-time, snapshotted, reversible; done behind a maintenance beat |
| Proxy chain could mis-bucket a real client as loopback | Evidence shows real clients land with real IPs (29 public); monitor the loopback share after cutover |
| Relay meter on the hot path adds latency | In-memory counters + brief code-validity cache; deterministic floor on any refusal |
| Free-tier size wrong (too tight/loose) | Env-tunable; start generous (30/day), watch the meter-refusal metric on the Board |
| Phone push needs a third-party target | On-screen alert is core; push is opt-in with a clear switch |
| Board is a growing single file | Relocate to `ops/admin-board/` and split render helpers as it grows |

---

## 9. Phased implementation (for the plan)

1. **Marsstead ledger + reroute + migration** (C1) — stand up `marsstead-dash`,
   move visits off salt, prove parity.
2. **Marsstead client beacons** (C2) — play + ping + verify.
3. **VESPER telemetry + metering** (C3, C4) — counters, `/brain/stats`, meter
   with safety-floor invariant, global ceiling.
4. **Clean-numbers layer** (C5) — partitions across all three ledgers.
5. **Board rewire + extras** (C6) — Mars tab, muster, mint, reports, deploy,
   connection-health, alerts; relocate source (C8).
6. **Windows launcher** (C7).
7. **Clint awareness** (C9) — the `/api/steads-event` webhook + curated DMs +
   the `steads` digest task + the Board Clint card. Depends on phases 1 + 5
   (ledgers emit; Board surfaces).
8. **Clint admin ops** (C10) — the WhatsApp `steads` tool + the shared-secret
   bearer on mutating ledger endpoints. Depends on phase 7.

Phases 1–6 are independently verifiable and shippable; the Clint phases (7–8)
consume the ledgers and Board, so they land after those exist.

---

## 10. Handoff to Project 2 (Steads family front)

Project 2 inherits from this build: the **public muster** (cleaned real-audience
numbers) as a social-proof surface, the **VESPER-meter code funnel** (the free
invite that lifts the meter is the wait-list), and the per-game deploy/version
data. Project 2 decides the family domain, the hub design, the cross-link strips
on each title screen, and the funnel UX around the meter.
