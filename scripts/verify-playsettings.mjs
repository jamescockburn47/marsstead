import assert from 'node:assert/strict';
import { normaliseSettings, createSettings, DEFAULT_SETTINGS } from '../src/playsettings.js';

for (const bad of [null, undefined, [], 42, 'gentle']) {
  assert.deepEqual(normaliseSettings(bad), DEFAULT_SETTINGS);
}
const custom = normaliseSettings({ guidance: false, survival: 'expedition', textScale: 1.3,
  reducedMotion: true, volume: 0.25, muted: true, fear: 'gentle', arbitrary: 'discard' });
assert.equal(custom.guidance, false);
assert.equal(custom.survival, 'expedition');
assert.equal(custom.fear, 'gentle', 'survival difficulty does not force horror');
assert.equal(custom.textScale, 1.3);
assert.equal(custom.reducedMotion, true);
assert.equal(custom.volume, 0.25);
assert.equal(custom.muted, true);
assert.equal('arbitrary' in custom, false);
assert.deepEqual(normaliseSettings(JSON.parse(JSON.stringify(custom))), custom);
assert.equal(normaliseSettings({ volume: 10 }).volume, 1);
assert.equal(normaliseSettings({ volume: -1 }).volume, 0);
assert.equal(normaliseSettings({ textScale: 0 }).textScale, 0.9);
assert.equal(normaliseSettings({ textScale: 9 }).textScale, 1.5);
assert.equal(normaliseSettings({ volume: NaN }).volume, DEFAULT_SETTINGS.volume);
assert.equal(normaliseSettings({ textScale: Infinity }).textScale, DEFAULT_SETTINGS.textScale);
assert.equal(normaliseSettings({ survival: 'lethal' }).survival, 'gentle');
assert.equal(normaliseSettings({ fear: 'surprise' }).fear, 'gentle');
assert.equal(normaliseSettings({ muted: 'false' }).muted, false);
const fresh = createSettings();
fresh.volume = 0;
assert.equal(createSettings().volume, DEFAULT_SETTINGS.volume);
console.log('verify-playsettings: safe defaults, independent choices and save round-trip green');
