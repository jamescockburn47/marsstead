// Marsstead — Phase 0: the ground. One region of Mars (Jezero), streamed
// with no cheap tiles; a colonist bounding under 0.38 g; the backwards
// light of Mars from noon butterscotch to the blue hour; dust in three
// registers; the sol clock running real Mars time; VESPER's first words.
// The kill/go gate: if this doesn't feel right, the project stops here.
//
// Dev keys: WASD move, SHIFT lope, SPACE jump, mouse-drag orbit,
// L headlamp, [ ] scrub time (the demo's best friend).
// E interact · Q cycle part · F/G load/unload rover · R sleep (sheltered,
// at night) · B build mode (E place, X remove, Q part, V wall/roof) ·
// M the surveyor's map (fog clears where you walk).

import * as THREE from 'three';
import { latLonToWorld, worldToLatLon, HOME, IS_PLACEHOLDER } from './mars.js';
import { meshGroundHeight } from './marschunk.js';
import { sunElevation, sunAzimuth, solClock, solarLongitude, season } from './marstime.js';
import { lightState, surfaceTempC } from './marslight.js';
import { tauAt, windAt } from './dust.js';
import { mtc } from './marstime.js';
import {
  G_MARS, WALK_SPEED, LOPE_SPEED, JUMP_V0, LOPE_HOP_V0,
  STRIDE_HZ_WALK, STRIDE_HZ_LOPE, fallStep, fallSeverity,
} from './physics.js';
import { TerrainLayer } from './terrain.js';
import { SkyDome } from './sky.js';
import { DustLayer, PuffCloud, Footprints } from './dustlayer.js';
import { Colonist } from './colonist.js';
import { createBuggy, stepBuggy } from './buggy.js';
import { BuggyLayer, TRACK, WHEELBASE } from './buggylayer.js';
import { Hud } from './hud.js';
import { createLander, available, unboltSeconds, takeOne, remaining, remainingTotal } from './salvage.js';
import { LanderLayer } from './landerlayer.js';
import {
  ITEMS, SUIT_CAPACITY, ROVER_CAPACITY, createStore, add, canAdd, count,
  remove, transfer, loadLabel, massOf,
} from './inventory.js';
import { vesperSay } from './vesper.js';
import { canSleep, wakeMillis, bedworthy } from './sleep.js';
import {
  CELL, PART_TYPES, faceKey, parseFaceKey, faceCentre, createStead,
  canPlace, place, removePart, cardinal, cursorFace,
} from './build.js';
import { analyse, volumeAtCell, canPressurise, findLeaks } from './pressure.js';
import { SteadLayer, BED_DEPTH } from './steadlayer.js';
import { createExploration, visit } from './explore.js';
import { MarsMap } from './marsmap.js';

