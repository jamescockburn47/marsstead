// pickup-scale: the scale-of-the-world beat — the ACTUAL planet, the
// console's live globe (PlanetChart), turning cursor-free in headless.
// James's own screen-grab had the pointer dragged across the disc the
// whole clip; this is the same rotating labelled Mars, captured clean.

import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'media/montage';
const server = spawn('npx', ['vite', '--port', '5199'], {
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
});
const browser = await chromium.launch({
  headless: true, args: ['--use-gl=angle', '--enable-webgl', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/?play`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 60000 });
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  window.marsstead.ordersShown = true;
  window.__base = performance.now();
});

// open the ship console on the planet page and let the globe build
const box = await page.evaluate(async () => {
  const g = window.marsstead;
  g.hopUI.open();
  g.hopUI.planetMode = true;
  g.hopUI.root.querySelector('#hchartwrap').classList.add('planet');
  // a warmup so the canvas sizes and the sphere/labels build
  for (let i = 0; i < 30; i++) { window.__base += 33.4; g.frame(window.__base); }
  const cv = g.hopUI.root.querySelector('#hplanet');
  const r = cv.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('globe rect:', JSON.stringify(box));

for (let i = 0; i < 150; i++) {
  await page.evaluate(() => {
    const g = window.marsstead;
    // hold a steady, filmic spin (idle drift is only 1.2 deg/s — too slow)
    g.hopUI.planet.orbit.vLon = 15;
    window.__base += 33.4; g.frame(window.__base);
  });
  writeFileSync(`${OUT}/sc_${String(i).padStart(4, '0')}.jpg`,
    await page.screenshot({ type: 'jpeg', quality: 85 }));
  if (i % 60 === 0) console.log(`  scale: ${i}/150`);
}
console.log('scale done');
await browser.close();
killServer();
process.exit(0);
