// Priority and queue policy is independent of audio, network and browser state.
export const VOICE_QUEUE_LIMIT = 2;
export function voiceVolume(value) { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }
export function planSpeech(active, queue, incoming) {
  if (incoming.urgent) return { accepted: true, interrupt: !!active, queue: [incoming] };
  if (incoming.live) {
    if (active?.urgent) return { accepted: true, interrupt: false, queue: [incoming].slice(-VOICE_QUEUE_LIMIT) };
    return { accepted: true, interrupt: !!active, queue: [incoming] };
  }
  if (active || queue.length) return { accepted: false, interrupt: false, queue };
  return { accepted: true, interrupt: false, queue: [incoming] };
}
