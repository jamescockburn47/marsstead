// Disposable visual walkthrough using the real planning, excavation and renderer.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createBurrow, plan, tick, installRing, digPrice } from '../src/burrow.js';
import { renderHomeScene } from '../src/home-scene.js';

const home = createBurrow(), stages = [];
let paid = 0;
const fund = cost => { paid += cost; return true; };
function capture(title, detail, selected = 'shaft') {
  const scene = renderHomeScene(home, selected, { reducedMotion: true });
  // Each hidden stage needs its own gradient/filter IDs in the shared document.
  scene.svg = scene.svg.replace(/id="(home-[^"]+)"/g, `id="stage${stages.length}-$1"`)
    .replace(/url\(#(home-[^)]+)\)/g, `url(#stage${stages.length}-$1)`);
  stages.push({ title, detail, paid, ...scene });
}
function build(piece, col, depth) {
  assert.ok(plan(home, piece, col, depth), `legal ${piece} at ${col},${depth}`);
  tick(home, 120, 3, fund);
  assert.equal(home.cells.get(`${col},${depth}`).dug, 1);
}
capture('Choose your first shaft', 'Open the Burrow at the surface hatch. Choose Shaft, then the glowing space directly below the airlock.');
assert.ok(plan(home, 'shaft', 0, 1));
capture('A plan is free', 'The outline is queued. Power is charged when excavation starts, not when you click. An untouched plan can be cancelled.');
tick(home, 5, 3, fund);
capture('The fleet starts excavating', 'The first shaft costs 4 kWh. This is the halfway state from the real excavation model. If charge is insufficient, the queue waits.');
tick(home, 5, 3, fund);
assert.ok(installRing(home));
capture('Seal the entrance', 'Once the shaft is finished, bring the salvaged airlock ring and choose Seal your home. The ring seals the connected burrow.', 'corridor');
assert.equal(digPrice(home, 'corridor'), 1);
build('corridor', 1, 1);
capture('Extend a corridor', 'Choose Corridor, then a glowing space beside the finished shaft. Your first corridor costs 1 kWh. Rooms attach to finished corridors.', 'bunk');
assert.equal(digPrice(home, 'bunk'), 2);
build('bunk', 2, 1);
capture('Make a place to sleep', 'Choose Bunk Room, then the space beyond the corridor. The first bunk costs 2 kWh. Shaft + corridor + bunk use 7 kWh in total.', 'corridor');
build('corridor', -1, 1); build('garden', -2, 1);
capture('Add a garden', 'Expand on the other side: another corridor and a shallow garden. Later corridors cost 3 kWh; gardens cost 8 kWh. Greenery now appears inside.', 'shaft');
build('shaft', 0, 2); build('corridor', 1, 2); build('store', 2, 2);
build('corridor', -1, 2); build('bay', -2, 2);
capture('A growing habitat', 'Extend the shaft for a second level, then corridors, storage and a works bay. The surface crown reflects completed rooms. The home remains a management cutaway.');
const panels = stages.map((s, i) => `<section ${i ? 'hidden' : ''}><h2>${i + 1}. ${s.title}</h2><p>${s.detail}</p><svg viewBox="0 0 ${s.width} ${s.height}" role="img" aria-label="${s.title}">${s.svg}</svg><p class="cost">Excavation power used in this demonstration: ${s.paid} kWh</p></section>`).join('');
mkdirSync('media/habitat', { recursive: true });
writeFileSync('media/habitat/index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Building a home on Mars</title><style>
*{box-sizing:border-box}body{margin:0;background:#15191a;color:#e7dfca;font:17px/1.5 system-ui}main{max-width:1100px;margin:auto;padding:24px}h1,h2{font-family:Georgia;font-weight:400}h1{margin:0}p{max-width:850px}small,.cost{color:#b9c6be}svg{display:block;width:100%;max-height:58vh;background:#241f1c;border-radius:12px}nav{display:flex;align-items:center;gap:16px;margin:20px 0}button{font:inherit;background:#31564f;color:#eceddd;border:1px solid #88afa1;padding:10px 22px;border-radius:6px;cursor:pointer}button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:3px solid #ead5a6}.sock{opacity:.75}
</style><main><h1>Building a home on Mars</h1><small>Demonstration • actual game renderer and excavation rules • time and power availability accelerated • does not touch your save</small><nav><button id="prev">Previous</button><span id="count" aria-live="polite"></span><button id="next">Next step</button></nav>${panels}</main><script>
const panels=[...document.querySelectorAll('section')];let step=0;const prev=document.querySelector('#prev'),next=document.querySelector('#next');function show(){panels.forEach((p,i)=>p.hidden=i!==step);prev.disabled=step===0;next.disabled=step===panels.length-1;document.querySelector('#count').textContent=(step+1)+' / '+panels.length}prev.onclick=()=>{step--;show()};next.onclick=()=>{step++;show()};show();</script></html>`);
console.log(`Generated ${stages.length} verified construction stages at media/habitat/index.html`);
