// shot-attract: the landing page's moving picture, one frame per shot —
// the descent from space, the stead at dusk, the night drive, the dusty
// gold — WITH the title over it, exactly as a visitor sees it. Headless
// Chrome; boots WITHOUT ?play so the real attract path runs.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

mkdirSync('media', { recursive: true });

const server = spawn('npx', ['vite', '--port', '5198'], {
  stdio: 'pipe', detached: process.platform !== 'win32', shell: process.platform === 'win32',
});
function killServer() {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
    } else process.kill(-server.pid);
  } catch { server.kill(); }
}
const PORT = await new Promise((res, rej) => {
  const t = setTimeout(() => { killServer(); rej(new Error('vite timeout')); }, 30000);
  let buf = '';
  server.stdout.on('data', (d) => {
    buf += String(d).replace(/\x1b\[[0-9;]*m/g, '');
    const m = buf.match(/Local:\s+http:\/\/localhost:(\d+)\//);
    if (m) { clearTimeout(t); res(Number(m[1])); }
  });
  server.stderr.on('data', (d) => process.stderr.write(d));
});

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : { channel: 'chrome' },
);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
await page.goto(`http://localhost:${PORT}/?gfx=fine`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marssteadAttract && window.marssteadAttract.ready,
  null, { timeout: 25000 });

// let the near field stream once before any shot
await page.waitForFunction(() => {
  const g = window.marssteadAttract;
  return g.terrain.queue.length === 0;
}, null, { timeout: 60000 }).catch(() => {});

import { writeFileSync } from 'node:fs';
async function shot(name, tIntoLoop) {
  // capture the CANVAS directly, in the same task as an explicit render —
  // Playwright's stability-waiting screenshot starves under a live rAF loop
  const data = await page.evaluate(({ tIntoLoop }) => {
    const g = window.marssteadAttract;
    g.attractT = tIntoLoop - 6.6;    // the 200 warm-up frames land ON the mark
    g.attractShotId = '';            // force the shot's staging to re-run
    let clock = performance.now();
    for (let i = 0; i < 200; i++) { clock += 33; g.frame(clock); }
    return document.querySelector('canvas').toDataURL('image/png');
  }, { tIntoLoop });
  writeFileSync(`media/attract-${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`  shot attract-${name}`);
}

// mid-shot times into the loop: descent(0-22) stead(22-38) drive(38-56) gold(56-70)
await shot('descent-high', 8);
await shot('descent-low', 20);
await shot('stead', 30);
await shot('drive', 47);
await shot('gold', 63);

console.log(errors.length ? `shot-attract: ${errors.length} console errors!` : 'shot-attract: clean');
errors.slice(0, 4).forEach((e) => console.error('  ' + e));
await browser.close();
killServer();
process.exit(errors.length ? 1 : 0);
