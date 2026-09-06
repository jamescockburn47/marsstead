// Disposable browser run: every ledger request is mocked; no real feedback is sent.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const url = process.env.FIRSTLIGHT_URL || 'http://127.0.0.1:5207';
const executablePath = process.env.CHROMIUM_PATH
  || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: mobile, hasTouch: mobile });
    const reports = [];
    let responseMode = 'failure', release;
    await context.routeWebSocket('**', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request(), target = new URL(request.url());
      if (target.origin !== new URL(url).origin) return route.abort();
      if (target.pathname === '/dash/feedback') {
        assert.equal(request.method(), 'POST');
        reports.push(request.postDataJSON());
        if (responseMode === 'pending') await new Promise(resolve => { release = resolve; });
        return route.fulfill({ status: responseMode === 'failure' ? 503 : 200,
          contentType: 'application/json', body: JSON.stringify({ ok: responseMode !== 'rejected', err: 'Fixture rejection' }) });
      }
      if (target.pathname.startsWith('/dash/')) return route.fulfill({ status: 200, body: '{}' });
      if (target.pathname.startsWith('/brain/')) return route.fulfill({ status: 503, body: 'Offline test' });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${url}/?play${mobile ? '&touch' : ''}`);
    await page.waitForFunction(() => window.marsstead?.ready && window.marsstead.feedback, null, { timeout: 60000 });
    await page.locator('#session-tools [data-action=pause]').click();
    await page.locator('#session-card [data-action=feedback]').click();
    const panel = page.locator('#playtest-feedback'), input = panel.locator('textarea'), send = panel.locator('[type=submit]');
    assert.equal(await panel.isVisible(), true);
    assert.equal(await page.evaluate(() => window.marsstead.paused), true);
    assert.equal(reports.length, 0, 'opening never sends');
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await panel.locator('[data-prompt="2"]').evaluate(el => el === document.activeElement), true);
    await panel.locator('[data-prompt="0"]').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await panel.locator('[data-feedback-close]').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await panel.locator('[data-prompt="0"]').evaluate(el => el === document.activeElement), true);
    const bounds = await panel.locator('section').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= (mobile ? 390 : 1280), 'dialog fits viewport');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    await input.fill('short');
    await page.evaluate(() => window.marsstead.feedback.send());
    assert.equal(reports.length, 0, 'short drafts cannot send');
    const draft = 'I could not find the next room after leaving the rover.';
    await panel.locator('[data-prompt="1"]').click();
    await input.fill(draft);
    await send.click();
    await page.waitForFunction(() => !window.marsstead.feedback.pending);
    assert.equal(await input.inputValue(), draft, 'HTTP failure preserves draft');
    assert.match(await panel.locator('[role=status]').textContent(), /Could not confirm/);
    responseMode = 'rejected';
    await send.click();
    await page.waitForFunction(() => !window.marsstead.feedback.pending);
    assert.equal(await input.inputValue(), draft, 'HTTP 200 rejection preserves draft');
    assert.match(await panel.locator('[role=status]').textContent(), /Could not confirm/);

    const expected = await page.evaluate(() => {
      const g = window.marsstead;
      return { loc: g.inLander ? 'lander' : 'surface', sol: Math.max(1, Math.floor((g.simMillis - g.missionStart) / 88775244) + 1),
        depth: 0, o2: Math.round(g.air * 100) };
    });
    for (const report of reports) {
      assert.deepEqual(Object.keys(report).sort(), ['context', 'kind', 'message']);
      assert.deepEqual(Object.keys(report.context).sort(), ['depth', 'loc', 'o2', 'page', 'sol']);
      assert.equal(report.kind, 'bug');
      assert.equal(report.message, `I got stuck: ${draft}`);
      assert.ok(report.message.length <= 2000);
      assert.match(report.context.page, /^playtest /); assert.ok(report.context.page.length <= 24);
      const { page: version, ...actual } = report.context;
      assert.deepEqual(actual, expected, 'only current coarse game context accompanies note');
    }
    responseMode = 'pending';
    await send.click();
    await page.waitForFunction(() => window.marsstead.feedback.pending);
    assert.equal(await send.isDisabled(), true);
    await page.evaluate(() => { window.marsstead.feedback.send(); window.marsstead.feedback.send(); });
    await page.waitForTimeout(100);
    assert.equal(reports.length, 3, 'pending state excludes duplicate sends');
    await panel.locator('[data-feedback-close]').click();
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.evaluate(() => window.marsstead.paused), true);
    await page.locator('#session-card [data-action=feedback]').click();
    assert.equal(await send.isDisabled(), true, 'reopening does not reset pending request');
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.evaluate(() => window.marsstead.paused), true, 'Escape returns to paused game');
    assert.equal(await page.locator('#session-card [data-action=feedback]').evaluate(el => el === document.activeElement), true);
    release();
    await page.waitForFunction(() => !window.marsstead.feedback.pending);
    assert.equal(await panel.isVisible(), false, 'delivery cannot reopen a closed panel');
    await page.locator('#session-card [data-action=feedback]').click();
    assert.equal(await input.inputValue(), '', 'confirmed delivery clears draft');
    assert.match(await panel.locator('[role=status]').textContent(), /Sent to James/);
    responseMode = 'success';
    await panel.locator('[data-prompt="2"]').click();
    await input.fill('An extra light near the workshop would help.');
    await send.click();
    await page.waitForFunction(() => !window.marsstead.feedback.pending);
    assert.equal(reports.at(-1).kind, 'feedback');
    assert.match(reports.at(-1).message, /^An idea: /);
    await input.fill('The first rover trip was fun.');
    await panel.locator('[data-prompt="0"]').click();
    await panel.locator('[data-feedback-close]').click();
    await page.locator('#session-card [data-action=feedback]').click();
    assert.equal(await input.inputValue(), 'The first rover trip was fun.', 'closing retains unsent draft');
    assert.equal(reports.length, 4, 'closing and reopening never submits');
    await page.keyboard.press('Escape');
    await page.locator('#session-card [data-action=resume]').click();
    assert.equal(await page.evaluate(() => window.marsstead.paused), false, 'ordinary resume still works');
    await context.close();
    console.log(`Feedback ${mobile ? 'phone' : 'desktop'}: explicit send, restricted payload, failure recovery, pending lock and pause passed.`);
  }
} finally { await browser.close(); }
