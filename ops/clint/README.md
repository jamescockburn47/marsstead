# Clint — Steads notifications (runs in clawd-admin on the EVO)

Reference copies of the Clawd-side files that power the WhatsApp notifications
for the Steads family. They run inside the clawd-admin agent, **not** this repo —
kept here as the tracked record (like `ops/admin-board/`).

## Deploy map — EVO `/home/james/clawdbot/`
| this repo | → clawd-admin path | role |
|---|---|---|
| `curate.js` | `src/steads/curate.js` | pure format/classify + digest |
| `store.js` | `src/steads/store.js` | event ring + dated JSONL |
| `state.js` | `src/steads/state.js` | in-process mute flag |
| `webhook.js` | `src/steads/webhook.js` | HMAC verify + DM (`POST /api/steads-event`) |
| `digest.js` | `src/tasks/steads-digest.js` | daily rollup (20:00 London) |
| `steads.js` | `src/tools/steads.js` | WhatsApp admin: status/mint/revoke/mute |

Also applied on the EVO:
- Route mounted in `src/http-server.js` (beside `/api/moorstead-event`).
- Config keys in `src/config.js`: `steadsWebhookSecret` / `steadsEnabled` / `steadsJid`.
- Digest wired into `src/scheduler.js` (`checkSteadsDigest`).
- The 5 `steads_*` tools registered in `src/tools/handler.js` (dispatch),
  `src/tools/definitions.js` (schemas), and `src/claude.js` (`OWNER_ONLY_TOOLS`).
- `STEADS_WEBHOOK_SECRET` shared between `clawd-admin/.env` and
  `marsstead/dash/ledger.env` (never in git). Originals backed up
  `*.bak-*-presteads` / `*.bak-*-c10`.

**Redeploy:** scp the three files to `src/steads/`, re-apply the http-server +
config edits, then `sudo systemctl restart clawdbot` (back up first).

## The Mars side
`server/mars-ledger.mjs` (`emitClint`) POSTs HMAC-signed events to Clawd: a real
stranger's **visit** (deduped 1/hour/browser) or **play**, and any **bug/
feedback**. You + bots are filtered by class, so a ping means a genuine external
player. Fire-and-forget — Clawd being down never affects the ledger.

## Live
- **C9 notifications** — real visit/play/bug → WhatsApp DM (verified).
- **Daily digest** — `checkSteadsDigest` in the scheduler, 20:00 London.
- **C10 WhatsApp admin** — `steads_status` / `steads_mint` / `steads_revoke`
  (+ `_confirm`) / `steads_mute`, owner-only, DM-only, revoke confirm-gated.

## Still to wire (follow-ons)
- Moorstead/Saltstead event emission (Moorstead already has its own pipeline).
- The Board **Clint card** (Clawd reachable + last notifications + mute dial).
- Moorstead/Saltstead **partition** (to light up the Board's muster toggle).
