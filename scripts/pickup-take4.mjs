// pickup-take4: reshoot s2 (daytime buggy), s3 (night summit walk,
// maximum sky, Milky-Way hunted), s4 (the landing COMPLETES with
// Viking 1 genuinely in frame), s6 (the true crest). s1/s5/s7 stand.

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
await page.evaluate(() => {
  const g = window.marsstead;
  window.__stage = {
    async settle(n = 150) { for (let i = 0; i < n; i++) { window.__base += 60; g.frame(window.__base); } },
    async hour(H) {
      const M = await import('/src/mars.js');
      const { lon } = M.worldToLatLon(g.pos.x, g.pos.z);
      g.calibrateToLocalHour(H - lon / 15 + M.HOME.lon / 15);
    },
  };
});
async function capture(shot, frames, perFrame = null) {
  for (let i = 0; i < frames; i++) {
    if (perFrame) await page.evaluate(perFrame, i);
    await page.evaluate(() => { window.__base += 33.4; window.marsstead.frame(window.__base); });
    writeFileSync(`${OUT}/${shot}_${String(i).padStart(4, '0')}.jpg`,
      await page.screenshot({ type: 'jpeg', quality: 85 }));
    if (i % 60 === 0) console.log(`  ${shot}: ${i}/${frames}`);
  }
}
const S = async (fn, arg) => page.evaluate(fn, arg);

// ---- s2 · the DAYTIME buggy run (8 s) -------------------------------------
console.log('s2: daytime buggy');
await S(async () => {
  const g = window.marsstead;
  const M = await import('/src/mars.js');
  const R = await import('/src/rocks.js');
  // rolling open country on the Hellas rim, mid-afternoon; hunt a clear lane
  const p = M.latLonToWorld(-36.5, 62.0);
  let best = p, bestR = 1;
  for (let i = 0; i < 400; i++) {
    const x = p.x + ((i * 73) % 1600) - 800, z = p.z + ((i * 131) % 1600) - 800;
    const r = Math.max(R.rockiness(x, z), R.rockiness(x + 50, z), R.rockiness(x + 100, z));
    if (r < bestR) { bestR = r; best = { x, z }; }
  }
  g.pos.x = best.x; g.pos.z = best.z;
  await window.__stage.hour(14.8);
  await window.__stage.settle(170);
  g.buggy.x = g.pos.x + 2; g.buggy.z = g.pos.z;
  g.buggy.heading = Math.PI / 2;
  window.__base += 33; g.frame(window.__base);
  if (!g.driving) g.interact();
  g.buggy.u = 9;
  g.camPitch = 0.14; g.camDist = 9;
});
await page.keyboard.down('w');
await capture('s2', 240);
await page.keyboard.up('w');
await S(() => { const g = window.marsstead; if (g.driving) g.interact(); });

// ---- s3 · night walk on the summit of Olympus, maximum sky (9 s) ----------
console.log('s3: summit night walk');
await S(async () => {
  const g = window.marsstead;
  const M = await import('/src/mars.js');
  const p = M.latLonToWorld(18.65, 226.4);   // the summit country
  g.pos.x = p.x; g.pos.z = p.z;
  await window.__stage.hour(1.8);
  await window.__stage.settle(180);
});
// the Milky-Way hunt: sample the sky at 10 azimuths, walk toward the brightest
const bestYaw = await S(async () => {
  const g = window.marsstead;
  const cv = g.renderer.domElement;
  const probe = document.createElement('canvas');
  probe.width = 64; probe.height = 24;
  const ctx = probe.getContext('2d');
  let best = 0, bestB = -1;
  for (let k = 0; k < 10; k++) {
    const yaw = (k / 10) * Math.PI * 2;
    g.camYaw = yaw; g.camPitch = -0.05; g.camDist = 8;
    window.__base += 33; g.frame(window.__base);
    ctx.drawImage(cv, 0, 0, cv.width, cv.height * 0.4, 0, 0, 64, 24);
    const d = ctx.getImageData(0, 0, 64, 24).data;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) b += d[i] + d[i + 1] + d[i + 2];
    if (b > bestB) { bestB = b; best = yaw; }
  }
  return best;
});
await S((yaw) => {
  const g = window.marsstead;
  g.camYaw = yaw; g.heading = yaw;
  g.camPitch = -0.05; g.camDist = 8;   // the sky owns two thirds of the frame
}, bestYaw);
await page.keyboard.down('w');
await capture('s3', 270);
await page.keyboard.up('w');

// ---- s4 · the landing, COMPLETE, Viking 1 in frame throughout (14 s) ------
console.log('s4: the full landing');
await S(async () => {
  const g = window.marsstead;
  const M = await import('/src/mars.js');
  const H = await import('/src/heritage.js');
  const v = H.heritageXZ(H.HERITAGE.find((s) => s.id === 'viking1'));
  g.hopper.x = v.x - 2500; g.hopper.z = v.z + 300;
  g.landerPos.x = g.hopper.x; g.landerPos.z = g.hopper.z;
  g.hopper.fuelKg = 660;
  g.pos.x = g.hopper.x + 3; g.pos.z = g.hopper.z;
  await window.__stage.hour(16.6);
  await window.__stage.settle(180);
  // land 24 m SOUTH of the wreck; the camera looks NORTH over the ship
  // at the wreck for the whole descent (yaw held at PI each frame)
  g.igniteHop(v.x, v.z + 24, false);
  let guard = 0;
  while (g.hopFlight && guard++ < 2000) {
    window.__base += 100; g.frame(window.__base);
    if ((g.hopper.state === 'descent' && g.hopAlt < 260) || g.hopper.state === 'settle') break;
  }
});
await capture('s4', 420, () => {
  const g = window.marsstead;
  // hold the frame: due north over the descending ship at the wreck
  g.camYaw = Math.PI;
  g.camPitch = g.hopFlight ? 0.10 : 0.13;
  g.camDist = g.hopFlight ? 22 : 15;
});

// ---- s6 · the TRUE crest over the round horizon (8 s) ---------------------
console.log('s6: the crest, properly');
await S(async () => {
  const g = window.marsstead;
  g.hopper.x = g.pos.x + 6; g.hopper.z = g.pos.z;
  g.landerPos.x = g.hopper.x; g.landerPos.z = g.hopper.z;
  g.hopper.fuelKg = 660;
  await window.__stage.hour(12.4);
  await window.__stage.settle(80);
  g.igniteHop(g.hopper.x - 24000, g.hopper.z + 5000, false);
  // fast-forward BY TIME into the first third of the arc — no state races
  let guard = 0;
  while (g.hopFlight && guard++ < 2000) {
    window.__base += 100; g.frame(window.__base);
    const H = g.hopper.hop;
    if (!H) break;
    if (H.t > H.dur.ignition + H.dur.ascent + H.dur.arc * 0.2) break;
  }
});
await capture('s6', 240);

console.log('take-4 pickups done');
await browser.close();
killServer();
process.exit(0);
