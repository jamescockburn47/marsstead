import assert from 'node:assert/strict';
import { VesperVoice } from '../src/vespervoice.js';
import { planSpeech, voiceVolume, VOICE_QUEUE_LIMIT } from '../src/voice-policy.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(256) });
function fixture({ slowFetch = false, slowDecode = false, microphoneFails = false } = {}) {
  const requests = [], decodes = [], sources = [], timers = new Map(), transcripts = [];
  let timerId = 0, now = 1000, synthCalls = 0;
  class AudioContext {
    state = 'running'; destination = {};
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    decodeAudioData() {
      const operation = deferred(); decodes.push(operation);
      if (!slowDecode) operation.resolve({ duration: 1 }); return operation.promise;
    }
    createBufferSource() {
      const source = { started: false, stopped: false, disconnected: false,
        connect() {}, start() { this.started = true; }, stop() { this.stopped = true; this.onended?.(); },
        disconnect() { this.disconnected = true; }, end() { this.onended?.(); } };
      sources.push(source); return source;
    }
  }
  class SpeechRecognition {
    start() { if (microphoneFails) throw Error('microphone denied'); }
    stop() { this.stopped = true; }
    result(text) { this.onresult?.({ results: [[{ transcript: text }]] }); }
    end() { this.onend?.(); }
  }
  const voice = new VesperVoice({ onTranscript: text => transcripts.push(text), runtime: {
    AudioContext, SpeechRecognition, getStored: () => null, store() {}, now: () => now,
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    fetch(url, init) {
      const operation = deferred(); requests.push({ url, ...init, ...operation });
      if (!slowFetch) operation.resolve(response()); return operation.promise;
    },
  } });
  // Any attempted browser voice fallback would violate the consistent-voice contract.
  globalThis.window = { speechSynthesis: { speak() { synthCalls++; }, cancel() {} } };
  return { voice, requests, decodes, sources, timers, transcripts, synthCalls: () => synthCalls,
    timeout() { for (const fn of [...timers.values()]) fn(); }, advance() { now += 31000; } };
}

assert.equal(voiceVolume(-1), 0); assert.equal(voiceVolume(2), 1); assert.equal(voiceVolume(NaN), 0);
const live = { text: 'reply', live: true }, urgent = { text: 'safety', urgent: true }, ambient = { text: 'aside' };
assert.equal(planSpeech(live, [], ambient).accepted, false);
assert.equal(planSpeech(live, [], urgent).interrupt, true);
assert.equal(planSpeech(urgent, [], live).interrupt, false);
assert.ok(planSpeech(urgent, Array(10).fill(live), live).queue.length <= VOICE_QUEUE_LIMIT);

// Browser timers require the global receiver; storing the native method on io loses it.
{
  const nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
  const calls = [];
  try {
    globalThis.setTimeout = function (callback, delay) {
      assert.equal(this, globalThis, 'native setTimeout receiver'); calls.push(['set', delay]); return 42;
    };
    globalThis.clearTimeout = function (id) {
      assert.equal(this, globalThis, 'native clearTimeout receiver'); calls.push(['clear', id]);
    };
    const v = new VesperVoice({ runtime: { getStored: () => null, fetch: () => new Promise(() => {}) } });
    assert.equal(v.speak('real timer binding'), true); const run = v.active;
    v.stopSpeaking(); await run.done;
    assert.deepEqual(calls[0], ['set', 12000]);
    assert.ok(calls.some(([kind, id]) => kind === 'clear' && id === 42));
  } finally { globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; }
}

