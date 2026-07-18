// Marsstead — Phase 0: the ground. One region of Mars (Jezero), streamed
// with no cheap tiles; a colonist bounding under 0.38 g; the backwards
// light of Mars from noon butterscotch to the blue hour; dust in three
// registers; the sol clock running real Mars time; VESPER's first words.
// The kill/go gate: if this doesn't feel right, the project stops here.
//
// Dev keys: WASD move, SHIFT lope, SPACE jump, mouse-drag orbit,
// L headlamp, [ ] scrub time (the demo's best friend).
// E interact (the lander's hatch is at the LADDER; E inside steps out) ·
// Q cycle part · F/G load/unload rover · R sleep (sheltered, at night) ·
// B build mode (E place, X remove, Q part, V wall/roof) · M the
// surveyor's map (fog clears where you walk) · H hitch/unhitch the rig
// from the buggy · T work the nearest bench · X pack up the rig.

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
  serialize as steadSerialize, deserialize as steadDeserialize,
} from './build.js';
import {
  snapshotSave, acceptSave, saveGame, loadGame, clearSave,
} from './save.js';
import { analyse, volumeAtCell, canPressurise, findLeaks } from './pressure.js';
import { SteadLayer, BED_DEPTH } from './steadlayer.js';
import {
  createExploration, visit,
  serialize as fogSerialize, deserialize as fogDeserialize,
} from './explore.js';
import { MarsMap } from './marsmap.js';
import {
  PROSPECT_RADIUS, HOPPER_CAP, depositById, depositsNear, createRig,
  canDeploy, deploy, packUp, drillTick, hopperCount, hopperTake,
} from './mine.js';
import { stepTrailer } from './trailer.js';
import {
  createFab, fabFeed, fabTick, fabTake, fabOutCount, RECIPES,
} from './refine.js';
import { RigLayer } from './riglayer.js';
import { TitleScreen } from './title.js';
import {
  MACHINE_TYPES, createMachine, canPlaceMachine, machineFeed, machineTick,
  machineTake, machineOutCount,
} from './machines.js';
import { MachineLayer } from './machinelayer.js';
import { LanderConsole } from './console.js';

const TIME_SCALE = 40;            // one sol ~= 37 real minutes in Phase 0

