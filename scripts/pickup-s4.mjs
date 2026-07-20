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
  // Offset COMPUTED from the camera formula (main.js frameFlying): the
  // yaw=π lens sits at pos+(0, D·sinP+2.4, D·cosP) looking at pos+1.2y.
  // To put Viking ~12 m from the lens, ~15deg screen-left, clear of the
  // dust bloom, the ship must land at V+(3.2, -10.6). (James: "its the
  // real money shot" — big in the foreground, not small and up-left.)
  const ok = (() => { g.igniteHop(v.x + 3.2, v.z - 10.6, false); return !!g.hopFlight; })();
  let steps = 0;
  while (g.hopFlight && steps++ < 2000) {
    window.__base += 100; g.frame(window.__base);
    const H2 = g.hopper.hop;
    // break by TIME: eight seconds before touchdown, whatever the
    // hop's shape (altitude thresholds lied on short low-apex hops)
    if (H2 && H2.t > H2.dur.total - 8) break;
  }
  window.__vik = v;
  // the exact canon line the game speaks near Viking 1 (heritage.js) —
  // held on the HUD through the whole descent so the money shot carries
  // VESPER on the lander's history, relay up or down (James's ask)
  const vs = H.HERITAGE.find((s) => s.id === 'viking1');
  window.__vLine = `${vs.name}, ${vs.year}. ${vs.story}`;
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
    g.camYaw = Math.PI;                        // wreck foreground-left
    g.camPitch = g.hopFlight ? 0.13 : 0.12;   // 0.12 lifts Viking off the bottom edge
    g.camDist = g.hopFlight ? 24 : 22;
    window.__base += 33.4; g.frame(window.__base);
    // Once down, the game lerps the camera IN to a walking close-up and
    // disembarks the settler — that buries the money shot in ~0.5 s. Lock
    // the lens to the wide landing framing (fixed pivot = the touchdown
    // spot) and hide the figure, so the Viking reveal HOLDS. Re-render
    // after g.frame() so this, not the game's lerp, is what's captured.
    if (!g.hopFlight) {
      if (!window.__L) window.__L = { x: g.pos.x, y: g.pos.y, z: g.pos.z };
      const L = window.__L, D = 22, P = 0.12, Y = Math.PI, cp = Math.cos(P);
      g.colonist.group.visible = false;
      g.cam.position.set(
        Math.sin(Y) * -D * cp + L.x,
        D * Math.sin(P) + 2.4 + L.y,
        Math.cos(Y) * -D * cp + L.z,
      );
      g.cam.lookAt(L.x, L.y + 1.2, L.z);
      g.renderer.render(g.scene, g.cam);
    }
    // assert the Viking history line AFTER the frame so no live bark or
    // flight prompt overwrites it in the captured screenshot
    if (window.__vLine && g.hud && g.hud.vesperLine) {
      g.hud.vesperLine.textContent = window.__vLine;
      g.hud.vesper.style.opacity = '1';
    }
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
