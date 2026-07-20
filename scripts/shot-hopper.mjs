// shot-hopper: the Stage 3 craft and the rebuilt stations, judged before
// any wiring ships (the showreel rule: the look leads). Three frames:
// the hopper fuelled on its pad at golden hour; the night burn; the
// works row (every station silhouette in one glance). Headless Chrome.

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

// stage the set: a pad + the hopper on it, and the works row nearby
await page.evaluate(async () => {
  const g = window.marsstead;
  const { HopperLayer } = await import('/src/hopperlayer.js');
  const M = await import('/src/machines.js');
  const px = g.pos.x + 26, pz = g.pos.z - 4;
  const py = g.groundAt(px, pz);
  // the works row, spaced for the eye, well clear of the pad
  const row = ['smelter', 'mill', 'assembler', 'solar-array', 'battery'];
  const rx = g.pos.x - 10, rz = g.pos.z - 26;
  row.forEach((t, i) => {
    g.machines.push(M.createMachine(t, rx + i * 5, rz, 0.4));
  });
  g.machineLayer.sync(g.machines, (x, z) => g.groundAt(x, z));
  g.buggy.x -= 40; // park the buggy out of every frame
  window.__hop = new HopperLayer(g.scene, g.renderer);
  window.__hop.setPlaced(px, pz, py + 0.2, 2.2); // canopy toward the cameras
  window.__hop.setFuel(4 * 110);
  window.__set = { px, pz, rx: rx + 10, rz }; // aim points
});

// stand `back` metres from the aim point (offset direction offA in rad),
// aim the view AT it — the shot-crown grammar, no guessed yaws
async function shot(name, { el, dir = 'down', aim, back = 11, offA = 2.4, pitch = 0.16, flame = 0 }) {
  await page.evaluate(({ el, dir, aim, back, offA, pitch, flame }) => {
    const g = window.marsstead;
    if (el !== undefined) {
      let guard = 0;
      const past = () => (dir === 'down' ? g.sunEl <= el : g.sunEl >= el);
      while (!past() && guard++ < 900) {
        g.simMillis += 3698968.5 / 20;
        g.frame(performance.now() + guard);
      }
    }
    const [ax, az] = aim === 'pad'
      ? [window.__set.px, window.__set.pz] : [window.__set.rx, window.__set.rz];
    g.pos.set(ax + Math.cos(offA) * back, 0, az + Math.sin(offA) * back);
    g.pos.y = g.groundAt(g.pos.x, g.pos.z);
    const d = { x: ax - g.pos.x, z: az - g.pos.z };
    g.camYaw = Math.PI - Math.atan2(d.x, -d.z) + 0.17; // craft off the settler's shoulder
    g.camPitch = pitch;
    window.__hop.setFlame(flame, g.t);
    for (let i = 0; i < 240; i++) {
      g.frame(performance.now() + 2000 + i * 33);
      window.__hop.update(g.t, g.sunEl < 0);
    }
  }, { el, dir, aim, back, offA, pitch, flame });
  await page.waitForFunction(() => {
    const g = window.marsstead;
    return g.terrain.queue.length === 0 && g.rocks.queue.length === 0;
  }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `media/hopper-${name}.png` });
  console.log(`  shot hopper-${name}`);
}

// golden hour on the pad, tanks racked, sun behind the camera's shoulder
await shot('golden', { el: 11, aim: 'pad', back: 10.5, offA: 2.6, pitch: 0.2 });
// the burn at dusk: throat fire and its light on the apron
await shot('burn', { el: -4, aim: 'pad', back: 9, offA: 1.2, pitch: 0.24, flame: 1 });
// the works row by afternoon light
await shot('works', { el: 28, dir: 'up', aim: 'row', back: 14, offA: 1.9, pitch: 0.16 });

console.log(errors.length ? `shot-hopper: ${errors.length} console errors!` : 'shot-hopper: clean');
errors.slice(0, 4).forEach((e) => console.error('  ' + e));
await browser.close();
killServer();
process.exit(errors.length ? 1 : 0);
