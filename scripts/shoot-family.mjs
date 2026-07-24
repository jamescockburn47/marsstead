// shoot-family: real screenshots of the three LIVE steads for the
// steadgames.com hub panels. Borrows the shots-mars launcher (channel
// chrome / CHROMIUM_PATH). Each page gets a fetch-guard so the headless
// visit never lands in a ledger or pings Clint. Output:
// ../steadgames/shots/{moorstead,saltstead,marsstead}.jpg (16:10, q80).
// Run on demand: node scripts/shoot-family.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'C:/Users/James/Desktop/steadgames/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : { channel: 'chrome' },
);

async function shoot(name, url, { clicks = [], settleMs = 12000, init, hide = [], hideAllDom = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    // never pollute the muster books from the film unit
    const realFetch = window.fetch.bind(window);
    window.fetch = (u, ...rest) =>
      /\/dash\/(visit|play|ping|insider)/.test(String(u))
        ? Promise.resolve(new Response('{"ok":true}'))
        : realFetch(u, ...rest);
    try { localStorage.clear(); } catch { /* fine */ }
  });
  if (init) await page.addInitScript(init);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    for (const sel of clicks) {
      try { await page.click(sel, { timeout: 4000 }); console.log(`  ${name}: clicked ${sel}`); } catch { /* not there — fine */ }
    }
    await page.waitForTimeout(settleMs);
    // beauty pass: drop overlays so the world itself fills the frame
    if (hide.length) await page.evaluate((sels) => sels.forEach((s) => document.querySelectorAll(s).forEach((el) => { el.style.display = 'none'; })), hide);
    if (hideAllDom) await page.evaluate(() => [...document.body.children].forEach((el) => {
      if (el.tagName !== 'CANVAS' && !el.querySelector('canvas')) el.style.display = 'none';
    }));
    if (hide.length || hideAllDom) await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
    console.log(`${name}: shot saved`);
  } catch (err) {
    console.error(`${name}: FAILED — ${err.message}`);
  } finally {
    await page.close();
  }
}

const only = process.argv.slice(2); // e.g. node shoot-family.mjs saltstead moorstead
const want = (n) => only.length === 0 || only.includes(n);

// Marsstead: straight into a fresh landing, fine tier, orders sheet shut
if (want('marsstead')) {
  await shoot('marsstead', 'https://www.marsstead.app/?play&gfx=fine', {
    settleMs: 16000,
    init: () => { try { localStorage.setItem('marsstead-orders-seen', '1'); } catch { /* fine */ } },
  });
}

// Saltstead: hoist colours, launch, then clear every overlay — pure sea
if (want('saltstead')) {
  await shoot('saltstead', 'https://www.saltstead.app/', {
    clicks: ['text=/board as a guest/i', 'text=/THE BLACK FLAG/i', 'text=/new voyage/i'],
    settleMs: 18000,
    hideAllDom: true,
  });
}

// Moorstead: the title overlays a live snowbound parish — lift the curtain
if (want('moorstead')) {
  await shoot('moorstead', 'https://www.moorstead.app/', {
    settleMs: 16000,
    hide: ['#title-screen', '.overlay'],
  });
}

await browser.close();
console.log('done');
