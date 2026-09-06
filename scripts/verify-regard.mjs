import assert from 'node:assert/strict';
import { REGARD_START, SIGNALS, DRIFT_PER_SOL, createRegard, applySignal, noteTalk,
  decay, tone, verdict, serializeRegard, deserializeRegard } from '../src/regard.js';
import { splitPairingTag, PAIRING_TAG_NOTE, STATE_FIELDS } from '../src/vesperbrain.js';

assert.equal(DRIFT_PER_SOL, 0);
assert(Object.values(SIGNALS).every((n) => n >= 0));
for (const tag of ['P', 'N', 'D']) assert.equal(SIGNALS[`tag-${tag}`], 0);
const quiet = createRegard(), directive = createRegard(), chatty = createRegard();
for (let sol = 1; sol <= 1000; sol++) {
  decay(quiet, sol);
  noteTalk(directive, sol); applySignal(directive, 'tag-D'); decay(directive, sol);
  noteTalk(chatty, sol); applySignal(chatty, 'tag-P'); decay(chatty, sol);
}
for (const player of [quiet, directive, chatty]) {
  assert.equal(player.score, REGARD_START);
  assert.equal(tone(player), 'warm');
  assert.equal(verdict(player), 'SUFFICIENT');
}
// Old low scores and high scores receive precisely the same warmth.
for (const score of [0, 20, 43, 44, 52, 68, 100]) {
  const legacy = deserializeRegard({ score, lastTalkSol: 2 });
  decay(legacy, 3000);
  assert.equal(legacy.score, score);
  assert.equal(tone(legacy), 'warm');
  assert.equal(verdict(legacy), 'SUFFICIENT');
}
const memory = createRegard();
assert(applySignal(memory, 'company'));
assert(memory.score > REGARD_START);
for (let i = 0; i < 1000; i++) applySignal(memory, 'correction');
assert.equal(memory.score, 100);
assert.equal(applySignal(memory, 'unrecognised'), false);
noteTalk(memory, 12.8);
assert.deepEqual(deserializeRegard(serializeRegard(memory)), memory);
assert.equal(deserializeRegard({ score: 9999 }).score, 100);
assert.equal(deserializeRegard(null).score, REGARD_START);
assert(STATE_FIELDS.pairing && !STATE_FIELDS.regardScore);
assert.deepEqual(splitPairingTag('Hello. [P]'), { tag: 'P', text: 'Hello. ' });
assert.equal(splitPairingTag('Hello. [ d ]').tag, 'D');
assert.equal(splitPairingTag('The [P] plan.').tag, null);
assert.equal(splitPairingTag(null).tag, null);
assert(PAIRING_TAG_NOTE.includes('Never grade'));
assert(PAIRING_TAG_NOTE.includes('no effect on warmth or progress'));
console.log('verify-regard: unconditional warmth, no social grading, legacy save/API green');
