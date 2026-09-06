// Conservative source-line count. Existing large modules are explicit debt,
// not a reason to split unrelated code during a playable-slice change.
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const legacy = new Set(['main.js', 'buggy.js', 'touch.js', 'colonistrig.js',
  'vesperbrain.js', 'colonist.js', 'dustlayer.js']);
const lines = source => source.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('//')).length;
assert.equal(lines('// comment\n\nconst n = 1;'), 1);
assert.ok(lines('statement();\n'.repeat(301)) > 300, 'counterexample exceeds the cap');
for (const name of readdirSync(new URL('../src/', import.meta.url))) {
  if (!name.endsWith('.js') || name === 'marsdata.js' || legacy.has(name)) continue;
  const count = lines(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'));
  assert.ok(count <= 300, `${name}: ${count} source lines; extract a coherent responsibility`);
}
console.log('verify-source-size: source cap passes; seven named legacy exceptions, generated Mars data excluded');