// Stopping a request cancels the network and rejects even a fetch implementation that ignores abort.
{
  const f = fixture({ slowFetch: true }), v = f.voice;
  v.speak('old reply', 'calm', { live: true }); const old = v.active;
  assert.equal(v.status, 'loading'); v.stopSpeaking(); await old.done;
  assert.equal(f.requests[0].signal.aborted, true); assert.equal(v.status, 'idle');
  f.requests[0].resolve(response()); await flush(); assert.equal(f.sources.length, 0);
  assert.equal(v.relayDown, 0, 'intentional cancellation does not poison relay health');
}
// Unabortable decoder completion must not resurrect a muted line or block a new generation.
{
  const f = fixture({ slowDecode: true }), v = f.voice;
  v.speak('decoding old', 'calm', { live: true }); await flush(); const old = v.active;
  v.setMuted(true); await old.done; assert.equal(v.status, 'muted');
  assert.equal(v.speak('muted request'), false); assert.equal(f.requests.length, 1);
  v.setMuted(false); v.speak('new reply', 'calm', { live: true }); await flush();
  f.decodes[0].resolve({ duration: 1 }); await flush(); assert.equal(f.sources.length, 0);
  f.decodes[1].resolve({ duration: 1 }); await flush(); assert.equal(f.sources.length, 1);
  assert.equal(v.status, 'speaking'); v.stopSpeaking(); await flush(); assert.equal(f.sources[0].stopped, true);
}
// A newer live reply supersedes live loading, and stale failures cannot change its status.
{
  const f = fixture({ slowFetch: true }), v = f.voice;
  v.speak('first live', 'calm', { live: true }); const old = v.active;
  v.speak('second live', 'calm', { live: true }); await old.done;
  f.requests[0].reject(Error('late network failure')); f.requests[1].resolve(response()); await flush();
  assert.equal(f.sources.length, 1); assert.equal(v.status, 'speaking'); assert.equal(v.relayDown, 0);
  v.stopSpeaking(); await flush();
}
// Urgent safety preempts actual playback. Only the latest reply waits behind safety; ambient never queues.
{
  const f = fixture(), v = f.voice;
  v.speak('conversation', 'calm', { live: true }); await flush(); const first = f.sources[0];
  v.speak('find shelter', 'urgent', { urgent: true }); await flush();
  assert.equal(first.stopped, true); assert.equal(f.sources.length, 2);
  assert.equal(v.speak('ambient'), false);
  v.speak('earlier pending', 'calm', { live: true }); v.speak('latest pending', 'calm', { live: true });
  assert.equal(v.queue.length, 1); assert.equal(f.requests.length, 2);
  f.sources[1].end(); await flush(); assert.equal(f.requests.length, 3);
  assert.equal(JSON.parse(f.requests[2].body).text, 'latest pending');
  v.setVolume(.25); assert.equal(v.gain.gain.value, .25);
  v.setVolume(0); await flush(); assert.equal(v.status, 'muted'); assert.equal(f.sources[2].stopped, true);
}
// Timeout and relay failure remain text-only, with bounded backoff and no browser synthesis.
for (const fail of ['timeout', 'http']) {
  const f = fixture({ slowFetch: true }), v = f.voice;
  v.speak('unavailable'); const run = v.active;
  if (fail === 'timeout') f.timeout(); else f.requests[0].resolve({ ok: false });
  await run.done; assert.equal(v.status, 'unavailable'); assert.equal(f.synthCalls(), 0);
  assert.equal(v.speak('backoff'), false); assert.equal(f.requests.length, 1);
  f.advance(); assert.equal(v.speak('retry'), true); v.stopSpeaking(); await flush();
}
// Timeout also frees an unresolved decoder; its late rejection is consumed.
{
  const f = fixture({ slowDecode: true }), v = f.voice;
  v.speak('stalled decoder'); await flush(); const run = v.active;
  f.timeout(); await run.done; f.decodes[0].reject(Error('late decode failure')); await flush();
  assert.equal(v.status, 'unavailable'); assert.equal(f.sources.length, 0);
}
// Microphone acquisition interrupts pending TTS, blocks playback during recognition and keeps final result identity.
{
  const f = fixture({ slowFetch: true }), v = f.voice;
  v.speak('interrupt for input'); const run = v.active;
  assert.equal(v.startListening(), true); await run.done; assert.equal(v.listening, true);
  assert.equal(v.speak('while listening'), false); const old = v.rec;
  v.stopListening(); assert.equal(old.stopped, true); assert.equal(v.listening, false);
  old.result('What next?'); old.end(); assert.deepEqual(f.transcripts, ['What next?']);
  assert.equal(v.startListening(), true); const next = v.rec; old.end(); old.result('stale');
  assert.equal(v.rec, next); assert.equal(v.listening, true); assert.equal(f.transcripts.length, 1);
  v.stopListening(); next.end(); assert.equal(v.rec, null);
}
// A final microphone command may synchronously produce a local spoken acknowledgement.
{
  const f = fixture({ slowFetch: true }), v = f.voice; let listeningCalls = 0;
  v.onListening = () => { listeningCalls++; };
  v.onTranscript = text => {
    assert.equal(text, 'recall crew'); assert.equal(v.rec, null); assert.equal(v.listening, false);
    assert.equal(v.speak('Crew recalled', 'calm', { live: true }), true);
  };
  assert.equal(v.startListening(), true); const rec = v.rec;
  v.stopListening(); rec.result('recall crew');
  assert.equal(listeningCalls, 1); assert.equal(f.requests.length, 1);
  assert.equal(JSON.parse(f.requests[0].body).text, 'Crew recalled');
  rec.end(); assert.equal(v.status, 'loading', 'late recognition end does not stop the reply');
  v.stopSpeaking(); await flush();
}
{
  const f = fixture({ slowFetch: true, microphoneFails: true }), v = f.voice;
  v.speak('interrupt despite failed microphone'); const run = v.active;
  assert.equal(v.startListening(), false); await run.done;
  assert.equal(v.listening, false); assert.equal(v.status, 'idle'); assert.equal(f.requests[0].signal.aborted, true);
}

{
  const f=fixture(),captions=[];f.voice.onCaption=text=>captions.push(text);
  f.voice.setMuted(true);assert.equal(f.voice.speak('Muted but visible.'),false);
  assert.deepEqual(captions,['Muted but visible.'],'mute never removes captions');
  f.voice.setMuted(false);f.voice.speak('Replay this.');f.voice.stopSpeaking();
  assert.equal(f.voice.speak('Replay this.','calm',{live:true,caption:false,replay:true}),true,'explicit replay bypasses duplicate suppression');
  assert.equal(captions.filter(text=>text==='Replay this.').length,1,'replay does not duplicate caption');
  f.voice.stopSpeaking();f.voice.startListening();const old=f.voice.rec;f.voice.cancelListening();
  old.result('Obsolete worker command');assert.deepEqual(f.transcripts,[],'cancelled mic cannot deliver a stale command');
  f.voice.startListening();const current=f.voice.rec;old.end();assert.equal(f.voice.rec,current);
  current.result('Current question');assert.deepEqual(f.transcripts,['Current question']);
}

delete globalThis.window;
console.log('VESPER voice: cancellation through fetch/decode/playback, priority, latest-only queue, mute/volume, text-only timeout and microphone lifecycle pass');
