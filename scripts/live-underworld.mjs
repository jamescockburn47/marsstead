// Local-only underground integration. Seed an earned entrance, then use real UI/input.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const executablePath = process.env.CHROMIUM_PATH ||
  ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.routeWebSocket('**', socket => socket.close());
await ctx.route('**/brain/**', r => r.fulfill({ status: 503, body: 'Offline integration' }));
await ctx.route('**/dash/**', r => r.fulfill({ status: 200, body: '{}' }));
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/i.test(m.text())) errors.push(m.text()); });
mkdirSync('media/underworld', { recursive: true });
const shot = name => page.screenshot({ path: `media/underworld/${name}.png` });
const ready = () => page.waitForFunction(() => window.marsstead?.ready, null, { timeout: 45000 });
const checkpoint = z => page.evaluate(async z => {
  const { centreAt, floorAt } = await import('/src/underworld.js');
  const g = window.marsstead, c = centreAt(z);
  g.under.pos.set(c.x, floorAt(c.x, z), z); g.under.vel.set(0, 0, 0); g.under.vy = 0;
  g.camYaw = 0; g.camPitch = .1; g.under.step(0);
}, z);
try {
  await page.goto(`${process.env.FIRSTLIGHT_URL || 'http://127.0.0.1:5207'}/?play&gfx=fine`);
  await ready();
  await page.evaluate(async () => {
    const { meshGroundHeight } = await import('/src/marschunk.js');
    const g = window.marsstead;
    g.burrow.cells.set('0,1', { piece: 'shaft', dug: 1, funded: true });
    g.pos.set(g.crownPos.x, meshGroundHeight(g.crownPos.x, g.crownPos.z + 3), g.crownPos.z + 3);
    g.burrowUI.open();
  });
  await page.locator('#bexplore').click();
  await page.locator('#under-intro select').selectOption('uneasy');
  await shot('00-descent-choice');
  await page.locator('#under-intro [data-action=enter]').click();
  await page.waitForFunction(() => window.marsstead.under.active);
  await page.waitForTimeout(600); await shot('01-entry');
  const surface = await page.evaluate(() => ({ x: window.marsstead.pos.x, z: window.marsstead.pos.z }));
  const before = await page.evaluate(() => window.marsstead.under.pos.z);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1100); await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(z => window.marsstead.under.pos.z > z + .4, before), 'real walking in underground frame');
  assert.deepEqual(await page.evaluate(() => ({ x: window.marsstead.pos.x, z: window.marsstead.pos.z })), surface);
  await page.keyboard.press('Escape');
  const frozen = await page.evaluate(() => [window.marsstead.t, window.marsstead.under.pos.z, window.marsstead.air]);
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => [window.marsstead.t, window.marsstead.under.pos.z, window.marsstead.air]), frozen);
  const baseFont = await page.locator('#under-instruments .under-detail').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  await page.locator('[data-setting=textScale]').fill('1.5');
  await page.locator('#session-card [data-action=resume]').click();
  assert.ok(await page.locator('#under-instruments .under-detail').evaluate((e, base) => parseFloat(getComputedStyle(e).fontSize) >= base * 1.49, baseFont));
  await page.evaluate(() => {
    const g = window.marsstead; g._listenTest = 0; g._originalListen = g.voice.startListening;
    g.voice.startListening = () => { g._listenTest++; return true; };
  });
  await page.keyboard.down('KeyV'); await page.keyboard.up('KeyV');
  assert.equal(await page.evaluate(() => window.marsstead._listenTest), 1);
  await page.evaluate(() => { const g = window.marsstead; g.voice.startListening = g._originalListen; g.settings.textScale = 1; g.experience.applySettings(); });
  console.log('ok optional descent, separate walking frame, pause and resume');
  for (const [index, z, mode, name] of [[0, 29, 1, 'relay'], [1, 77, 2, 'brood'], [2, 127, 0, 'lattice']]) {
    await checkpoint(z);
    if (index === 0) {
      await page.locator('#under-instruments [data-action=interact]').click();
      assert.equal(await page.evaluate(() => window.marsstead.under.scan), 0, 'wrong light mode does not progress');
    }
    await page.locator(`#under-instruments [data-mode="${mode}"]`).click();
    await page.locator('#under-instruments [data-action=interact]').click();
    await page.waitForFunction(i => window.marsstead.underworld.completed.length === i + 1, index, { timeout: 20000 });
    await shot(`02-${name}`);
  }
  assert.equal(await page.evaluate(() => window.marsstead.underworld.returned), false);
  const cargo = await page.evaluate(() => JSON.stringify([window.marsstead.suit.slots, window.marsstead.roverStore.slots]));
  await page.evaluate(() => window.marsstead.persist());
  await page.reload(); await ready();
  assert.equal(await page.evaluate(() => window.marsstead.under.active), false, 'reload returns to safe surface position');
  assert.deepEqual(await page.evaluate(() => ({ x: window.marsstead.pos.x, z: window.marsstead.pos.z })), surface);
  assert.equal(await page.evaluate(() => JSON.stringify([window.marsstead.suit.slots, window.marsstead.roverStore.slots])), cargo);
  assert.equal(await page.evaluate(() => window.marsstead.underworld.completed.length), 3);
  await page.evaluate(() => window.marsstead.burrowUI.open());
  await page.locator('#bexplore').click(); await page.locator('#under-intro [data-action=enter]').click();
  await page.locator('#under-instruments [data-action=exit]').click();
  assert.equal(await page.evaluate(() => window.marsstead.underworld.returned), true);
  assert.equal(await page.evaluate(() => window.marsstead.colonist.group.parent === window.marsstead.scene), true);
  await page.evaluate(() => window.marsstead.persist());
  await page.reload(); await ready();
  assert.equal(await page.evaluate(() => window.marsstead.underworld.returned), true);
  console.log('ok three instrument/light tasks, checkpoint save, safe reload, return upgrade and avatar parent');
  assert.deepEqual(errors, [], 'no shader compilation or browser errors');
  await page.evaluate(() => window.marsstead.burrowUI.open());
  await page.locator('#bexplore').click(); await page.locator('#under-intro [data-action=enter]').click();
  await checkpoint(82);
  await page.evaluate(() => { window.marsstead.settings.fear = 'intense'; window.marsstead.camYaw = -.6; });
  await page.waitForTimeout(500); await shot('03-brood-intense');
  await page.keyboard.press('KeyL'); await shot('04-lamp-off');
  await page.keyboard.press('KeyL');
  await page.setViewportSize({ width: 390, height: 844 }); await shot('05-narrow');
  console.log('ok three chamber visual samples, intense/lamp-off and narrow layout');
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await phoneContext.route('**/brain/**', r => r.fulfill({ status: 503, body: '' }));
  await phoneContext.route('**/dash/**', r => r.fulfill({ status: 200, body: '{}' }));
  const phone = await phoneContext.newPage();
  await phone.goto(`${process.env.FIRSTLIGHT_URL || 'http://127.0.0.1:5207'}/?play&touch`);
  await phone.waitForFunction(() => window.marsstead?.ready);
  await phone.evaluate(async () => {
    const g = window.marsstead, { meshGroundHeight } = await import('/src/marschunk.js');
    g.burrow.cells.set('0,1', { piece: 'shaft', dug: 1, funded: true });
    g.pos.set(g.crownPos.x, meshGroundHeight(g.crownPos.x, g.crownPos.z + 3), g.crownPos.z + 3);
    g.burrowUI.open();
  });
  await phone.locator('#bexplore').tap(); await phone.locator('#under-intro [data-action=enter]').tap();
  const phoneZ = await phone.evaluate(() => window.marsstead.under.pos.z);
  const input = await phoneContext.newCDPSession(phone);
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 92, y: 748 }] });
  await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 92, y: 682 }] });
  await phone.waitForTimeout(800);
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(await phone.evaluate(z => window.marsstead.under.pos.z > z + .2, phoneZ), 'touch forward moves down the tunnel');
  await phone.screenshot({ path: 'media/underworld/06-touch.png' });
  await phone.locator('#under-instruments [data-action=exit]').tap();
  assert.equal(await phone.evaluate(() => window.marsstead.under.active), false);
  console.log('ok actual touch joystick direction and surface return');
  await phoneContext.close();
} finally { await browser.close(); }