class Game {
  constructor(save = null) {
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
    this.inLander = false;    // in the cabin: warm, pressurised, home
    this.console = new LanderConsole();
    this.sleptOnce = false;   // shakedown ends (and salvage unlocks) at first rest

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
    this.missionStart = this.simMillis; // sol 1 of THIS landing (save carries it)

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

    // the expedition: the rig sleeps by the lander until it's towed out
    this.rig = createRig(-16, -1, 0.6);
    this.rigLayer = new RigLayer(this.scene);
    this.prospected = new Set(); // deposit ids the ground has admitted to
    this.fab = createFab();      // the lander's ISRU bench
    this.machines = [];          // the built refinery (step 5)
    this.machineLayer = new MachineLayer(this.scene);
    this.anchoring = null;       // { t, need } while planting the rig
    this.swayTimer = 0;
    this.prevHopper = 0;

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

    if (save) this.applySave(save);
    this.booted = true; // until now, persist() must stay silent — a page
    // interrupted mid-boot must never write half-applied state over a
    // good save (the unload handlers below register with the page alive)
    this.lastPersist = 0;
    // best-effort parting save: the planet keeps what it was given
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist();
    });
    addEventListener('beforeunload', () => this.persist());

    this.say('wake');
    this.t = 0;
    this.last = performance.now();
    this.ready = true;
    requestAnimationFrame((n) => this.frame(n));
  }

  // restore an accepted save: only authored facts — the world re-derives
  applySave(s) {
    this.simMillis = s.simMillis;
    this.heading = s.heading;
    this.air = s.air; this.warm = s.warm;
    this.buggy.x = s.buggy.x; this.buggy.z = s.buggy.z;
    this.buggy.heading = s.buggy.heading;
    this.buggy.y = meshGroundHeight(this.buggy.x, this.buggy.z);
    this.pos.set(s.pos.x, 0, s.pos.z);
    // a save taken from the saddle wakes you standing beside the machine
    if (Math.hypot(this.pos.x - this.buggy.x, this.pos.z - this.buggy.z) < 1.5) {
      this.pos.x += 2;
    }
    this.pos.y = meshGroundHeight(this.pos.x, this.pos.z);
    this.suit.slots = s.suit;
    this.roverStore.slots = s.rover;
    this.lander.stock = s.lander;
    this.landerLayer.sync(this.lander);
    if (s.steadBaseY !== null && s.stead.length) {
      this.stead = steadDeserialize(s.stead);
      this.steadBaseY = s.steadBaseY;
      this.steadLayer.setBase(this.steadBaseY);
      this.steadLayer.sync(this.stead, meshGroundHeight);
      this.analysis = analyse(this.stead);
    }
    this.steadOrigin = s.steadOrigin;
    this.exploration = fogDeserialize(s.exploration);
    visit(this.exploration, this.pos.x, this.pos.z);
    this.lastVisit = { x: this.pos.x, z: this.pos.z };
    this.everPressurised = s.everPressurised;
    this.saidFirsts = new Set(s.saidFirsts);
    this.rig = createRig(s.rig.x, s.rig.z, s.rig.heading);
    this.rig.deployed = s.rig.deployed;
    this.rig.depositId = s.rig.depositId;
    this.rig.hopper = s.rig.hopper;
    this.prospected = new Set(s.prospected);
    this.fab = { queue: s.fab.queue, t: s.fab.t, out: s.fab.out };
    this.machines = s.machines;
    this.machineLayer.sync(this.machines, meshGroundHeight);
    this.prevHopper = hopperCount(this.rig);
    this.sleptOnce = s.sleptOnce;
    this.missionStart = s.missionStart ?? this.simMillis;
    if (s.inLander) this.enterLander(); // saved aboard, wake aboard
  }

  // fire-and-forget: a failed save must never cost a frame, let alone a run
  persist() {
    if (this.resetting || !this.booted) return; // never resurrect a wiped
    // slate; never write from a page that hasn't fully woken up
    saveGame(snapshotSave({
      simMillis: this.simMillis,
      pos: this.pos, heading: this.heading,
      air: this.air, warm: this.warm,
      buggy: this.buggy,
      suit: this.suit.slots, rover: this.roverStore.slots,
      lander: this.lander.stock,
      stead: steadSerialize(this.stead),
      steadBaseY: this.steadBaseY, steadOrigin: this.steadOrigin,
      exploration: fogSerialize(this.exploration),
      everPressurised: this.everPressurised,
      saidFirsts: this.saidFirsts,
      inLander: this.inLander,
      sleptOnce: this.sleptOnce,
      missionStart: this.missionStart,
      rig: this.rig,
      prospected: this.prospected,
      fab: this.fab,
      machines: this.machines,
    })).catch(() => {});
  }

  // wipe the slate and start the landing again (the live handle's lever)
  async reset() {
    this.resetting = true;
    await clearSave();
    location.reload();
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
    if (e.code === 'KeyC' && this.inLander) this.console.toggleExpand();
    if (e.code === 'KeyB' && !this.driving && !this.sleepAnim) {
      this.buildMode = !this.buildMode;
      if (!this.buildMode) {
        this.steadLayer.showGhost(null);
        this.steadLayer.clearLeaks();
        this.machineLayer.showGhost(null);
      }
    }
    if (e.code === 'KeyX' && this.buildMode) this.removeCursor();
    if (e.code === 'KeyM') this.map.toggle();
    if (e.code === 'KeyH') this.toggleHitch();
    if (e.code === 'KeyT') this.workFab();
    if (e.code === 'KeyX' && !this.buildMode && !this.driving
      && this.rig.deployed && this.distToRig() < 4) {
      packUp(this.rig);
      this.say('pack-up');
    }
    if (e.code === 'KeyV' && this.buildMode) {
      this.buildSlot = this.buildSlot === 'wall' ? 'roof' : 'wall';
    }
    if (e.code === 'BracketLeft') this.simMillis -= 3698968.5 * 0.5;  // -30 Mars min
    if (e.code === 'BracketRight') this.simMillis += 3698968.5 * 0.5; // +30
  }

  distToLander() {
    return Math.hypot(this.pos.x - this.landerPos.x, this.pos.z - this.landerPos.z);
  }
  // the hatch is up the ladder, on the lander's +z face
  distToLadder() {
    return Math.hypot(this.pos.x - this.landerPos.x,
      this.pos.z - (this.landerPos.z + 2.6));
  }

  enterLander() {
    this.inLander = true;
    this.unbolt = null;
    this.vel.set(0, 0, 0);
    this.colonist.group.visible = false;
    this.colonist.setLamp(false);
    this.pos.set(this.landerPos.x, 0, this.landerPos.z);
    this.pos.y = meshGroundHeight(this.pos.x, this.pos.z);
    this.hud.setVeil(0.55); // the cabin: the planet, dimmed to a porthole
    this.console.setVisible(true);
    this.sayOnce('lander-in');
  }

  exitLander() {
    this.inLander = false;
    this.colonist.group.visible = true;
    this.pos.set(this.landerPos.x, 0, this.landerPos.z + 2.9);
    this.pos.y = meshGroundHeight(this.pos.x, this.pos.z);
    this.hud.setVeil(0);
    this.console.setVisible(false);
  }

  // the console's read of the world, rebuilt each cabin frame
  consoleModel() {
    const missionSol = Math.max(1,
      Math.floor((this.simMillis - this.missionStart) / 88775244) + 1);
    const phase = !this.sleptOnce ? 'shakedown — hull salvage locked'
      : this.everPressurised ? 'the full ledger' : 'construction';
    const tau = tauAt(mtc(this.simMillis));
    const temp = surfaceTempC(this.sunEl ?? 0, tau);
    const bedworthyBuilt = this.analysis.volumes
      .some((v) => v.cells.length >= 6 && canPressurise(v, true));
    return {
      sol: `${missionSol}`,
      clock: solClock(this.simMillis),
      season: season(this.simMillis),
      phase,
      objectives: [
        ['rest a night aboard', this.sleptOnce],
        ['prospect an ore body', this.prospected.size > 0],
        ['seal a volume', this.saidFirsts.has('first-seal')],
        ['pressurise the first hab', this.everPressurised],
        ['cook steel from Mars', this.saidFirsts.has('fab-first-steel')],
        ['raise a hab that beats the lander', bedworthyBuilt],
      ],
      air: `${Math.round(this.air * 100)}`,
      warm: `${Math.round(this.warm * 100)}`,
      temp: `${Math.round(temp)}°C`,
      sun: `${(this.sunEl ?? 0).toFixed(1)}° ${canSleep(this.sunEl ?? 90) ? '(night)' : '(up)'}`,
      dust: tau > 3 ? 'STORM' : tau > 1.2 ? 'thick' : 'clear',
      shelter: this.sheltered() ? 'within reach' : 'none in reach',
      suit: loadLabel(this.suit),
      rover: loadLabel(this.roverStore),
      hull: `${remainingTotal(this.lander)} parts${this.sleptOnce ? '' : ' (locked)'}`,
      fab: `${fabOutCount(this.fab)} ready · ${this.fab.queue.length} cooking`,
      machines: this.machines.length
        ? this.machines.map((m) => `${m.type}${m.queue.length ? '*' : ''}`).join(', ')
        : 'none built',
      rig: this.rig.deployed
        ? `drilling — hopper ${hopperCount(this.rig)}/${HOPPER_CAP}`
        : this.rig.hitched ? 'in tow' : 'parked',
      ore: `${this.prospected.size} site${this.prospected.size === 1 ? '' : 's'}`,
      vesper: this.hud.vesperLine.textContent,
    };
  }
  distToRover() {
    return Math.hypot(this.pos.x - this.buggy.x, this.pos.z - this.buggy.z);
  }
  distToRig() {
    return Math.hypot(this.pos.x - this.rig.x, this.pos.z - this.rig.z);
  }

  // the buggy's hitch pin, just behind the rear axle
  hitchPin() {
    return {
      x: this.buggy.x - Math.sin(this.buggy.heading) * 1.9,
      z: this.buggy.z - Math.cos(this.buggy.heading) * 1.9,
    };
  }

  // H: pin in, pin out
  toggleHitch() {
    if (this.rig.hitched) {
      this.rig.hitched = false;
      return;
    }
    if (!this.driving || this.rig.deployed) return;
    const pin = this.hitchPin();
    if (Math.hypot(pin.x - this.rig.x, pin.z - this.rig.z) < 4.5) {
      this.rig.hitched = true;
      this.sayOnce('hitch');
    }
  }

  // slope under the rig — the anchor law reads it
  rigSlope() { return this.slopeAt(this.rig.x, this.rig.z); }

  nearestDepositToRig() {
    const near = depositsNear(this.rig.x, this.rig.z, 40);
    near.sort((a, b) => Math.hypot(a.x - this.rig.x, a.z - this.rig.z)
      - Math.hypot(b.x - this.rig.x, b.z - this.rig.z));
    return near[0] || null;
  }

  // E at a deployed rig: the hopper hands over — suit first, deck alongside
  takeOre() {
    let moved = 0;
    for (let guard = 0; guard < HOPPER_CAP * 2; guard++) {
      const peek = Object.keys(this.rig.hopper)[0];
      if (!peek) break;
      const dest = canAdd(this.suit, peek, 1) ? this.suit
        : (this.distToRover() < 9 && canAdd(this.roverStore, peek, 1) ? this.roverStore : null);
      if (!dest) { if (!moved) this.say('suit-full'); break; }
      const got = hopperTake(this.rig, peek, 1);
      if (!got) break;
      add(dest, got.id, 1);
      moved++;
    }
  }

  // the rig's one-line state for the HUD (null when there's nothing to say)
  rigPrompt() {
    const r = this.rig;
    if (r.deployed) {
      const n = hopperCount(r);
      const take = n > 0 ? `|*E| take ore ×${n} · ` : 'drilling… · ';
      return `${take}|*X| pack up`;
    }
    if (canDeploy(r, this.nearestDepositToRig(), this.rigSlope())) {
      return '|*E| anchor the rig (5s)';
    }
    const dep = this.nearestDepositToRig();
    if (dep) return 'rig — tow it onto the ore body (|*H| from the buggy)';
    return 'the drill rig — tow it to marked ore (|*H| hitch from the buggy)';
  }

  // the fabricator's one-line state (empty string when it has none)
  fabLabel() {
    const q = this.fab.queue.length, o = fabOutCount(this.fab);
    const carryRaw = Object.keys(RECIPES).some((raw) => count(this.suit, raw) > 0
      || (this.distToRover() < 9 && count(this.roverStore, raw) > 0));
    if (!q && !o && !carryRaw) return '';
    const bits = [];
    if (o) bits.push(`${o} ready`);
    if (q) bits.push(`${q} cooking`);
    return ` · |*T| fabricator${bits.length ? ` (${bits.join(', ')})` : ''}`;
  }

  // the machine you're standing at, if any
  nearestMachine(radius = 3.5) {
    let best = null, bestD = radius;
    for (const m of this.machines) {
      const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
      if (d < bestD) { best = m; bestD = d; }
    }
    return best;
  }

  // T works the nearest bench: a built machine first, else the lander's
  // fabricator — clear the out-tray into the bags, then feed it raw
  workFab() {
    if (this.driving) return;
    const roverClose = this.distToRover() < 9;
    const m = this.nearestMachine();
    if (m) {
      for (const id of Object.keys(m.out)) {
        while (m.out[id] && canAdd(this.suit, id, 1)) {
          machineTake(m, id, 1);
          add(this.suit, id, 1);
        }
      }
      for (const raw of Object.keys(MACHINE_TYPES[m.type].recipes)) {
        remove(this.suit, raw, machineFeed(m, raw, count(this.suit, raw)));
        if (roverClose) remove(this.roverStore, raw, machineFeed(m, raw, count(this.roverStore, raw)));
      }
      return;
    }
    if (this.distToLander() > 7) return;
    for (const id of Object.keys(this.fab.out)) {
      while (this.fab.out[id] && canAdd(this.suit, id, 1)) {
        fabTake(this.fab, id, 1);
        add(this.suit, id, 1);
      }
    }
    for (const raw of Object.keys(RECIPES)) {
      // fabFeed reports what the queue accepted; only THAT leaves the bag
      remove(this.suit, raw, fabFeed(this.fab, raw, count(this.suit, raw)));
      if (roverClose) {
        remove(this.roverStore, raw, fabFeed(this.fab, raw, count(this.roverStore, raw)));
      }
    }
  }
  salvageTarget() {
    if (!this.sleptOnce) return null; // shakedown: the hull isn't inventory yet
    const opts = available(this.lander);
    if (!opts.length) return null;
    return opts[((this.salvageSel % opts.length) + opts.length) % opts.length];
  }

  // E is THE doing key: the cabin door, the rover, the rig, the bolts
  interact() {
    if (this.inLander) { this.exitLander(); return; }
    if (this.driving) { this.toggleBuggy(); return; }
    if (this.distToLadder() < 3.6) { this.enterLander(); return; }
    if (this.distToRover() < 3.2) { this.toggleBuggy(); return; }
    if (this.distToRig() < 4 && !this.rig.hitched) {
      if (this.rig.deployed && hopperCount(this.rig) > 0) { this.takeOre(); return; }
      if (!this.rig.deployed && !this.anchoring
        && canDeploy(this.rig, this.nearestDepositToRig(), this.rigSlope())) {
        this.anchoring = { t: 0, need: 5 };
        return;
      }
    }
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

  // E: mount within reach; dismount to the buggy's left. The settler is
  // VISIBLE in the seat: the figure reparents onto the buggy's frame and
  // takes the seated pose, so it rides every bounce the chassis takes.
  toggleBuggy() {
    if (this.driving) {
      this.driving = false;
      const sin = Math.sin(this.buggy.heading), cos = Math.cos(this.buggy.heading);
      this.pos.set(this.buggy.x - cos * 1.6, 0, this.buggy.z + sin * 1.6);
      this.pos.y = meshGroundHeight(this.pos.x, this.pos.z);
      this.scene.add(this.colonist.group); // back to the world's frame
      this.colonist.group.position.copy(this.pos);
      this.colonist.group.visible = true;
      this.colonist.setLamp(this.lamp);
      this.buggyLayer.setLamps(false);
    } else {
      const d = Math.hypot(this.pos.x - this.buggy.x, this.pos.z - this.buggy.z);
      if (d < 3.2) {
        this.driving = true;
        this.buggyLayer.group.add(this.colonist.group);
        this.colonist.group.position.set(0, -0.02, -0.12);
        this.colonist.group.rotation.y = 0; // face the nose
        this.colonist.poseSeated();
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

  // the catalogue Q cycles: face parts first, then the machines
  buildablePart() {
    const types = [...Object.keys(PART_TYPES), ...Object.keys(MACHINE_TYPES)];
    return types[((this.buildSel % types.length) + types.length) % types.length];
  }

  isMachine(type) { return !!MACHINE_TYPES[type]; }
  costsOf(type) { return (MACHINE_TYPES[type] ?? PART_TYPES[type]).costs; }

  canAfford(type) {
    return this.costsOf(type).every(([id, n]) => count(this.suit, id) >= n);
  }

  // slope of the drawn ground at (x, z), rise over run
  slopeAt(x, z) {
    const e = 1.2;
    const gx = (meshGroundHeight(x + e, z) - meshGroundHeight(x - e, z)) / (2 * e);
    const gz = (meshGroundHeight(x, z + e) - meshGroundHeight(x, z - e)) / (2 * e);
    return Math.hypot(gx, gz);
  }

  // a machine goes down at the centre of the cell you face
  machineTargetCell() {
    const { dx, dz } = cardinal(Math.sin(this.camYaw), Math.cos(this.camYaw));
    const cx = Math.floor(this.pos.x / CELL) + dx;
    const cz = Math.floor(this.pos.z / CELL) + dz;
    return { x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL };
  }

  placeMachine(type) {
    const { x, z } = this.machineTargetCell();
    if (!canPlaceMachine(type, this.slopeAt(x, z), this.machines, x, z)
      || !this.canAfford(type)) return;
    for (const [id, n] of this.costsOf(type)) remove(this.suit, id, n);
    this.machines.push(createMachine(type, x, z, this.camYaw));
    this.machineLayer.sync(this.machines, meshGroundHeight);
  }

  removeMachine() {
    let best = -1, bestD = 4;
    this.machines.forEach((m, i) => {
      const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
      if (d < bestD) { best = i; bestD = d; }
    });
    if (best < 0) return;
    const m = this.machines[best];
    const costs = MACHINE_TYPES[m.type].costs;
    const refundKg = costs.reduce((kg, [id, n]) => kg + ITEMS[id].kg * n, 0);
    let dest = null;
    if (massOf(this.suit) + refundKg <= SUIT_CAPACITY) dest = this.suit;
    else if (this.distToRover() < 9 && massOf(this.roverStore) + refundKg <= ROVER_CAPACITY) dest = this.roverStore;
    if (!dest) { this.say('suit-full'); return; }
    this.machines.splice(best, 1);
    for (const [id, n] of costs) add(dest, id, n);
    this.machineLayer.sync(this.machines, meshGroundHeight);
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
    if (this.isMachine(type)) { this.placeMachine(type); return; }
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
    if (this.isMachine(this.buildablePart())) { this.removeMachine(); return; }
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
  // the drawn surface plus your own roofs: a roof plate is a floor once
  // your boots are at or above it (jump up; walk off the edge honestly)
  groundAt(x, z) {
    let g = meshGroundHeight(x, z);
    if (this.steadBaseY !== null && this.stead.parts.size) {
      const roof = this.stead.parts.get(
        faceKey(Math.floor(x / CELL), 1, Math.floor(z / CELL), 1));
      const top = this.steadBaseY + CELL;
      if (roof && this.pos.y >= top - 0.4) g = Math.max(g, top);
    }
    return g;
  }

  resolveWalls(px, pz) {
    if (this.stead.parts.size === 0 || this.steadBaseY === null) return;
    // feet above the wall tops (roof-walking) pass over freely
    if (this.pos.y > this.steadBaseY + CELL - 0.3) return;
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

  // R: hand the night to VESPER — only with shelter, only at real night.
  // Every refusal says WHY: silence teaches nothing.
  trySleep() {
    if (this.sleepAnim || this.driving) return;
    if (!canSleep(this.sunEl ?? 90)) { this.say('not-tired'); return; }
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
    this.machineLayer.showGhost(null);
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
    } else if (this.inLander) {
      this.frameInside(dt);
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

    const ground = this.groundAt(this.pos.x, this.pos.z);
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

    // ---- anchoring the rig: stand by it while the legs go down
    if (this.anchoring) {
      if (speed > 0.6 || this.distToRig() > 5) {
        this.anchoring = null; // walked off the job
      } else {
        this.anchoring.t += dt;
        if (this.anchoring.t >= this.anchoring.need) {
          this.anchoring = null;
          const dep = this.nearestDepositToRig();
          if (canDeploy(this.rig, dep, this.rigSlope())) {
            deploy(this.rig, dep);
            this.say('deploy');
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
      if (this.isMachine(type)) {
        const { x, z } = this.machineTargetCell();
        const ok = canPlaceMachine(type, this.slopeAt(x, z), this.machines, x, z)
          && this.canAfford(type);
        this.machineLayer.showGhost(x, meshGroundHeight(x, z), z, ok);
        this.steadLayer.showGhost(null);
      } else {
        this.machineLayer.showGhost(null);
        const key = this.buildCursor(false);
        this.steadLayer.showGhost(key, key ? this.placementOk(key, type) : false, this.buildBaseY());
      }
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
      const t = MACHINE_TYPES[type] ?? PART_TYPES[type];
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
    } else if (this.anchoring) {
      const pct = Math.round((this.anchoring.t / this.anchoring.need) * 100);
      this.hud.setPrompt(`anchoring the rig… ${pct}%`);
    } else if (this.distToLadder() < 3.6) {
      this.hud.setPrompt('|*E| climb into the lander'
        + (canSleep(this.sunEl ?? 90) ? ' · |*R| sleep till dawn' : ''));
    } else if (this.distToRover() < 3.2) {
      const deck = massOf(this.roverStore) > 0 ? ` · |*G| take from deck` : '';
      const load = massOf(this.suit) > 0 ? ` · |*F| load deck` : '';
      this.hud.setPrompt(`|*E| drive${load}${deck}`);
    } else if (this.nearestMachine()) {
      const m = this.nearestMachine();
      const bits = [];
      const o = machineOutCount(m);
      if (o) bits.push(`${o} ready`);
      if (m.queue.length) bits.push(`${m.queue.length} cooking`);
      this.hud.setPrompt(`|*T| ${MACHINE_TYPES[m.type].name.toLowerCase()}`
        + (bits.length ? ` (${bits.join(', ')})` : ''));
    } else if (this.distToRig() < 4 && !this.rig.hitched && this.rigPrompt()) {
      this.hud.setPrompt(this.rigPrompt());
    } else if (this.distToLander() < 6 && this.salvageTarget()) {
      const id = this.salvageTarget();
      this.hud.setPrompt(
        `|*E| unbolt ${ITEMS[id].name.toLowerCase()} ×${remaining(this.lander, id)}`
        + ` (${unboltSeconds(id)}s) · |*Q| next part`
        + (remainingTotal(this.lander) ? '' : ' · stripped')
        + this.fabLabel()
        + (canSleep(this.sunEl ?? 90) ? ' · |*R| sleep till dawn' : '')
        + ' · hatch at the ladder',
      );
    } else if (this.distToLander() < 6 && !this.sleptOnce) {
      this.hud.setPrompt('hull salvage — locked until you’ve rested a night · hatch at the ladder');
    } else if (this.distToLander() < 6 && this.fabLabel()) {
      this.hud.setPrompt(this.fabLabel().replace(/^ · /, ''));
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

  // the cabin: the suit drinks the lander's stores while the camera holds
  // a slow watch outside. E steps out; R takes the night when it's night.
  frameInside(dt) {
    this.air = Math.min(1, this.air + dt * 0.08);
    this.warm = Math.min(1, this.warm + dt * 0.1);
    this.camYaw += dt * 0.04; // the porthole drifts
    const co = new THREE.Vector3(
      Math.sin(this.camYaw) * -9 * Math.cos(0.3),
      9 * Math.sin(0.3) + 3.4,
      Math.cos(this.camYaw) * -9 * Math.cos(0.3),
    ).add(this.pos);
    co.y = Math.max(co.y, meshGroundHeight(co.x, co.z) + 0.8);
    this.cam.position.lerp(co, Math.min(1, 4 * dt));
    this.cam.lookAt(this.pos.x, this.pos.y + 3.2, this.pos.z);
    this.hud.setPrompt('LANDER — cabin · |*E| step out · |*C| console · |*M| map'
      + (canSleep(this.sunEl ?? 90) ? ' · |*R| sleep till dawn' : '')
      + this.fabLabel());
    this.hud.setBags(`suit ${loadLabel(this.suit)}`);
    this.hud.setSpeed(null);
    this.console.update(this.consoleModel());
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
      this.hud.setVeil(this.inLander ? 0.55 : 0); // the cabin keeps its dim
      if (!this.sleptOnce) {
        this.sleptOnce = true; // shakedown over: the hull becomes inventory
        this.say('salvage-unlocked');
      } else {
        this.say('wake');
      }
      this.persist(); // the morning is worth keeping
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
    const bx0 = bx, bz0 = bz; // pre-step, for the wall check below
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

    // ---- walls stop the buggy too: no vehicle fits an airlock, so every
    // sealing face is a wall to the chassis (centre-point, ground level)
    if (this.stead.parts.size && this.steadBaseY !== null
      && Math.abs(this.buggy.y - this.steadBaseY) < 2.4) {
      const c0x = Math.floor(bx0 / CELL), c0z = Math.floor(bz0 / CELL);
      let c1x = Math.floor(this.buggy.x / CELL), c1z = Math.floor(this.buggy.z / CELL);
      const wall = (fk) => {
        const p = this.stead.parts.get(fk);
        return p && PART_TYPES[p.type].seals;
      };
      let blocked = false;
      if (c1x !== c0x && wall(faceKey(Math.max(c0x, c1x), 0, c0z, 0))) {
        this.buggy.x = bx0; c1x = c0x; blocked = true;
      }
      if (c1z !== c0z && wall(faceKey(c1x, 0, Math.max(c0z, c1z), 2))) {
        this.buggy.z = bz0; blocked = true;
      }
      if (blocked) { this.buggy.u *= -0.2; this.buggy.v = 0; }
    }

    // ---- the tow: the rig chases the pin; geometry raises the flags
    if (this.rig.hitched) {
      const pin = this.hitchPin();
      const tf = stepTrailer(this.rig, pin.x, pin.z, this.buggy.heading, this.buggy.u, dt);
      if (tf.jackknife) {
        this.rig.hitched = false; // the pin shears to save the chassis
        this.say('jackknife');
      } else if (tf.sway) {
        this.swayTimer += dt;
        if (this.swayTimer > 0.6) { this.swayTimer = -8; this.say('trailer-sway'); }
      } else if (this.swayTimer > 0) {
        this.swayTimer = 0;
      }
    }

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

    // the rider shows in chase view; in first person YOU are the rider
    this.colonist.group.visible = !this.fpv;

    if (this.fpv) {
      // first person: the driver's eye — rigid to the body (no lerp; a
      // laggy FP camera is a seasick FP camera), attitude included
      const eye = this.buggyLayer.group.localToWorld(new THREE.Vector3(0, 1.58, -0.12));
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
    const pin = this.hitchPin();
    const hitchable = !this.rig.hitched && !this.rig.deployed
      && Math.hypot(pin.x - this.rig.x, pin.z - this.rig.z) < 4.5;
    this.hud.setPrompt(`|*E| dismount · |*C| view`
      + (this.rig.hitched ? ' · |*H| unhitch' : hitchable ? ' · |*H| hitch the rig' : ''));
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

    // ---- the earned map: stamp ground as it's actually covered — and
    // read it for ore while we're down there (prospecting IS being there)
    if (Math.hypot(this.pos.x - this.lastVisit.x, this.pos.z - this.lastVisit.z) > 12) {
      this.lastVisit = { x: this.pos.x, z: this.pos.z };
      visit(this.exploration, this.pos.x, this.pos.z);
      for (const d of depositsNear(this.pos.x, this.pos.z, PROSPECT_RADIUS)) {
        if (!this.prospected.has(d.id)) {
          this.prospected.add(d.id);
          this.say('prospect');
        }
      }
    }
    if (this.map.visible) {
      this.map.update(this.exploration, {
        player: { x: this.pos.x, z: this.pos.z, heading: this.driving ? this.buggy.heading : this.heading },
        lander: this.landerPos,
        buggy: { x: this.buggy.x, z: this.buggy.z },
        stead: this.steadOrigin,
        rig: { x: this.rig.x, z: this.rig.z },
        deposits: [...this.prospected].map(depositById).filter(Boolean),
      });
    }

    // ---- the expedition's slow machines
    if (drillTick(this.rig, dt)) this.sayOnce('drill-first-ore');
    const hopperNow = hopperCount(this.rig);
    if (hopperNow >= HOPPER_CAP && this.prevHopper < HOPPER_CAP) this.say('hopper-full');
    this.prevHopper = hopperNow;
    if (fabTick(this.fab, dt) === 'steel-panel') this.sayOnce('fab-first-steel');
    for (const m of this.machines) {
      if (machineTick(m, dt) === 'steel-panel') this.sayOnce('fab-first-steel');
    }
    this.machineLayer.update(this.machines, this.t);
    this.rigLayer.update(this.rig, meshGroundHeight(this.rig.x, this.rig.z));
    this.rigLayer.syncOre(this.pos.x, this.pos.z, meshGroundHeight);

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
    // the ledger writes itself every so often
    if (this.t - this.lastPersist > 15) {
      this.lastPersist = this.t;
      this.persist();
    }
    this.hud.setClock(
      solClock(this.simMillis),
      `Ls ${solarLongitude(this.simMillis).toFixed(1)}° · ${season(this.simMillis)} · Jezero`,
    );
    this.hud.update(this.t);
  }
}

// the muster book: one visitor beacon per load to the harbourmaster's
// ledger (vercel rewrites /dash/* to the family's EVO door). Fire-and-
// forget — if the ledger is unreachable the game never notices.
(function musterBook() {
  try {
    let pid;
    try {
      pid = localStorage.getItem('marsstead-pid');
      if (!pid) {
        pid = crypto.randomUUID ? crypto.randomUUID()
          : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('marsstead-pid', pid);
      }
    } catch { pid = ''; }
    fetch('/dash/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: 'marsstead', kind: 'visit', pid }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* the muster book only ever undercounts */ }
})();

// boot: the title fronts the save — CONTINUE carries it, NEW LANDING wipes
// it, ?play skips the ceremony (live checks, the dev loop)
loadGame().catch(() => null).then((save) => {
  const start = async (choice) => {
    if (choice === 'new' && save) await clearSave();
    window.marsstead = new Game(choice === 'continue' ? save : null);
  };
  if (new URLSearchParams(location.search).has('play')) {
    start(save ? 'continue' : 'new');
  } else {
    new TitleScreen(save, start);
  }
});
