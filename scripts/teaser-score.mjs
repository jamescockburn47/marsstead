// Original 24-bar Marsstead cue. Deterministic physical/additive instruments; no samples.
// 96 BPM, 4/4, 60 seconds. Run: node scripts/teaser-score.mjs [output.wav]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const rate = 48000, seconds = 60, beat = 60 / 96, bar = beat * 4;
const count = rate * seconds, left = new Float64Array(count), right = new Float64Array(count);
const events = [];
let seed = 87234;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 * 2 - 1);
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function add(kind, midi, start, duration, gain, pan = 0) {
  events.push({ kind, midi, start, duration, gain, pan });
}
// D major / B minor. Eight-bar home theme, variations, suspended descent, final D6/9.
const chords = [
  [50,57,62,66], [47,54,59,62], [43,50,57,59], [45,52,57,61],
  [50,57,62,66], [47,54,59,62], [43,50,55,59], [45,52,57,62],
  [47,54,59,62], [43,50,55,59], [50,57,62,66], [45,52,57,61],
  [43,50,55,59], [50,57,62,66], [47,54,59,62], [45,52,57,61],
  [43,50,55,59], [50,57,62,66], [47,54,59,65], [46,53,58,64],
  [47,54,59,65], [45,52,58,61], [43,50,57,59], [50,57,62,66]
];
// [MIDI, beats] with space and recurring contour rather than mechanical eighth notes.
const theme = [
  [[74,1.5],[69,.5],[66,1],[69,1]], [[71,2],[69,1],[66,1]],
  [[67,1.5],[69,.5],[71,1],[74,1]], [[73,2.5],[69,1.5]],
  [[74,1],[78,1],[76,1.5],[74,.5]], [[71,1.5],[69,.5],[66,2]],
  [[67,1],[71,1],[69,1],[66,1]], [[64,1],[66,1],[62,2]]
];
for (let b = 0; b < 24; b++) {
  const start = b * bar, chord = chords[b], cave = b >= 18 && b < 22;
  const energy = b < 3 ? .56 : b < 12 ? .88 : b < 18 ? .72 : cave ? .43 : .88;
  // Bowed ensemble enters gradually, voices separated spatially and by register.
  if (b >= 2) chord.slice(1).forEach((pitch, i) =>
    add('bow', pitch + (b >= 12 && b < 18 ? 12 : 0), start, bar + .3,
      .022 * energy * (cave ? .7 : 1), (i - 1) * .48));
  add('cello', chord[0] - 12, start + .03, bar * .96, .068 * energy, -.12);
  // Picked, rolling chord figure; spare opening and sparse cave variation.
  const pattern = cave ? [0,2] : b < 3 ? [0,2,3] : [0,.75,1.5,2,2.75,3.5];
  pattern.forEach((offset, index) => {
    const pitch = chord[1 + index % 3] + 12;
    add('pluck', pitch, start + offset * beat + .012 * (index % 2), .95,
      .073 * energy * (index % 3 === 0 ? 1 : .74), -.44 + index % 3 * .09);
  });
  // Main melody: intro establishes the theme; reprise warms the inhabited home.
  if (!cave && b < 23) {
    let cursor = 0;
    const line = theme[b % 8];
    for (const [pitch, length] of line) {
      const lowIntro = b < 2 ? -12 : 0;
      add('piano', pitch + lowIntro, start + cursor * beat + .028,
        Math.min(2.4, length * beat + .3), .17 * energy, .12);
      if (b >= 12 && b < 18 && length >= 1.5)
        add('bow', pitch - 12, start + cursor * beat + .12, length * beat, .021, .28);
      cursor += length;
    }
  } else if (cave) {
    // Sparse low answering phrase, no piercing metallic ticks.
    add('piano', [59,58,54,61][b - 18], start + .25, 2.3, .094, .15);
    add('piano', chord[3], start + 1.65, 1.3, .055, -.25);
  }
  if (b >= 3 && b < 18) {
    add('drum', 0, start, .35, .08 * energy, -.04);
    add('drum', 0, start + 2 * beat, .3, .054 * energy, .05);
  }
}
// A settled ending, long enough to hear the resolution before the picture fades.
[50,57,62,66,69,74].forEach((note, i) => {
  add('piano', note, 57.5 + i * .048, 3, .105 - i * .009, (i - 2.5) * .08);
});
function render(event) {
  const { kind, midi, start, duration, gain, pan } = event;
  const base = frequency(midi), offset = Math.round(start * rate);
  const length = Math.min(count - offset, Math.round((duration + .9) * rate));
  const lGain = Math.sqrt((1 - pan) * .5) * gain;
  const rGain = Math.sqrt((1 + pan) * .5) * gain;
  const phases = Array.from({ length: 13 }, () => random() * Math.PI);
  let pluck, cursor = 0, lowNoise = 0;
  if (kind === 'pluck') {
    pluck = new Float64Array(Math.round(rate / base));
    // A triangular pluck excites a string, with a small finite attack transient.
    for (let i = 0; i < pluck.length; i++) {
      const q = i / pluck.length;
      pluck[i] = (q < .22 ? q / .22 : (1 - q) / .78) * 2 - 1 + random() * .12;
    }
  }
  for (let i = 0; i < length; i++) {
    const t = i / rate, release = Math.exp(-Math.max(0, t - duration) * 7);
    let sample = 0;
    if (kind === 'piano') {
      // Struck, slightly inharmonic three-string unisons and frequency-dependent decay.
      const attack = 1 - Math.exp(-t * 350);
      for (let h = 1; h <= 12; h++) {
        const amplitude = Math.exp(-t * (.68 + h * .26)) / h ** 1.28;
        const phase = 2 * Math.PI * base * h * Math.sqrt(1 + .000035 * h * h) * t;
        sample += amplitude * (Math.sin(phase) * .65 + Math.sin(phase * 1.0013) * .2
          + Math.sin(phase * .9986) * .15);
      }
      sample *= attack * release;
    } else if (kind === 'pluck') {
      sample = pluck[cursor];
      const next = (cursor + 1) % pluck.length;
      pluck[cursor] = (sample + pluck[next]) * .4965;
      cursor = next;
      sample *= Math.min(1, t * 500) * release;
    } else if (kind === 'bow' || kind === 'cello') {
      const attack = Math.min(1, t / (kind === 'bow' ? .45 : .19));
      const envelope = Math.sin(attack * Math.PI / 2) * release;
      const vibrato = .012 * Math.sin(t * 2 * Math.PI * 4.7) * Math.min(1, t * 2);
      for (let h = 1; h <= 9; h++) {
        const formant = 1 + .7 * Math.exp(-(((base * h - 650) / 380) ** 2));
        const phase = 2 * Math.PI * base * h * t + vibrato * h;
        sample += formant / h ** 1.65 * (Math.sin(phase + phases[h]) * .5
          + Math.sin(phase * 1.0025 + phases[h] + .3) * .27
          + Math.sin(phase * .997 + phases[h] - .2) * .23);
      }
      sample *= envelope * .72;
    } else {
      // Finite soft drum strike, pitched membrane modes; no continuous noise signal.
      const phase = 2 * Math.PI * (57 * t + 13 * (1 - Math.exp(-t * 26)) / 26);
      sample = Math.sin(phase) * Math.exp(-t * 15) + .23 * Math.sin(phase * 1.59) * Math.exp(-t * 26);
      lowNoise = lowNoise * .6 + random() * .4;
      sample += lowNoise * Math.exp(-t * 95) * .06;
      sample *= Math.min(1, t * 1200);
    }
    left[offset + i] += sample * lGain;
    right[offset + i] += sample * rGain;
  }
}
for (const event of events) render(event);
// Short stereo early reflections and damped late reflections from the dry arrangement.
const dryL = left.slice(), dryR = right.slice();
for (const [delay, gain, cross] of [[.043,.12,0],[.071,.1,1],[.127,.075,1],[.191,.062,0],
  [.283,.046,1],[.397,.035,0],[.541,.026,1],[.733,.018,0]]) {
  const shift = Math.round(delay * rate); let l = 0, r = 0;
  for (let i = shift; i < count; i++) {
    l = l * .72 + (cross ? dryR[i-shift] : dryL[i-shift]) * .28;
    r = r * .72 + (cross ? dryL[i-shift] : dryR[i-shift]) * .28;
    left[i] += l * gain; right[i] += r * gain;
  }
}
let peak = 0, energy = 0;
for (let i = 0; i < count; i++) {
  const fade = clamp(i / rate / .12, 0, 1) * clamp((seconds - i / rate) / 1.25, 0, 1);
  left[i] *= fade; right[i] *= fade;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  energy += left[i] ** 2 + right[i] ** 2;
}
const scale = .79 / peak, pcm = Buffer.alloc(count * 4);
for (let i = 0; i < count; i++) {
  pcm.writeInt16LE(Math.round(left[i] * scale * 32767), i * 4);
  pcm.writeInt16LE(Math.round(right[i] * scale * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 4, 28);
header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);
const output = process.argv[2] || 'media/teaser60/score-v2.wav';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([header, pcm]));
const report = { output, seconds, rate, channels: 2, bpm: 96, bars: 24, events: events.length,
  instruments: [...new Set(events.map(e => e.kind))], peakDbFS: 20 * Math.log10(.79),
  rmsDbFS: 20 * Math.log10(Math.sqrt(energy / (count * 2)) * scale),
  provenance: 'Original deterministic composition and synthesis. No third-party recordings or samples.' };
writeFileSync(output.replace(/\.wav$/, '.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
