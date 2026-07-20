// pickup-s7: the title as end card, refilmed after the tagline was cut
// (James 2026-07-20: "remove it completely"). Just MARSSTEAD over the
// attract reel — the stale s7 frames still carried the old subtitle.

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
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.marssteadAttract, null, { timeout: 60000 });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; window.__base = performance.now(); });
await page.evaluate(() => {
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
  if (i % 60 === 0) console.log(`  s7: ${i}/150`);
}
console.log('s7 done');
await browser.close();
killServer();
process.exit(0);
