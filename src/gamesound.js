// Quiet procedural feedback. Audio is created only by explicit interaction;
// missing/blocked WebAudio leaves the game fully usable and returns false.
import { normaliseSettings } from './playsettings.js';

const NOTES = {
  scuttle: { notes: [630, 910, 410], duration: 0.045, gain: 0.035, type: 'triangle', gap: 0.8 },
  underHum: { notes: [48, 73], duration: 1.8, gain: 0.025, type: 'sine', gap: 3.4 },
  step: { notes: [90], duration: 0.055, gain: 0.045, type: 'triangle', gap: 0.17 },
  jump: { notes: [190, 285], duration: 0.13, gain: 0.07, type: 'sine', gap: 0.35 },
  build: { notes: [220, 330, 440], duration: 0.32, gain: 0.10, type: 'triangle', gap: 0.15 },
  survey: { notes: [392, 494, 587], duration: 0.5, gain: 0.11, type: 'sine', gap: 0.3 },
  return: { notes: [330, 262, 196], duration: 0.5, gain: 0.09, type: 'sine', gap: 0.3 },
};

export class GameSound {
  constructor(settings) {
    this.settings = normaliseSettings(settings);
    this.context = null;
    this.paused = false;
    this.lastPlayed = new Map();
  }

  async unlock() {
    if (this.paused) return false;
    try {
      if (!this.context || this.context.state === 'closed') {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return false;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.applyVolume();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch { return false; } // browser/device denied audio; retry on next gesture
  }

  setSettings(raw) { this.settings = normaliseSettings(raw); this.applyVolume(); }
  applyVolume() {
    if (!this.master || this.context.state === 'closed') return;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.volume,
      this.context.currentTime, 0.025);
  }

  async setPaused(paused) {
    this.paused = paused;
    if (!this.context || this.context.state === 'closed') return false;
    try {
      if (paused && this.context.state === 'running') await this.context.suspend();
      else if (!paused && this.context.state === 'suspended') await this.context.resume();
      return true;
    } catch { return false; } // interruption/device policy: gameplay remains silent
  }

  play(name) {
    const spec = NOTES[name], audio = this.context;
    if (!spec || !audio || audio.state !== 'running' || this.paused
      || this.settings.muted || this.settings.volume <= 0) return false;
    const now = audio.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -Infinity) < spec.gap) return false;
    this.lastPlayed.set(name, now);
    for (const [index, frequency] of spec.notes.entries()) {
      const oscillator = audio.createOscillator(), envelope = audio.createGain();
      const start = now + index * 0.065, end = start + spec.duration;
      oscillator.type = spec.type;
      oscillator.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(spec.gain / spec.notes.length, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope); envelope.connect(this.master);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(start); oscillator.stop(end + 0.015);
    }
    return true;
  }

  async dispose() {
    if (!this.context || this.context.state === 'closed') return;
    try { await this.context.close(); }
    catch { /* already interrupted/closed by the browser; no owned audio remains */ }
    this.context = null;
    this.master = null;
  }
}
