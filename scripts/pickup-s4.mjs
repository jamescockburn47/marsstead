// pickup-s4: the landing beside Viking 1, done right — instrumented,
// wreck offset laterally so the hull can't hide it, capture starting
// provably airborne.

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

const staged = await page.evaluate(async () => {
  const g = window.marsstead;
  const M = await import('/src/mars.js');
  const H = await import('/src/heritage.js');
  const v = H.heritageXZ(H.HERITAGE.find((s) => s.id === 'viking1'));
  g.hopper.x = v.x - 2500; g.hopper.z = v.z + 300;
  g.landerPos.x = g.hopper.x; g.landerPos.z = g.hopper.z;
  g.hopper.fuelKg = 660;
  g.pos.x = g.hopper.x + 3; g.pos.z = g.hopper.z;
  const { lon } = M.worldToLatLon(g.pos.x, g.pos.z);
  g.calibrateToLocalHour(16.6 - lon / 15 + M.HOME.lon / 15);
  for (let i = 0; i < 180; i++) { window.__base += 60; g.frame(window.__base); }
  // land 16 m EAST and 18 m SOUTH of the wreck: from the north-facing
  // camera the old machine sits clear, up-left of the hull
  const ok = (() => { g.igniteHop(v.x + 16, v.z + 18, false); return !!g.hopFlight; })();
  let steps = 0;
  while (g.hopFlight && steps++ < 2000) {
    window.__base += 100; g.frame(window.__base);
    const H2 = g.hopper.hop;
    // break by TIME: eight seconds before touchdown, whatever the
    // hop's shape (altitude thresholds lied on short low-apex hops)
    if (H2 && H2.t > H2.dur.total - 8) break;
  }
  window.__vik = v;
  return { ignited: ok, state: g.hopper.state, alt: Math.round(g.hopAlt || 0), steps };
});
console.log('staged:', JSON.stringify(staged));
if (!staged.ignited || staged.state === 'parked') {
  console.error('LANDING NOT AIRBORNE AT CAPTURE — aborting');
  await browser.close(); killServer(); process.exit(1);
}

for (let i = 0; i < 420; i++) {
  await page.evaluate(() => {
    const g = window.marsstead;
    g.camYaw = Math.PI;                        // due north: wreck up-left
    g.camPitch = g.hopFlight ? 0.10 : 0.13;
    g.camDist = g.hopFlight ? 22 : 15;
    window.__base += 33.4; g.frame(window.__base);
  });
  writeFileSync(`${OUT}/s4_${String(i).padStart(4, '0')}.jpg`,
    await page.screenshot({ type: 'jpeg', quality: 85 }));
  if (i === 0 || i === 90) {
    const st = await page.evaluate(() => ({ s: window.marsstead.hopper.state, a: Math.round(window.marsstead.hopAlt || 0) }));
    console.log(`  s4 frame ${i}:`, JSON.stringify(st));
  }
}
console.log('s4 pickup done');
await browser.close();
killServer();
process.exit(0);
