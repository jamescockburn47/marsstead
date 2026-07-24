# The Steads family front — steadgames.com + regularised landings

**Date:** 2026-07-24 · **Status:** draft for sign-off · **Project 2** (follows
the 2026-07-22 consolidated-board spec, which built the ledgers/muster this
front consumes). Domain: **steadgames.com** (bought, Vercel).

## 1. Goal

One public front door for the family — a hub at steadgames.com showing all
three games as living panels with real player counts — and a consistent
landing layer on every game (the Saltstead pattern: name, tagline, concise
summary, play links, sibling strip), so a stranger landing anywhere
understands the game in five seconds and can find the others in one click.

### Non-goals
- No change to gameplay, saves, VESPER, or the ops Board.
- No accounts/analytics on the hub beyond the beacons the ledgers already have.
- The VESPER-meter funnel UX (code redemption flow polish) — later.

## 2. Components

### C1 — The hub (new repo `jamescockburn47/steadgames`, Vercel project `steadgames`)
Single static page + tiny JS; procedural-only, zero binary assets (identity
invariant 1); domains steadgames.com + www (301 apex→www to match siblings).
- **Header:** THE STEADS + credo line.
- **Three living panels** (moor green `#9ec27a` / salt sea `#5aa7d8` / mars
  `#d88a5a` accents): each an iframe of the game's live title screen (its
  attract reel). **One awake at a time** — panels boot asleep as
  procedural-canvas posters drawn by the hub itself; hover/tap wakes one
  (mounts the iframe), waking another puts the previous back to sleep
  (unmounts). Click-through = the real domain in the same tab.
- **Muster strip:** "N settlers across the steads this week" — sum of the
  three ledgers' *real* weekly uniques via C4; graceful absence if unreachable.
- **Footer:** two-sentence family story; no tracking beyond a `/dash/visit`
  beacon to the mars ledger tagged `site:'steadgames'`? — **No.** Keep it
  simple: the hub gets no beacon in v1 (its traffic shows up as click-throughs
  on the games themselves).

### C2 — Regularised landings (the Saltstead pattern)
Shared elements per game: **name · tagline · ~40-word summary · play links ·
"part of the Steads" sibling strip · feedback link.**
- **Marsstead:** a DOM overlay on the existing TitleScreen — the attract reel
  keeps running behind; the overlay carries the words. `escHtml` everywhere;
  verify-gated (`verify-attract` extended or a new `verify-landing`).
- **Moorstead:** same pattern on its title layer (its repo, local).
- **Saltstead:** already the model — add the sibling strip only (its repo,
  cloned).
- Sibling strip (all three + hub): `part of THE STEADS — moorstead.app ·
  saltstead.app · marsstead.app · steadgames.com` (own game unlinked/dimmed).

### C3 — Copy (drafted for James's edit — the sign-off centrepiece)
- **Hub credo:** *Three worlds drawn entirely by code — a moor, a sea, a
  planet. Nothing to download, no ads, owned by nobody's art department.*
- **Marsstead** — tagline: *the sand kept its secrets for four billion years* ·
  summary: *A survival homestead on the real Mars — true NASA terrain, thin
  air, killing cold. Build your stead, mine the regolith, and go down after
  what's waiting. VESPER, a live AI companion, is the only other voice out
  here. Drawn entirely by code.*
- **Moorstead** — tagline: *t' moor knows thy name* · summary: *A voxel
  Yorkshire Moors sandbox — crofts, quarries, steam trains, and villagers with
  minds of their own (a local AI gives every one a voice). Build, farm, ride
  to Whitby, bring the family: kid-safe shared worlds by invite. Drawn
  entirely by code.*
- **Saltstead** — tagline (existing, kept): *the sea never signed the treaty* ·
  summary (for hub panel): *A sea-rover sandbox on the real Earth — sail
  anywhere, under the King's colours or the black flag. Storms, broadsides,
  legendary beasts, and ports that remember you. Drawn entirely by code.*

### C4 — Public muster doors
Each ledger gains `GET /dash/muster-public` → `{"week": <real weekly
uniques>, "playersEver": <real ever players>}` — counts only, no pids/names/
IPs, computed from the existing partition, cached 5 min in-process,
rate-limited. Caddy allowlists the path on :8090/:8091/:8092. Hub fetches all
three client-side; CORS `Access-Control-Allow-Origin: https://www.steadgames.com`.

### C5 — CSP / embedding
- Each game's `frame-ancestors` gains `https://steadgames.com
  https://www.steadgames.com` (Marsstead `vercel.json` here; Moorstead keeps
  its spire entry; Saltstead in its repo).
- The hub's own CSP: `default-src 'self'; frame-src` the three game origins;
  `connect-src` the three `/dash/muster-public` origins; no third-party
  anything.

### C6 — Repo/deploy plumbing
- New repo via `gh`; Vercel project; steadgames.com + www assigned.
- **Saltstead repo cloned locally** — needed for C2/C5, and used to sync the
  2026-07-22/24 live ledger edits (partition + Clint emission) into
  `tools/dash-app.py`, closing that outstanding caveat. Moorstead repo local
  already; same sync for its dash.

## 3. Verification
- Hub: headless check that the page carries all three panels + copy; live
  puppeteer check that exactly one iframe mounts on wake and posters render.
- Games: extend each repo's verify with a landing check (overlay text present,
  sibling strip links correct, `escHtml`).
- Muster doors: curl each `/dash/muster-public` → counts-only shape; confirm
  no pid/ip fields; confirm Caddy blocks other /dash GETs as before.
- CSP: confirm the hub can frame each game and (spot-check) a foreign origin
  still cannot.

## 4. Risks
| Risk | Mitigation |
|---|---|
| 3 iframes melt phones | one-awake rule; posters are hub-drawn canvas, ~free |
| Public muster door leaks | counts-only payload, no identifiers; cached; allowlisted path |
| Landing overlay fights the attract reel | overlay is DOM above the canvas, input-transparent except its links |
| Sibling-repo drift (salt/moor) | cloning salt anyway → sync the live ledger edits into both repos this project |

## 5. Phases
1. Hub repo + page + posters + copy → deploy to steadgames.com (no iframes yet).
2. CSP changes + living panels + muster doors → hub goes alive.
3. Landing overlays: Marsstead → Moorstead → Saltstead strip; repo syncs.

Each phase shippable; phase 1 alone already gives the master domain a real front.
