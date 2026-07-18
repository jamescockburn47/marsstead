# VESPER's voice — the live brain, the real voice, and the ears

*(USP 1 stood up: the Phase 3 promise, delivered early. This documents what
runs where, and how to operate it.)*

## The stack in one paragraph

The player holds **V** and speaks; the browser's own speech recognition
(Web Speech API — free, on-device-ish, no key) turns it into text. The text,
a six-turn history, and a **whitelisted** state snapshot go to the same-origin
`/brain/chat`, which Vercel (prod) or Vite (dev) proxies to the EVO tunnel
(`marsstead.sovren.xyz`), where **`marsstead-brain.service`** — the relay,
`server/vesper-relay.mjs` — composes the prompt server-side from
`src/vesperbrain.js` and calls **MiniMax-M3** (thinking disabled: radio
speed). The reply is clamped to a radio-sized line, shown on the HUD, and
sent to `/brain/tts`, where the relay calls **MiniMax T2A** (`speech-2.8-hd`,
voice `English_CalmWoman`; whisper register on `speech-2.6-hd`) and streams
back MP3, played through WebAudio. Every canned line is spoken through the
same TTS path (relay-cached, so repeats are free).

**MiniMax sends voice but does not receive it** — there is no MiniMax ASR
API. Input is the browser's `SpeechRecognition` (Chrome/Edge; Safari
partially). Where it's unsupported, V does nothing and the game is unchanged.

## The ladder (the LLM is a layer, never a dependency)

1. **Live brain + real voice** — relay up: M3 replies, MiniMax speaks.
2. **Relay down, chat** — the canned `radio-static` lines answer, in
   character, deterministic.
3. **Relay down, ambience** — canned lines still show on the HUD and are
   spoken by the browser's own `speechSynthesis` (best female English voice
   it has). Text remains the deterministic floor; audio is best-effort.
4. **No audio at all** — the game is exactly the pre-voice game.

## The contract (verify-gated)

`src/vesperbrain.js` is pure and shared by client, relay and gate:

- **`VESPER_SYSTEM`** — the instruction set: register (dry, warm, watchful,
  openly a machine), safety-first ordering, truth-only (no invented
  telemetry), kid-safe, never turns on the settler, radio brevity, the dark
  register, garbled-transcription handling.
- **`STATE_FIELDS`** — the whitelist. `Game.brainState()` reads only these;
  `sanitizeState` clamps on both ends; `verify-vesperbrain.mjs` proves a
  canary field never reaches the prompt. **No leak, by construction.**
- **Moods** (`calm · wonder · warning · urgent · storm · dark`) are derived
  deterministically from state/event — never by the model — and map to exact
  T2A settings (`ttsPlan`). Whisper rides 2.6 because 2.8 doesn't carry it.

To change the voice: edit `VOICE_ID` in `src/vesperbrain.js` and redeploy the
relay (candidates: `English_SereneWoman`, `English_Graceful_Lady`,
`English_Wise_Lady`, `English_MaturePartner`).

## Ops (the EVO)

- **Service**: `marsstead-brain.service` → `node ~/marsstead/brain/server/vesper-relay.mjs`,
  port **8012**, `EnvironmentFile=~/marsstead/brain/brain.env` (holds
  `MINIMAX_API_KEY`, chmod 600 — the key lives nowhere else, never in git).
- **Caddy**: `:8092` block → only `/brain/health|chat|tts` proxied, else 403.
- **Tunnel**: `~/.cloudflared/config.yml` ingress `marsstead.sovren.xyz → :8092`
  (DNS routed via `cloudflared tunnel route dns`).
- **Redeploy relay**: `scp src/vesperbrain.js evo-tailscale:marsstead/brain/src/ &&
  scp server/vesper-relay.mjs evo-tailscale:marsstead/brain/server/ &&
  ssh evo-tailscale sudo systemctl restart marsstead-brain`.
- **Limits**: per-IP token buckets (8 chat/min, 30 tts/min), 4 in-flight
  each, 32 KB bodies, 150-entry TTS LRU. The door only speaks VESPER — the
  system prompt is composed server-side, so it cannot be repurposed as a
  general MiniMax proxy.
- **Health**: `https://marsstead.sovren.xyz/brain/health`.
- Set `MINIMAX_THINKING=adaptive` in `brain.env` to let M3 reason (slower).

## Client bits

- `src/vespervoice.js` — WebAudio playback queue (max 2, no echoes, 30 s
  relay back-off), `speechSynthesis` fallback, push-to-talk ears.
- `main.js` — `brainState()` (the whitelist reader), `talkToVesper()` (async,
  off the render path), `say()` now speaks; **V** outside build mode is
  push-to-talk (`● LISTENING` bottom-centre); V in build mode still flips
  wall/roof.
- `vercel.json` — `microphone=(self)`, `media-src` added; `/brain/*` rewrite
  was already in place.
- Mute: `window.marsstead.voice.setMuted(true)` (persists in localStorage).
