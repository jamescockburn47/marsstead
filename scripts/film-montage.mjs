// film-montage: the LinkedIn reel — seven money shots, filmed off the
// live game by deterministic frame-stepping (the sim renders exactly
// the frames we ask for), written as JPEG sequences for ffmpeg.
// Usage: node scripts/film-montage.mjs   (then scripts/cut-montage.sh)

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'media/montage';
mkdirSync(OUT, { recursive: true });

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
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`http://localhost:${PORT}/?play`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 60000 });
// WE are the clock now: every manual g.frame() queues another RAF, and
// each screenshot pumps the compositor and fires the whole backlog —
// by shot 2 every captured frame replayed hundreds of sim frames (the
// first shoot crawled to 1 frame per 20 s). Kill the self-scheduling.
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
// the camera crew has read the briefing: keep LANDFALL ORDERS shut
// (the every-new-life auto-open filmed shoot #2 entirely behind the sheet)
await page.evaluate(() => { window.marsstead.ordersShown = true; });

// one sim step + render; base advances 33.4 ms -> ~30 fps footage
await page.evaluate(() => { window.__base = performance.now(); });
async function step(n = 1, ms = 33.4) {
  await page.evaluate(([k, m]) => {
    const g = window.marsstead;
    for (let i = 0; i < k; i++) { window.__base += m; g.frame(window.__base); }
  }, [n, ms]);
}
let frameNo = 0;
async function capture(shot, frames, perFrame = null) {
  for (let i = 0; i < frames; i++) {
    if (perFrame) await page.evaluate(perFrame, i);
    await step(1);
    const buf = await page.screenshot({ type: 'jpeg', quality: 85 });
    writeFileSync(`${OUT}/${shot}_${String(i).padStart(4, '0')}.jpg`, buf);
    frameNo++;
    if (i % 60 === 0) console.log(`  ${shot}: ${i}/${frames}`);
  }
}

// helpers staged inside the page
await page.evaluate(() => {
  const g = window.marsstead;
  window.__stage = {
    async settle(n = 140) { for (let i = 0; i < n; i++) { window.__base += 60; g.frame(window.__base); } },
    tp(x, z) { g.pos.x = x; g.pos.z = z; g.keys = g.keys || {}; },
    async hour(H) {
      const M = await import('/src/mars.js');
      const { lon } = M.worldToLatLon(g.pos.x, g.pos.z);
      // calibrateToLocalHour speaks HOME time; translate the site's hour
      g.calibrateToLocalHour(H - lon / 15 + M.HOME.lon / 15);
    },
    cam(yaw, pitch, dist) { g.camYaw = yaw; g.camPitch = pitch; g.camDist = dist; },
  };
});

const S = async (fn, arg) => page.evaluate(fn, arg);

// ---- SHOT 1 · dawn frost walk at Jezero (8 s) -----------------------------
console.log('shot 1: dawn frost');
await S(async () => {
  const g = window.marsstead;
  const M = await import('/src/mars.js');
  const h = M.latLonToWorld(M.HOME.lat, M.HOME.lon);
  window.__stage.tp(h.x + 140, h.z + 90);
  await window.__stage.hour(7.7);
  await window.__stage.settle(150);
  const F = g.terrain.frost;
  g.camYaw = Math.atan2(F.uSunAzimXZ.value.x, -F.uSunAzimXZ.value.y);
  g.camPitch = 0.13; g.camDist = 7.5;
});
await page.keyboard.down('w');
await capture('s1', 240);
await page.keyboard.up('w');

// ---- SHOT 2 · Olympus Mons ridge walk, midday (8 s) -----------------------
console.log('shot 2: olympus');
await S(async () => {
  const g = window.marsstead;
  const M = await import('/src/mars.js');
  const p = M.latLonToWorld(19.2, 231.5);   // east approaches of the shield
  window.__stage.tp(p.x, p.z);
  await window.__stage.hour(15.0);
  await window.__stage.settle(170);
  g.heading = -Math.PI / 2;                  // face west, at the mountain
  g.camYaw = -Math.PI / 2; g.camPitch = 0.10; g.camDist = 8.5;
});
await page.keyboard.down('w');
await capture('s2', 240);
await page.keyboard.up('w');

// ---- SHOT 3 · night drive under the Milky Way (9 s) -----------------------
console.log('shot 3: night drive');
await S(async () => {
  const g = window.marsstead;
  await window.__stage.hour(1.3);
  await window.__stage.settle(60);
  g.buggy.x = g.pos.x + 2; g.buggy.z = g.pos.z;
  g.buggy.heading = 0.9;
  window.__base += 33; g.frame(window.__base);
  if (!g.driving) g.interact();              // saddle up
  if (!g.lamp) { g.lamp = true; }            // lights on for the drama
  g.camPitch = 0.06; g.camDist = 9.5;        // sky-heavy frame
});
await page.keyboard.down('w');
await capture('s3', 270);
await page.keyboard.up('w');
await S(() => { const g = window.marsstead; if (g.driving) g.interact(); });

