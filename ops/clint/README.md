# Clint — Steads notifications (runs in clawd-admin on the EVO)

Reference copies of the Clawd-side files that power the WhatsApp notifications
for the Steads family. They run inside the clawd-admin agent, **not** this repo —
kept here as the tracked record (like `ops/admin-board/`).

## Deploy map — EVO `/home/james/clawdbot/`
| this repo | → clawd-admin path | role |
|---|---|---|
| `curate.js` | `src/steads/curate.js` | pure format/classify + digest |
| `store.js` | `src/steads/store.js` | event ring + dated JSONL |
| `webhook.js` | `src/steads/webhook.js` | HMAC verify + DM (`POST /api/steads-event`) |

Also applied on the EVO:
- Route mounted in `src/http-server.js` (beside `/api/moorstead-event`).
- Config keys in `src/config.js`: `steadsWebhookSecret` / `steadsEnabled` / `steadsJid`.
- `STEADS_WEBHOOK_SECRET` shared between `clawd-admin/.env` and
  `marsstead/dash/ledger.env` (never in git). Originals backed up `*.bak-*-presteads`.

**Redeploy:** scp the three files to `src/steads/`, re-apply the http-server +
config edits, then `sudo systemctl restart clawdbot` (back up first).

## The Mars side
`server/mars-ledger.mjs` (`emitClint`) POSTs HMAC-signed events to Clawd: a real
stranger's **visit** (deduped 1/hour/browser) or **play**, and any **bug/
feedback**. You + bots are filtered by class, so a ping means a genuine external
player. Fire-and-forget — Clawd being down never affects the ledger.

## Still to wire (follow-ons)
- Daily **digest** into Clawd's scheduler (`composeDigest` is ready).
- Moorstead/Saltstead event emission (Moorstead already has its own pipeline).
- The Board **Clint card** and the **C10 WhatsApp admin `steads` tool**
  (owner-only mint/revoke/status from the phone + shared-secret bearer).