const TIME_SCALE = 40;            // one sol ~= 37 real minutes in Phase 0

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd08350, 0.003);
    this.cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 6000);

    // light rig: one sun, one dust-fill hemisphere
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    // a tight box around the colonist: shadows stay crisp AND attached —
    // bias tuned so the shadow roots at the boots instead of drifting
    // downslope (peter-panning) or acne-ing on the flat
    this.sun.shadow.camera.left = -45; this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45; this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 20; this.sun.shadow.camera.far = 300;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.35;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.HemisphereLight(0xcf9a72, 0x4a2a1c, 0.5);
    this.scene.add(this.fill);

    this.terrain = new TerrainLayer(this.scene);
    this.sky = new SkyDome(this.scene);
    this.dust = new DustLayer(this.scene, meshGroundHeight);
    this.puffs = new PuffCloud(this.scene, 2400, 0.05);
    this.footprints = new Footprints(this.scene, 240);
    this.prevStridePhase = 0; this.footSide = 1; this.wasAirborne = false;
    this.colonist = new Colonist(this.scene);
    this.hud = new Hud(IS_PLACEHOLDER);

    // the buggy: parked a short walk east of the drop site
    this.buggy = createBuggy(14, 6, -0.8);
    this.buggy.y = meshGroundHeight(this.buggy.x, this.buggy.z);
    this.buggyLayer = new BuggyLayer(this.scene);
    this.driving = false;
    this.fpv = false;   // C toggles first-person while driving
    this.buggyFlags = { skidF: false, skidR: false, airborne: false, landed: false, impact: 0 };
    this.driftTimer = 0; this.airTimer = 0;

    // the lander: the ship you rode down, west of the drop point — the
    // finite warehouse (and, for now, the free air refill of the gentle
    // start). Salvage state is pure; the layer strips visibly.
    this.lander = createLander();
    this.landerPos = { x: -11, z: -6 };
    this.landerLayer = new LanderLayer(this.scene, this.landerPos.x, this.landerPos.z,
      meshGroundHeight(this.landerPos.x, this.landerPos.z));
    this.suit = createStore(SUIT_CAPACITY);
    this.roverStore = createStore(ROVER_CAPACITY);
    this.salvageSel = 0;      // Q cycles the target type
    this.unbolt = null;       // { id, t, need } while working a bolt

    // the walker's state — spawned at HOME (the Jezero delta)
    this.pos = new THREE.Vector3(0, 0, 0);
    this.pos.y = meshGroundHeight(0, 0);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.airborne = false;
    this.heading = 0;
    this.camYaw = 0.6; this.camPitch = 0.32; this.camDist = 7;

    // the clock: start late afternoon at HOME so the first minutes of play
    // walk into the blue hour (the demo IS the sunset)
    this.simMillis = Date.now();
    this.calibrateToLocalHour(16.4);

    // sleep: null, or { t, wake, jumped } while the night is skipped
    this.sleepAnim = null;

    // the stead: pure data (build.js) + its drawn layer. baseY anchors the
    // grammar's flat y=0 plane to the terrain at the first placement.
    this.stead = createStead();
    this.steadLayer = new SteadLayer(this.scene);
    this.steadBaseY = null;
    this.buildMode = false;
    this.buildSel = 0;         // Q cycles part types while building
    this.buildSlot = 'wall';   // V flips wall/roof
    this.analysis = { volumes: [], outside: new Set() };
    this.insideVolume = null;
    this.insidePressurised = false;
    this.everPressurised = false; // flips once; the gentle start ends with it
    this.cycling = null;       // { t, tx, tz } while an airlock runs its cycle
    this.leakCacheKey = '';
    this.leaks = [];
    this.steadOrigin = null;   // where the first part went down (map POI)

    // the earned map: fog everywhere the settler hasn't walked
    this.exploration = createExploration();
    visit(this.exploration, 0, 0); // the drop site is known ground
    this.lastVisit = { x: 0, z: 0 };
    this.map = new MarsMap(meshGroundHeight);

    // the suit
    this.air = 1; this.warm = 1;
    this.saidCounts = {}; this.lamp = false;
    this.lampMode = 'auto'; this.lampLit = false; // auto: dusk switches them
    this.idleTimer = 0; this.saidFirsts = new Set();

    this.keys = {};
    addEventListener('keydown', (e) => { this.keys[e.code] = true; this.devKeys(e); });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    let dragging = false;
    addEventListener('mousedown', () => { dragging = true; });
    addEventListener('mouseup', () => { dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!dragging) return;
      this.camYaw -= e.movementX * 0.005;
      this.camPitch = Math.max(0.05, Math.min(1.2, this.camPitch + e.movementY * 0.004));
    });
    addEventListener('resize', () => {
      this.cam.aspect = innerWidth / innerHeight;
      this.cam.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    this.say('wake');
    this.t = 0;
    this.last = performance.now();
    this.ready = true;
    requestAnimationFrame((n) => this.frame(n));
  }

  // shift the sim clock so local true solar time at HOME reads `hour`
  calibrateToLocalHour(hour) {
    const current = mtc(this.simMillis) + HOME.lon / 15;
    const deltaHours = ((hour - current) % 24 + 24) % 24;
    this.simMillis += deltaHours * 3698968.5; // Mars hour in real millis
  }

  devKeys(e) {
    if (e.code === 'KeyL') {
      // cycle auto -> on -> off -> auto (auto is the default: dusk decides)
      this.lampMode = this.lampMode === 'auto' ? 'on' : this.lampMode === 'on' ? 'off' : 'auto';
    }
    if (e.code === 'KeyE') this.buildMode ? this.placeCursor() : this.interact();
    if (e.code === 'KeyR') this.trySleep();
    if (e.code === 'KeyQ') this.buildMode ? this.buildSel++ : this.salvageSel++;
    if (e.code === 'KeyF') this.loadRover();
    if (e.code === 'KeyG') this.unloadRover();
    if (e.code === 'KeyC' && this.driving) this.fpv = !this.fpv;
    if (e.code === 'KeyB' && !this.driving && !this.sleepAnim) {
      this.buildMode = !this.buildMode;
      if (!this.buildMode) { this.steadLayer.showGhost(null); this.steadLayer.clearLeaks(); }
    }
    if (e.code === 'KeyX' && this.buildMode) this.removeCursor();
    if (e.code === 'KeyM') this.map.toggle();
    if (e.code === 'KeyV' && this.buildMode) {
      this.buildSlot = this.buildSlot === 'wall' ? 'roof' : 'wall';
    }
    if (e.code === 'BracketLeft') this.simMillis -= 3698968.5 * 0.5;  // -30 Mars min
    if (e.code === 'BracketRight') this.simMillis += 3698968.5 * 0.5; // +30
  }

  distToLander() {
    return Math.hypot(this.pos.x - this.landerPos.x, this.pos.z - this.landerPos.z);
  }
  distToRover() {
    return Math.hypot(this.pos.x - this.buggy.x, this.pos.z - this.buggy.z);
  }
  salvageTarget() {
    const opts = available(this.lander);
    if (!opts.length) return null;
    return opts[((this.salvageSel % opts.length) + opts.length) % opts.length];
  }

  // E is THE doing key: rover first if in reach, else the lander's bolts
  interact() {
    if (this.driving) { this.toggleBuggy(); return; }
    if (this.distToRover() < 3.2) { this.toggleBuggy(); return; }
    if (this.distToLander() < 6 && !this.unbolt) {
      const id = this.salvageTarget();
      if (!id) return;
      // heavy salvage (the ring) goes straight to the rover's deck — park
      // it alongside first; everything else needs suit room
      const roverClose = this.distToRover() < 9;
      const fitsSuit = canAdd(this.suit, id, 1);
      const fitsDeck = roverClose && canAdd(this.roverStore, id, 1);
      if (!fitsSuit && !fitsDeck) { this.say('suit-full'); return; }
      this.unbolt = { id, t: 0, need: unboltSeconds(id) };
    }
  }

  // F: everything the suit holds goes onto the rover's deck
  loadRover() {
    if (this.driving || this.distToRover() > 4) return;
    for (const id of Object.keys(this.suit.slots)) {
      transfer(this.suit, this.roverStore, id, 99);
    }
  }
  // G: take the heaviest thing back off the deck the suit can hold
  unloadRover() {
    if (this.driving || this.distToRover() > 4) return;
    const ids = Object.keys(this.roverStore.slots)
      .sort((a, b) => ITEMS[b].kg - ITEMS[a].kg);
    for (const id of ids) {
      if (transfer(this.roverStore, this.suit, id, 1) > 0) return;
    }
  }

  // E: mount within reach; dismount to the buggy's left
  toggleBuggy() {
    if (this.driving) {
      this.driving = false;
      const sin = Math.sin(this.buggy.heading), cos = Math.cos(this.buggy.heading);
      this.pos.set(this.buggy.x - cos * 1.6, 0, this.buggy.z + sin * 1.6);
      this.pos.y = meshGroundHeight(this.pos.x, this.pos.z);
      this.colonist.group.visible = true;
      this.colonist.setLamp(this.lamp);
      this.buggyLayer.setLamps(false);
    } else {
      const d = Math.hypot(this.pos.x - this.buggy.x, this.pos.z - this.buggy.z);
      if (d < 3.2) {
        this.driving = true;
        this.colonist.group.visible = false;
        this.colonist.setLamp(false);
        this.buggyLayer.setLamps(this.lamp);
        this.sayOnce('buggy-first');
      }
    }
  }

  // a bed for the night: the lander's hull, or a pressurised hab that
  // BEATS the lander (bedworthy — small sealed volumes shelter, not sleep)
  sheltered() {
    return this.distToLander() < 7
      || (this.insidePressurised && bedworthy(this.insideVolume));
  }

  // ---- building --------------------------------------------------------

  buildablePart() {
    const types = Object.keys(PART_TYPES);
    return types[((this.buildSel % types.length) + types.length) % types.length];
  }

  canAfford(type) {
    return PART_TYPES[type].costs.every(([id, n]) => count(this.suit, id) >= n);
  }

  // the grid anchor: fixed at first placement, previewed before it —
  // bedded BED_DEPTH into the dirt so wall feet bite instead of perch
  buildBaseY() {
    return this.steadBaseY
      ?? meshGroundHeight(this.pos.x, this.pos.z) - BED_DEPTH;
  }

  buildCursor(forRemove = false) {
    const { dx, dz } = cardinal(Math.sin(this.camYaw), Math.cos(this.camYaw));
    const cx = Math.floor(this.pos.x / CELL), cz = Math.floor(this.pos.z / CELL);
    return cursorFace(this.stead, this.buildSlot, cx, cz, dx, dz, forRemove);
  }

  // grammar + purse + terrain: ground-level parts must meet ground near
  // the base plane, or walls float over gullies and bury in banks
  placementOk(key, type) {
    if (!canPlace(this.stead, key) || !this.canAfford(type)) return false;
    const f = parseFaceKey(key);
    if (f.y === 0) {
      const c = faceCentre(f.x, f.y, f.z, f.axis);
      if (Math.abs(meshGroundHeight(c[0], c[2]) - this.buildBaseY()) > 0.75) return false;
    }
    return true;
  }

  placeCursor() {
    const type = this.buildablePart();
    const key = this.buildCursor(false);
    if (!key || !this.placementOk(key, type)) return;
    if (this.steadBaseY === null) {
      this.steadBaseY = this.buildBaseY();
      this.steadLayer.setBase(this.steadBaseY);
      this.steadOrigin = { x: this.pos.x, z: this.pos.z };
    }
    for (const [id, n] of PART_TYPES[type].costs) remove(this.suit, id, n);
    place(this.stead, key, type);
    this.steadLayer.sync(this.stead, meshGroundHeight);
    this.afterBuildChange();
  }

  removeCursor() {
    const key = this.buildCursor(true);
    if (!key) return;
    const type = this.stead.parts.get(key).type;
    const costs = PART_TYPES[type].costs;
    const refundKg = costs.reduce((kg, [id, n]) => kg + ITEMS[id].kg * n, 0);
    // the refund needs somewhere to go: suit first, the rover's deck if
    // it's alongside, otherwise the part stays on the wall
    let dest = null;
    if (massOf(this.suit) + refundKg <= SUIT_CAPACITY) dest = this.suit;
    else if (this.distToRover() < 9 && massOf(this.roverStore) + refundKg <= ROVER_CAPACITY) dest = this.roverStore;
    if (!dest) { this.say('suit-full'); return; }
    removePart(this.stead, key);
    for (const [id, n] of costs) add(dest, id, n);
    this.steadLayer.sync(this.stead, meshGroundHeight);
    this.afterBuildChange();
  }

  // re-judge the air after every change: the flood-fill is the contract
  afterBuildChange() {
    this.analysis = analyse(this.stead);
    this.leakCacheKey = ''; // stale
    if (this.analysis.volumes.length) this.sayOnce('first-seal');
    // fed = true for now: the seal is fed from the lander's O2 stock until
    // the electrolyser closes the loop (PHASE2 step 5)
    const pressurised = this.analysis.volumes.some((v) => canPressurise(v, true));
    if (pressurised && !this.everPressurised) {
      this.everPressurised = true; // the gentle start ends here, for good
      this.say('pressurised');
    }
  }

  // walls are real: crossing a sealed ground-level face stops you; the
  // airlock instead runs its cycle and hands you through
  resolveWalls(px, pz) {
    if (this.stead.parts.size === 0 || this.steadBaseY === null) return;
    if (Math.abs(this.pos.y - this.steadBaseY) > 2.4) return; // above the walls
    const c0x = Math.floor(px / CELL), c0z = Math.floor(pz / CELL);
    let c1x = Math.floor(this.pos.x / CELL), c1z = Math.floor(this.pos.z / CELL);
    if (c1x !== c0x) {
      const fk = faceKey(Math.max(c0x, c1x), 0, c0z, 0);
      const part = this.stead.parts.get(fk);
      if (part && PART_TYPES[part.type].seals) {
        if (part.type === 'airlock') this.startCycle(c1x, c0z);
        this.pos.x = px; c1x = c0x;
      }
    }
    if (c1z !== c0z) {
      const fk = faceKey(c1x, 0, Math.max(c0z, c1z), 2);
      const part = this.stead.parts.get(fk);
      if (part && PART_TYPES[part.type].seals) {
        if (part.type === 'airlock') this.startCycle(c1x, c1z);
        this.pos.z = pz;
      }
    }
  }

  startCycle(tx, tz) {
    if (this.cycling) return;
    this.cycling = { t: 0, tx, tz };
    this.say('airlock-cycle');
  }

  // R: hand the night to VESPER — only with shelter, only at real night
  trySleep() {
    if (this.sleepAnim || this.driving) return;
    if (!canSleep(this.sunEl ?? 90)) return;
    if (!this.sheltered()) {
      // a sealed-but-small hab earns its own refusal
      this.say(this.insidePressurised ? 'hab-too-small' : 'no-shelter');
      return;
    }
    const { lat, lon } = worldToLatLon(this.pos.x, this.pos.z);
    const wake = wakeMillis(this.simMillis, lat, lon);
    if (wake === null) return; // polar night: no dawn to wake into
    this.sleepAnim = { t: 0, wake, jumped: false };
    this.say('sleep');
    this.hud.setVeil(1);
    this.steadLayer.showGhost(null);
    this.steadLayer.clearLeaks();
  }

  say(event) {
    const n = this.saidCounts[event] || 0;
    this.saidCounts[event] = n + 1;
    this.hud.say(vesperSay(event, n), this.t);
  }
  sayOnce(event) {
    if (this.saidFirsts.has(event)) return;
    this.saidFirsts.add(event);
    this.say(event);
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.simMillis += dt * 1000 * TIME_SCALE;

    if (this.sleepAnim) {
      this.frameSleeping(dt);
    } else if (this.driving) {
      this.frameDriving(dt);
    } else {
      this.frameOnFoot(dt);
    }

    // ---- the light of Mars
    this.frameWorld(dt);
    this.renderer.render(this.scene, this.cam);
    requestAnimationFrame((n) => this.frame(n));
  }

  frameOnFoot(dt) {
    this.camDist = 7;
    // the airlock's slow arithmetic: inputs wait, then you're through
    if (this.cycling) {
      this.cycling.t += dt;
      this.vel.multiplyScalar(Math.max(0, 1 - 8 * dt));
      if (this.cycling.t >= 1.6) {
        this.pos.x = (this.cycling.tx + 0.5) * CELL;
        this.pos.z = (this.cycling.tz + 0.5) * CELL;
        this.cycling = null;
      }
    }
    // ---- movement under 0.38 g
    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const wish = new THREE.Vector3();
    if (!this.cycling) {
      if (this.keys.KeyW) wish.add(fwd);
      if (this.keys.KeyS) wish.sub(fwd);
      if (this.keys.KeyA) wish.add(right);
      if (this.keys.KeyD) wish.sub(right);
    }
    const loping = this.keys.ShiftLeft || this.keys.ShiftRight;
    const speed0 = this.vel.length();
    const target = wish.lengthSq() > 0
      ? wish.normalize().multiplyScalar(loping ? LOPE_SPEED : WALK_SPEED)
      : new THREE.Vector3();
    // low-traction ease: momentum carries a little on the dusty regolith,
    // more while airborne (you can't steer off the ground)
    const ease = this.airborne ? 0.4 : 6;
    this.vel.lerp(target, Math.min(1, ease * dt));
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.resolveWalls(px, pz);
    if (this.vel.lengthSq() > 0.05) {
      this.heading = Math.atan2(this.vel.x, this.vel.z);
      this.sayOnce('first-steps');
      if (loping) this.sayOnce('lope');
      this.idleTimer = 0;
    } else {
      this.idleTimer += dt;
      if (this.idleTimer > 45) { this.idleTimer = 0; this.say('idle'); }
    }

    const ground = meshGroundHeight(this.pos.x, this.pos.z);
    if (!this.airborne && this.keys.Space && !this.cycling) {
      this.vy = JUMP_V0; this.airborne = true;
      this.sayOnce('first-jump');
    } else if (!this.airborne && loping && speed0 > 3.2) {
      // the LOPE: running is a chain of small ballistic bounds — each
      // stride leaves the ground for real (LOPE_HOP_V0's ~0.6 s flight)
      this.vy = LOPE_HOP_V0; this.airborne = true;
    }
    if (this.airborne) {
      this.vy = fallStep(this.vy, dt, G_MARS);
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        if (fallSeverity(this.vy) > 0.15) this.say('fall');
        this.pos.y = ground; this.vy = 0; this.airborne = false;
      }
    } else {
      this.pos.y = ground;
      // walked off an edge?
      if (this.pos.y - ground > 0.01) this.airborne = true;
    }

    const speed = this.vel.length();
    this.colonist.group.position.copy(this.pos);
    this.colonist.pose(dt, speed, this.airborne, this.heading,
      loping ? STRIDE_HZ_LOPE : STRIDE_HZ_WALK);

    // ---- footfalls: prints in the sand + little poofs of dust.
    // Walking: each half stride-cycle plants a boot. Bounding/jumping:
    // the LANDING is the footfall (both boots, bigger poof).
    const stridePhase = this.colonist.phase % Math.PI;
    const landedNow = this.wasAirborne && !this.airborne;
    if (landedNow || (!this.airborne && speed > 0.5 && stridePhase < this.prevStridePhase)) {
      this.footSide = -this.footSide;
      this.footprints.stamp(this.pos.x, this.pos.z, this.heading, this.footSide, meshGroundHeight);
      if (landedNow) this.footprints.stamp(this.pos.x, this.pos.z, this.heading, -this.footSide, meshGroundHeight);
      const n = landedNow ? 10 : 4;
      for (let i = 0; i < n; i++) {
        const j = (this.puffSeed = ((this.puffSeed || 0) + 1) % 4096);
        const a = (j * 2.399) % (Math.PI * 2); // golden-angle spread
        this.puffs.spawn(
          this.pos.x + Math.cos(a) * 0.15, this.pos.y + 0.06,
          this.pos.z + Math.sin(a) * 0.15,
          Math.cos(a) * (0.3 + (j % 7) * 0.06) + this.vel.x * 0.15,
          0.35 + (j % 5) * 0.08,
          Math.sin(a) * (0.3 + (j % 7) * 0.06) + this.vel.z * 0.15,
        );
      }
    }
    this.prevStridePhase = stridePhase;
    this.wasAirborne = this.airborne;

    // ---- camera: soft third-person orbit
    const co = new THREE.Vector3(
      Math.sin(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
      this.camDist * Math.sin(this.camPitch) + 1.6,
      Math.cos(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
    ).add(this.pos);
    // keep the lens out of the ground
    co.y = Math.max(co.y, meshGroundHeight(co.x, co.z) + 0.6);
    this.cam.position.lerp(co, Math.min(1, 8 * dt));
    this.cam.lookAt(this.pos.x, this.pos.y + 0.95, this.pos.z);

    // ---- salvage: work the selected bolt (stand still, stay close)
    if (this.unbolt) {
      if (speed > 0.6 || this.distToLander() > 7) {
        this.unbolt = null; // walked off the job
      } else {
        this.unbolt.t += dt;
        if (this.unbolt.t >= this.unbolt.need) {
          const { id } = this.unbolt;
          this.unbolt = null;
          const toSuit = canAdd(this.suit, id, 1);
          const dest = toSuit ? this.suit
            : (this.distToRover() < 9 ? this.roverStore : null);
          if (dest && takeOne(this.lander, id) && add(dest, id, 1)) {
            this.landerLayer.sync(this.lander);
            this.sayOnce('salvage-first');
            if (id === 'airlock-ring') this.say('ring-taken');
          }
        }
      }
    }

    // ---- the gentle start: the lander tops your air back up, free —
    // until the first volume pressurises and the ledger switches on
    if (!this.everPressurised && this.distToLander() < 7 && this.air < 1) {
      this.air = Math.min(1, this.air + dt * 0.03);
    }

    // ---- standing in your own weather: the sealed volume feeds the suit
    {
      const cx = Math.floor(this.pos.x / CELL), cz = Math.floor(this.pos.z / CELL);
      const vol = this.steadBaseY !== null ? volumeAtCell(this.analysis, cx, 0, cz) : null;
      this.insideVolume = vol;
      this.insidePressurised = !!(vol && canPressurise(vol, true));
      if (this.insidePressurised) {
        this.air = Math.min(1, this.air + dt * 0.06);
        this.warm = Math.min(1, this.warm + dt * 0.08);
      }
    }

    // ---- the build cursor: ghost + the leak finder's markers
    if (this.buildMode) {
      const type = this.buildablePart();
      const key = this.buildCursor(false);
      this.steadLayer.showGhost(key, key ? this.placementOk(key, type) : false, this.buildBaseY());
      const cx = Math.floor(this.pos.x / CELL), cz = Math.floor(this.pos.z / CELL);
      const cacheKey = `${this.stead.parts.size}:${cx},${cz}`;
      if (cacheKey !== this.leakCacheKey) {
        this.leakCacheKey = cacheKey;
        this.leaks = this.stead.parts.size >= 4 ? findLeaks(this.stead, [cx, 0, cz]) : [];
        if (this.leaks.length) this.sayOnce('leak');
      }
      if (this.leaks.length) this.steadLayer.showLeaks(this.leaks, this.buildBaseY(), this.t);
      else this.steadLayer.clearLeaks();
    }

    // ---- prompts + bags (the HUD reads the nearest interaction)
    if (this.cycling) {
      this.hud.setPrompt('airlock cycling…');
    } else if (this.buildMode) {
      const type = this.buildablePart();
      const t = PART_TYPES[type];
      const have = t.costs
        .map(([id, n]) => `${count(this.suit, id)}/${n} ${ITEMS[id].name.toLowerCase()}`)
        .join(' + ');
      const seal = this.insidePressurised ? ' · PRESSURISED'
        : this.leaks.length ? ' · leaking — follow the markers' : '';
      this.hud.setPrompt(
        `|*E| place ${t.name.toLowerCase()} (${have}) · |*X| remove`
        + ` · |*Q| part · |*V| ${this.buildSlot === 'wall' ? 'roof' : 'wall'} · |*B| done${seal}`,
      );
    } else if (this.unbolt) {
      const pct = Math.round((this.unbolt.t / this.unbolt.need) * 100);
      this.hud.setPrompt(`unbolting ${ITEMS[this.unbolt.id].name.toLowerCase()}… ${pct}%`);
    } else if (this.distToRover() < 3.2) {
      const deck = massOf(this.roverStore) > 0 ? ` · |*G| take from deck` : '';
      const load = massOf(this.suit) > 0 ? ` · |*F| load deck` : '';
      this.hud.setPrompt(`|*E| drive${load}${deck}`);
    } else if (this.distToLander() < 6 && this.salvageTarget()) {
      const id = this.salvageTarget();
      this.hud.setPrompt(
        `|*E| unbolt ${ITEMS[id].name.toLowerCase()} ×${remaining(this.lander, id)}`
        + ` (${unboltSeconds(id)}s) · |*Q| next part`
        + (remainingTotal(this.lander) ? '' : ' · stripped')
        + (canSleep(this.sunEl ?? 90) ? ' · |*R| sleep till dawn' : ''),
      );
    } else if (canSleep(this.sunEl ?? 90) && this.sheltered()) {
      this.hud.setPrompt('|*R| sleep till dawn');
    } else {
      this.hud.setPrompt(null);
    }
    const chips = Object.entries(this.suit.slots)
      .map(([id, n]) => `${ITEMS[id].name} ×${n}`).join(' · ');
    this.hud.setBags(
      `suit ${loadLabel(this.suit)}${chips ? ' — ' + chips : ''}`,
      massOf(this.roverStore) > 0 || this.distToRover() < 6
        ? `rover ${loadLabel(this.roverStore)}` : null,
    );

    // the parked buggy still needs drawing — seated on its wheels
    const pwg = this.wheelGround(this.buggy.x, this.buggy.z, this.buggy.heading);
    this.buggy.y = pwg.h;
    this.buggyLayer.update(dt, this.buggy, { skidF: false, skidR: false, airborne: false, landed: false },
      pwg.h, pwg.pitch, pwg.roll, this.puffs);
    this.hud.setSpeed(null);
  }

  // the night, skipped: fade to black, jump the clock to the computed dawn
  // behind the veil, wake with full bottles. Inputs sit the night out.
  frameSleeping(dt) {
    const s = this.sleepAnim;
    s.t += dt;
    if (!s.jumped && s.t >= 1.6) {
      s.jumped = true;
      this.simMillis = s.wake;
      this.air = 1; this.warm = 1;
      this.hud.setVeil(0);
      this.say('wake');
    }
    if (s.t >= 3.2) this.sleepAnim = null;
    this.hud.setPrompt(null);
    this.hud.setSpeed(null);
  }

  // sample the drawn surface under all four wheel contacts: the body's
  // height AND attitude come from where the wheels actually stand — the
  // same "stand on what is drawn" rule the walker follows (no floating
  // flat over a slope, no downhill wheels in the air)
  wheelGround(bx, bz, heading) {
    const sin = Math.sin(heading), cos = Math.cos(heading);
    const at = (lx, lz) => meshGroundHeight(bx + lx * cos + lz * sin, bz - lx * sin + lz * cos);
    const hFL = at(-TRACK, WHEELBASE), hFR = at(TRACK, WHEELBASE);
    const hRL = at(-TRACK, -WHEELBASE), hRR = at(TRACK, -WHEELBASE);
    const hF = (hFL + hFR) / 2, hR = (hRL + hRR) / 2;
    const hL = (hFL + hRL) / 2, hRt = (hFR + hRR) / 2;
    return {
      h: (hF + hR) / 2,
      pitch: Math.atan2(hR - hF, 2 * WHEELBASE),
      roll: Math.atan2(hRt - hL, 2 * TRACK),
    };
  }

  frameDriving(dt) {
    const input = {
      throttle: (this.keys.KeyW ? 1 : 0) + (this.keys.KeyS && this.buggy.u <= 0.5 ? -0.6 : 0),
      brake: this.keys.KeyS && this.buggy.u > 0.5 ? 1 : 0,
      steer: (this.keys.KeyA ? 1 : 0) - (this.keys.KeyD ? 1 : 0),
      handbrake: !!this.keys.Space,
    };
    // ground: height + attitude from the four wheel contacts, gradient
    // from central differences (drives the slope forces)
    const e = 0.7, bx = this.buggy.x, bz = this.buggy.z;
    const wg = this.wheelGround(bx, bz, this.buggy.heading);
    const h = wg.h;
    const ground = {
      h,
      gx: (meshGroundHeight(bx + e, bz) - meshGroundHeight(bx - e, bz)) / (2 * e),
      gz: (meshGroundHeight(bx, bz + e) - meshGroundHeight(bx, bz - e)) / (2 * e),
    };
    // fixed-substep integration: cover the WHOLE frame dt in 120 Hz slices,
    // so the dynamics run true at any framerate (and stay stable)
    const total = Math.min(dt, 0.1);
    const n = Math.max(1, Math.ceil(total / (1 / 120)));
    const h2 = total / n;
    let flags = { skidF: false, skidR: false, airborne: false, landed: false, impact: 0 };
    for (let i = 0; i < n; i++) {
      const f = stepBuggy(this.buggy, input, ground, h2);
      flags = {
        skidF: flags.skidF || f.skidF, skidR: flags.skidR || f.skidR,
        airborne: flags.airborne || f.airborne, landed: flags.landed || f.landed,
        impact: Math.max(flags.impact, f.impact),
      };
    }
    this.buggyFlags = flags;
    this.buggyLayer.update(dt, this.buggy, flags, h, wg.pitch, wg.roll, this.puffs);

    // VESPER reads the same flags the physics raises
    if (flags.skidR && Math.abs(this.buggy.v) > 1.5) {
      this.driftTimer += dt;
      if (this.driftTimer > 0.7) { this.driftTimer = -4; this.say('buggy-drift'); }
    } else if (this.driftTimer > 0) this.driftTimer = 0;
    if (flags.airborne) {
      this.airTimer += dt;
      if (this.airTimer > 0.8) { this.airTimer = -6; this.say('buggy-air'); }
    } else if (this.airTimer > 0) this.airTimer = 0;
    if (flags.rollover) this.say('buggy-rollover');
    if (flags.cleanFlip) this.say('buggy-flip');
    else if (flags.landed && flags.impact > 5 && !flags.rollover) this.say('buggy-crash');

    // the settler rides the seat
    this.pos.set(this.buggy.x, this.buggy.y, this.buggy.z);

    if (this.fpv) {
      // first person: the driver's eye — rigid to the body (no lerp; a
      // laggy FP camera is a seasick FP camera), attitude included
      const eye = this.buggyLayer.group.localToWorld(new THREE.Vector3(0, 1.32, -0.05));
      this.cam.position.copy(eye);
      let dy = this.buggy.heading - this.camYaw;
      dy = ((dy + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.camYaw += dy * Math.min(1, 6 * dt); // mouse can still glance around
      const look = new THREE.Vector3(
        Math.sin(this.camYaw), -Math.sin(this.camPitch - 0.25) * 0.6, Math.cos(this.camYaw),
      ).add(eye);
      this.cam.lookAt(look);
    } else {
      // chase camera: eases in behind the buggy's heading, farther back
      let dy = this.buggy.heading - this.camYaw;
      dy = ((dy + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.camYaw += dy * Math.min(1, 2.2 * dt);
      this.camDist = 12;
      const co = new THREE.Vector3(
        Math.sin(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
        this.camDist * Math.sin(this.camPitch) + 2.2,
        Math.cos(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
      ).add(this.pos);
      co.y = Math.max(co.y, meshGroundHeight(co.x, co.z) + 0.7);
      this.cam.position.lerp(co, Math.min(1, 6 * dt));
      this.cam.lookAt(this.buggy.x, this.buggy.y + 1.0, this.buggy.z);
    }

    this.hud.setSpeed(Math.abs(this.buggy.u) * 3.6);
    this.hud.setPrompt(`|*E| dismount · |*C| view`);
    this.hud.setBags(`rover ${loadLabel(this.roverStore)}`);
  }

  frameWorld(dt) {
    // ---- the light of Mars
    const { lat, lon } = worldToLatLon(this.pos.x, this.pos.z);
    const sunEl = sunElevation(this.simMillis, lat, lon);
    this.sunEl = sunEl; // live handles: the console + live checks read these
    const sunAz = sunAzimuth(this.simMillis, lat, lon);
    this.sunAz = sunAz;
    const tau = tauAt(mtc(this.simMillis));
    const L = lightState(sunEl, tau);

    const sunDir = new THREE.Vector3(
      Math.sin(sunAz * Math.PI / 180) * Math.cos(sunEl * Math.PI / 180),
      Math.sin(sunEl * Math.PI / 180),
      -Math.cos(sunAz * Math.PI / 180) * Math.cos(sunEl * Math.PI / 180),
    );
    this.sun.position.copy(this.pos).addScaledVector(sunDir, 120);
    this.sun.target.position.copy(this.pos);
    this.sun.color.setRGB(...L.sunColour);
    this.sun.intensity = L.sunIntensity * 1.6;
    this.fill.color.setRGB(...L.ambientColour);
    this.fill.intensity = L.ambientIntensity * 1.3;
    this.scene.fog.color.setRGB(...L.fogColour);
    this.scene.fog.density = L.fogDensity;

    // Phobos: period 7.65 h, rises WEST sets east — the backwards moon
    const pAng = (this.simMillis / (7.65 * 3600000)) * Math.PI * 2;
    const phobosDir = new THREE.Vector3(
      -Math.cos(pAng), Math.sin(pAng) * 0.8, 0.35,
    ).normalize();
    this.sky.set(L, sunDir, phobosDir, this.cam.position);

    // automatic lights: dusk switches them on, dawn off; L overrides
    const wantLit = this.lampMode === 'on' || (this.lampMode === 'auto' && sunEl < 4);
    if (wantLit !== this.lampLit) {
      this.lampLit = wantLit;
      if (wantLit && this.lampMode === 'auto') this.sayOnce('lights-on');
    }
    this.colonist.setLamp(this.lampLit && !this.driving);
    this.buggyLayer.setLamps(this.lampLit);

    // dusk / night / dawn beats
    if (sunEl < 6 && sunEl > -2 && this.lastSunEl > sunEl) this.sayOnce('sunset');
    if (sunEl < -8) this.sayOnce('night');
    if (sunEl > 4 && this.lastSunEl < sunEl && this.saidFirsts.has('night')) this.sayOnce('dawn');
    this.lastSunEl = sunEl;

    // ---- the earned map: stamp ground as it's actually covered
    if (Math.hypot(this.pos.x - this.lastVisit.x, this.pos.z - this.lastVisit.z) > 12) {
      this.lastVisit = { x: this.pos.x, z: this.pos.z };
      visit(this.exploration, this.pos.x, this.pos.z);
    }
    if (this.map.visible) {
      this.map.update(this.exploration, {
        player: { x: this.pos.x, z: this.pos.z, heading: this.driving ? this.buggy.heading : this.heading },
        lander: this.landerPos,
        buggy: { x: this.buggy.x, z: this.buggy.z },
        stead: this.steadOrigin,
      });
    }

    // ---- the world layers
    this.terrain.update(this.pos.x, this.pos.z);
    this.dust.update(dt, this.t, this.pos.x, this.pos.z, this.vel.x, this.vel.z);
    // dust is sunlit matter: it fades with the light (never glows at night)
    this.dust.moteMat.opacity = 0.06 + 0.44 * L.sunIntensity;
    this.dust.devilMat.opacity = 0.05 + 0.3 * L.sunIntensity;
    this.puffs.update(dt, meshGroundHeight);
    // the fractal atmosphere: dome + haze sheets read the same pure envelopes
    const wind = windAt(this.pos.x, this.pos.z, this.t);
    this.dust.setAtmos(L, sunDir, tau, wind.x, wind.z, this.t,
      this.cam.position, meshGroundHeight(this.cam.position.x, this.cam.position.z));
    if (this.dust.nearestDevil < 220) this.sayOnce('devil-near');

    // ---- the suit's slow arithmetic. The gentle start runs an 8h bottle
    // and forgiving cold; once the first hab pressurises the full ledger
    // switches on (PHASE2) — a 5h bottle and a colder night.
    const temp = surfaceTempC(sunEl, tau);
    const bottleHours = this.everPressurised ? 5 : 8;
    this.air = Math.max(0, this.air - dt / (bottleHours * 3600 / TIME_SCALE));
    const chill = temp < -60 ? ((-60 - temp) / 40) * (this.everPressurised ? 1.5 : 1) : 0;
    this.warm = Math.max(0, Math.min(1, this.warm + (0.05 - chill * 0.02) * dt));
    if (this.warm < 0.35) this.sayOnce('cold');
    if (this.air < 0.25) this.sayOnce('air-low');
    this.hud.setVitals(this.air, this.warm, temp);
    this.hud.setClock(
      solClock(this.simMillis),
      `Ls ${solarLongitude(this.simMillis).toFixed(1)}° · ${season(this.simMillis)} · Jezero`,
    );
    this.hud.update(this.t);
  }
}

const game = new Game();
window.marsstead = game; // the live handle, the family way
