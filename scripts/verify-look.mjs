// verify-look: the renderer-side half of the look contract, asserted
// SOURCE-LEVEL (main.js and the layers boot THREE at import, so Node
// cannot run them — Moorstead's documented workaround: read the source,
// assert the text). The pure halves live in verify-gfx / verify-marschunk.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = (p) => readFileSync(join(SRC, p), 'utf8');

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. flat shading is GONE from the whole source tree (invariant 1, amended)
{
  const offenders = readdirSync(SRC).filter((f) => f.endsWith('.js')
    && /flatShading:\s*true/.test(src(f)));
  check('no flatShading:true anywhere in src/', offenders.length === 0, offenders.join(','));
}

// 2. the terrain: analytic normals uploaded, never recomputed; per-pixel
//    detail present, uniform-branch guarded, and shading-only (the
//    walked-surface contract forbids GPU displacement)
{
  const t = src('terrain.js');
  check('terrain uploads analytic normals', /setAttribute\('normal'/.test(t));
  check('terrain never computeVertexNormals', !/computeVertexNormals/.test(t));
  check('terrain detail is uniform-branch guarded',
    /uAlbedoAmp > 0\.001/.test(t) && /uNormalAmp > 0\.001/.test(t));
  check('terrain detail never displaces (shading only)',
    !/transformed\s*[.+]?[xyz]?\s*\+=/.test(t) && !/transformed\.y/.test(t));
  check('terrain detail rides the shared fbm', /from '\.\/glsl\.js'/.test(t));
}

// 3. one owner for the GLSL fbm: glsl.js declares it, consumers import it
{
  const owners = readdirSync(SRC).filter((f) => f.endsWith('.js')
    && /float fbm\(/.test(src(f)));
  check('glsl.js is the only fbm owner', owners.length === 1 && owners[0] === 'glsl.js',
    owners.join(','));
}

// 4. the tier rig in main.js: ACES + adaptive exposure on fine, the legacy
//    pipeline untouched on plain, the watchdog remembered as auto-plain
{
  const m = src('main.js');
  check('fine is ACES', /ACESFilmicToneMapping/.test(m));
  check('plain is NoToneMapping', /NoToneMapping/.test(m));
  check('exposure eases toward the pure target', /exposureTarget\(day\)/.test(m));
  check('watchdog remembers auto-plain', /'marsstead-gfx', 'auto-plain'/.test(m));
  check('plain renders direct', /this\.renderer\.render\(this\.scene, this\.cam\)/.test(m));
}

// 5. the post stack: pass order is the contract — bloom in HDR before
//    OutputPass, the grade last in display space; the dread channel wired
{
  const p = src('post.js');
  const order = ['new RenderPass', 'new UnrealBloomPass', 'new OutputPass', 'new ShaderPass(GradeShader)']
    .map((s) => p.indexOf(s));
  check('composer pass order render->bloom->output->grade',
    order.every((i) => i >= 0) && order.every((v, i, a) => i === 0 || a[i - 1] < v),
    order.join(','));
  check('scene target is HDR + MSAA', /HalfFloatType/.test(p) && /samples: 4/.test(p));
  check('grade carries the dread channel', /uDread/.test(p) && /uDread \* 0\.35/.test(p));
  check('grade dithers the banding away', /\/ 255\.0/.test(p));
  check('grain is luminance-scaled', /uGrain \* \(1\.0 - lum \* 0\.7\)/.test(p));
}

if (failed) { console.error(`verify-look: ${failed} FAILED`); process.exit(1); }
console.log('verify-look: all green');
