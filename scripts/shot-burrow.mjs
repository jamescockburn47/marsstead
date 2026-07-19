// shot-burrow: one screenshot of the Burrow console with a lived-in
// warren, for visual review. Headless Chrome (the pane's kiosk guard
// blocks pane captures). Writes media/burrow-console.png.

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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) errors.push(m.text());
});
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* fine */ } });
await page.goto(`http://localhost:${PORT}/?play&gfx=fine`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 20000 });

await page.evaluate(async () => {
  const g = window.marsstead;
  const B = await import('/src/burrow.js');
  // a lived-in warren: two shaft levels, corridors both ways, furnished
  // rooms, one dig running, one queued — every register on screen
  B.plan(g.burrow, 'shaft', 0, 1); B.tick(g.burrow, 60, 3);
  B.installRing(g.burrow);
  B.plan(g.burrow, 'corridor', 1, 1); B.plan(g.burrow, 'corridor', -1, 1);
  B.tick(g.burrow, 60, 3);
  B.plan(g.burrow, 'bunk', 2, 1); B.plan(g.burrow, 'store', -2, 1);
  B.tick(g.burrow, 80, 3);
  B.plan(g.burrow, 'shaft', 0, 2); B.tick(g.burrow, 40, 3);
  B.plan(g.burrow, 'corridor', 1, 2); B.tick(g.burrow, 30, 3);
  B.plan(g.burrow, 'garden', 2, 2); B.tick(g.burrow, 30, 3); // mid-dig
  B.plan(g.burrow, 'corridor', -1, 2); // queued
  g.calibrateToLocalHour(15.5);
  for (let i = 0; i < 30; i++) g.frame(g.last + 33);
  g.burrowUI.open();
});
await page.waitForTimeout(900);
await page.screenshot({ path: 'media/burrow-console.png' });
console.log(errors.length ? `shot-burrow: ${errors.length} console errors!` : 'shot-burrow: clean');
errors.slice(0, 4).forEach((e) => console.error('  ' + e));
await browser.close();
killServer();
process.exit(errors.length ? 1 : 0);
