// VESPER's voice and ears — the audio layer. DOM/WebAudio, so NOT pure and
// never imported by verify scripts. Everything in here is best-effort and
// async, strictly off the render path: any failure degrades silently down
// the ladder (relay TTS → browser speechSynthesis → text only), because the
// canned text line in the HUD is the floor and it has already been shown.
// The LLM/TTS relay is a layer, never a dependency (USP 1).

const RELAY_TTS = '/brain/tts';

export class VesperVoice {
  constructor({ onTranscript } = {}) {
    this.onTranscript = onTranscript || (() => {});
    this.queue = [];
    this.speakingNow = false;
    this.lastText = '';
    this.lastAt = 0;
    this.ctx = null;
    this.current = null;
    this.rec = null;
    this.listening = false;
    this.relayDown = 0; // epoch ms until which we skip the relay after a failure
    let stored = null;
    try { stored = localStorage.getItem('marsstead-voice'); } catch { /* private mode */ }
    this.mutedFlag = stored === 'off';
  }

  get muted() { return this.mutedFlag; }
  setMuted(v) {
    this.mutedFlag = !!v;
    try { localStorage.setItem('marsstead-voice', v ? 'off' : 'on'); } catch { /* private mode */ }
    if (v) this.stopSpeaking();
  }

  // call on any user gesture: browsers gate audio until one has happened
  poke() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _audioCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  // speak a line in a mood; queues at most two so VESPER never backlogs
  speak(text, mood = 'calm') {
    if (!text || this.mutedFlag) return;
    const now = Date.now();
    if (text === this.lastText && now - this.lastAt < 5000) return; // no echoes
    this.lastText = text; this.lastAt = now;
    this.queue.push({ text, mood });
    while (this.queue.length > 2) this.queue.shift();
    this._pump();
  }

  stopSpeaking() {
    this.queue.length = 0;
    try { this.current?.stop(); } catch { /* already ended */ }
    try { window.speechSynthesis?.cancel(); } catch { /* unsupported */ }
  }

  async _pump() {
    if (this.speakingNow) return;
    this.speakingNow = true;
    try {
      while (this.queue.length) {
        const { text, mood } = this.queue.shift();
        try {
          if (Date.now() < this.relayDown) throw new Error('relay resting');
          await this._playRelay(text, mood);
        } catch {
          this.relayDown = Date.now() + 30000; // back off; the floor speaks
          await this._playSynth(text, mood);
        }
      }
    } finally {
      this.speakingNow = false;
    }
  }

  // the real voice: MiniMax TTS via the relay, played through WebAudio
  async _playRelay(text, mood) {
    const res = await fetch(RELAY_TTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mood }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 200) throw new Error('tts empty');
    const ctx = this._audioCtx();
    if (!ctx) throw new Error('no audio context');
    const buf = await ctx.decodeAudioData(bytes);
    this.relayDown = 0;
    await new Promise((done) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = done;
      this.current = src;
      src.start();
    });
  }

  // the floor's floor: the browser's own synthesis, best female English
  // voice it has. Not deterministic across machines and doesn't need to be
  // — the deterministic floor is the TEXT (vesper.js); this is just air.
  _playSynth(text, mood) {
    return new Promise((done) => {
      const synth = window.speechSynthesis;
      if (!synth) { done(); return; }
      try {
        const u = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
        const female = en.find((v) =>
          /female|woman|libby|sonia|aria|jenny|zira|samantha|serena|kate|susan|hazel/i.test(v.name));
        u.voice = female || en[0] || null;
        u.rate = mood === 'dark' ? 0.85 : mood === 'urgent' ? 1.1 : 0.95;
        u.pitch = 1.0;
        u.volume = mood === 'dark' ? 0.55 : 0.9;
        u.onend = done;
        u.onerror = done;
        synth.speak(u);
      } catch { done(); }
    });
  }

  // ---------------------------------------------------------------- ears
  earsSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // push-to-talk down: begin listening. Returns true if the ears are on.
  startListening() {
    if (this.rec || !this.earsSupported()) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const rec = new SR();
      rec.lang = 'en-GB';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const t = e.results?.[0]?.[0]?.transcript;
        if (t) this.onTranscript(t);
      };
      rec.onend = () => { this.rec = null; this.listening = false; };
      rec.onerror = () => { this.rec = null; this.listening = false; };
      rec.start();
      this.rec = rec;
      this.listening = true;
      this.stopSpeaking(); // she yields the channel when you key the mic
      return true;
    } catch {
      this.rec = null;
      return false;
    }
  }

  // push-to-talk up: stop and let onresult deliver what it heard
  stopListening() {
    try { this.rec?.stop(); } catch { /* already stopped */ }
    this.listening = false;
  }
}
