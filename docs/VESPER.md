# VESPER: live context, conversation and worker control

Updated 6 September 2026. The relay was activated with user authorisation on 6 September 2026; health confirms the matching context/voice contract. See [VESPER-REVIEW.md](VESPER-REVIEW.md) for evidence and the activation boundary.

## Connection and state

Click **Type to VESPER** in the visible toolbar (the compact **VESPER** button on phone), or press **Enter**, to open the conversation. The panel keeps recent messages and the reply field open: use **Send** or Enter, **Speak / Finish speaking**, and **Read aloud** beside a reply. Hold **V** outside the panel for push-to-talk. The browser provides speech recognition; recognised text, bounded recent history and a whitelisted snapshot go to same-origin `/brain/chat`. Vite and Vercel proxy this to the EVO relay at `marsstead.sovren.xyz`. The relay constructs the prompt and calls MiniMax-M3. Browser recognition availability depends on the browser; typed conversation is always available.

The current contract is `2026-09-06-context-voice-1`. `/brain/health` reports the contract, chat model, voice ID and synthesis model. The in-game help panel distinguishes a matching connection, an outdated relay and an unavailable relay. A successful health response proves relay availability, not a successful upstream chat; the release probe therefore exercises chat and speech as well.

Every request takes a new snapshot. Alongside the current task, available actions, nearby cargo, discoveries, suit gauges and mission clock, eight bounded fields describe:

- `homeLayout`: actual location, completed cells, installed ring and opening progress.
- `constructionQueue`: queued excavation, funding, grid supply/demand and production queues/output.
- `crewStatus`: commissioned count, mode, protection, condition and actual command reach.
- `weatherStatus`: current phase, countdown, cold and whether the player is really sheltered.
- `equipmentStatus`: covers, dust and condition effects; battery storage stays connected and an uncovered rover retains its driving floor.
- `activityStatus`: survey reward, rescued worker, field route, crop and rations.
- `vehicleStatus`: ship fuel/location/flight, rover location, recall and towing state.
- `inventoryStatus`: separate suit, rover, ship, sled, lander and uncollected spoil stores.

Each field is at most 600 characters. Missing data is null; overflowing lists explicitly report omitted entries. Only known game fields are read, and the relay clamps the contract again. No arbitrary save object or secret is included. This is broad current game context, not an exhaustive world database or a guarantee that generated advice is correct.

Current telemetry takes precedence over old conversation and generic mechanics notes. Completed and queued rooms are separate. Bunk shielding and garden air-loop scores are design bonuses, not pressure readings. The outdated long empty-base tutorial has been replaced by the supplied-home opening, without changing story canon.

## Both text and voice

Every VESPER dialogue reply and instrument call enters the readable conversation log and requests the same voice delivery. Spoken player input appears as text alongside typed input. The panel retains up to 60 entries during the session; the existing saved recent dialogue repopulates it after reload. Opening or closing the panel does not erase the session transcript. Typed input is not spoken back redundantly.

Mute and voice failure retain text. Read aloud explicitly replays a line without duplicate suppression or duplicate transcript entries. Sending a typed message, closing the panel or opening a fresh typed interaction cancels old microphone recognition; Finish speaking and push-to-talk release still accept their final transcript. Safe return closes the entire panel. Keyboard input cannot move the player or trigger build actions. The panel follows the visual viewport when a mobile keyboard reduces usable screen height.

## Quiet conversation

`src/vesper-dialogue.js` owns delivery. Only selected meaningful milestones qualify for a proactive live remark. They share a minimum three-minute interval, the same event waits ten minutes, and player conversation suppresses notices for 45 seconds. These are minimum gaps, not a periodic chatter schedule. Movement, jumping and idle time do not earn remarks.

Notices yield while the player is talking, interacting with panels, receiving speech or in danger. Replies from an older question, an interrupted microphone interaction or a paused session cannot arrive later over the new conversation. A notice also expires if its shelter/weather/travel context changes while waiting.

Safety and immediate mechanical feedback use the deterministic instrument channel. Repeated ordinary feedback is limited to once per event per 45 seconds; critical events use a ten-second minimum and pre-empt pending conversation. Explicit worker-command acknowledgements always land. Live personality has no canned substitute when the relay is down: the player gets a functional connection message and retains instruments and controls.

## Voice

All registers use `English_Wiselady`, `speech-2.8-hd`, calm delivery and unchanged pitch. Moods adjust pace slightly. The former dark-mode switch to `speech-2.6-hd` whisper is removed. Voice failure leaves the text visible; it never substitutes an arbitrary installed browser voice.

Speech has a bounded queue, request/decode cancellation and a twelve-second deadline. Muting, pausing or starting to speak cancels pending and current audio. A completed microphone transcript releases its recognizer before the game responds, so immediate worker acknowledgements can speak. Old microphone callbacks cannot stop a new recognition session.

Options **Audio volume** and **Mute all audio** cover effects and VESPER together. Legacy voice-mute preferences remain respected. To audition the actual generated voice, open `/media/vesper-review/index.html` locally; review MP3s are ignored test evidence, not runtime assets.

## Optional worker orders

Players keep the direct crew and weather buttons. VESPER adds concise typed or spoken shortcuts:

| Phrase | Effect |
| --- | --- |
| crew follow me | Follow locally; pause excavation |
| crew hold position | Park; pause excavation |
| crew resume excavation | Resume the planned dig queue |
| recall crew | Protect workers through the home weather hub |
| release crew | Release weather protection; other work restrictions still apply |

An optional VESPER address or supported polite prefix is accepted. The first three retain actual nearby-worker, on-foot and home-area checks. Recall/release retain the weather hub's rules. No extra charge, cargo or construction bypass is introduced.

A strict local parser executes these whole-utterance commands through existing game functions, before any LLM call. Questions, quotations, negations, hypothetical and compound instructions are not commands. Ambiguous speech goes to conversation; model output never triggers an action. A concise instrument acknowledgement states execution or refusal. Worker control still functions if chat is unavailable.

## Verification and operation

- `npm run verify` includes focused context, parser, dialogue and voice lifecycle checks.
- `npm run verify:vesper-browser` tests the changed browser journey with an offline relay fixture.
- Set `VESPER_RELAY_URL` to an explicitly isolated relay to exercise real M3 and TTS through that same browser journey. This incurs normal upstream usage and retains the relay's metering.
- `npm run verify:browser` covers the existing desktop and phone first-use journey.

Production service: `marsstead-brain.service`, `/home/james/marsstead/brain/server/vesper-relay.mjs`, port 8012. Caddy on 8092 and the existing tunnel publish `/brain/health`, `/brain/chat` and `/brain/tts`. Secrets remain solely in the remote `brain.env`; do not print or copy them.

The relay requires five files, with the repository layout preserved: `server/vesper-relay.mjs`, `src/vesperbrain.js`, `src/gamefacts.js`, `src/power.js`, `src/vespermeter.js`. Updating the brain alone leaves a stale mechanics corpus. Activation needs a backup, the matching set, a service restart and a real same-origin chat/TTS probe; restore the backed-up set and restart to roll back. No Caddy, tunnel, secret, quota or website deployment is needed for this relay change.
