// live-hop (needs a browser + vite): the whole staged flight, end to
// end — pad placed, hopper assembled, tanks loaded, a 12 km hop plotted
// and flown by driving frames. Asserts the doctrine: phases in order,
// streamed terrain hidden under the vista at the crest, the sky ladder
// engaged (uThin high, stars by day), the landing on the mark, the world
// handed back, and not one console error.

import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

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
});

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) errors.push(m.text());
});
await page.addInitScript(() => {
  try { localStorage.clear(); localStorage.setItem('marsstead-orders-seen', '1'); } catch {}
});
await page.goto(`http://localhost:${PORT}/?play&gfx=plain`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 20000 });

const result = await page.evaluate(async () => {
  const g = window.marsstead;
  const M = await import('/src/machines.js');
  const out = { phases: [], midArc: {}, errors: [] };
  // stage: pad under our feet, hopper stood on it, four tanks racked
  const px = g.pos.x + 8, pz = g.pos.z;
  g.machineLayer.sync(g.machines, (x, z) => g.groundAt(x, z));
  g.hopperBuilt = true;
  g.hopper.x = px; g.hopper.z = pz;
  for (let i = 0; i < 4; i++) g.hopper.fuelKg += 110;
  // the console's own arithmetic: open, aim 12 km north, read the plot
  g.hopUI.open();
  g.hopUI.aim = [px, pz - 12000];
  g.hopUI.render();
  out.plotText = document.querySelector('#hplot').textContent;
  out.goEnabled = !document.querySelector('#hgo').disabled;
  document.querySelector('#hgo').click(); // LIGHT THE ENGINE
  out.ignited = !!g.hopper.hop && !!g.hopFlight;
  out.consoleClosed = !g.hopUI.visible;

  // fly by hand: fixed 50 ms frames until landed (or 3000 frames)
  let last = performance.now();
  let sawThin = 0, sawStars = 0, sawVista = false, terrainHiddenAtCrest = null;
  for (let i = 0; i < 3000 && (g.hopFlight || g.hopper.hop); i++) {
    last += 50;
    g.frame(last);
    const ph = g.hopper.hop ? g.hopper.state : 'landed';
    if (!out.phases.includes(ph)) out.phases.push(ph);
    if (g.hopAlt > 1700) {
      sawThin = Math.max(sawThin, g.L.thin || 0);
      sawStars = Math.max(sawStars, g.L.starVisibility || 0);
      sawVista = sawVista || (g.vista.mesh && g.vista.mesh.visible);
      if (terrainHiddenAtCrest === null) {
        const chunk = [...g.terrain.chunks.values()][0];
        terrainHiddenAtCrest = chunk ? !chunk.mesh.visible : null;
      }
    }
  }
  out.midArc = { sawThin: +sawThin.toFixed(2), sawStars: +sawStars.toFixed(2), sawVista, terrainHiddenAtCrest };
  out.landed = !g.hopper.hop && !g.hopFlight;
  out.landedAt = { x: Math.round(g.hopper.x - px), z: Math.round(g.hopper.z - pz) };
  out.aimErr = Math.round(Math.hypot(g.hopper.x - px, g.hopper.z - pz + 12000));
  out.playerNearCraft = Math.hypot(g.pos.x - g.hopper.x, g.pos.z - g.hopper.z) < 10;
  out.colonistBack = g.colonist.group.visible;
  out.fuelLeft = Math.round(g.hopper.fuelKg);
  // the world hands back: run frames until the destination streams
  for (let i = 0; i < 600 && g.terrain.queue.length; i++) { last += 50; g.frame(last); }
  const chunk = [...g.terrain.chunks.values()][0];
  out.terrainBack = chunk ? chunk.mesh.visible : false;
  out.vistaGone = !g.vista.mesh;
  out.camFarRestored = g.cam.far === 6000;
  return out;
});

console.log(JSON.stringify(result, null, 1));
console.log('pageerrors:', errors.length ? errors.slice(0, 4) : 'none');
await browser.close();
killServer();

const ok = result.goEnabled && result.ignited && result.consoleClosed
  && result.phases.join(',') === 'ascent,arc,descent,landed'
  && result.midArc.sawThin > 0.5 && result.midArc.sawStars > 0.5
  && result.midArc.sawVista && result.midArc.terrainHiddenAtCrest === true
  && result.landed && result.aimErr < 900
  && result.playerNearCraft && result.colonistBack
  && result.terrainBack && result.vistaGone && result.camFarRestored
  && !errors.length;
console.log(ok ? 'live-hop: all green' : 'live-hop: FAILED');
process.exit(ok ? 0 : 1);
