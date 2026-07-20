// pickup-s3b: the summit night walk, sky-maximal — stand ON the local
// crest, walk the level ridge line, camera pitched up, Milky-Way hunted.

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
  const C = await import('/src/marschunk.js');
  // hunt the LOCAL CREST on the shield: highest point in a 1.2 km ring
  const p0 = M.latLonToWorld(18.65, 226.4);
  let best = p0, bestH = -1e9;
  for (let i = 0; i < 500; i++) {
    const x = p0.x + ((i * 97) % 2400) - 1200, z = p0.z + ((i * 173) % 2400) - 1200;
    const h = C.meshGroundHeight(x, z);
    if (h > bestH) { bestH = h; best = { x, z }; }
  }
  g.pos.x = best.x; g.pos.z = best.z;
  const { lon } = M.worldToLatLon(g.pos.x, g.pos.z);
  g.calibrateToLocalHour(1.8 - lon / 15 + M.HOME.lon / 15);
  for (let i = 0; i < 180; i++) { window.__base += 60; g.frame(window.__base); }
  // walk the LEVEL direction: probe 12 headings, pick the flattest
  let flat = 0, flatD = 1e9;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const d = Math.abs(C.meshGroundHeight(g.pos.x + Math.sin(a) * 25, g.pos.z + Math.cos(a) * 25)
      - C.meshGroundHeight(g.pos.x, g.pos.z));
    if (d < flatD) { flatD = d; flat = a; }
  }
  window.__walkDir = flat;
});
// the Milky-Way hunt at the up-pitch we will film with
const bestYaw = await page.evaluate(async () => {
  const g = window.marsstead;
  const cv = g.renderer.domElement;
  const probe = document.createElement('canvas');
  probe.width = 64; probe.height = 28;
  const ctx = probe.getContext('2d');
  // prefer yaws near the walk direction so figure and band share a frame
  let best = window.__walkDir, bestB = -1;
  for (let k = -3; k <= 3; k++) {
    const yaw = window.__walkDir + k * 0.45;
    g.camYaw = yaw; g.camPitch = -0.13; g.camDist = 8.5;
    window.__base += 33; g.frame(window.__base);
    ctx.drawImage(cv, 0, 0, cv.width, cv.height * 0.55, 0, 0, 64, 28);
    const d = ctx.getImageData(0, 0, 64, 28).data;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) b += d[i] + d[i + 1] + d[i + 2];
    if (b > bestB) { bestB = b; best = yaw; }
  }
  return best;
});
await page.evaluate((yaw) => {
  const g = window.marsstead;
  g.heading = yaw; g.camYaw = yaw;
  g.camPitch = -0.13; g.camDist = 8.5;   // the sky takes the frame
}, bestYaw);
await page.keyboard.down('w');
for (let i = 0; i < 270; i++) {
  await page.evaluate(() => {
    const g = window.marsstead;
    g.camPitch = -0.13;                   // hold against any authored drift
    window.__base += 33.4; g.frame(window.__base);
  });
  writeFileSync(`${OUT}/s3_${String(i).padStart(4, '0')}.jpg`,
    await page.screenshot({ type: 'jpeg', quality: 85 }));
  if (i % 90 === 0) console.log(`  s3b: ${i}/270`);
}
await page.keyboard.up('w');
console.log('s3b done');
await browser.close();
killServer();
process.exit(0);
