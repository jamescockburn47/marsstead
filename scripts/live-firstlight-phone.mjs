// Focused actual touch-context layout/input check. Uses the same local server as live-firstlight.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const executablePath = process.env.CHROMIUM_PATH
  || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.routeWebSocket('**', socket => socket.close());
await context.route('**/brain/**', r => r.fulfill({ status: 503, body: 'Offline test' }));
await context.route('**/dash/**', r => r.fulfill({ status: 200, body: '{}' }));
const page = await context.newPage();
mkdirSync('media/firstlight', { recursive: true });
try {
  await page.goto(`${process.env.FIRSTLIGHT_URL || 'http://127.0.0.1:5207'}/?play&touch`);
  await page.waitForFunction(() => window.marsstead?.ready, null, { timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'media/firstlight/12-phone-touch.png' });
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('touch')));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const rects = await page.evaluate(() => {
    const goal = document.querySelector('#first-light').getBoundingClientRect();
    const tools = document.querySelector('#session-tools').getBoundingClientRect();
    return { goalTop: goal.top, goalBottom: goal.bottom, toolsBottom: tools.bottom, height: innerHeight };
  });
  assert.ok(rects.goalTop >= rects.toolsBottom, 'goal clears session controls');
  assert.ok(rects.goalBottom < rects.height * 0.45, 'guidance leaves centre playfield visible');
  await page.locator('#session-tools [data-action=pause]').tap();
  assert.equal(await page.evaluate(() => window.marsstead.paused), true);
  await page.locator('#session-card [data-action=resume]').tap();
  assert.equal(await page.evaluate(() => window.marsstead.paused), false);
  await page.screenshot({ path: 'media/firstlight/13-phone-resumed.png' });
  // Placement-only fixture: preserve fresh opening flags, resources and the actual visible fleet.
  const beforeCrew = await page.evaluate(() => {
    const g = window.marsstead, bot = g.crownLayer.drones.find(d => d.visible);
    if (!bot || g.inLander || g.driving || g.habitat.active || g.under.active) throw Error('Expected fresh on-foot crew fixture');
    const opening = { ...g.opening }, radius = Math.hypot(bot.position.x, bot.position.z);
    g.pos.x = g.crownPos.x + bot.position.x + bot.position.x / radius;
    g.pos.z = g.crownPos.z + bot.position.z + bot.position.z / radius;
    g.pos.y = g.groundAt(g.pos.x, g.pos.z); g.vel.set(0, 0, 0); g.vy = 0; g.airborne = false;
    g.clearInput();
    return opening;
  });
  assert.equal(beforeCrew.followed, false, 'placement has not earned a crew command');
  await page.locator('#crew-prompt').waitFor({ state: 'visible' });
  assert.deepEqual(await page.evaluate(() => window.marsstead.opening), beforeCrew, 'placement grants no opening progress');
  await page.locator('#crew-prompt').tap();
  await page.waitForFunction(() => window.marsstead.crew.visible);
  await page.locator('#touchHud').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#touchHud').isVisible(), false, 'crew panel hides movement controls');
  for (const label of ['Call over', 'Hold position', 'Resume excavation']) {
    const button = page.getByRole('button', { name: label, exact: true });
    assert.ok(await button.isVisible(), `${label} visible on phone`);
    assert.ok(await button.isEnabled(), `${label} enabled near the worker`);
    const bounds = await button.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390
      && bounds.y + bounds.height <= 844, `${label} fits the phone viewport`);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth
    && document.querySelector('.crew-card').scrollWidth <= document.querySelector('.crew-card').clientWidth),
  'crew panel has no horizontal overflow');
  await page.screenshot({ path: 'media/firstlight/14-phone-crew.png' });
  await page.getByRole('button', { name: 'Call over', exact: true }).tap();
  await page.waitForFunction(() => !window.marsstead.crew.visible && window.marsstead.opening.followed);
  assert.deepEqual(await page.evaluate(() => window.marsstead.opening),
    { ...beforeCrew, fleetMode: 'follow', followed: true }, 'only the actual Call over command earns followed');
  await page.locator('.touch-move').waitFor({ state: 'visible' });
  // Real browser touch drag through the game's joystick, not direct key/state injection.
  const move = await page.locator('.touch-move').boundingBox();
  const origin = { x: Math.round(move.x + move.width * .5), y: Math.round(move.y + move.height * .75) };
  const start = await page.evaluate(() => ({ x: window.marsstead.pos.x, z: window.marsstead.pos.z }));
  const touch = await context.newCDPSession(page);
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...origin, id: 1 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x, y: origin.y - 36, id: 1 }] });
    await page.waitForFunction(() => window.marsstead.keys.KeyW && window.marsstead.touchStick?.y > 0);
    await page.waitForFunction(p => Math.hypot(window.marsstead.pos.x - p.x, window.marsstead.pos.z - p.z) > .1,
      start, { timeout: 5000 });
  } finally {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  }
  await page.waitForFunction(() => !window.marsstead.keys.KeyW && !window.marsstead.touchStick);
  console.log('ok actual touch context: readable goal, pause/resume, viewport-safe crew commands, earned follow and restored joystick movement');
} finally { await browser.close(); }
