// shot-hop: the showreel, framed — three moments of a 120 km hop at
// midday (the drama IS black-at-noon): the ascent's plume over the
// falling pad, the crest over the MOLA vista under daylight stars with
// the limb band, and the landing burn. Headless Chrome; the fine tier.

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
  // network noise is the rig's own barks hitting the live relay's rate
  // limit — only true page/GL errors fail the shot
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
await page.addInitScript(() => {
  try { localStorage.clear(); localStorage.setItem('marsstead-orders-seen', '1'); } catch {}
});
await page.goto(`http://localhost:${PORT}/?play&gfx=fine`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 20000 });

// stage and ignite an 18 km hop WEST at midday: on the 1:200 world that
// is ~61° of longitude — launch at noon, land in the golden hour, the
// whole colour journey in one flight (north instead would be 61° of
// LATITUDE: the arctic; the world's scale is a real flight consideration)
await page.evaluate(async () => {
  const g = window.marsstead;
  const M = await import('/src/machines.js');
  g.calibrateToLocalHour(12.1);
  const px = g.pos.x + 8, pz = g.pos.z;
  g.machineLayer.sync(g.machines, (x, z) => g.groundAt(x, z));
  g.hopperBuilt = true;
  g.hopper.x = px; g.hopper.z = pz;
  for (let i = 0; i < 6; i++) g.hopper.fuelKg += 110;
  for (let i = 0; i < 60; i++) g.frame(performance.now() + i * 33);
  g.igniteHop(px - 18000, pz, false, false);
  window.__clock = performance.now();
});

// run frames until a condition holds, then let the canvas present
async function flyTo(cond, name, extra = {}) {
  await page.evaluate(({ cond, extra }) => {
    const g = window.marsstead;
    // eslint-disable-next-line no-new-func
    const test = new Function('g', `return (${cond});`);
    let guard = 0;
    while (!test(g) && guard++ < 4000 && (g.hopFlight || g.hopper.hop)) {
      window.__clock += 50;
      g.frame(window.__clock);
    }
    if (extra.yaw !== undefined) g.camYaw = extra.yaw;
    if (extra.pitch !== undefined) g.camPitch = extra.pitch;
    for (let i = 0; i < 14; i++) { window.__clock += 33; g.frame(window.__clock); }
  }, { cond, extra });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `media/hop-${name}.png` });
  console.log(`  shot hop-${name}`);
}

// the ascent: plume lit, pad shrinking below (camera slightly under)
await flyTo('g.hopAlt > 220 && g.hopAlt < 1500', 'ascent', { pitch: 0.12 });
// the crest: the world from above, stars at noon, the limb
await flyTo("g.hopper.state === 'arc' && g.hopper.hop.t > g.hopper.hop.dur.ascent + g.hopper.hop.dur.arc * 0.45", 'crest', { pitch: 0.42 });
// the fall home: landing burn against the returning ground, seen low
await flyTo("g.hopper.state === 'descent' && g.hopAlt < 1600", 'descent', { pitch: 0.08 });

console.log(errors.length ? `shot-hop: ${errors.length} console errors!` : 'shot-hop: clean');
errors.slice(0, 4).forEach((e) => console.error('  ' + e));
await browser.close();
killServer();
process.exit(errors.length ? 1 : 0);
