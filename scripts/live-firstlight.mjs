// Browser integration regression. Start npm run dev separately; never touches live saves.
// FIRSTLIGHT_URL=http://127.0.0.1:5207 CHROMIUM_PATH=<browser> node scripts/live-firstlight.mjs
import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const url = process.env.FIRSTLIGHT_URL || 'http://127.0.0.1:5207';
const executablePath = process.env.CHROMIUM_PATH
  || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium'].find(existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser');
mkdirSync('media/firstlight', { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Test one loaded build; an editor save must not hot-reload the fixture midway.
await context.routeWebSocket('**', socket => socket.close());
// Local integration proof does not call the real AI or count as a player visit.
await context.route('**/brain/**', route => route.fulfill({ status: 503, body: 'Offline test' }));
await context.route('**/dash/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const shot = name => page.screenshot({ path: `media/firstlight/${name}.png` });
const ready = () => page.waitForFunction(() => window.marsstead?.ready, null, { timeout: 45000 });
const status = label => console.log(`ok ${label}`);
// Test placement only moves the actor to a checkpoint: it never awards materials or advances time.
const position = (x, z) => page.evaluate(async ({ x, z }) => {
  const { meshGroundHeight } = await import('/src/marschunk.js');
  const g = window.marsstead; g.pos.set(x, meshGroundHeight(x, z), z);
  g.vel.set(0, 0, 0); g.vy = 0; g.airborne = false; g.focusWorld();
}, { x, z });
try {
  await page.goto(url, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'LAND', exact: true }).click();
  await ready();
  // This regression owns the pre-starter construction journey. New first use is
  // exercised by live-opening.mjs; do not let its gifted home/bank fund this path.
  await page.evaluate(async () => {
    const g = window.marsstead;
    const { createBurrow } = await import('/src/burrow.js');
    const { createPower } = await import('/src/power.js');
    const { createLander } = await import('/src/salvage.js');
    const { createStore, SUIT_CAPACITY, ROVER_CAPACITY } = await import('/src/inventory.js');
    const { acceptFieldwork } = await import('/src/fieldwork.js');
    const { acceptHabitatActivities } = await import('/src/habitat-activities.js');
    const { meshGroundHeight } = await import('/src/marschunk.js');
    g.opening = null; g.burrow = createBurrow(); g.power = createPower(); g.grid = null;
    g.lander = createLander(); g.suit = createStore(SUIT_CAPACITY); g.roverStore = createStore(ROVER_CAPACITY);
    g.machines = []; g.machineLayer.sync(g.machines, meshGroundHeight); g.droneCount = 3;
    g.expedition = acceptFieldwork(null); g.activities = acceptHabitatActivities(null);
    g.everPressurised = false; g.camYaw = .6; g.camPitch = .32; g.camDist = 7;
    g.clearInput(); g.experience.update(0);
  });
  assert.deepEqual(await page.evaluate(() => ({ opening: window.marsstead.opening,
    cells: window.marsstead.burrow.cells.size, sealed: window.marsstead.burrow.ringInstalled,
    machines: window.marsstead.machines.length, ring: window.marsstead.lander.stock['airlock-ring'] })),
  { opening: null, cells: 0, sealed: false, machines: 0, ring: 1 }, 'explicit legacy start has no starter grant');
  await page.waitForTimeout(2000);
  assert.equal(await page.evaluate(() => window.marsstead.orders.visible), false);
  await shot('01-landfall'); status('title → land → explicit legacy construction fixture');

  await page.locator('#session-tools [data-action=pause]').click();
  const frozen = await page.evaluate(() => [window.marsstead.t, window.marsstead.air]);
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(() => [window.marsstead.t, window.marsstead.air]), frozen);
  await page.locator('[data-setting=textScale]').fill('1.2');
  await page.locator('[data-setting=reducedMotion]').check();
  await shot('02-settings');
  await page.locator('#session-card [data-action=resume]').click();
  assert.equal(await page.evaluate(() => document.activeElement === window.marsstead.renderer.domElement), true);
  const before = await page.evaluate(() => ({ x: window.marsstead.pos.x, z: window.marsstead.pos.z }));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
  const distance = await page.evaluate(p => Math.hypot(window.marsstead.pos.x - p.x, window.marsstead.pos.z - p.z), before);
  assert.ok(distance > 1, `walking after resume: ${distance}m`);
  await page.evaluate(() => { window.marsstead.camDist = 6; });
  await page.keyboard.down('KeyA');
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(160); await shot(`walk-side-${i}`); }
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(350); await shot('walk-stopped');
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  await page.waitForTimeout(500); await shot('03-lope');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.marsstead.airborne);
  await shot('04-jump');
  await page.keyboard.up('Space'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  status('pause freezes time/vitals; resume accepts movement; lope and manual jump');

  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => window.marsstead.map.visible);
  await page.waitForTimeout(500); await shot('05-map');
  assert.ok(await page.evaluate(() => {
    const c = window.marsstead.map.canvas;
    if (!c) return false;
    return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(v => v !== 0);
  }), 'map paints while simulation is paused');
  await page.keyboard.press('Escape'); status('map renders and closes');

  const home = await page.evaluate(() => window.marsstead.crownPos);
  await position(home.x, home.z + 3);
  await page.locator('#first-light button').click();
  await page.locator('#bsvg [data-key="0,1"]').click();
  await page.getByRole('button', { name: 'Close the Burrow' }).click();
  assert.equal(await page.evaluate(() => document.activeElement === window.marsstead.renderer.domElement), true);
  await page.waitForFunction(() => window.marsstead.burrow.cells.get('0,1')?.dug >= 1, null, { timeout: 90000 });
  status('first shaft is planned through UI and dug using the real power simulation');

  await position(108, -91);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Horizon: turn right', exact: true }).click({ clickCount: 2 });
  await page.getByRole('button', { name: 'Sky: turn left', exact: true }).click({ clickCount: 3 });
  await page.getByRole('button', { name: 'Reflected light: turn left', exact: true }).click();
  await page.getByRole('button', { name: 'Recover solar wing · 18 kg' }).click();
  assert.equal(await page.evaluate(() => window.marsstead.expedition.claimed), false,
    'shaft spoil fills suit; station preserves reward until cargo space is available');
  await page.evaluate(() => { window.marsstead.buggy.x = 110; window.marsstead.buggy.z = -91; });
  await page.getByRole('button', { name: 'Recover solar wing · 18 kg' }).click();
  assert.equal(await page.evaluate(() => window.marsstead.expedition.claimed), true);
  await shot('06-survey');
  await page.getByRole('button', { name: 'Close · Esc', exact: true }).click();
  assert.equal(await page.evaluate(() => document.activeElement === window.marsstead.renderer.domElement), true);
  await position(home.x + 5, home.z + 4);
  await page.evaluate(home => { window.marsstead.buggy.x = home.x + 6; window.marsstead.buggy.z = home.z + 4; }, home);
  await page.waitForFunction(() => window.marsstead.power.charge >= 0.5, null, { timeout: 90000 });
  await page.locator('#first-light button').click();
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => window.marsstead.expedition.complete), true);
  await page.keyboard.press('KeyB');
  await position(home.x, home.z + 3);
  await page.locator('#first-light button').click();
  await page.locator('#bring').click();
  assert.equal(await page.evaluate(() => window.marsstead.burrow.ringInstalled), true);
  await shot('07-first-home');
  await page.getByRole('button', { name: 'Close the Burrow' }).click();
  await page.keyboard.press('KeyJ');
  assert.ok(await page.locator('#rmain').innerText().then(s => s.includes('FIRST LIGHT')));
  await page.keyboard.press('Escape');
  status('survey puzzle → single wing reward → powered home → ring → discovery record');

  const rover = await page.evaluate(() => ({ x: window.marsstead.buggy.x, z: window.marsstead.buggy.z }));
  await position(rover.x + 1, rover.z);
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => window.marsstead.driving), true);
  await page.locator('#session-tools [data-action=home]').click();
  assert.equal(await page.evaluate(() => window.marsstead.inLander && window.marsstead.colonist.group.parent === window.marsstead.scene), true);
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => window.marsstead.inLander), false);
  status('rover → return home → disembark restores world coordinates');
  assert.notEqual(await page.evaluate(() => window.marsstead.persist()), false);
  await page.goto(`${url}/?play`); await ready();
  assert.deepEqual(await page.evaluate(() => ({ complete: window.marsstead.expedition.complete,
    sealed: window.marsstead.burrow.ringInstalled, scale: window.marsstead.settings.textScale,
    paid: window.marsstead.machines.find(m => m.type === 'solar-array')?.paidCosts })),
  { complete: true, sealed: true, scale: 1.2, paid: [['solar-wing', 1]] });
  status('actual IndexedDB save/reload retains rewards, exact paid recipe, home and settings');

  // Clearly separate the advanced-home art fixture from the earned first-session journey.
  await page.evaluate(() => {
    const g = window.marsstead;
    for (const [key, piece] of [['1,1', 'corridor'], ['2,1', 'bunk'], ['-1,1', 'corridor'], ['-2,1', 'garden'],
      ['0,2', 'shaft'], ['1,2', 'corridor'], ['2,2', 'store'], ['-1,2', 'corridor'], ['-2,2', 'bay']]) {
      g.burrow.cells.set(key, { piece, dug: 1, funded: true });
    }
    g.burrowUI.open();
  });
  await page.waitForTimeout(700); await shot('08-home-art-fixture');
  await page.getByRole('button', { name: 'Close the Burrow' }).click();
  await position(home.x, home.z + 9);
  await page.evaluate(() => { const g = window.marsstead; g.camYaw = Math.PI; g.camDist = 12; });
  await page.waitForTimeout(700); await shot('10-home-surface');
  await page.evaluate(() => window.marsstead.burrowUI.open());
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('09-home-phone');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Close the Burrow' }).click();
  await page.waitForTimeout(250); await shot('11-phone-world');
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('#session-tools').getBoundingClientRect();
    const b = document.querySelector('#first-light').getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  assert.equal(overlap, false, 'phone session buttons do not overlap the current goal');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  status('home desktop/phone visual fixtures; no document overflow or uncaught errors');
} finally { await browser.close(); }
