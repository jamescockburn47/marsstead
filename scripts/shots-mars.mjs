// shots-mars: the contact sheet — the look, judged in one image. Boots the
// dev server, forces a NEW landing (cleared save -> deterministic spawn) on
// the fine tier, walks the clock through the canonical light states, and
// screenshots each with a fixed camera. media/contact-sheet.html lays the
// set out in a grid for one-glance review; the per-shot pngs are the
// golden-diff inputs when that lands. Not part of `npm run verify` (needs
// a browser); run on demand after any look change.
//
// Windows-friendly: CHROMIUM_PATH wins; otherwise the installed Chrome
// (channel). No SwiftShader forcing — the contact sheet wants the REAL look.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

mkdirSync('media', { recursive: true });

// no fixed port: vite picks a free one and we parse it from the banner
// (stripping ANSI first — v8 lards the URL with bold codes)
const server = spawn('npx', ['vite', '--port', '5198'], {
  stdio: 'pipe', detached: process.platform !== 'win32', shell: process.platform === 'win32',
});
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

function killServer() {
  // synchronous on Windows: process.exit right after must not orphan vite
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
    } else {
      process.kill(-server.pid);
    }
  } catch { server.kill(); }
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : { channel: 'chrome' },
);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  // the muster beacon (/dash/visit) 404s on a bare dev server by design —
  // fire-and-forget; everything else is a real error
  if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) {
    errors.push(m.text());
  }
});

// a NEW landing every run: deterministic spawn, calibrated clock — but the
// LANDFALL ORDERS sheet stays shut (it auto-opens on a fresh save and
// would blind every frame of the sheet)
await page.addInitScript(() => {
  try {
    localStorage.clear();
    localStorage.setItem('marsstead-orders-seen', '1');
  } catch { /* fine */ }
});
await page.goto(`http://localhost:${PORT}/?play&gfx=fine`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 20000 });

// let the near field stream before any shot
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(400);
  if (await page.evaluate(() => window.marsstead.terrain.chunks.size) >= 200) break;
}

// one camera grammar for every shot: yaw/pitch fixed, or aimed down-sun.
// hour sets the coarse clock; el (with dir 'down'|'up') fine-scrubs the sun
// to a target ELEVATION — the light states live at elevations, not hours.
async function shot(name, { hour, el, dir = 'down', downSun = false, lamp = false, yaw = 0.6, pitch = 0.22, goto } = {}) {
  await page.evaluate(async ({ hour, el, dir, downSun, lamp, yaw, pitch, goto }) => {
    const g = window.marsstead;
    if (g.orders && g.orders.visible) g.orders.close(); // never shoot paper
    if (goto === 'rocky') {
      // stand the colonist in the rockiest country within reach
      const { rockiness } = await import('/src/rocks.js');
      let best = { r: 0, x: 0, z: 0 };
      for (let x = -800; x <= 800; x += 64) {
        for (let z = -800; z <= 800; z += 64) {
          const rr = rockiness(x, z);
          if (rr > best.r) best = { r: rr, x, z };
        }
      }
      g.pos.set(best.x, 0, best.z);
      g.pos.y = g.groundAt(best.x, best.z);
      for (let i = 0; i < 30; i++) g.frame(performance.now() + i * 16);
    }
    if (hour !== undefined) g.calibrateToLocalHour(hour);
    if (el !== undefined) {
      let guard = 0;
      const past = () => (dir === 'down' ? g.sunEl <= el : g.sunEl >= el);
      while (!past() && guard++ < 900) {
        g.simMillis += 3698968.5 / 20; // +3 Mars minutes, always forward
        g.frame(performance.now() + guard);
      }
    }
    g.lampMode = lamp ? 'on' : 'auto';
    g.camYaw = yaw; g.camPitch = pitch;
    // settle: exposure easing converges (dt*0.4), chunks re-sort, sky sets
    for (let i = 0; i < 260; i++) g.frame(performance.now() + 2000 + i * 33);
    if (downSun) {
      g.camYaw = Math.PI - (g.sunAz * Math.PI / 180);
      g.camPitch = 0.12;
      for (let i = 0; i < 30; i++) g.frame(performance.now() + 12000 + i * 33);
    }
  }, { hour, el, dir, downSun, lamp, yaw, pitch, goto });
  // a teleport rebuilds the whole streamed grid — drain the build queues
  // under real RAF before asking for a stable frame
  await page.waitForFunction(() => {
    const g = window.marsstead;
    return g.terrain.queue.length === 0 && g.rocks.queue.length === 0;
  }, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(700); // real RAF frames so the canvas presents
  await page.screenshot({ path: `media/sheet-${name}.png`, timeout: 60000 });
  const state = await page.evaluate(() => ({
    sunEl: +window.marsstead.sunEl.toFixed(1),
    exposure: +window.marsstead.renderer.toneMappingExposure.toFixed(3),
  }));
  console.log(`  shot ${name}: sunEl ${state.sunEl}°, exposure ${state.exposure}`);
  return { name, ...state };
}

const shots = [];
shots.push(await shot('noon', { hour: 12.2 }));
shots.push(await shot('afternoon', { hour: 15.5 }));
shots.push(await shot('boulderfield', { hour: 16.2, goto: 'rocky', yaw: 2.2, pitch: 0.18 }));
shots.push(await shot('golden', { el: 12, downSun: true }));
shots.push(await shot('bluehour', { el: 0.4, downSun: true }));
shots.push(await shot('night', { el: -25, lamp: true }));
shots.push(await shot('dawn', { el: -1.5, dir: 'up', downSun: true }));

// the sheet: one glance, six states
writeFileSync('media/contact-sheet.html', `<!doctype html>
<meta charset="utf-8"><title>Marsstead contact sheet</title>
<style>
  body { background: #14100e; color: #d8c6b4; font: 14px/1.4 Georgia, serif; margin: 16px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  figure { margin: 0; } img { width: 100%; display: block; border-radius: 3px; }
  figcaption { padding: 4px 2px; opacity: 0.8; }
</style>
<h1>Marsstead — the six lights</h1>
<div class="grid">
${shots.map((s) => `  <figure><img src="sheet-${s.name}.png" alt="${s.name}">
  <figcaption>${s.name} — sun ${s.sunEl}°, exposure ${s.exposure}</figcaption></figure>`).join('\n')}
</div>
`);

console.log(errors.length ? `shots-mars: ${errors.length} console errors!` : 'shots-mars: no console errors');
errors.slice(0, 5).forEach((e) => console.error('  ' + e));

await browser.close();
killServer();
if (errors.length) process.exit(1);
console.log('shots-mars: contact sheet at media/contact-sheet.html');
process.exit(0);
