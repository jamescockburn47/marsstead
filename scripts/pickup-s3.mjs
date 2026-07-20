// pickup-s3: reshoot ONLY the night drive — clear ground, a moving
// buggy, and a slow sky pan so the Milky Way crosses the frame.

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

await page.evaluate(async () => {
  const g = window.marsstead;
  const M = await import('/src/mars.js');
  const R = await import('/src/rocks.js');
  // hunt a CLEAR lane on the home plain: low rockiness here AND 60 m ahead
  const h = M.latLonToWorld(M.HOME.lat, M.HOME.lon);
  let best = null, bestR = 1;
  for (let i = 0; i < 400; i++) {
    const x = h.x + ((i * 73) % 1200) - 600, z = h.z + ((i * 131) % 1200) - 600;
    const r = Math.max(R.rockiness(x, z), R.rockiness(x + 40, z), R.rockiness(x + 80, z));
    if (r < bestR) { bestR = r; best = { x, z }; }
  }
  g.pos.x = best.x; g.pos.z = best.z;
  const { lon } = M.worldToLatLon(g.pos.x, g.pos.z);
  g.calibrateToLocalHour(1.6 - lon / 15 + M.HOME.lon / 15);   // deep night
  for (let i = 0; i < 120; i++) { window.__base += 60; g.frame(window.__base); }
  g.buggy.x = g.pos.x + 2; g.buggy.z = g.pos.z;
  g.buggy.heading = Math.PI / 2;               // drive east along the clear lane
  window.__base += 33; g.frame(window.__base);
  if (!g.driving) g.interact();
  g.lamp = true;
  g.buggy.u = 8;                                // rolling from frame one
  g.camPitch = 0.02; g.camDist = 10;            // the sky owns the frame
});
await page.keyboard.down('w');
for (let i = 0; i < 270; i++) {
  await page.evaluate(() => {
    const g = window.marsstead;
    g.camYaw += 0.003;                          // slow pan: the sky sweeps
    window.__base += 33.4; g.frame(window.__base);
  });
  writeFileSync(`${OUT}/s3_${String(i).padStart(4, '0')}.jpg`,
    await page.screenshot({ type: 'jpeg', quality: 85 }));
  if (i % 60 === 0) console.log(`  s3: ${i}/270`);
}
await page.keyboard.up('w');
console.log('pickup done');
await browser.close();
killServer();
process.exit(0);
