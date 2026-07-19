// shot-crown: the settlement's surface face, judged in two lights — a
// lived-in crown by afternoon (wear, cables, banks, hands at work) and by
// night (the buried lantern: light-pipes burning with the warren's life).
// Headless Chrome (the pane's kiosk guard blocks pane captures). Writes
// media/crown-day.png and media/crown-night.png.

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
  if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) errors.push(m.text());
});
await page.addInitScript(() => {
  try {
    localStorage.clear();
    localStorage.setItem('marsstead-orders-seen', '1');
  } catch { /* fine */ }
});
await page.goto(`http://localhost:${PORT}/?play&gfx=fine`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 20000 });

// a lived-in crown: rooms below, ring seated, one dig still running so
// the hands are AT the cut in every frame
await page.evaluate(async () => {
  const g = window.marsstead;
  const B = await import('/src/burrow.js');
  B.plan(g.burrow, 'shaft', 0, 1); B.tick(g.burrow, 60, 3);
  B.installRing(g.burrow);
  B.plan(g.burrow, 'corridor', 1, 1); B.plan(g.burrow, 'corridor', -1, 1);
  B.tick(g.burrow, 60, 3);
  B.plan(g.burrow, 'bunk', 2, 1); B.plan(g.burrow, 'store', -2, 1);
  B.tick(g.burrow, 80, 3);
  B.plan(g.burrow, 'garden', 1, 2); // queued forever: the dig never idles
});

async function shot(name, hour) {
  await page.evaluate(({ hour }) => {
    const g = window.marsstead;
    g.calibrateToLocalHour(hour);
    // stand the settler off the crown's shoulder and aim the view at it
    const c = g.crownPos;
    g.pos.set(c.x + 6.5, 0, c.z + 4.5);
    g.pos.y = g.groundAt(g.pos.x, g.pos.z);
    const dir = { x: c.x - g.pos.x, z: c.z - g.pos.z };
    g.camYaw = Math.PI - Math.atan2(dir.x, -dir.z);
    g.camPitch = 0.14;
    for (let i = 0; i < 220; i++) g.frame(performance.now() + i * 33);
  }, { hour });
  await page.waitForFunction(() => {
    const g = window.marsstead;
    return g.terrain.queue.length === 0 && g.rocks.queue.length === 0;
  }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `media/crown-${name}.png` });
  console.log(`  shot crown-${name}`);
}

await shot('day', 15.5);
await shot('night', 22.6);

console.log(errors.length ? `shot-crown: ${errors.length} console errors!` : 'shot-crown: clean');
errors.slice(0, 4).forEach((e) => console.error('  ' + e));
await browser.close();
killServer();
process.exit(errors.length ? 1 : 0);