// ---- SHOT 4 · landing beside Viking 1 (10 s) ------------------------------
console.log('shot 4: viking landing');
await S(async () => {
  const g = window.marsstead;
  const H = await import('/src/heritage.js');
  const v = H.heritageXZ(H.HERITAGE.find((s) => s.id === 'viking1'));
  // stage the ship 3 km short of the wreck, tanks full, then fly to it
  g.hopper.x = v.x - 3000; g.hopper.z = v.z + 400;
  g.landerPos.x = g.hopper.x; g.landerPos.z = g.hopper.z;
  g.hopper.fuelKg = 660;
  window.__stage.tp(g.hopper.x + 3, g.hopper.z);
  await window.__stage.hour(16.4);           // the long light
  await window.__stage.settle(170);
  g.igniteHop(v.x + 26, v.z - 8, false);     // land beside the old machine
  // fast-forward to the last 500 m of the descent, uncaptured
  let guard = 0;
  while (g.hopFlight && guard++ < 2000) {
    window.__base += 100; g.frame(window.__base);
    const st = window.marsstead.hopper.state;
    if ((st === 'descent' && g.hopAlt < 500) || st === 'settle') break;
  }
  window.__vik = { x: v.x, z: v.z };
});
await capture('s4', 300, () => {
  const g = window.marsstead;
  if (!g.hopFlight && window.__vik) {
    const t = Math.atan2(window.__vik.x - g.pos.x, window.__vik.z - g.pos.z);
    g.camYaw += (((t - g.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.06;
    g.camPitch = 0.14; g.camDist = 15;
  }
});

// ---- SHOT 5 · the signal sweep (6 s) --------------------------------------
console.log('shot 5: the signal');
await S(async () => {
  const g = window.marsstead;
  const L = await import('/src/marslegends.js');
  const site = L.SITES[0];
  const p = L.siteXZ(site);
  window.__stage.tp(p.x + 60, p.z + 10);
  await window.__stage.hour(17.4);
  await window.__stage.settle(150);
  g.camYaw = Math.atan2(p.x - g.pos.x, p.z - g.pos.z);
  g.heading = g.camYaw;
  g.camPitch = 0.16; g.camDist = 7;
});
await page.keyboard.down('w');
await capture('s5', 130);
await page.keyboard.up('w');
await S(() => {
  const g = window.marsstead;
  window.__base += 33; g.frame(window.__base);
  g.interact();                              // read the ground
});
await capture('s5b', 60);

// ---- SHOT 6 · the crest: round horizon (8 s) ------------------------------
console.log('shot 6: the crest');
await S(async () => {
  const g = window.marsstead;
  if (g.reading) g.reading = null;
  g.hopper.x = g.pos.x + 6; g.hopper.z = g.pos.z;
  g.landerPos.x = g.hopper.x; g.landerPos.z = g.hopper.z;
  g.hopper.fuelKg = 660;
  await window.__stage.hour(12.3);
  await window.__stage.settle(80);
  g.igniteHop(g.hopper.x + 21000, g.hopper.z - 6000, false);
  let guard = 0;
  while (g.hopFlight && guard++ < 2000) {
    window.__base += 100; g.frame(window.__base);
    const H = g.hopper.hop;
    if (g.hopper.state === 'arc' && H
      && H.t > H.dur.ignition + H.dur.ascent + H.dur.arc * 0.25) break;
  }
});
await capture('s6', 240);

// ---- SHOT 7 · the title, as the end card (5 s) ----------------------------
console.log('shot 7: title');
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marssteadAttract, null, { timeout: 60000 });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.evaluate(() => { window.__base = performance.now(); });
await S(() => {
  const g = window.marssteadAttract;
  for (let i = 0; i < 60; i++) { window.__base += 60; g.frame(window.__base); }
});
for (let i = 0; i < 150; i++) {
  await page.evaluate(() => {
    const g = window.marssteadAttract;
    window.__base += 33.4; g.frame(window.__base);
  });
  writeFileSync(`${OUT}/s7_${String(i).padStart(4, '0')}.jpg`,
    await page.screenshot({ type: 'jpeg', quality: 90 }));
}

console.log(`filmed ${frameNo + 150} frames -> ${OUT}/`);
await browser.close();
killServer();
process.exit(0);
