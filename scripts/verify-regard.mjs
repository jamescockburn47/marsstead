// verify-regard: the hidden partnership score's contract — collaboration
// pays, vending-machine play and passive play both score low, silence
// decays, nothing is terminal, the number never shows (only the felt
// word and the coarse seasonal verdict), and the save round-trips.

import {
  REGARD_START, SIGNALS, DRIFT_FLOOR, createRegard, applySignal, noteTalk,
  decay, tone, verdict, serializeRegard, deserializeRegard,
} from '../src/regard.js';
import { splitPairingTag, PAIRING_TAG_NOTE, STATE_FIELDS } from '../src/vesperbrain.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. the shape of the signals: partnership pays, being used costs
{
  check('a new pairing starts unproven, not cold',
    REGARD_START > 40 && REGARD_START < 68);
  check('partnership-shaped exchanges pay best',
    SIGNALS['tag-P'] > SIGNALS['tag-N'] && SIGNALS['tag-P'] > 0);
  check('vending-machine exchanges cost', SIGNALS['tag-D'] < 0);
  check('corrections are what equals get', SIGNALS.correction > 0);
  check('company in the dark pays', SIGNALS.company > 0);
  const r = createRegard();
  check('unknown signal refused', !applySignal(r, 'flattery'));
}

// 2. three players, one season: partner, vending machine, ghost
{
  const partner = createRegard();
  for (let sol = 1; sol <= 30; sol++) {
    noteTalk(partner, sol);
    applySignal(partner, 'tag-P');
    if (sol % 3 === 0) applySignal(partner, 'consulted');
    if (sol % 4 === 0) applySignal(partner, 'answered');
    if (sol % 5 === 0) applySignal(partner, 'company');
    decay(partner, sol);
  }
  const vending = createRegard();
  for (let sol = 1; sol <= 30; sol++) {
    noteTalk(vending, sol);
    applySignal(vending, 'tag-D');
    decay(vending, sol);
  }
  const ghost = createRegard();
  for (let sol = 1; sol <= 30; sol++) decay(ghost, sol);

  check('the partner earns warmth', tone(partner) === 'warm', `${partner.score}`);
  check('the partner reviews EXEMPLARY', verdict(partner) === 'EXEMPLARY');
  check('the vending-machine player scores low', vending.score < REGARD_START);
  check('the ghost drifts to the floor', ghost.score === DRIFT_FLOOR, `${ghost.score}`);
  check('the ghost reviews UNDER REVIEW', verdict(ghost) === 'UNDER REVIEW');
  check('silence never pulls a low score UP', (() => {
    const low = createRegard(); low.score = 20;
    for (let sol = 1; sol <= 20; sol++) decay(low, sol);
    return low.score === 20;
  })());
  check('nothing is terminal: a cold pairing can still warm', (() => {
    const cold = createRegard(); cold.score = 5;
    for (let i = 0; i < 60; i++) applySignal(cold, 'tag-P');
    return tone(cold) !== 'thin';
  })());
  check('the score clamps both ways', (() => {
    const r = createRegard();
    for (let i = 0; i < 200; i++) applySignal(r, 'tag-P');
    const hi = r.score;
    for (let i = 0; i < 500; i++) applySignal(r, 'tag-D');
    return hi <= 100 && r.score >= 0;
  })());
}

// 3. the felt word and the verdict are coarse, total, and never a number
{
  for (const s of [0, 20, 43, 44, 50, 67, 68, 90, 100]) {
    const r = createRegard(); r.score = s;
    check(`tone(${s}) is a word`, ['warm', 'easy', 'thin'].includes(tone(r)));
    check(`verdict(${s}) is official`, ['EXEMPLARY', 'SUFFICIENT', 'UNDER REVIEW'].includes(verdict(r)));
  }
  check('the prompt carries the word, never the score',
    STATE_FIELDS.pairing && STATE_FIELDS.pairing.kind === 'str' && !STATE_FIELDS.regardScore);
}

// 4. the tag channel (the relay contract's ~5-token judge)
{
  check('a tagged reply splits clean',
    JSON.stringify(splitPairingTag('Good plan. We dig at dawn. [P]'))
    === JSON.stringify({ tag: 'P', text: 'Good plan. We dig at dawn. ' }));
  check('lowercase and spaced tags parse', splitPairingTag('Noted. [ d ]').tag === 'D');
  check('an untagged reply passes through',
    splitPairingTag('No tag here.').tag === null
    && splitPairingTag('No tag here.').text === 'No tag here.');
  check('a mid-line bracket is not a tag', splitPairingTag('The [P] plan stands, settler.').tag === null);
  check('garbage in, garbage safely out', splitPairingTag(null).tag === null);
  check('the tag note explains all three letters',
    ['[P]', '[D]', '[N]'].every((t) => PAIRING_TAG_NOTE.includes(t)));
  check('the tag judges the exchange, never the settler',
    /never the settler/i.test(PAIRING_TAG_NOTE));
}

// 5. save round-trip, laundered
{
  const r = createRegard();
  applySignal(r, 'tag-P'); noteTalk(r, 12);
  const back = deserializeRegard(serializeRegard(r));
  check('round-trip keeps the score', Math.abs(back.score - r.score) < 0.01);
  check('round-trip keeps the talk sol', back.lastTalkSol === 12);
  check('garbage in, fresh pairing out', deserializeRegard(null).score === REGARD_START);
  check('a hacked save clamps', deserializeRegard({ score: 9999 }).score === 100);
}

if (failed) { console.error(`verify-regard: ${failed} FAILED`); process.exit(1); }
console.log('verify-regard: all green');
