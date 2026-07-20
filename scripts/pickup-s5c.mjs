// pickup-s5c: the mystery tease — THE RECORD open on THE OLD LOGS,
// slow-scrolling to Viking 2's page: "Drift does not keep a beat."

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
  const L = await import('/src/marslegends.js');
  const H = await import('/src/heritage.js');
  // the chain has begun: the delta read; and TWO old machines salvaged —
  // their logs waiting in the book
  g.mystery.found = [L.SITES[0].id];
  g.mystery.read = [];
  for (const id of ['viking2', 'mars3']) {
    const site = H.HERITAGE.find((s) => s.id === id);
    g.heritage = H.recordTake(site, g.heritage, site.salvage[0][0], 1);
  }
  for (let i = 0; i < 10; i++) { window.__base += 60; g.frame(window.__base); }
  g.journalUI.open(g.mystery, g.heritage);
});
for (let i = 0; i < 170; i++) {
  await page.evaluate((i2) => {
    const g = window.marsstead;
    window.__base += 33.4; g.frame(window.__base);
    // a reader's slow descent to the listening pages
    const main = document.querySelector('#rmain');
    if (main) {
      const t = Math.min(1, Math.max(0, (i2 - 40) / 100));
      const e = t * t * (3 - 2 * t);
      main.scrollTop = e * (main.scrollHeight - main.clientHeight);
    }
  }, i);
  writeFileSync(`${OUT}/s5c_${String(i).padStart(4, '0')}.jpg`,
    await page.screenshot({ type: 'jpeg', quality: 85 }));
  if (i % 60 === 0) console.log(`  s5c: ${i}/170`);
}
console.log('s5c done');
await browser.close();
killServer();
process.exit(0);
