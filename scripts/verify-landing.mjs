// verify-landing — the family landing pattern on the title (spec 2026-07-24):
// tagline, concise summary, sibling strip, and the CSP that lets the hub
// frame the game. Source-level checks (the title is DOM; the reel behind it
// is covered by verify-attract).
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  FAIL:', name); } };

const title = readFileSync(new URL('../src/title.js', import.meta.url), 'utf8');
check('tagline present', title.includes('the sand kept its secrets for four billion years'));
check('summary present (VESPER named)', title.includes('A survival homestead on the real Mars')
  && title.includes('VESPER, a live AI companion'));
check('summary carries the family promise', title.includes('free, no'));
check('sibling strip: THE STEADS', title.includes('part of THE STEADS'));
for (const sib of ['moorstead.app', 'saltstead.app', 'steadgames.com']) {
  check(`strip links ${sib}`, title.includes(`https://www.${sib}`));
}
check('strip built with textContent/DOM (no innerHTML)', !/innerHTML/.test(title));

const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
check('CSP admits the hub (frame-ancestors)',
  vercel.includes('frame-ancestors https://steadgames.com https://www.steadgames.com'));
check("CSP no longer 'none' for frame-ancestors", !vercel.includes("frame-ancestors 'none'"));

console.log(`\nverify-landing: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
