// live-recall (needs a browser + vite): the buggy recall end to end: the buggy recall end to end — strand it, order the
// recall from the console, run the clock, assert it comes home.
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const server = spawn('npx', ['vite', '--port', '5198'], {
  stdio: 'pipe', shell: true, 
});
function killServer() {
  try { spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true }); } catch { server.kill(); }
}
const PORT = await new Promise((res, rej) => {
  const t = setTimeout(() => { killServer(); rej(new Error('vite timeout')); }, 30000);
  let buf = '';
  server.stdout.on('data', (d) => {
    buf += String(d).replace(/\x1b\[[0-9;]*m/g, '');
    const m = buf.match(/Local:\s+http:\/\/localhost:(\d+)\//);
    if (m) { clearTimeout(t); res(Number(m[1])); }
  });
});

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  try { localStorage.clear(); localStorage.setItem('marsstead-orders-seen', '1'); } catch {}
});
await page.goto(`http://localhost:${PORT}/?play&gfx=plain`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 20000 });

const result = await page.evaluate(async () => {
  const g = window.marsstead;
  const out = {};
  // strand the buggy 900 m out, bank charged enough
  g.buggy.x = g.crownPos.x + 900; g.buggy.z = g.crownPos.z;
  g.power.charge = 6;
  g.frame(performance.now()); // the grid snapshot the console reads
  g.burrowUI.open();
  g.burrowUI.render();
  const btn = document.querySelector('#brecall');
  out.visible = btn && btn.style.display !== 'none';
  out.enabled = btn && !btn.disabled;
  out.label = btn && btn.textContent;
  btn.click();
  out.recallStarted = !!g.recall;
  out.chargeAfter = g.power.charge;
  g.burrowUI.close();
  // run the tow clock out through real frames
  g.recall.rem = 0.5;
  for (let i = 0; i < 90; i++) g.frame(performance.now() + i * 33);
  out.home = Math.hypot(g.buggy.x - g.crownPos.x, g.buggy.z - g.crownPos.z) < 15;
  out.recallCleared = !g.recall;
  // and a near buggy must not offer the button
  g.burrowUI.open(); g.burrowUI.render();
  out.nearHidden = document.querySelector('#brecall').style.display === 'none';
  return out;
});

console.log(JSON.stringify(result, null, 1));
console.log('pageerrors:', errors.length ? errors.slice(0, 3) : 'none');
await browser.close();
killServer();
process.exit(result.visible && result.enabled && result.recallStarted
  && result.home && result.recallCleared && result.nearHidden && !errors.length ? 0 : 1);
