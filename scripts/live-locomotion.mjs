// Disposable actual-game capture: simulation 60 Hz, images/video 30 fps.
// No copied controller or player storage. Camera and daylight are review fixtures.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const origin = process.env.LOCOMOTION_URL || 'http://127.0.0.1:5207';
const out = 'media/mars-gait', fps = 30, hz = 60;
const executablePath = process.env.CHROMIUM_PATH ||
  ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium'].find(existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser');
const selected = process.env.LOCOMOTION_CLIPS?.split(',');
const clips = [
  { id: 'lope', title: 'Easy outdoor lope · side', side: true, fast: false, seconds: 8 },
  { id: 'bound', title: 'Fast surface bounds · side', side: true, fast: true, seconds: 8 },
  { id: 'turn-jump', title: 'Turn, manual jump and release', side: true, fast: false, seconds: 10 },
  { id: 'cave', title: 'Actual workings traversal', cave: true, fast: true, seconds: 8 },
  { id: 'gameplay', title: 'Actual surface camera', fast: false, seconds: 8 },
].filter(clip => !selected || selected.includes(clip.id));
assert.ok(clips.length, 'LOCOMOTION_CLIPS must name an existing clip');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [], evidence = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await context.routeWebSocket('**', socket => socket.close());
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/brain/') || url.pathname.startsWith('/dash/'))
      return route.fulfill({ status: 503, body: 'Disposable offline capture' });
    if (url.origin !== new URL(origin).origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGL|THREE/i.test(message.text())) errors.push(message.text());
  });
  await page.goto(`${origin}/?play&gfx=fine`);
  await page.waitForFunction(() => window.marsstead?.ready, null, { timeout: 60000 });
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(100); // let the already queued RAF finish before fixed stepping
  await page.evaluate(async () => {
    const g = window.marsstead;
    window.captureThree = await import('/node_modules/three/build/three.module.js');
    g._captureFloor = (await import('/src/underworld.js')).floorAt;
    g.persist = () => {}; g.maybePing = () => {}; g.say = () => {};
    g.enterAttract(); g.attract = true; g.attractT = 41; g.frame(g.last + 1); g.attract = false;
    g.driving = false; g.inLander = false; g.hopFlight = false; g.paused = false; g.clearInput();
    g._captureRender = g.renderFrame.bind(g); g.renderFrame = () => {};
    const pose = g.colonist.pose.bind(g.colonist);
    g.colonist.pose = (...args) => {
      const result = pose(...args); g._capturePose = result; g._captureGait = args[1].gait; return result;
    };
    document.querySelectorAll('body > :not(canvas):not(script):not(style)').forEach(e => e.style.visibility = 'hidden');
    const caption = document.createElement('div'); caption.id = 'capture-caption';
    caption.style.cssText = 'position:fixed;left:22px;top:18px;padding:9px 13px;background:#111a20dd;color:#f6eee0;font:15px system-ui;z-index:99999;pointer-events:none';
    document.body.append(caption);
  });
  for (const clip of clips) {
    const dir = `${out}/${clip.id}`; mkdirSync(dir, { recursive: true });
    for (const key of ['KeyW', 'KeyD', 'ShiftRight']) await page.keyboard.up(key);
    await page.evaluate(clip => {
      const g = window.marsstead;
      if (g.under.active) g.under.exit();
      if (clip.cave) { g.under.enter('gentle'); g.under.setMode(1); }
      else {
        g.pos.set(g.crownPos.x + 26, 0, g.crownPos.z + 5); g.pos.y = g.groundAt(g.pos.x, g.pos.z);
        g.vel.set(0, 0, 0); g.airborne = false; g.vy = 0; g.boundStride = undefined;
        for (let i = 0; i < 120; i++) { g.terrain.update(g.pos.x, g.pos.z); g.rocks.update(g.pos.x, g.pos.z); }
      }
      g._captureGround = clip.cave ? g.under.pos.y : g.pos.y;
      g.camYaw = 0; g.camPitch = .05; g.cam.fov = clip.id === 'turn-jump' ? 52 : clip.side ? 46 : 60; g.cam.updateProjectionMatrix();
      g.colonist.rig.first = true; g.colonist.group.visible = true; g.clearInput(); g.focusWorld();
      g._captureClip = clip;
    }, clip);
    const rows = [], releaseAt = clip.seconds - 2;
    for (let frame = 0; frame < clip.seconds * fps; frame++) {
      if (frame === 15) { await page.keyboard.down('KeyW'); if (clip.fast) await page.keyboard.down('ShiftRight'); }
      if (clip.id === 'turn-jump' && frame === 75) await page.keyboard.down('KeyD');
      if (clip.id === 'turn-jump' && frame === 105) await page.keyboard.up('KeyD');
      if (clip.id === 'turn-jump' && frame === 150) await page.keyboard.down('Space');
      if (clip.id === 'turn-jump' && frame === 180) await page.keyboard.up('Space');
      if (frame === releaseAt * fps) { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftRight'); }
      rows.push(...await page.evaluate(({ frame, fps, hz, releaseAt }) => {
        const g = window.marsstead, clip = g._captureClip, actor = clip.cave ? g.under : g;
        const rows = [];
        for (let sub = 0; sub < hz / fps; sub++) {
          g.frame(g.last + 1000 / hz);
          const pose = g._capturePose, stride = actor.boundStride;
          const ground = clip.cave ? g._captureFloor(actor.pos.x, actor.pos.z) : g.groundAt(actor.pos.x, actor.pos.z);
          rows.push({ t: frame / fps + (sub + 1) / hz, pos: actor.pos.toArray(), speed: actor.vel.length(), ground,
            airborne: actor.airborne, vy: actor.vy, side: stride?.side, cycle: stride?.cycle,
            phase: stride?.phase, age: stride?.age, u: g._captureGait?.u, hipY: pose?.hipY,
            left: pose?.footL, right: pose?.footR, legL: pose?.legL, legR: pose?.legR });
        }
        if (clip.side) {
          const jump = clip.id === 'turn-jump', distance = jump ? 4.4 : 3.55;
          const ground = g.groundAt(actor.pos.x, actor.pos.z);
          const cameraGround = g.groundAt(actor.pos.x + distance, actor.pos.z);
          g.cam.position.set(actor.pos.x + distance, Math.max(ground + (jump ? 1.45 : 1.35), cameraGround + .5), actor.pos.z);
          g.cam.lookAt(actor.pos.x, ground + (jump ? 1.3 : 1.15), actor.pos.z);
          g.fill.intensity = Math.max(g.fill.intensity, 1.1); // review fill, no physics change
        }
        const stage = frame / fps < .5 ? 'REST' : frame / fps >= releaseAt ? 'RELEASE / SETTLE' : 'REAL MOVEMENT INPUT';
        document.querySelector('#capture-caption').textContent = `${clip.title}  |  ${stage}  |  ${(frame / fps).toFixed(2)} s`;
        g._captureRender(0);
        if (clip.side) {
          const THREE = window.captureThree, box = new THREE.Box3().setFromObject(g.colonist.group), points = [];
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z).project(g.cam));
          rows.at(-1).pixels = (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) * innerHeight / 2;
          rows.at(-1).insideFrame = points.every(p => Math.abs(p.x) < .98 && Math.abs(p.y) < .98);
        }
        return rows;
      }, { frame, fps, hz, releaseAt }));
      await page.screenshot({ path: `${dir}/${String(frame).padStart(4, '0')}.png` });
      if (clip.side) assert.equal(rows.at(-1).insideFrame, true, `${clip.id} frame ${frame}: full astronaut framing`);
      if (frame % 60 === 0) console.log(`${clip.id}: ${frame}/${clip.seconds * fps} frames`);
    }
    const launches = rows.filter((row, index) => row.airborne && index > 0 && !rows[index - 1].airborne);
    const maxSpeed = Math.max(...rows.map(row => row.speed));
    const manualRows = rows.filter(row => row.phase === 'manual');
    const manualHeight = manualRows.length ? Math.max(...manualRows.map(row => row.pos[1] - row.ground)) : null;
    writeFileSync(`${dir}/telemetry.json`, JSON.stringify(rows, null, 2));
    assert.ok(rows.every(row => [...row.pos, row.speed, row.vy].every(Number.isFinite)), `${clip.id}: finite controller`);
    assert.ok(launches.length >= 3, `${clip.id}: at least three actual flights`);
    assert.equal(new Set(launches.map(row => row.side)).size, 2, `${clip.id}: alternating sides`);
    assert.ok(rows.at(-1).speed < .12 && !rows.at(-1).airborne, `${clip.id}: input release settles`);
    assert.ok(maxSpeed > (clip.fast ? (clip.cave ? 3.7 : 5.5) : 2.35), `${clip.id}: expected speed ${maxSpeed}`);
    if (clip.id === 'turn-jump') assert.ok(manualRows.length && manualHeight > .5,
      `actual Space jump required: ${manualRows.length} manual frames, ${manualHeight}m clearance`);
    const minimumPixels = clip.side ? Math.min(...rows.filter(row => row.pixels).map(row => row.pixels)) : null;
    if (clip.side) assert.ok(minimumPixels >= 300, `${clip.id}: close astronaut, got ${minimumPixels}px`);
    const item = { ...clip, frames: clip.seconds * fps, simulationHz: hz, videoFps: fps,
      launches: launches.length, maxSpeed, minimumPixels, manualHeight, settled: true };
    evidence.push(item);
    execFileSync('ffmpeg', ['-y', '-framerate', String(fps), '-i', `${dir}/%04d.png`,
      '-frames:v', String(clip.seconds * fps), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-an', `${out}/${clip.id}.mp4`], { stdio: 'ignore', timeout: 120000 });
    console.log('Recorded and checked', item);
  }
  assert.deepEqual(errors, [], 'no browser or shader errors');
  if (!selected || selected.includes('gameplay')) {
    await page.goto(`${origin}/media/mars-gait/index.html`);
    await page.waitForFunction(() => document.querySelectorAll('video').length === 5 &&
      [...document.querySelectorAll('video')].every(video => video.readyState >= 1));
    const card = page.locator('.clip').first(), video = card.locator('video');
    for (const speed of ['0.5', '0.25', '1']) {
      await card.locator('select').selectOption(speed);
      assert.equal(await video.evaluate(element => element.playbackRate), Number(speed));
    }
    await card.locator('[data-step="1"]').click();
    assert.ok(Math.abs(await video.evaluate(element => element.currentTime) - 1 / fps) < .005);
    await card.locator('[data-step="-1"]').click();
    assert.equal(await video.evaluate(element => element.currentTime), 0);
    await card.locator('input').evaluate(element => {
      element.value = '45'; element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.ok(Math.abs(await video.evaluate(element => element.currentTime) - 1.5) < .005);
    await card.locator('[data-play]').click();
    assert.equal(await video.evaluate(element => element.paused), false, 'labelled Play starts clip');
    await card.locator('[data-play]').click();
    assert.equal(await video.evaluate(element => element.paused), true, 'labelled Pause stops clip');
    await card.locator('[data-play]').click();
    await page.locator('.clip').nth(1).locator('[data-play]').click();
    assert.equal(await video.evaluate(element => element.paused), true, 'one active review clip');
    await page.locator('video').evaluateAll(elements => elements.forEach(element => element.pause()));
    await page.screenshot({ path: `${out}/gallery.png`, fullPage: true });
    assert.deepEqual(errors, [], 'gallery has no browser errors');
    console.log('Gallery verified: five videos, all speeds, frame stepping, scrubbing and single active playback');
  }
  writeFileSync(`${out}/${selected ? `evidence-${selected.join('-')}` : 'evidence'}.json`,
    JSON.stringify({ origin, disposableContext: true, externalNetworkBlocked: true, evidence, errors }, null, 2));
} finally { await browser.close(); }
