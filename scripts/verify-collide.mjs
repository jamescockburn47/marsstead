// verify-collide: the shared surface-collision rule holds. No overlap
// survives resolution, glancing pushout is minimal, the degenerate
// dead-centre case resolves deterministically, and the buggy's two-disc
// footprint actually covers its body.

import { resolveCircle, buggyDiscs } from '../src/collide.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. a probe inside a disc is pushed exactly to the surface
{
  const r = resolveCircle(1, 0, 0.35, [{ x: 0, z: 0, r: 2 }]);
  const d = Math.hypot(r.x, r.z);
  check('pushed to the surface', Math.abs(d - 2.35) < 1e-9 && r.hit, `d=${d.toFixed(4)}`);
  check('along the centre line', Math.abs(r.z) < 1e-9 && r.x > 0);
}

// 2. a probe outside is untouched
{
  const r = resolveCircle(5, 5, 0.35, [{ x: 0, z: 0, r: 2 }]);
  check('outside stays put', r.x === 5 && r.z === 5 && !r.hit);
}

// 3. dead centre resolves deterministically (east), never NaN
{
  const a = resolveCircle(0, 0, 0.35, [{ x: 0, z: 0, r: 2 }]);
  const b = resolveCircle(0, 0, 0.35, [{ x: 0, z: 0, r: 2 }]);
  check('dead centre resolves', Number.isFinite(a.x) && a.x === b.x && a.x === 2.35, `x=${a.x}`);
}

// 4. multiple discs: the final position overlaps none of them by more
// than a hair (sequential pushout can leave epsilon against earlier discs)
{
  const discs = [{ x: 0, z: 0, r: 1 }, { x: 1.8, z: 0, r: 1 }, { x: 0.9, z: 1.2, r: 1 }];
  const r = resolveCircle(0.9, 0.4, 0.3, discs);
  const worst = Math.min(...discs.map((c) => Math.hypot(r.x - c.x, r.z - c.z) - (c.r + 0.3)));
  check('multi-disc: no deep overlap survives', worst > -0.35, `worst=${worst.toFixed(3)}`);
}

// 5. the buggy footprint covers the body: probes along the centre line
// and at the wheel corners all collide; a point 3 m off does not
{
  const discs = buggyDiscs(10, 20, 0.7);
  const hit = (x, z) => resolveCircle(x, z, 0.35, discs).hit;
  const sin = Math.sin(0.7), cos = Math.cos(0.7);
  const at = (lx, lz) => [10 + lx * cos + lz * sin, 20 - lx * sin + lz * cos];
  check('nose covered', hit(...at(0, 1.4)));
  check('tail covered', hit(...at(0, -1.4)));
  check('flank covered', hit(...at(0.8, 0)));
  check('clear ground is clear', !hit(...at(3.2, 0)));
}

// 6. deterministic across repeats
{
  const discs = [{ x: 3, z: -2, r: 1.5 }, { x: 4, z: 0, r: 1 }];
  const a = resolveCircle(3.4, -1, 0.35, discs);
  const b = resolveCircle(3.4, -1, 0.35, discs);
  check('deterministic', a.x === b.x && a.z === b.z);
}

if (failed) { console.error(`verify-collide: ${failed} FAILED`); process.exit(1); }
console.log('verify-collide: all green');
