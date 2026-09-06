import assert from 'node:assert/strict';
import { createWeather, acceptWeather, weatherAt, advanceWeather, acceptCondition,
  equipmentEfficiency, cleanCondition, WEATHER_CLOCK_MS } from '../src/weather.js';

const epoch = 1770000000000;
const at = seconds => epoch + seconds * WEATHER_CLOCK_MS;
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-10, `${message}: ${a} vs ${b}`);
const state = createWeather(epoch);
assert.deepEqual(state, { version: 1, epochMillis: epoch, processedThrough: epoch, crewSecured: false,
  crewCondition: { secured: false, dust: 0 } });
for (const [seconds, phase] of [[0, 'clear'], [899.99, 'clear'], [900, 'warning'], [1079.99, 'warning'],
  [1080, 'storm'], [1199.99, 'storm'], [1200, 'clear'], [2700, 'warning'], [2880, 'storm']]) {
  assert.equal(weatherAt(state, at(seconds), 20).phase, phase, `${seconds}s weather phase`);
}
assert.equal(weatherAt(state, at(900), 20).secondsToStorm, 180);
assert.equal(weatherAt(state, at(900), 20).secondsRemaining, 180);
assert.equal(weatherAt(state, at(1110), 20).secondsRemaining, 90);
assert.equal(weatherAt(state, at(1110), 20).secondsToStorm, 0);
for (const [seconds, intensity] of [[1080, 0], [1087.5, .5], [1095, 1], [1185, 1], [1192.5, .5], [1200, 0]]) {
  near(weatherAt(state, at(seconds), 20).intensity, intensity, 'continuous 15-second intensity ramp');
}
assert.equal(weatherAt(state, epoch, -4).cold, false);
assert.equal(weatherAt(state, epoch, -4.01).cold, true);
assert.equal(weatherAt(state, epoch, NaN).cold, false, 'unknown sunlight is not invented night');

for (const raw of [undefined, null, {}, { version: 2 }, { version: 1, epochMillis: Infinity },
  { version: 1, epochMillis: -1 }]) {
  const accepted = acceptWeather(raw, epoch);
  assert.equal(weatherAt(accepted, epoch, 20).phase, 'clear');
  assert.equal(weatherAt(accepted, epoch, 20).secondsToStorm, 1080, 'legacy or invalid records receive fresh warning grace');
  assert.equal(accepted.processedThrough, epoch);
}
const invalid = acceptWeather({ version: 1, epochMillis: epoch, processedThrough: Infinity,
  crewSecured: 'true', crewCondition: { secured: 1, dust: Infinity } }, at(30));
assert.equal(invalid.processedThrough, at(30));
assert.equal(invalid.crewSecured, false);
assert.deepEqual(invalid.crewCondition, { secured: false, dust: 0 });
for (const clock of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
  const stable = createWeather(epoch), before = JSON.stringify(stable), condition = { secured: false, dust: .2 };
  assert.equal(advanceWeather(stable, clock, [condition]), 0);
  assert.equal(JSON.stringify(stable), before);
  assert.equal(condition.dust, .2, 'invalid clock cannot damage equipment');
}
assert.deepEqual(acceptCondition(undefined), { secured: false, dust: 0 });
assert.deepEqual(acceptCondition({ secured: 'true', dust: 8 }), { secured: false, dust: 1 });
assert.deepEqual(acceptCondition({ secured: true, dust: -4 }), { secured: true, dust: 0 });

const skipped = createWeather(epoch), exposed = acceptCondition(null), secured = acceptCondition({ secured: true });
const resources = { slots: { 'alloy-panel': 3, 'solar-wing': 1 }, charge: 12 }, ledger = JSON.stringify(resources);
Object.assign(exposed, resources);
skipped.crewSecured = false;
const crew = skipped.crewCondition;
assert.equal(advanceWeather(skipped, at(1250), [exposed, secured, crew]), 120, 'complete skipped storm is integrated');
near(exposed.dust, .65, 'full unprotected exposure');
near(secured.dust, .08, 'full protected exposure');
assert.strictEqual(skipped.crewCondition, crew, 'advancing preserves the condition referenced by crew targets');
near(skipped.crewCondition.dust, .65, 'crew receives the same exposure as other equipment');
assert.equal(JSON.stringify({ slots: exposed.slots, charge: exposed.charge }), ledger,
  'exposure mutates only condition fields even when adjacent resource data is supplied');
const saved = JSON.parse(JSON.stringify(skipped)), resumed = acceptWeather(saved, at(1250));
assert.deepEqual(resumed.crewCondition, skipped.crewCondition, 'crew condition round-trips');
assert.equal(advanceWeather(resumed, at(1250), [exposed, secured, resumed.crewCondition]), 0);
near(exposed.dust, .65, 'same clock after reload cannot duplicate exposure');
assert.equal(advanceWeather(resumed, at(1200), [exposed]), 0, 'backwards clock does not rewind high-watermark');
assert.equal(resumed.processedThrough, at(1250));
const rewoundReload = acceptWeather(JSON.parse(JSON.stringify(resumed)), at(1100));
assert.equal(rewoundReload.processedThrough, at(1250), 'reload after rewind retains processed history');
assert.equal(advanceWeather(rewoundReload, at(1250), [exposed]), 0);

for (const protection of [false, true]) {
  const gradual = createWeather(epoch), large = createWeather(epoch);
  const a = acceptCondition({ secured: protection }), b = acceptCondition({ secured: protection });
  for (let seconds = 1; seconds <= 4800; seconds++) advanceWeather(gradual, at(seconds), [a]);
  advanceWeather(large, at(4800), [b]);
  near(a.dust, b.dust, 'gradual frames and a multi-storm sleep skip agree');
  assert.ok(a.dust >= 0 && a.dust <= 1);
}
const partial = createWeather(epoch), machine = acceptCondition(null);
advanceWeather(partial, at(1110), [machine, machine]);
near(machine.dust, .65 / 4, 'partial interval and duplicate target references are counted once');
machine.secured = true; // Account to this instant before changing protection.
advanceWeather(partial, at(1200), [machine]);
near(machine.dust, .65 / 4 + .08 * 3 / 4, 'securing only protects the remaining storm interval');
const paused = JSON.stringify(partial), pausedDust = machine.dust;
for (let i = 0; i < 100; i++) {
  weatherAt(partial, at(1200), -10);
  advanceWeather(partial, at(1200), [machine]);
}
assert.equal(JSON.stringify(partial), paused, 'a paused clock has no progression');
assert.equal(machine.dust, pausedDust);
assert.equal(equipmentEfficiency(machine, 20), 0, 'secured equipment does not produce');
assert.ok(machine.dust > 0, 'securing never erases existing dust');
assert.equal(cleanCondition(machine), true);
assert.equal(machine.dust, 0);
assert.equal(machine.secured, true, 'cleaning does not unpack secured equipment');
assert.equal(cleanCondition(machine), false);
assert.equal(equipmentEfficiency({ secured: false, dust: 0 }, 20), 1);
assert.equal(equipmentEfficiency({ secured: false, dust: 0 }, -10), .5);
near(equipmentEfficiency({ secured: false, dust: .3 }, 20), .79, 'dust reduces usable production');
assert.equal(equipmentEfficiency({ secured: false, dust: .6 }, 20), 0, 'clogged production stops');
assert.equal(equipmentEfficiency({ secured: false, dust: 1 }, -10), 0);
console.log('verify-weather: deterministic phases, grace, exposure across skips/reloads, protection, crew condition, cold and production limits pass');
