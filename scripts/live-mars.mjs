// live-mars: the Phase 0 smoke test in a real browser. Boots the dev
// server, loads the game, asserts the handle comes up with no console
// errors, walks the colonist, jumps under 0.38 g, scrubs the clock to the
// blue hour and to night, and screenshots each state into media/.
// Not part of `npm run verify` (needs a browser); run on demand.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 5199;
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

mkdirSync('media', { recursive: true });

// detached => own process group, so we can kill vite AND its children
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'pipe', detached: true,
});
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite timeout')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('Local:')) { clearTimeout(t); res(); } });
  server.stderr.on('data', (d) => process.stderr.write(d));
});

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok  ${name}`);
  else { failed++; console.error(`FAIL  ${name} ${detail}`); }
};

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marsstead && window.marsstead.ready, null, { timeout: 20000 });
check('game boots to ready', true);

// let terrain stream in
await page.waitForTimeout(4000);
const chunkCount = await page.evaluate(() => window.marsstead.terrain.chunks.size);
check('terrain streams (no cheap tiles)', chunkCount >= 100, `chunks=${chunkCount}`);

// afternoon establishing shot
await page.screenshot({ path: 'media/phase0-afternoon.png' });

// walk + lope: hold W and Shift, confirm the colonist covers ground
// measure against SIM time, not wall time — software GL renders slowly,
// so the sim covers less time than the wall clock; speed is what matters
const before = await page.evaluate(() => ({ x: window.marsstead.pos.x, z: window.marsstead.pos.z, t: window.marsstead.t }));
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(2500);
const after = await page.evaluate(() => ({ x: window.marsstead.pos.x, z: window.marsstead.pos.z, t: window.marsstead.t }));
const dist = Math.hypot(after.x - before.x, after.z - before.z);
const simDt = after.t - before.t;
const speed = dist / Math.max(0.01, simDt);
check('the colonist lopes', speed > 4, `${speed.toFixed(1)} m/s over ${simDt.toFixed(1)} sim-s`);

// jump: airborne under 0.38 g has real hang time — poll until a frame
// registers the press (software GL frames arrive slowly)
await page.keyboard.down('Space');
let sawAir = false;
for (let i = 0; i < 20 && !sawAir; i++) {
  await page.waitForTimeout(120);
  sawAir = await page.evaluate(() => window.marsstead.airborne);
}
await page.keyboard.up('Space');
check('jump leaves the ground', sawAir === true);
await page.waitForTimeout(1200);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');

// scrub to the blue hour: small steps, wait a real frame each time so the
// read isn't stale, stop with the sun ON the horizon — then turn the lens
// INTO the sunset (camYaw = pi - azimuth aims the camera down-sun)
for (let i = 0; i < 160; i++) {
  const el = await page.evaluate(() => {
    window.marsstead.simMillis += 3698968.5 / 15; // +4 Mars minutes
    return window.marsstead.sunEl;
  });
  await page.waitForTimeout(150);
  if (el !== undefined && el < 1.5) break;
}
await page.evaluate(() => {
  const g = window.marsstead;
  g.camYaw = Math.PI - (g.sunAz * Math.PI / 180);
  g.camPitch = 0.12;
});
await page.waitForTimeout(1200);
await page.screenshot({ path: 'media/phase0-bluehour.png' });
check('blue hour captured', true);

// on to night: stars + Phobos
await page.evaluate(() => { window.marsstead.simMillis += 3698968.5 * 2.5; });
await page.waitForTimeout(1500);
await page.keyboard.press('KeyL'); // headlamp on for the night shot
await page.waitForTimeout(400);
await page.screenshot({ path: 'media/phase0-night.png' });
check('night captured', true);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
try { process.kill(-server.pid); } catch { server.kill(); }
if (failed) { console.error(`live-mars: ${failed} FAILED`); process.exit(1); }
console.log('live-mars: all green — screenshots in media/');
process.exit(0);
