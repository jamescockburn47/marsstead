// One relay voice. Failed audio leaves the already displayed text in place.
import { planSpeech, voiceVolume, VOICE_QUEUE_LIMIT } from './voice-policy.js';
const RELAY_TTS = '/brain/tts', REQUEST_TIMEOUT = 12000, FAILURE_BACKOFF = 30000;

function cancelled(signal) {
  const error = new Error('Voice cancelled'); error.name = 'AbortError';
  return signal.reason instanceof Error ? signal.reason : error;
}
// decodeAudioData cannot be aborted, so race it and discard its late result.
function untilCancelled(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(cancelled(signal)); };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => {
      signal.removeEventListener('abort', abort); signal.aborted ? reject(cancelled(signal)) : resolve(value);
    }, error => { signal.removeEventListener('abort', abort); reject(error); });
    if (signal.aborted) abort();
  });
}

export class VesperVoice {
  constructor({ onTranscript, onCaption = () => {}, onListening = () => {}, runtime = {} } = {}) {
    this.onCaption = onCaption;
    this.onListening = onListening;
    const host = globalThis.window || globalThis;
    this.io = {
      fetch: (...args) => globalThis.fetch(...args),
      AudioContext: host.AudioContext || host.webkitAudioContext,
      SpeechRecognition: host.SpeechRecognition || host.webkitSpeechRecognition,
      now: () => Date.now(), setTimeout: (...args) => globalThis.setTimeout(...args),
      clearTimeout: (...args) => globalThis.clearTimeout(...args),
      getStored: () => globalThis.localStorage?.getItem('marsstead-voice'),
      store: value => globalThis.localStorage?.setItem('marsstead-voice', value), ...runtime,
    };
    this.onTranscript = onTranscript || (() => {});
    this.queue = []; this.generation = 0; this.active = null; this.current = null;
    this.lastText = ''; this.lastAt = -Infinity; this.ctx = null; this.gain = null;
    this.rec = null; this.listening = false; this.relayDown = 0;
    this.volume = 1; this._status = 'idle'; this.lastError = null;
    let stored = null;
    try { stored = this.io.getStored(); } catch { /* Private storage is optional. */ }
    this.mutedFlag = stored === 'off';
  }
  get muted() { return this.mutedFlag; }
  get speakingNow() { return !!this.active; }
  get status() { return this.mutedFlag || this.volume === 0 ? 'muted' : this._status; }
  setMuted(value) {
    this.mutedFlag = !!value;
    try { this.io.store(value ? 'off' : 'on'); } catch { /* Private storage is optional. */ }
    if (value) this.stopSpeaking();
  }
  setVolume(value) {
    this.volume = voiceVolume(value);
    if (this.gain) this.gain.gain.value = this.volume;
    if (this.volume === 0) this.stopSpeaking();
  }
  poke() {
    const generation = this.generation;
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {
      if (this.generation !== generation) return;
      this.lastError = 'audio-unavailable'; this._status = 'unavailable';
    });
  }
  async _audioCtx(run) {
    if (!this.ctx) {
      if (!this.io.AudioContext) throw new Error('audio-unavailable');
      this.ctx = new this.io.AudioContext();
      this.gain = this.ctx.createGain(); this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await untilCancelled(this.ctx.resume(), run.controller.signal);
    return this.ctx;
  }
  speak(text, mood = 'calm', { live = false, urgent = false, caption = true, replay = false } = {}) {
    if (typeof text !== 'string' || !text.trim()) return false;
    if (caption) this.onCaption(text);
    if (this.mutedFlag || this.volume === 0 || this.listening || this.rec) return false;
    const now = this.io.now();
    if (!replay && text === this.lastText && now - this.lastAt < 5000) return false;
    if (now < this.relayDown) { this._status = 'unavailable'; return false; }
    const line = { text, mood, live: !!live, urgent: !!urgent };
    const plan = planSpeech(this.active?.line, this.queue, line);
    if (!plan.accepted) return false;
    if (plan.interrupt) this.stopSpeaking();
    this.queue = plan.queue.slice(-VOICE_QUEUE_LIMIT);
    this.lastText = text; this.lastAt = now; this._pump(); return true;
  }
  stopSpeaking() {
    this.generation++; this.queue.length = 0;
    const run = this.active; this.active = null; this.current = null; this.currentLive = false;
    if (run) {
      run.controller.abort(); this.io.clearTimeout(run.timer);
      try { run.source?.stop(); } catch { /* Source may already have ended. */ }
    }
    this._status = 'idle';
  }
  _valid(run) {
    return this.active === run && run.generation === this.generation && !run.controller.signal.aborted
      && !this.mutedFlag && this.volume > 0 && !this.listening && !this.rec;
  }
  _pump() {
    if (this.active || !this.queue.length || this.mutedFlag || this.volume === 0 || this.listening || this.rec) return;
    const run = { line: this.queue.shift(), generation: this.generation, controller: new AbortController(), source: null };
    this.active = run; this.currentLive = run.line.live; this._status = 'loading';
    run.timer = this.io.setTimeout(() => { run.timedOut = true; run.controller.abort(); }, REQUEST_TIMEOUT);
    run.done = this._playRelay(run).catch(() => {
      if (this.active !== run || run.generation !== this.generation) return;
      this.lastError = run.timedOut ? 'tts-timeout' : 'tts-unavailable';
      this.relayDown = this.io.now() + FAILURE_BACKOFF; this._status = 'unavailable'; this.queue.length = 0;
    }).finally(() => {
      this.io.clearTimeout(run.timer);
      if (run.source) { run.source.onended = null; run.source.disconnect(); }
      if (this.active !== run) return;
      this.active = null; this.current = null; this.currentLive = false;
      if (this._status !== 'unavailable') this._status = 'idle';
      this._pump();
    });
  }
  async _playRelay(run) {
    const signal = run.controller.signal, { text, mood } = run.line;
    const res = await untilCancelled(this.io.fetch(RELAY_TTS, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mood }), signal,
    }), signal);
    if (!res.ok) throw new Error('tts-response');
    const bytes = await untilCancelled(res.arrayBuffer(), signal);
    if (bytes.byteLength < 200) throw new Error('tts-empty');
    const ctx = await this._audioCtx(run);
    const buffer = await untilCancelled(ctx.decodeAudioData(bytes), signal);
    if (!this._valid(run)) return;
    this.io.clearTimeout(run.timer); this.relayDown = 0; this.lastError = null;
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(this.gain);
    run.source = source; this.current = source; this._status = 'speaking';
    await untilCancelled(new Promise(resolve => { source.onended = resolve; source.start(); }), signal);
  }
  earsSupported() { return !!this.io.SpeechRecognition; }
  startListening() {
    this.onListening();
    this.stopSpeaking(); // Input owns the channel, even if microphone setup fails.
    if (this.rec || !this.earsSupported()) return false;
    try {
      const rec = new this.io.SpeechRecognition();
      rec.lang = 'en-GB'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = event => {
        if (this.rec !== rec) return;
        const result = event.results?.[event.resultIndex ?? 0];
        if (result?.isFinal === false) return;
        const text = result?.[0]?.transcript;
        // Final input is complete before a local command can reply synchronously.
        // Release this identity first: late events cannot clear a newer session.
        this.rec = null; this.listening = false;
        try { rec.stop(); } catch { /* Final recognition may already have stopped. */ }
        if (text) this.onTranscript(text);
      };
      const ended = () => {
        if (this.rec !== rec) return;
        this.rec = null; this.listening = false;
      };
      rec.onend = ended; rec.onerror = ended;
      this.rec = rec; this.listening = true; rec.start(); return true;
    } catch {
      this.rec = null; this.listening = false; return false;
    }
  }
  stopListening() {
    const rec = this.rec; this.listening = false;
    try { rec?.stop(); } catch { if (this.rec === rec) this.rec = null; }
    // Keep identity until final result or onend; the result can arrive after stop().
  }
  cancelListening() {
    const rec=this.rec;this.rec=null;this.listening=false;
    try { if(rec?.abort)rec.abort();else rec?.stop(); } catch { /* Identity already invalidated; late callbacks are ignored. */ }
  }
}
