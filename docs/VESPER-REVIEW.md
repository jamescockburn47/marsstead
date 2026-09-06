# VESPER review — 6 September 2026

## Scope and status

Tier B: player conversation, voice and optional crew orders. Failure consequences are incorrect advice, missed or intrusive speech and unintended worker-mode changes. The proof is deterministic state/command/cancellation tests, fresh independent review and an actual browser → isolated relay → M3/TTS journey. Saves and materials are not model-controlled.

Local changes are implemented. The existing public relay was probed successfully for a real generated chat answer and 53,268 bytes of speech. Its service is active, but its older state whitelist drops the current task/help fields and all eight new context fields. After explicit user authorisation, the matching five-file relay was activated on 6 September 2026. Health now reports the current contract. The original audit above describes the previous version.

## What changed

- Bounded, fresh snapshots cover home, construction, crew reach, weather, equipment, vehicles, activities and separate inventories.
- Updated mechanics corpus and phase instructions describe the supplied starter home and implemented storm/cleanup loop. Current telemetry outranks generic notes and old conversation.
- Routine movement and idle chatter are removed from proactive eligibility. Meaningful notices have global and event gaps and yield to conversation, input, panels and danger.
- Stale chat, TTS and microphone callbacks cannot revive cancelled speech. Pause and mute cover pending audio. A final transcript releases its recognizer before immediate command acknowledgement.
- All moods retain Wiselady and speech-2.8-hd. Voice failure leaves readable text instead of changing actor through browser synthesis.
- Five optional, strictly parsed crew orders use existing local control rules. LLM output has no execution path. Direct controls remain available.
- Help shows relay contract status. Mission clock matches the player HUD; home-design bonuses are explicitly separate from actual air/pressure. Desktop habitat subtitles sit above the action panel, including the supported 150% text setting.

## Evidence

`npm run verify` and `npm run build` passed. Existing desktop and actual-touch first-use browser journeys passed, including save/reload and restored movement. `npm run verify:vesper-browser` passed with an offline fixture. The opt-in isolated relay browser probe exercised real generated responses and returned MP3s, WebAudio decoding/playback, typed and microphone worker orders, rejected remote commands, real sealed-storm telemetry, pause cancellation and the visible mute control. Speech recognition itself was injected for reproducibility; physical microphone capture and subjective voice quality still need human audition.

Fresh review identified the recognizer-before-acknowledgement race. It was fixed and covered by deterministic lifecycle tests plus the browser journey. A real-browser native timer receiver failure was also reproduced and fixed. The review also caught overlap at 150% text; scaled clearance and an actual browser rectangle assertion now pass. The gate includes absent data, bounded lists, unsupported fields, negations/questions/compound commands, idempotence, resource conservation, audio cancellation across fetch/decode/playback and stale replies.

Ignored local evidence: `/media/vesper-review/index.html`, `conversation.json`, live/offline browser logs and verify/build logs. The browser fixture uses disposable saves and blocks unrelated multiplayer connections.

## Limits found in actual generated answers

Providing correct telemetry does not guarantee a correct answer. Early probes conflated completed/queued rooms and an outdoor battery with an interior room; the obsolete phase prompt was replaced. Later answers correctly identified the supplied home and real storm shelter, but sometimes omitted the requested next action or required cleanup. A subsequent probe falsely called a parked, funded passage active. The context now explicitly states that excavation is paused despite funding; a targeted real API counterexample correctly recognised the parked crew (grounding-probe.json). This improves the tested case without guaranteeing future wording. Generated advice remains optional; task cards, weather instruments and guarded commands determine actual mechanics. Do not label this an exhaustive or verified model understanding. Monitor these concrete cases in subsequent playtests instead of treating a single good sample as proof.

The voice identity and synthesis settings are mechanically consistent. Actual audio was generated and played by the browser; accent, warmth and personal preference should be assessed with the included sample. The existing large-bundle build warning remains unchanged.

## Relay activation and recovery

Host: `evo-tailscale`. Target: `/home/james/marsstead/brain`. Service: `marsstead-brain.service`, port 8012. The tested isolated relay used `/home/james/marsstead/vesper-review-20260906` and port 18012, with a bounded temporary service and tunnel; it does not replace production. The temporary service and owned local tunnel have now been stopped; production remained active and its original source hashes were unchanged.

Executed after explicit authorisation (6 September 2026). Backup: `/home/james/marsstead/relay-backup-20260906`; staged candidate: `/home/james/marsstead/relay-release-20260906`. Procedure:

1. Confirm the target service/path and preserve the existing five source files together in a timestamped backup outside the source directories. Preserve `brain.env` in place; do not print or copy it.
2. Stage the five files below under a new sibling directory, compare hashes and validate imports with the existing remote Node runtime. Preserve the complete matching dependency set and repository layout.
3. Copy the verified set to the corresponding production paths and restart only `marsstead-brain.service`. No configuration, metering, Caddy, tunnel or website changes.
4. Probe the real same-origin `/brain/health`, expecting contract `2026-09-06-context-voice-1`, then one actual chat with dynamic home/storm state and a TTS request. Check service errors. If startup or probes fail, restore all five backed-up files and restart the same service, then confirm the old health/chat path recovers.

| File | SHA-256 of reviewed local candidate |
| --- | --- |
| `server/vesper-relay.mjs` | `756b234ecadcd937cd69d47ade668dd35ef9bed15e4b1ff794f626602bef0626` |
| `src/vesperbrain.js` | `6d069ad24619e1a99b558958e12c44beb83f87b0161c7fc2ec32cfbc4c37fa41` |
| `src/gamefacts.js` | `06a6271bc651e440d4671183fb757fb31ee37251c2b60ad4ade306448e27060e` |
| `src/power.js` | `6efd27c72bb316d826325f433091d8ba0f07687f3dfcf09fc53ac8565d2a13bd` |
| `src/vespermeter.js` | `7fa6b1e9821057f9efe4bc84191a727237b7a89f4538fa2ce5c8a524b4710f52` |
