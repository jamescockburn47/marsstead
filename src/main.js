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
import {
  latLonToWorld, worldToLatLon, HOME, IS_PLACEHOLDER, nearestFeature,
} from './mars.js';
import { meshGroundHeight } from './marschunk.js';
import { sunElevation, sunAzimuth, solClock, solarLongitude, season, ltst } from './marstime.js';
import { frostLineLat, morningFrost } from './frost.js';
import {
  SITES, siteXZ, chainActive, signalStrength, sweepAt,
  serializeMystery, deserializeMystery, ARRIVE_M, SWEEP_M,
} from './marslegends.js';
import { Journal } from './journal.js';
import { PlanetHud } from './planethud.js';
import {
  HERITAGE, heritageXZ, remainingAt, isStripped, recordTake,
  serializeHeritage, deserializeHeritage, SALVAGE_M,
} from './heritage.js';
import { HeritageLayer } from './heritagelayer.js';
import { lightState, surfaceTempC, dayFactor, altitudeLight } from './marslight.js';
import {
  createHopper, loadTank as hopperLoadTank, beginHop, tickHop, TANK_FUEL_KG,
  serializeHopper, deserializeHopper, CRADLE_BUGGY_KG,
} from './hopper.js';
import { ShipLayer } from './shiplayer.js';
import { SledLayer } from './sledlayer.js';
import {
  wardenVerify, loadAuth as loadWardenAuth, saveAuth as saveWardenAuth, isWarden,
  wardenNameCheck,
} from './warden.js';
import { WardenPanel } from './wardenpanel.js';
import { VistaLayer } from './vistalayer.js';
import { HopConsole } from './hopconsole.js';
import { reelAt, shotCam, driveInput } from './attract.js';
import { GlobeLayer } from './globelayer.js';
import { rockiness } from './rocks.js';
import {
  EXPOSURE_BASE, exposureTarget, decideTier, fpsVerdict, median,
  SETTLE_S, WINDOW_S,
} from './gfx.js';
import { buildComposer, resizeComposer, disposeComposer } from './post.js';
import {
  phobosWorld, deimosWorld, earthElongation, marsEqToWorld,
} from './marsheavens.js';
import { tauAt, windAt, cirrusAt, solBase } from './dust.js';
import {
  createPower, tickPower, spend, BUILD_KWH, RECALL_KWH,
  serializePower, deserializePower,
} from './power.js';
import { mtc } from './marstime.js';
import {
  G_MARS, WALK_SPEED, LOPE_SPEED, JUMP_V0, LOPE_HOP_V0,
  fallStep, fallSeverity,
} from './physics.js';
import { TerrainLayer } from './terrain.js';
import { RockLayer } from './rocklayer.js';
import { collidersNear, bumpsNear, bumpHeightAt } from './rocks.js';
import { resolveCircle, buggyDiscs } from './collide.js';
import { SkyDome } from './sky.js';
import { DustLayer } from './dustlayer.js';
import {
  createTrail, appendTrack, serializeTrail, deserializeTrail,
} from './tracks.js';
import {
  createBurrow, plan as planBurrow, cancelPlan as cancelBurrowPlan,
  tick as burrowTick, installRing, isPressurised as burrowPressurised,
  isBedworthy as burrowBedworthy, takeSpoil, warrenReport, handsBusy,
  serialize as serializeBurrow, deserialize as deserializeBurrow,
} from './burrow.js';
import { BurrowConsole } from './burrowconsole.js';
import {
  createRegard, applySignal, noteTalk, decay as regardDecay, tone as regardTone,
  verdict as regardVerdict, serializeRegard, deserializeRegard,
} from './regard.js';
import { WorksConsole } from './worksconsole.js';
import { CrownLayer } from './crownlayer.js';
import { TrackLayer } from './tracklayer.js';
import { WakeLayer } from './wakelayer.js';
import { Colonist } from './colonist.js';
import {
  createBuggy, stepBuggy, deflectBuggy, wheelContactHeight,
  WHEELBASE_F, WHEELBASE_R, recallSeconds, RECALL_MIN_M,
} from './buggy.js';
import { BuggyLayer, TRACK } from './buggylayer.js';
import { Hud } from './hud.js';
import { createLander, available, unboltSeconds, takeOne, remaining, remainingTotal } from './salvage.js';
import {
  ITEMS, SUIT_CAPACITY, ROVER_CAPACITY, createStore, add, canAdd, count,
  remove, transfer, loadLabel, massOf,
} from './inventory.js';
import { suitSay, cleanName, briefFallback } from './vesper.js';
import { moodForEvent, sanitizeState, shouldBark } from './vesperbrain.js';
import { VesperVoice } from './vespervoice.js';
import { canSleep, wakeMillis, bedworthy } from './sleep.js';
import {
  CELL, PART_TYPES, faceKey, parseFaceKey, faceCentre, createStead,
  canPlace, place, removePart, cardinal, cursorFace,
  serialize as steadSerialize, deserialize as steadDeserialize,
} from './build.js';
import {
  snapshotSave, acceptSave, saveGame, loadGame, clearSave, saveWorthy,
} from './save.js';
import { analyse, volumeAtCell, canPressurise, findLeaks } from './pressure.js';
import { SteadLayer, BED_DEPTH } from './steadlayer.js';
import {
  createExploration, visit,
  serialize as fogSerialize, deserialize as fogDeserialize,
} from './explore.js';
import { MarsMap } from './marsmap.js';
import { MiniMap } from './minimap.js';
import { MissionOrders } from './orders.js';
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
import { TouchControls } from './touch.js';
import {
  MACHINE_TYPES, createMachine, canPlaceMachine, machineFeed, machineTick, payableCosts,
  machineTake, machineOutCount,
} from './machines.js';
import { MachineLayer } from './machinelayer.js';
import { LanderConsole } from './console.js';
import { installKiosk } from './kiosk.js';
import { startUpdateCheck } from './update-check.js';

// Harden the page against stray browser gestures (two-finger swipe-back,
// long-press menu, text drag) and take it fullscreen on first interaction —
// then watch the deployed version.json for the "new version — tap to reload"
// toast. Both inherited from the siblings (kiosk.js, update-check.js).
installKiosk();
startUpdateCheck();

const TIME_SCALE = 40;            // one sol ~= 37 real minutes in Phase 0

// the GL renderer string (feeds the software-GL floor in the pure probe)
function glRendererString(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  } catch { return ''; }
}

class Game {
  constructor(save = null, settlerName = '', attract = false) {
    // ATTRACT MODE: the landing page's moving picture — the world runs
    // behind the title, driven by the pure reel (attract.js), sealed:
    // no input, no speech, no HUD, and persist() never fires (booted
    // stays false). The Play choice reloads into a clean real start.
    this.attract = attract;
    // the settler's name: fresh entry at the title door wins; otherwise
    // the save's (applySave); VESPER falls back to "settler" gracefully
    this.settlerName = cleanName(settlerName);
    this.freshLanding = !save; // the first-sol briefing fires only here
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
    // Phobos-light: a faint, cool, FAST-moving second key after dark — a
    // light source that visibly crosses the sky in hours (no shadow; the
    // drama is in the moving highlights, not a second shadow rig)
    this.phobosLight = new THREE.DirectionalLight(0x9fb4d8, 0);
    this.scene.add(this.phobosLight, this.phobosLight.target);

    this.terrain = new TerrainLayer(this.scene);
    this.rocks = new RockLayer(this.scene);
    this.sky = new SkyDome(this.scene);
    this.dust = new DustLayer(this.scene, meshGroundHeight);
    // the permanent trail: the store persists (rides the save); the layer
    // instances the marks near the lens; the wake is dust-as-a-field
    this.trail = createTrail();
    this.trackLayer = new TrackLayer(this.scene);
    this.wake = new WakeLayer(this.scene);
    this.colonist = new Colonist(this.scene, this.renderer);
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
    // (the LanderLayer died with the merge — ShipLayer is the whole home)
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
    this.minimap = new MiniMap();
    this.orders = new MissionOrders();

    // the expedition: the rig sleeps by the lander until it's towed out
    this.rig = createRig(-16, -1, 0.6);
    this.rigLayer = new RigLayer(this.scene);
    this.prospected = new Set(); // deposit ids the ground has admitted to
    this.fab = createFab();      // the lander's ISRU bench
    this.machines = [];          // the built refinery (step 5)
    this.machineLayer = new MachineLayer(this.scene);

    // ---- the Burrow: the underground home (never walked — doctrine 1);
    // the crown is its surface presence, the console is its interior
    this.burrow = createBurrow();
    this.droneCount = 3; // VESPER's hands, deployed from the lander's cargo
    this.crownPos = { x: -4, z: -16 };
    this.crownLayer = new CrownLayer(this.scene, this.crownPos.x, this.crownPos.z, meshGroundHeight);
    this.burrowUI = new BurrowConsole({
      getBurrow: () => this.burrow,
      getDroneCount: () => this.droneCount,
      // the ring is HEAVY: it rides the rover's deck, not the suit — the
      // console accepts it from either, with the rover parked at the crown
      ringCarried: () => count(this.suit, 'airlock-ring') > 0
        || (Math.hypot(this.buggy.x - this.crownPos.x, this.buggy.z - this.crownPos.z) < 9
          && count(this.roverStore, 'airlock-ring') > 0),
      onPlan: (piece, c, d) => {
        if (planBurrow(this.burrow, piece, c, d)) {
          this.sayOnce('dig-start');
          // a plan committed on the heels of a conversation is a plan
          // SHARED — the collaboration-shaped signal, zero tokens
          if (this.t - this.lastTalk < 45) applySignal(this.regard, 'consulted');
        }
      },
      onCancel: (c, d) => cancelBurrowPlan(this.burrow, c, d),
      onInstallRing: () => {
        const fromSuit = count(this.suit, 'airlock-ring') > 0;
        const fromDeck = count(this.roverStore, 'airlock-ring') > 0
          && Math.hypot(this.buggy.x - this.crownPos.x, this.buggy.z - this.crownPos.z) < 9;
        if (!fromSuit && !fromDeck) return;
        if (installRing(this.burrow)) {
          remove(fromSuit ? this.suit : this.roverStore, 'airlock-ring', 1);
          this.say('ring-installed');
        }
      },
      droneCarried: () => count(this.suit, 'drone-frame') > 0,
      onDeployDrone: () => {
        if (count(this.suit, 'drone-frame') < 1 || this.droneCount >= 8) return;
        if (!spend(this.power, BUILD_KWH.drone)) { this.say('no-charge'); return; }
        remove(this.suit, 'drone-frame', 1);
        this.droneCount += 1;
        this.say('drone-deployed');
      },
      getBank: () => (this.grid ? { charge: this.grid.charge, capacity: this.grid.capacity } : null),
      // the recall (the cliff-bottom rule): the hands fetch a stranded
      // buggy home for charge — the planet may cost you, never strand you
      buggyAwayM: () => Math.hypot(this.buggy.x - this.crownPos.x, this.buggy.z - this.crownPos.z),
      recallState: () => this.recall,
      onRecall: () => {
        if (this.recall || this.driving) return;
        const away = Math.hypot(this.buggy.x - this.crownPos.x, this.buggy.z - this.crownPos.z);
        if (away < RECALL_MIN_M) return;
        if (!spend(this.power, RECALL_KWH)) { this.say('no-charge'); return; }
        this.recall = { rem: recallSeconds(away) };
      },
      line: () => this.hud.vesperLine.textContent || '…',
    });
    this.recall = null;
    this.power = createPower();
    this.grid = null; // last tickPower truth — consoles read it
    this.saidPowerLow = false;
    this.worksUI = new WorksConsole({
      getFab: () => this.fab,
      getMachines: () => this.machines,
      getGrid: () => this.grid,
      getForecast: () => {
        const sol = Math.floor(this.simMillis / 88775244);
        return { today: solBase(sol), tomorrow: solBase(sol + 1) };
      },
      line: () => this.hud.vesperLine.textContent || '…',
    });
    this.anchoring = null;       // { t, need } while planting the rig
    this.swayTimer = 0;
    this.prevHopper = 0;

    // ---- STAGE 3: the hopper — the pure craft, its layer, the vista
    // for the arc, and the pad's console. hopper.js owns the numbers.
    this.hopper = createHopper();
    // THE SHIP (2026-07-20, James's call): the lander and the hopper are
    // ONE vehicle — you land flight-ready, fuel willing. Three tanks
    // ride down with you: a few flights from sol one, then the mines
    // and the works must pay for more. hopperBuilt survives in the save
    // for compatibility but is always true — the ship simply exists.
    this.hopperBuilt = true;
    this.hopper.x = this.landerPos.x;
    this.hopper.z = this.landerPos.z;
    this.hopper.fuelKg = 3 * TANK_FUEL_KG;
    // the WORKSHOP HOLD: the bay behind the roll-door — flying salvage
    // home is possible and PRICED: hold mass rides every hop as payload
    this.shipHold = { capacity: 1200, slots: {} };
    // the CARGO SLED: the ground path — towed with H like the rig, free
    // of fuel, slow and honest. You brought one; it starts by the ship.
    this.sled = {
      x: this.landerPos.x - 6.5, z: this.landerPos.z + 3, heading: 0.4,
      hitched: false, store: { capacity: 600, slots: {} },
    };
    this.sledLayer = new SledLayer(this.scene);
    this.hopperLayer = new ShipLayer(this.scene, this.renderer);
    this.vista = new VistaLayer(this.scene, this.terrain.frost);
    this.hopFlight = null;    // visual flight state: { cradle, hidTerrain }
    this._legSquash = 0;      // touchdown suspension impulse, decays parked
    this._scourPulse = 0;     // the landing blast's hanging dust, likewise

    // ---- the signal chain (marslegends): the reason to fly
    this.mystery = deserializeMystery(null);
    this.journalUI = new Journal();
    // the wrist planet: the whole surveyed world, always in the corner
    this.planetHud = new PlanetHud(solarLongitude(this.simMillis));

    // ---- heritage: the old machines, and the cleanup charter
    this.heritage = deserializeHeritage(null);   // { siteId: { itemId: taken } }
    this.heritageLayer = new HeritageLayer(this.scene);
    this.salvaging = null;                        // { site, t, need }
    this._heritageNear = null;
    this._heritageReseat = 0;
    this.reading = null;      // { t, need } while reading the ground
    this.sceneQueue = null;   // { lines, i, nextAt } — a beat's canon plays out
    this._sweepDist = Infinity;
    // the hopper's birth (pads dead 2026-07-20): assembly lives at the
    // ASSEMBLER via the works console; these hooks are shared with it
    const HOP_COSTS = [['steel-panel', 6], ['machine-parts', 4], ['electronics', 2]];
    const hopPool = (id) => count(this.suit, id) + count(this.roverStore, id);
    this.hopCanAssemble = () => {
      const missing = HOP_COSTS.filter(([id, n]) => hopPool(id) < n);
      const listed = HOP_COSTS.map(([id, n]) => `${n} ${id.replace('-', ' ')}`).join(', ');
      return {
        ok: missing.length === 0 && !!this.grid && this.grid.charge >= BUILD_KWH.machine,
        text: `it wants <b>${listed}</b> and ${BUILD_KWH.machine} kWh — `
          + (missing.length ? `short of ${missing.map(([id]) => id.replace('-', ' ')).join(', ')}.`
            : 'all aboard. Light the work.'),
      };
    };
    this.hopAssemble = () => {
      const missing = HOP_COSTS.filter(([id, n]) => hopPool(id) < n);
      if (missing.length || !spend(this.power, BUILD_KWH.machine)) { this.say('no-charge'); return; }
      for (const [id, n] of HOP_COSTS) {
        const fromSuit = remove(this.suit, id, n);
        if (fromSuit < n) remove(this.roverStore, id, n - fromSuit);
      }
      const asm = this.machines.find((m) => m.type === 'assembler');
      this.hopperBuilt = true;
      this.hopper.x = asm ? asm.x + 9 : this.pos.x + 6;
      this.hopper.z = asm ? asm.z + 4 : this.pos.z;
      this.say('hopper-built');
    };
    // every roof you own, for every chart: the way home must always be
    // on the map (James, 2026-07-20)
    // the old machines, for every chart: name, place, and whether the
    // charter's work there is done
    this.heritageFor = () => HERITAGE.map((s) => ({
      ...heritageXZ(s), name: s.name, stripped: isStripped(s, this.heritage),
    }));
    this.homesFor = () => [
      { x: this.crownPos.x, z: this.crownPos.z, label: 'BURROW', glyph: '⌂', colour: '#e8c46a' },
      ...(this.steadOrigin
        ? [{ x: this.steadOrigin.x, z: this.steadOrigin.z, label: 'HAB', glyph: '⌂', colour: '#e8c46a' }]
        : []),
      // (the LANDER row died with the merge — the SHIP mark carries it)
    ];
    this.hopUI = new HopConsole({
      getHopper: () => this.hopper,
      getHome: () => this.crownPos,
      homes: () => this.homesFor(),
      heritage: () => this.heritageFor(),
      holdMass: () => massOf(this.shipHold),
      season: () => solarLongitude(this.simMillis),
      buggyNear: () => Math.hypot(this.buggy.x - this.hopper.x, this.buggy.z - this.hopper.z) < 12,
      tanksCarried: () => count(this.suit, 'methane-tank') + count(this.roverStore, 'methane-tank'),
      onLoadTank: () => {
        if (this.hopper.fuelKg >= 6 * 110) return;
        if (remove(this.suit, 'methane-tank', 1) || remove(this.roverStore, 'methane-tank', 1)) {
          hopperLoadTank(this.hopper);
        }
      },
      onIgnite: (tx, tz, cradle) => this.igniteHop(tx, tz, cradle),
      getBank: () => (this.grid ? { charge: this.grid.charge, capacity: this.grid.capacity } : null),
      line: () => this.hud.vesperLine.textContent || '…',
    });

    // ---- THE WARDEN: the family admin mark (warden.js). ?warden=<key>
    // claims it once (the key is stripped from the URL immediately),
    // ?warden=off renounces, F9 opens the bench. A cheat code, not
    // security — see warden.js's header.
    this.wardenAuth = loadWardenAuth(localStorage);
    try {
      const q = new URLSearchParams(location.search);
      const wk = q.get('warden');
      if (wk !== null) {
        q.delete('warden');
        const qs = q.toString();
        history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
        if (wk === 'off') { saveWardenAuth(localStorage, null); this.wardenAuth = null; }
        else {
          wardenVerify(wk).then((ok) => {
            if (!ok) return;
            this.wardenAuth = { warden: true };
            saveWardenAuth(localStorage, this.wardenAuth);
          });
        }
      }
    } catch { /* odd embeds without URL games — the mark just isn't claimed */ }
    this.wardenUI = new WardenPanel({
      fillBags: () => {
        for (const id of Object.keys(ITEMS)) {
          this.suit.slots[id] = 24;
          this.roverStore.slots[id] = 48;
        }
      },
      fullCharge: () => {
        const cap = this.grid ? this.grid.capacity : 12;
        this.power.charge = cap;
        if (this.grid) this.grid.charge = cap;
      },
      refit: () => { this.air = 1; this.warm = 1; },
      // the attract reel's yard, raised for real — same shape, same spots
      raiseWorks: () => {
        const A = this.crownPos;
        for (const [type, dx, dz, h] of [
          ['solar-array', 10, 5, 0.4], ['solar-array', 13.5, 7, 0.4],
          ['battery', 9, 9, 0.2], ['smelter', -9, 7, 2.6],
          ['mill', -13, 3, 2.2], ['assembler', -10, 12, 1.9],
        ]) {
          const x = A.x + dx, z = A.z + dz;
          if (!this.machines.some((m) => m.type === type && Math.hypot(m.x - x, m.z - z) < 1)) {
            this.machines.push(createMachine(type, x, z, h));
          }
        }
        this.machineLayer.sync(this.machines, meshGroundHeight);
      },
      raiseHopper: () => {
        // the ship always exists now: the refit just fills the rack
        this.hopper.fuelKg = 6 * TANK_FUEL_KG;
      },
      digBurrow: () => {
        const stage = (piece, c, d) => {
          planBurrow(this.burrow, piece, c, d);
          burrowTick(this.burrow, 999, 4);
        };
        stage('shaft', 0, 1); installRing(this.burrow);
        stage('corridor', 1, 1); stage('corridor', -1, 1);
        stage('bunk', 2, 1); stage('store', -2, 1);
        stage('shaft', 0, 2); stage('corridor', 1, 2); stage('garden', 2, 2);
      },
      setHour: (h) => this.calibrateToLocalHour(h),
      sites: () => [
        { id: 'crown', label: 'THE CROWN — home' },
        { id: 'lander', label: 'THE LANDER' },
        { id: 'arctic', label: 'THE ARCTIC — 18 km north' },
        { id: 'evening', label: 'EVENING COUNTRY — 12 km east' },
      ],
      teleport: (id) => {
        const S = {
          crown: { x: this.crownPos.x + 4, z: this.crownPos.z + 6 },
          lander: { x: this.landerPos.x + 5, z: this.landerPos.z + 3 },
          arctic: { x: this.crownPos.x, z: this.crownPos.z - 18000 },
          evening: { x: this.crownPos.x + 12000, z: this.crownPos.z },
        }[id];
        if (!S) return;
        this.pos.x = S.x; this.pos.z = S.z;
        this.vy = 0;
        if (this.driving) {
          this.buggy.x = S.x + 3; this.buggy.z = S.z;
          this.buggy.u = 0; this.buggy.v = 0;
        }
        this.wardenUI.close();
      },
      renounce: () => { saveWardenAuth(localStorage, null); this.wardenAuth = null; },
    });

    // the suit
    this.air = 1; this.warm = 1;
    this.saidCounts = {}; this.lamp = false;
    this.lampMode = 'auto'; this.lampLit = false; // auto: dusk switches them
    this.idleTimer = 0; this.saidFirsts = new Set();

    // VESPER's voice and ears — the audio layer over the canned floor.
    // Session-only history: live speech is the authored non-deterministic
    // thing (invariant 4) and it does not ride the save.
    this.vesperHistory = [];
    this.lastTalk = -Infinity; // game-time of the last live exchange
    // the hidden partnership score (OVERVIEW §6): rides the save, never
    // the screen — warmth in her voice and a seasonal Review, nothing else
    this.regard = createRegard();
    this.pendingVesperQuestion = false;
    this.lastSeason = null;
    this.lastRegardSol = 0;
    this.voice = new VesperVoice({ onTranscript: (t) => this.talkToVesper(t) });

    // ---- the text channel: ENTER opens a line to VESPER, typed words ride
    // the same road as spoken ones (talkToVesper — history, rapport, relay)
    this.chatBar = document.createElement('input');
    this.chatBar.id = 'vesperchat';
    this.chatBar.maxLength = 240;
    this.chatBar.placeholder = 'say something to VESPER — ENTER sends · ESC closes';
    this.chatBar.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);'
      + 'width:min(560px,80vw);padding:10px 14px;display:none;z-index:50;'
      + 'font-family:Georgia,serif;font-size:14px;letter-spacing:1px;text-align:center;'
      + 'color:#f6ede2;background:rgba(20,11,7,.92);outline:none;border-radius:4px;'
      + 'border:1px solid rgba(232,196,106,.55);';
    document.body.appendChild(this.chatBar);
    this.chatBar.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing is not piloting
      if (e.key === 'Enter') {
        const text = this.chatBar.value.trim();
        this.chatBar.value = '';
        this.chatBar.style.display = 'none';
        this.chatBar.blur();
        if (text) { this.hud.say(`(you) ${text}`, this.t, 4); this.talkToVesper(text); }
      } else if (e.key === 'Escape') {
        this.chatBar.value = '';
        this.chatBar.style.display = 'none';
        this.chatBar.blur();
      }
    });

    this.keys = {};
    addEventListener('keydown', (e) => {
      if (this.attract) return;      // the reel takes no requests
      if (document.activeElement === this.chatBar) return; // words, not verbs
      if (e.key === 'Enter' && !this.buildMode && !this.map.visible) {
        this.chatBar.style.display = 'block';
        this.chatBar.focus();
        return;
      }
      this.keys[e.code] = true; this.voice.poke(); this.devKeys(e);
    });
    addEventListener('keyup', (e) => {
      if (document.activeElement === this.chatBar) return;
      this.keys[e.code] = false;
      if (e.code === 'KeyV') { this.voice.stopListening(); this.hud?.setEar(false); }
    });
    let dragging = false;
    addEventListener('mousedown', () => { if (!this.attract) dragging = true; });
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
      if (this.post) resizeComposer(this.post, innerWidth, innerHeight, this.renderer.getPixelRatio());
    });

    if (save) this.applySave(save);
    // the name-as-key door (James, 2026-07-20): a settler named with the
    // warden key IS the warden — the mark rides the save itself, so it
    // survives any browser, any device, any cleared storage
    wardenNameCheck(this.settlerName).then((ok) => {
      if (ok) this.wardenAuth = { warden: true };
    });
    if (this.attract) this.enterAttract(); // stage the demo set, hide the HUD
    this.booted = !this.attract; // until now, persist() must stay silent — a page
    // interrupted mid-boot must never write half-applied state over a
    // good save (the unload handlers below register with the page alive)
    this.lastPersist = 0;
    // best-effort parting save: the planet keeps what it was given
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist();
    });
    addEventListener('beforeunload', () => this.persist());

    // ---- the graphics rig: the pure probe decides the opening tier
    // (?gfx=fine|plain overrides, for the dev loop and the shot rig)
    const urlGfx = new URLSearchParams(location.search).get('gfx');
    let storedGfx = null;
    try { storedGfx = localStorage.getItem('marsstead-gfx'); } catch { /* private mode */ }
    this.gfxManual = urlGfx === 'fine' || urlGfx === 'plain'
      || storedGfx === 'fine' || storedGfx === 'plain';
    this.gfxWatch = { t: 0, frames: [], span: 0, pixelDropped: false };
    this.post = null;
    const gfxSig = {
      stored: urlGfx || storedGfx,
      touchPrimary: matchMedia('(pointer: coarse)').matches,
      webgpu: null,
      rendererStr: glRendererString(this.renderer),
      deviceMemory: navigator.deviceMemory ?? null,
      cores: navigator.hardwareConcurrency ?? null,
    };
    this.applyQuality(decideTier(gfxSig).tier);
    // the async half of the probe: the WebGPU adapter answers late
    if (!this.gfxManual && navigator.gpu?.requestAdapter) {
      navigator.gpu.requestAdapter().then((a) => {
        this.applyQuality(decideTier({ ...gfxSig, webgpu: !!a }).tier);
      }).catch(() => { /* the optimistic opening stands */ });
    }

    // touch-screen controls: an input adapter over the same key bus and
    // orbit camera the keyboard/mouse feed (phones and tablets; ?touch
    // forces it for the dev loop)
    this.touch = new TouchControls(this);
    this.touch.sync();

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
    if (s.steadBaseY !== null && s.stead.length) {
      this.stead = steadDeserialize(s.stead);
      // RE-SEAT on load (2026-07-20): baseY re-derives from the CURRENT
      // ground at the stead's own origin, exactly as a first build
      // would — so no ground-law evolution can ever bury or float a
      // saved hab. The saved value only stands if the origin was lost.
      this.steadBaseY = s.steadOrigin
        ? meshGroundHeight(s.steadOrigin.x, s.steadOrigin.z) - BED_DEPTH
        : s.steadBaseY;
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
    this.trail = deserializeTrail(s.trail); // the old marks still stand
    this.burrow = deserializeBurrow(s.burrow); // the warren keeps its shape
    this.restedQ = s.restedQ; this.restedUntil = s.restedUntil;
    this.power = deserializePower(s.power); // the bank remembers its charge
    this.droneCount = s.drones || 3;        // the fleet you commissioned
    if (!this.settlerName) this.settlerName = s.settlerName || '';
    // she remembers: the last exchanges and the count of talks ride the
    // save, so rapport survives the browser closing
    if (Array.isArray(s.vesperLog) && s.vesperLog.length) this.vesperHistory = s.vesperLog;
    this.talks = s.talks || 0;
    this.regard = deserializeRegard(s.regard); // the pairing, as it stood
    this.hopper = deserializeHopper(s.hopper); // the craft, where it stood
    // the ship always exists now; a pre-merge save wakes with the ship
    // beside the hull and grace fuel for the new life it never had
    this.hopperBuilt = true;
    if (!s.hopperBuilt) {
      this.hopper.x = this.landerPos.x;
      this.hopper.z = this.landerPos.z;
      this.hopper.fuelKg = Math.max(this.hopper.fuelKg, 2 * TANK_FUEL_KG);
    }
    // ONE VEHICLE, one anchor, wherever the save left it
    this.landerPos.x = this.hopper.x;
    this.landerPos.z = this.hopper.z;
    this.shipHold.slots = s.shipHold || {};
    if (s.sled) {
      this.sled.x = s.sled.x; this.sled.z = s.sled.z;
      this.sled.heading = s.sled.heading;
      this.sled.store.slots = s.sled.slots || {};
    } else {
      // an older save never owned a sled: it waits by the ship
      this.sled.x = this.landerPos.x - 6.5;
      this.sled.z = this.landerPos.z + 3;
    }
    this.mystery = deserializeMystery(s.mystery); // the chain, as far as it got
    this.heritage = deserializeHeritage(s.heritage); // the hauls already carried home
    // logs already recovered never re-announce
    this._hadRecord = Object.fromEntries(HERITAGE
      .filter((hs) => hs.record && this.heritage[hs.id]).map((hs) => [hs.id, true]));
    if (s.inLander) this.enterLander(); // saved aboard, wake aboard
  }

  // fire-and-forget: a failed save must never cost a frame, let alone a run
  persist() {
    if (this.hopFlight) return; // mid-air is no place to write history
    if (this.resetting || !this.booted) return; // never resurrect a wiped
    // slate; never write from a page that hasn't fully woken up
    if (!saveWorthy(this)) return; // a poisoned clock or walker must never
    // overwrite a good save — acceptSave would discard it all on boot
    saveGame(snapshotSave({
      simMillis: this.simMillis,
      pos: this.pos, heading: this.heading,
      air: this.air, warm: this.warm,
      // a recall in flight collapses to its arrival (refresh is never a
      // rescue, and the charge is already spent — the tow just finishes)
      buggy: this.recall
        ? { ...this.buggy, x: this.crownPos.x + 7, z: this.crownPos.z + 6, u: 0, v: 0 }
        : this.buggy,
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
      rig: this.recall && this.rig.hitched
        ? { ...this.rig, x: this.crownPos.x + 3.6, z: this.crownPos.z + 6 }
        : this.rig,
      prospected: this.prospected,
      fab: this.fab,
      machines: this.machines,
      trail: serializeTrail(this.trail),
      burrow: serializeBurrow(this.burrow),
      restedQ: this.restedQ || 0,
      restedUntil: this.restedUntil || 0,
      power: serializePower(this.power),
      drones: this.droneCount,
      settlerName: this.settlerName,
      vesperLog: this.vesperHistory.slice(-6),
      talks: this.talks || 0,
      regard: serializeRegard(this.regard),
      hopper: serializeHopper(this.hopper),
      hopperBuilt: !!this.hopperBuilt,
      mystery: serializeMystery(this.mystery),
      heritage: serializeHeritage(this.heritage),
      shipHold: this.shipHold.slots,
      sled: {
        x: this.sled.x, z: this.sled.z, heading: this.sled.heading,
        slots: this.sled.store.slots,
      },
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
    if (e.code === 'F9' && isWarden(this.wardenAuth)) this.wardenUI.toggle();
    if (e.code === 'KeyJ') this.journalUI.toggle(this.mystery, this.heritage);
    if (e.code === 'KeyM') this.map.toggle();
    if (e.code === 'KeyO') this.orders.toggle();
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
    // V outside build mode: push-to-talk — hold to speak to VESPER
    if (e.code === 'KeyV' && !this.buildMode && !e.repeat) {
      if (this.voice.startListening()) {
        this.hud.setEar(true);
        this.lastTalk = this.t; // conversation takes the channel
      }
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
    const tau = tauAt(mtc(this.simMillis), Math.floor(this.simMillis / 88775244));
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
    // one pin, one trailer: whichever is on it comes off first
    if (this.rig.hitched) { this.rig.hitched = false; return; }
    if (this.sled.hitched) { this.sled.hitched = false; return; }
    if (!this.driving) return;
    const pin = this.hitchPin();
    const dRig = this.rig.deployed ? Infinity
      : Math.hypot(pin.x - this.rig.x, pin.z - this.rig.z);
    const dSled = Math.hypot(pin.x - this.sled.x, pin.z - this.sled.z);
    if (Math.min(dRig, dSled) >= 4.5) return;
    if (dSled <= dRig) this.sled.hitched = true;
    else this.rig.hitched = true;
    this.sayOnce('hitch');
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
    const bits = [];
    if (o) bits.push(`${o} ready`);
    if (q) bits.push(`${q} cooking`);
    // the bench always announces itself — an empty-handed settler learns
    // what it EATS instead of walking past a silent door
    if (!q && !o && !carryRaw) return ' · |*T| fabricator (feed it iron ore → steel panels)';
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

  // ---- STAGE 3: ignition and the staged flight ----------------------------
  igniteHop(tx, tz, cradle) {
    // payload is honest: the cradled buggy AND everything in the hold
    const payload = (cradle ? CRADLE_BUGGY_KG : 0) + massOf(this.shipHold);
    const from = [this.hopper.x, this.hopper.z];
    if (!beginHop(this.hopper, from, [tx, tz], payload)) return;
    this.sled.hitched = false; // the sled is ground kit — it stays
    this.vista.build(from, this.hopper.hop.to);
    this.hopFlight = { cradle, hidTerrain: false, landedSettling: false };
    this.colonist.group.visible = false;
    if (cradle) this.buggyLayer.group.visible = false;
    this._preHopFar = this.cam.far;   // hand the depth budget back on landing
    this.cam.far = 600000;
    this.cam.updateProjectionMatrix();
    this.say('hop-ignition');
  }

  // one frame of the flight: the pure module dictates, the layers obey.
  // Returns the altitude (m) for the light ladder, or 0 when not flying.
  frameFlight(dt) {
    if (!this.hopper.hop && !this.hopFlight) return 0;
    const F = this.hopFlight;
    const snap = this.hopper.hop ? tickHop(this.hopper, dt)
      : {
        phase: 'landed', prog: 1, alt: 0, x: this.hopper.x, z: this.hopper.z,
        burn: 0, shake: 0, scour: 0, touchdown: false,
      };
    const groundY = meshGroundHeight(snap.x, snap.z);
    // the settler rides: pos IS the craft; inputs are dead weight.
    // The shake channel trembles the whole shot — craft, camera, world —
    // by jittering the one position everything hangs from (deterministic:
    // sines of the sim clock, never Math.random)
    const sh = (snap.shake || 0) * 0.14;
    const jx = sh * Math.sin(this.t * 23.7), jy = sh * 0.7 * Math.sin(this.t * 31.3);
    const jz = sh * Math.sin(this.t * 27.1 + 1.7);
    this.pos.set(snap.x + jx, groundY + snap.alt + jy, snap.z + jz);
    this.vel.set(0, 0, 0); this.vy = 0; this.airborne = false;
    const H = this.hopper.hop;
    const heading = H ? Math.atan2(H.to[0] - H.from[0], H.to[1] - H.from[1]) : 0;
    const lean = snap.phase === 'ascent' ? 0.1 : snap.phase === 'descent' ? -0.08 : 0;
    this.hopperLayer.setPose(snap.x + jx, groundY + snap.alt + jy, snap.z + jz, heading, lean);
    this.hopperLayer.setFuel(this.hopper.fuelKg);
    // the drama channels are the pure module's word: throttle and scour
    this.hopperLayer.setFlame(snap.burn, this.t);
    this.hopperLayer.setScour(snap.x, groundY, snap.z, snap.scour, this.t);
    // the hold-down compresses the legs under full thrust; settle rides soft
    this.hopperLayer.setSquash(snap.phase === 'ignition' ? snap.burn * 0.55
      : snap.phase === 'settle' ? 0.15 : 0);
    // the vista swap: streamed ground hides above the haze (or above half
    // the apex on a short lob — the streamer must never chase the track),
    // returns below
    const swapAlt = Math.min(1200, (H ? H.apexM : 1200) * 0.55);
    if (snap.alt > swapAlt && !F.hidTerrain) {
      F.hidTerrain = true;
      this.terrain.setVisible(false);
      this.rocks.setVisible(false);
      this.vista.setVisible(true);
      if (this.vista.mesh) this.vista.mesh.position.y = -3; // ducks under real chunks
      this.say('hop-crest');
    }
    if (snap.alt <= swapAlt && F.hidTerrain
      && (snap.phase === 'descent' || snap.phase === 'settle' || snap.phase === 'landed')) {
      F.hidTerrain = false;
      this.terrain.setVisible(true);
      this.rocks.setVisible(true);
    }
    // the camera: authored per phase — in CLOSE for the hold-down (the
    // fire building under a still craft is the shot), pulled back with
    // altitude on the rise, back in tight for the settle
    const wantDist = snap.phase === 'ignition' ? 9.5
      : snap.phase === 'ascent' ? 13 + Math.min(120, snap.alt * 0.055)
        : snap.phase === 'arc' ? 26
          : snap.phase === 'settle' ? 13 : 18;
    this.camDist += (wantDist - this.camDist) * Math.min(1, dt * 1.2);
    const wantPitch = snap.phase === 'ignition' ? 0.18
      : snap.phase === 'arc' ? 0.5 : snap.phase === 'settle' ? 0.26 : 0.34;
    this.camPitch += (wantPitch - this.camPitch) * Math.min(1, dt * 0.8);
    this.camYaw += dt * (snap.phase === 'ignition' ? 0.1 : 0.045);
    if (snap.phase === 'landed') {
      // touchdown: the world hands back — with a THUMP: the legs take
      // the hit and spring back, the blast's dust hangs a moment
      this.hopFlight = null;
      this._legSquash = 1;
      this._scourPulse = 1;
      this.colonist.group.visible = true;
      this.pos.set(this.hopper.x + 3.2, 0, this.hopper.z + 2.4);
      this.pos.y = meshGroundHeight(this.pos.x, this.pos.z);
      this.hopperLayer.setPlaced(this.hopper.x, this.hopper.z,
        meshGroundHeight(this.hopper.x, this.hopper.z) + 0.1, heading);
      this.hopperLayer.setFlame(0, this.t);
      // the whole homestead-on-legs has MOVED: everything anchored to
      // the ship (the bench, the cabin, the shelter rule, the spare
      // skin, the maps) follows the one anchor
      this.landerPos.x = this.hopper.x;
      this.landerPos.z = this.hopper.z;
      if (F.cradle) {
        this.buggy.x = this.hopper.x - 4.2; this.buggy.z = this.hopper.z + 3.5;
        this.buggy.u = 0; this.buggy.v = 0;
        this.buggyLayer.group.visible = true;
      }
      this.camDist = 7;
      this.cam.far = this._preHopFar || 6000;
      this.cam.updateProjectionMatrix();
      this.say('hop-landed');
      this.persist();
      return 0;
    }
    return snap.alt;
  }

  // ---- ATTRACT: the landing page's moving picture -------------------------
  // Stage a lived settlement in memory (persist never fires in attract)
  // and find the night drive its boulder ridge. Called once, at boot.
  enterAttract() {
    document.querySelector('#hud')?.style.setProperty('display', 'none');
    this.colonist.group.visible = false;
    // the warren below (the crown's lantern wants a living home)
    const stage = (piece, c, d) => {
      planBurrow(this.burrow, piece, c, d);
      burrowTick(this.burrow, 999, 4);
    };
    stage('shaft', 0, 1); installRing(this.burrow);
    stage('corridor', 1, 1); stage('corridor', -1, 1);
    stage('bunk', 2, 1); stage('store', -2, 1);
    stage('shaft', 0, 2); stage('corridor', 1, 2); stage('garden', 2, 2);
    // the works and the pad, arranged as a yard around the crown
    const A = this.crownPos;
    this.attractAnchor = { x: A.x, z: A.z };
    const put = (type, dx, dz, h) => {
      this.machines.push(createMachine(type, A.x + dx, A.z + dz, h));
    };
    put('solar-array', 10, 5, 0.4); put('solar-array', 13.5, 7, 0.4);
    put('battery', 9, 9, 0.2); put('smelter', -9, 7, 2.6);
    put('mill', -13, 3, 2.2); put('assembler', -10, 12, 1.9);
    this.machineLayer.sync(this.machines, meshGroundHeight);
    this.hopperBuilt = true;
    this.hopper.x = A.x + 21; this.hopper.z = A.z - 9;
    this.hopper.fuelKg = 4 * 110;
    // the drive shot wants the rockiest country within reach
    let best = { r: -1, x: A.x + 300, z: A.z + 220 };
    for (let x = -700; x <= 700; x += 70) {
      for (let z = -700; z <= 700; z += 70) {
        const rr = rockiness(A.x + x, A.z + z);
        if (rr > best.r) best = { r: rr, x: A.x + x, z: A.z + z };
      }
    }
    this.attractDriveAt = best;
    // the buggy parks in the yard for the stead shot (the drive shot
    // re-seats it at the ridge each pass)
    this.buggy = createBuggy(A.x + 7, A.z + 15, 2.3);
    // the descent's vista, built ONCE and WORLD-WIDE (one full E-W wrap:
    // no square edge can show) — rebuilding a far-field every loop pass
    // is a visible stall; in attract it only ever toggles
    this.vista.build([A.x, A.z], [A.x, A.z], { world: true });
    if (this.vista.mesh) {
      this.vista.mesh.position.y = -3;
      this.vista.setVisible(false);
    }
    // the whole planet, for the opening shot: the globe turning in the
    // black, parked far beneath the flat world's stage
    this.globe = new GlobeLayer(this.scene, solarLongitude(this.simMillis));
    this.globe.setPlaced(A.x, -120000, A.z);
    // the cut veil: every shot change happens behind it
    this.attractVeil = document.createElement('div');
    this.attractVeil.style.cssText = 'position:fixed;inset:0;z-index:59;'
      + 'background:#0c0604;pointer-events:none;opacity:1;';
    document.body.appendChild(this.attractVeil);
    this.attractT = 0;
    this.attractShotId = '';
  }

  // one frame of the reel: the pure table dictates the clock, the
  // weather, the camera and the drive — this merely applies them
  frameAttract(dt) {
    this.attractT += dt;
    const { shot, k, veil } = reelAt(this.attractT);
    const A = this.attractAnchor;
    if (shot.id !== this.attractShotId) {
      this.attractShotId = shot.id;
      this.calibrateToLocalHour(shot.hour);
      this.attractTau = shot.tau;
      if (shot.id === 'drive') {
        const D = this.attractDriveAt;
        this.buggy = createBuggy(D.x, D.z, 1.15);
      }
    }
    this.air = 1; this.warm = 1;                  // the reel never suffocates
    const target = shot.id === 'drive'
      ? [this.buggy.x, this.buggy.z, this.buggy.heading] : null;
    const c = shotCam(shot.id, k, target);
    this.hopAlt = c.alt;                          // the light ladder reads this
    // visibility is DECLARATIVE, every frame — the reel loops and skips
    // (the shot rig jumps the clock); event-edges desync, states cannot.
    // The vista and the globe were built once at enterAttract: toggles only.
    const wantGlobe = shot.id === 'planet';
    const wantVista = shot.id === 'descent' && c.alt >= 1000;
    const wantFar = (wantVista || wantGlobe) ? 600000 : 6000;
    if (this.cam.far !== wantFar) {
      this.cam.far = wantFar;
      this.cam.updateProjectionMatrix();
    }
    this.terrain.setVisible(!wantVista && !wantGlobe);
    this.rocks.setVisible(!wantVista && !wantGlobe);
    if (this.vista.mesh) this.vista.setVisible(wantVista);
    if (this.globe) this.globe.setVisible(wantGlobe);
    // the night drive: scripted hands on a real wheel — and the LAYER
    // posed here too (the on-foot/driving frames that normally pose it
    // never run under the reel)
    if (shot.id === 'drive') {
      const input = driveInput(k);
      const e = 0.7;
      const total = Math.min(dt, 0.1);
      const n = Math.max(1, Math.ceil(total / (1 / 120)));
      for (let i = 0; i < n; i++) {
        const bx = this.buggy.x, bz = this.buggy.z;
        const wg = this.wheelGround(bx, bz, this.buggy.heading);
        stepBuggy(this.buggy, input, {
          h: wg.h, wh: wg.wh, at: wg.at,
          gx: (meshGroundHeight(bx + e, bz) - meshGroundHeight(bx - e, bz)) / (2 * e),
          gz: (meshGroundHeight(bx, bz + e) - meshGroundHeight(bx, bz - e)) / (2 * e),
        }, total / n);
      }
    }
    this.buggyLayer.update(dt, this.buggy,
      { skidF: false, skidR: false, airborne: false, landed: false });
    // the camera, applied rigid; streaming follows the camera's ground
    if (c.globe) {
      const G = this.globe.centre;
      this.cam.position.set(G.x + c.cam[0], G.y + c.cam[1], G.z + c.cam[2]);
      this.cam.lookAt(G.x, G.y, G.z);
      this.pos.set(A.x, 0, A.z);
      this.pos.y = meshGroundHeight(A.x, A.z);
      this.vel.set(0, 0, 0); this.vy = 0;
      this.attractVeil.style.opacity = veil.toFixed(3);
      return;
    }
    const wx = c.world ? c.cam[0] : A.x + c.cam[0];
    const wz = c.world ? c.cam[2] : A.z + c.cam[2];
    const lx = c.world ? c.look[0] : A.x + c.look[0];
    const lz = c.world ? c.look[2] : A.z + c.look[2];
    this.cam.position.set(wx, meshGroundHeight(wx, wz) + c.cam[1], wz);
    this.cam.lookAt(lx, meshGroundHeight(lx, lz) + c.look[1], lz);
    // the streamer follows the CAMERA's ground point (dolly-speed slow) —
    // never the look point, which can race kilometres in a single shot
    this.pos.set(wx, 0, wz);
    this.pos.y = meshGroundHeight(wx, wz);
    this.vel.set(0, 0, 0); this.vy = 0;
    this.attractVeil.style.opacity = veil.toFixed(3);
  }

  // the flight's frame: the pure phase machine dictates position; the
  // camera rides authored curves; the settler's inputs are dead weight
  frameFlying(dt) {
    this.hopAlt = this.frameFlight(dt);
    const co = new THREE.Vector3(
      Math.sin(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
      this.camDist * Math.sin(this.camPitch) + 2.4,
      Math.cos(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
    ).add(this.pos);
    // rigid, never lerped: the craft moves kilometres a second — a lagged
    // camera turns the star of the shot into a speck
    this.cam.position.copy(co);
    this.cam.lookAt(this.pos.x, this.pos.y + 1.2, this.pos.z);
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
    if (this.hopFlight) return; // nothing to do but ride
    if (this.burrowUI.visible) { this.burrowUI.close(); return; }
    if (this.worksUI.visible) { this.worksUI.close(); return; }
    if (this.hopUI.visible) { this.hopUI.close(); return; }
    // the sweep's heart: reading the ground IS the act of the chain
    if (!this.inLander && !this.driving && this.activeSignal
      && this._sweepDist < SWEEP_M && !this.reading) {
      this.reading = { t: 0, need: 4 };
      return;
    }
    // the old machines: the cleanup charter's own act
    if (!this.inLander && !this.driving && this._heritageNear
      && this._heritageNear.d < SALVAGE_M && !this.salvaging
      && !isStripped(this._heritageNear.site, this.heritage)) {
      this.salvaging = { site: this._heritageNear.site, t: 0, need: 4.5 };
      return;
    }
    // the craft is its own console — an open-ground landing must NEVER
    // strand the ship: E beside the hopper opens its brain anywhere.
    // The BUGGY outranks it when it is the nearer machine (a released
    // cradle parks inside the hopper's ring — driving off must be one E)
    {
      const dHop = Math.hypot(this.hopper.x - this.pos.x, this.hopper.z - this.pos.z);
      if (!this.inLander && !this.driving && this.hopperBuilt && !this.hopFlight
        && dHop < 7 && !(this.distToRover() < 3.2 && this.distToRover() < dHop)) {
        this.hopUI.open();
        return;
      }
    }
    if (!this.inLander && !this.driving
      && (this.nearestMachine() || this.distToLander() < 6) && this.distToLadder() >= 3.6
      && this.distToRover() >= 3.2 && this.distToCrown() >= 4
      && !(this.distToLander() < 6 && this.salvageTarget())) {
      this.worksUI.open();
      return;
    }
    if (!this.inLander && !this.driving && this.distToCrown() < 4) {
      this.burrowUI.open();
      this.sayOnce('crown-first');
      return;
    }
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
  // F/G route to the NEAREST open store: the buggy's deck, the sled's
  // bed, or the ship's workshop hold — one pair of keys, three mouths
  nearestStore() {
    const options = [
      { store: this.roverStore, d: this.distToRover(), max: 4 },
      { store: this.sled.store, d: this.distToSled(), max: 4 },
      { store: this.shipHold, d: this.distToLander(), max: 8 },
    ].filter((o) => o.d <= o.max).sort((a, b) => a.d - b.d);
    return options[0] ? options[0].store : null;
  }

  distToSled() {
    return Math.hypot(this.pos.x - this.sled.x, this.pos.z - this.sled.z);
  }

  // where the settler actually STANDS (2026-07-20): inside a named
  // feature you are IN it; outside, you are near the closest one — the
  // clock line follows the boots, not the landing site
  placeName() {
    const f = nearestFeature(this.pos.x, this.pos.z);
    if (!f) return 'the open country';
    const d = Math.hypot(f.x - this.pos.x, f.z - this.pos.z);
    // world metres per real km ≈ 4.99 (M_PER_DEG / deg-km); the feature's
    // own footprint decides "in" vs "near"
    const radW = Math.max(60, (f.diamKm * 4.99) / 2);
    return d <= radW ? f.name : `near ${f.name}`;
  }

  loadRover() {
    if (this.driving) return;
    const store = this.nearestStore();
    if (!store) return;
    for (const id of Object.keys(this.suit.slots)) {
      transfer(this.suit, store, id, 99);
    }
  }
  // G: take the heaviest thing back off the store the suit can hold
  unloadRover() {
    if (this.driving) return;
    const store = this.nearestStore();
    if (!store) return;
    const ids = Object.keys(store.slots)
      .sort((a, b) => ITEMS[b].kg - ITEMS[a].kg);
    for (const id of ids) {
      if (transfer(store, this.suit, id, 1) > 0) return;
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
  distToCrown() {
    return Math.hypot(this.pos.x - this.crownPos.x, this.pos.z - this.crownPos.z);
  }

  sheltered() {
    return this.distToLander() < 7
      || (this.insidePressurised && bedworthy(this.insideVolume))
      || (burrowBedworthy(this.burrow) && this.distToCrown() < 7);
  }

  // ---- building --------------------------------------------------------

  // the catalogue Q cycles: face parts first, then the machines
  buildablePart() {
    const types = [...Object.keys(PART_TYPES), ...Object.keys(MACHINE_TYPES)];
    return types[((this.buildSel % types.length) + types.length) % types.length];
  }

  isMachine(type) { return !!MACHINE_TYPES[type]; }

  // machines may take a salvage alternative (a wreck's solar wing IS an
  // array): show and spend the payable list, falling back to the base
  costsOf(type) {
    if (this.isMachine(type)) {
      return payableCosts(type, (id) => count(this.suit, id)) ?? MACHINE_TYPES[type].costs;
    }
    return PART_TYPES[type].costs;
  }

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
    // the nanofab spends the bank: structure IS charge (the currency rule)
    if (!spend(this.power, BUILD_KWH.machine)) { this.say('no-charge'); return; }
    for (const [id, n] of this.costsOf(type)) remove(this.suit, id, n);
    this.machines.push(createMachine(type, x, z, this.camYaw));
    this.machineLayer.sync(this.machines, meshGroundHeight);
    // a bench raised on the heels of a conversation: a plan shared
    if (this.t - this.lastTalk < 45) applySignal(this.regard, 'consulted');
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
    if (!spend(this.power, BUILD_KWH.steadPart)) { this.say('no-charge'); return; }
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
    // where you sleep matters: the warren's shelter score follows you out
    this.sleepingBelow = burrowBedworthy(this.burrow) && this.distToCrown() < 7;
    this.sleepAnim = { t: 0, wake, jumped: false };
    this.say('sleep');
    this.hud.setVeil(1);
    this.steadLayer.showGhost(null);
    this.steadLayer.clearLeaks();
    this.machineLayer.showGhost(null);
  }

  say(event) {
    if (this.attract) return; // the reel is silent — no barks, no relay
    // ambience yields to conversation (safety and feedback always land)
    if (!shouldBark(event, this.t - this.lastTalk)) return;
    const n = this.saidCounts[event] || 0;
    this.saidCounts[event] = n + 1;
    // the instrument channel: instant, deterministic, relay-proof — the
    // events a player must hear NOW (safety, refusals, mechanics)
    const instr = suitSay(event, n, this.settlerName);
    if (instr) {
      this.hud.say(instr, this.t);
      this.voice.speak(instr, moodForEvent(event, sanitizeState(this.brainState())));
      return;
    }
    // everything else is the MIND's to notice: one live line, in her own
    // words, with your shared history in reach. A missed bark is silence,
    // never noise — the rapport rule: canned personality is dead.
    this.barkLive(event);
  }

  barkLive(event) {
    // she speaks when there is SOMETHING TO SAY: firsts and milestones
    // always; repeat scenery rarely (2.5 min global, 10 min per subject)
    const gap = this.t - (this.lastBarkAt ?? -999);
    const first = !this.saidFirsts.has(event);
    this.lastBarkByEvent = this.lastBarkByEvent || {};
    const sameGap = this.t - (this.lastBarkByEvent[event] ?? -9999);
    if (!first && (gap < 150 || sameGap < 600)) return;
    this.lastBarkAt = this.t;
    this.lastBarkByEvent[event] = this.t;
    fetch('/brain/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: sanitizeState(this.brainState()),
        history: this.vesperHistory.slice(-4),
        bark: event,
      }),
      signal: AbortSignal.timeout(14000),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`relay ${r.status}`))))
      .then(({ line, mood }) => {
        if (!line) return;
        this.vesperHistory.push({ who: 'vesper', text: line });
        while (this.vesperHistory.length > 8) this.vesperHistory.shift();
        this.hud.say(line, this.t, Math.max(7, line.length / 12));
        this.voice.speak(line, mood || 'calm', { live: true });
      })
      .catch(() => {
        // a missed scenery notice harms nothing — but the BRIEFING must
        // land even relay-down: the deterministic floor teaches
        const fb = briefFallback(event, this.settlerName);
        if (fb) this.hud.say(fb, this.t, Math.max(7, fb.length / 12));
      });
  }
  sayOnce(event) {
    if (this.saidFirsts.has(event)) return;
    this.saidFirsts.add(event);
    this.say(event);
  }

  // the whitelisted live state the brain layer may see. vesperbrain.js
  // clamps it again on both ends; STATE_FIELDS is the contract, this is
  // merely its reader — never hand it anything you wouldn't broadcast.
  brainState() {
    const missionSol = Math.max(1,
      Math.floor((this.simMillis - this.missionStart) / 88775244) + 1);
    const tau = tauAt(mtc(this.simMillis), Math.floor(this.simMillis / 88775244));
    return {
      settlerName: this.settlerName,
      talks: this.talks || 0,
      milestones: [...this.saidFirsts].slice(-8).join(', '),
      sol: missionSol,
      clock: solClock(this.simMillis),
      season: season(this.simMillis),
      sunEl: this.sunEl ?? 0,
      tempC: surfaceTempC(this.sunEl ?? 0, tau),
      tau,
      air: Math.round(this.air * 100),
      warm: Math.round(this.warm * 100),
      sheltered: this.sheltered(),
      inside: !!(this.inLander || this.insidePressurised),
      driving: !!this.driving,
      lamp: !!this.lampLit,
      steadParts: this.stead.parts.size,
      oreSites: this.prospected.size,
      // the base she advises on: the warren, the grid, the fleet, the chain
      burrowRooms: [...this.burrow.cells.values()].filter((c) => c.dug >= 1).length,
      ringInstalled: this.burrow.ringInstalled,
      warrenShelter: Math.round(warrenReport(this.burrow).shelter * 100),
      warrenAir: Math.round(warrenReport(this.burrow).air * 100),
      drones: this.droneCount,
      bankCharge: this.grid ? this.grid.charge : 0,
      bankCap: this.grid ? this.grid.capacity : 0,
      gridShed: this.grid && this.grid.shed.length ? this.grid.shed.join(', ') : '',
      benches: [...new Set(this.machines.map((m) => m.type))].join(', '),
      lastLine: this.hud.vesperLine.textContent,
      pairing: regardTone(this.regard),
    };
  }

  // the live brain: settler speech in, VESPER's reply out — async, off the
  // render path, and every failure lands on the canned floor (radio-static)
  talkToVesper(raw) {
    this.hud?.setEar(false);
    const text = (raw || '').trim();
    if (!text) return;
    this.lastTalk = this.t;
    this.talks = (this.talks || 0) + 1;
    this.vesperHistory.push({ who: 'you', text });
    while (this.vesperHistory.length > 8) this.vesperHistory.shift();
    // the zero-token signals (regard.js): her question answered; company
    // kept in the dark hours. The semantic ones ride the reply's tag.
    noteTalk(this.regard, Math.floor(this.simMillis / 88775244));
    if (this.pendingVesperQuestion) {
      applySignal(this.regard, 'answered');
      this.pendingVesperQuestion = false;
    }
    if ((this.sunEl ?? 0) < 0 && !this.inLander && !this.insidePressurised) {
      applySignal(this.regard, 'company');
    }
    const body = JSON.stringify({
      state: sanitizeState(this.brainState()),
      history: this.vesperHistory.slice(-6),
      text,
    });
    fetch('/brain/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(20000),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`relay ${r.status}`))))
      .then(({ line, mood, tag }) => {
        if (!line) throw new Error('empty reply');
        this.lastTalk = this.t;
        this.vesperHistory.push({ who: 'vesper', text: line });
        this.hud.say(line, this.t, Math.max(7, line.length / 12));
        this.voice.speak(line, mood || 'calm', { live: true });
        // the ~5-token pairing tag: the model's judgement of the
        // EXCHANGE's shape feeds the hidden score; her question, if she
        // asked one, arms the answered signal for the next reply
        if (tag === 'P' || tag === 'N' || tag === 'D') {
          applySignal(this.regard, `tag-${tag}`);
        }
        this.pendingVesperQuestion = /\?\s*$/.test(line);
      })
      .catch(() => this.say('radio-static'));
  }

  frame(now) {
    // a non-finite timestamp (a manual frame() call, a broken RAF) would
    // slip a NaN dt through the clamps below and poison the whole sim —
    // skip the tick without touching the clock
    if (!Number.isFinite(now)) { requestAnimationFrame((n) => this.frame(n)); return; }
    // clamped both ways: a backwards timestamp must never feed the physics
    // a negative dt (anti-damped springs explode)
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.simMillis += dt * 1000 * TIME_SCALE;

    if (this.attract) {
      this.frameAttract(dt);      // the reel owns the frame behind the title
    } else if (this.sleepAnim) {
      this.frameSleeping(dt);
    } else if (this.hopFlight) {
      this.frameFlying(dt);       // STAGE 3: the staged hop owns the frame
    } else if (this.inLander) {
      this.frameInside(dt);
    } else if (this.driving) {
      this.frameDriving(dt);
    } else {
      this.frameOnFoot(dt);
    }

    // ---- the light of Mars
    this.frameWorld(dt);
    this.touch.tick();
    this.watchFrame(dt);
    this.renderFrame(dt);
    requestAnimationFrame((n) => this.frame(n));
  }

  // ---- the graphics rig (gfx.js decides; this merely applies) ------------

  applyQuality(tier) {
    if (this.gfxQuality === tier) return;
    this.gfxQuality = tier;
    const fine = tier === 'fine';
    this.renderer.toneMapping = fine ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = fine ? EXPOSURE_BASE : 1;
    this.terrain.setDetail(fine);
    // tone-mapping and shadow-type changes only land after a recompile
    this.scene.traverse((o) => {
      if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true;
    });
    if (fine && !this.post) this.post = buildComposer(this.renderer, this.scene, this.cam);
    else if (!fine && this.post) { disposeComposer(this.post); this.post = null; }
  }

  // the fps watchdog: only ever eases DOWN (fine -> plain -> fewer pixels);
  // upgrades — and manual choices — are the player's alone
  watchFrame(rawDt) {
    const gw = this.gfxWatch;
    gw.t += rawDt;
    if (gw.t < SETTLE_S || rawDt <= 0 || rawDt > 0.5) return;
    gw.frames.push(1 / rawDt);
    gw.span += rawDt;
    if (gw.span < WINDOW_S) return;
    const verdict = fpsVerdict(this.gfxQuality, median(gw.frames));
    gw.frames.length = 0; gw.span = 0;
    if (verdict === 'drop-plain' && !this.gfxManual) {
      this.applyQuality('plain');
      // remembered as auto-plain: the next boot opens easy WITHOUT locking
      // the player out of choosing fine again
      try { localStorage.setItem('marsstead-gfx', 'auto-plain'); } catch { /* session only */ }
    } else if (verdict === 'drop-pixels' && !gw.pixelDropped) {
      gw.pixelDropped = true;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(innerWidth, innerHeight);
      if (this.post) resizeComposer(this.post, innerWidth, innerHeight, 1);
    }
  }

  // one render call: through the post stack under fine, direct under plain.
  // Every drive is a deterministic function of light state already in hand —
  // no luminance readback, the family rule.
  renderFrame(dt) {
    // the visor mirrors the painted sky by day and goes quiet by night
    this.colonist.setDaylight(dayFactor(this.sunEl ?? 45));
    if (this.post && this.gfxQuality === 'fine') {
      const day = dayFactor(this.sunEl ?? 45);
      const night = 1 - day;
      const halo = this.L ? this.L.haloStrength : 0;
      // deterministic eye adaptation; pressurised interiors read brighter
      let target = exposureTarget(day);
      if (this.inLander || this.insidePressurised) target += 0.12;
      this.renderer.toneMappingExposure
        += (target - this.renderer.toneMappingExposure) * Math.min(1, dt * 0.4);
      // living bloom: swells at night for the lamps, flares with the halo
      this.post.bloom.strength = 0.3 + night * 0.16 + halo * 0.12;
      this.post.bloom.threshold = 0.85 - night * 0.06;
      const gu = this.post.grade.uniforms;
      gu.uTime.value = (gu.uTime.value + dt) % 64;
      gu.uWarmth.value = halo;
      // gu.uDread stays 0 until the mystery reaches for it
      this.post.composer.render();
    } else {
      this.renderer.render(this.scene, this.cam);
    }
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
    if (!this.cycling && !this.burrowUI.visible && !this.worksUI.visible
      && !this.orders.visible) {
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
    // the big rocks are real — and so is everything parked or built: the
    // boot pushes off boulders, the buggy, the lander's hull, machines
    // and the rig alike (one shared rule, collide.js)
    {
      const solids = [
        ...collidersNear(this.pos.x, this.pos.z),
        ...this.worldSolids(),
        ...buggyDiscs(this.buggy.x, this.buggy.z, this.buggy.heading),
      ];
      const res = resolveCircle(this.pos.x, this.pos.z, 0.35, solids);
      this.pos.x = res.x; this.pos.z = res.z;
    }
    if (this.vel.lengthSq() > 0.05) {
      this.heading = Math.atan2(this.vel.x, this.vel.z);
      this.sayOnce('first-steps');
      if (loping) this.sayOnce('lope');
      this.idleTimer = 0;
    } else {
      this.idleTimer += dt;
      // idle musings retired from the loop: she speaks when there is
      // something to say (James's rule) — standing still is not something
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
    this.colonist.pose(dt, {
      x: this.pos.x, z: this.pos.z, heading: this.heading,
      vx: this.vel.x, vz: this.vel.z, speed,
      airborne: this.airborne, vy: this.vy,
      groundAt: (gx, gz) => this.groundAt(gx, gz),
      simT: this.simMillis / 1000,
    });

    // ---- the trail: bootprints land as ground is covered (the pure store
    // enforces the stride spacing and alternates the feet) — and they
    // PERSIST: the way home is always marked
    if (!this.airborne && speed > 0.5) {
      appendTrack(this.trail, this.pos.x, this.pos.z, this.heading, 'boot');
    }

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
        this.machineLayer.showGhost(x, meshGroundHeight(x, z), z, ok, type);
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
      const kwh = this.isMachine(type) ? BUILD_KWH.machine : BUILD_KWH.steadPart;
      this.hud.setPrompt(
        `|*E| place ${t.name.toLowerCase()} (${have} · ⚡${kwh} kWh) · |*X| remove`
        + ` · |*Q| part · |*V| ${this.buildSlot === 'wall' ? 'roof' : 'wall'} · |*B| done${seal}`,
      );
    } else if (this.unbolt) {
      const pct = Math.round((this.unbolt.t / this.unbolt.need) * 100);
      this.hud.setPrompt(`unbolting ${ITEMS[this.unbolt.id].name.toLowerCase()}… ${pct}%`);
    } else if (this.anchoring) {
      const pct = Math.round((this.anchoring.t / this.anchoring.need) * 100);
      this.hud.setPrompt(`anchoring the rig… ${pct}%`);
    } else if (this.burrowUI.visible) {
      this.hud.setPrompt('THE BURROW · |*E| back to the surface');
    } else if (this.distToCrown() < 4) {
      const home = burrowBedworthy(this.burrow);
      this.hud.setPrompt('|*E| the Burrow console'
        + (home && canSleep(this.sunEl ?? 90) ? ' · |*R| sleep below' : ''));
    } else if (this.distToLadder() < 3.6) {
      this.hud.setPrompt('|*E| climb into the lander'
        + (canSleep(this.sunEl ?? 90) ? ' · |*R| sleep till dawn' : ''));
    } else if (this.distToRover() < 3.2) {
      const deck = massOf(this.roverStore) > 0 ? ` · |*G| take from deck` : '';
      const load = massOf(this.suit) > 0 ? ` · |*F| load deck` : '';
      this.hud.setPrompt(`|*E| drive${load}${deck}`);
    } else if (this.salvaging) {
      const pct = Math.round((this.salvaging.t / this.salvaging.need) * 100);
      this.hud.setPrompt(`salvaging ${this.salvaging.site.name.toLowerCase()}… ${pct}%`);
    } else if (this._heritageNear && this._heritageNear.d < SALVAGE_M && !this.driving) {
      const site = this._heritageNear.site;
      this.hud.setPrompt(isStripped(site, this.heritage)
        ? `${site.name.toLowerCase()} · stripped with honours`
        : `|*E| salvage ${site.name.toLowerCase()}`);
    } else if (this.reading) {
      const pct = Math.round((this.reading.t / this.reading.need) * 100);
      this.hud.setPrompt(`reading the ground… ${pct}%`);
    } else if (this.activeSignal && this._sweepDist < SWEEP_M && !this.driving) {
      this.hud.setPrompt('|*E| read the ground');
    } else if (this.hopperBuilt && !this.hopFlight
      && Math.hypot(this.hopper.x - this.pos.x, this.hopper.z - this.pos.z) < 7) {
      this.hud.setPrompt('|*E| the ship · |*F| load the hold · |*G| take back');
    } else if (this.distToSled() < 4 && !this.driving) {
      const kg = Math.round(massOf(this.sled.store));
      this.hud.setPrompt(`the sled (${kg}/${this.sled.store.capacity} kg) · |*F| load · |*G| take · |*H| hitch from the buggy`);
    } else if (this.nearestMachine()) {
      const m = this.nearestMachine();
      const bits = [];
      const o = machineOutCount(m);
      if (o) bits.push(`${o} ready`);
      if (m.queue.length) bits.push(`${m.queue.length} cooking`);
      this.hud.setPrompt(`|*T| ${MACHINE_TYPES[m.type].name.toLowerCase()}`
        + (bits.length ? ` (${bits.join(', ')})` : '') + ' · |*E| the works');
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
      this.hud.setPrompt('hull salvage — locked until you’ve rested a night · hatch at the ladder'
        + this.fabLabel());
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

    // the parked buggy still needs drawing — and the SPRINGS pose it now:
    // a zero-input step settles it onto its wheels (and onto any rock a
    // wheel is standing on), so parked and driven share one truth
    if (!(this.attract && this.attractShotId === 'drive')) {
      // (the reel's drive shot steps the buggy itself, with real inputs)
      const pe = 0.7, pbx = this.buggy.x, pbz = this.buggy.z;
      const pwg = this.wheelGround(pbx, pbz, this.buggy.heading);
      const pground = {
        h: pwg.h, wh: pwg.wh, at: pwg.at,
        gx: (meshGroundHeight(pbx + pe, pbz) - meshGroundHeight(pbx - pe, pbz)) / (2 * pe),
        gz: (meshGroundHeight(pbx, pbz + pe) - meshGroundHeight(pbx, pbz - pe)) / (2 * pe),
      };
      const ptotal = Math.min(dt, 0.1);
      const pn = Math.max(1, Math.ceil(ptotal / (1 / 120)));
      for (let i = 0; i < pn; i++) {
        stepBuggy(this.buggy, { throttle: 0, steer: 0, brake: 0, handbrake: false }, pground, ptotal / pn);
      }
    }
    this.buggyLayer.update(dt, this.buggy,
      { skidF: false, skidR: false, airborne: false, landed: false });
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
      // the rested buff: a well-designed bunk pays for hours of sol —
      // slower warmth and air drain (the lander's cot is a fixed 0.3)
      this.restedQ = this.sleepingBelow ? warrenReport(this.burrow).shelter : 0.3;
      this.restedUntil = this.simMillis + (3 + 5 * this.restedQ) * 3698968.5;
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

  // sample the surface under all four wheel contacts: the drawn terrain
  // PLUS the rock-dome bump field (rocks.js) — the big tyres ride and
  // bounce over sub-boulder rocks instead of ghosting through them. The
  // suspension in buggy.js turns these four heights into body attitude,
  // so this returns the raw per-wheel array the physics wants.
  wheelGround(bx, bz, heading) {
    const sin = Math.sin(heading), cos = Math.cos(heading);
    const c = this._bumpCache;
    let bumps;
    if (c && Math.hypot(c.x - bx, c.z - bz) < 2) { bumps = c.list; } else {
      bumps = bumpsNear(bx, bz, 6);
      this._bumpCache = { x: bx, z: bz, list: bumps };
    }
    // the sampler the physics uses for wheels AND the chassis skid plate:
    // drawn terrain, with the rock domes riding on top. Wheels read it
    // through their own contact patch (wheelContactHeight) — a big wheel
    // bridges cracks and climbs edges early; the skid plate stays a
    // point-sampler, because the body is not round.
    const sample = (x, z) => Math.max(meshGroundHeight(x, z), bumpHeightAt(x, z, bumps));
    const at = (lx, lz) => wheelContactHeight(sample,
      bx + lx * cos + lz * sin, bz - lx * sin + lz * cos, sin, cos);
    const wh = [at(-TRACK, WHEELBASE_F), at(TRACK, WHEELBASE_F),
      at(-TRACK, -WHEELBASE_R), at(TRACK, -WHEELBASE_R)];
    return { h: (wh[0] + wh[1] + wh[2] + wh[3]) / 4, wh, at: sample };
  }

  // everything parked or built is SOLID — one shared disc list (collide.js
  // resolves the walker against it; deflectBuggy answers for the chassis):
  // the lander's hull, every machine, the rig when it isn't being towed.
  worldSolids() {
    const solids = [{ x: this.landerPos.x, z: this.landerPos.z, r: 3.3 }];
    for (const m of this.machines) solids.push({ x: m.x, z: m.z, r: 0.7 });
    if (this.rig && !this.rig.hitched) solids.push({ x: this.rig.x, z: this.rig.z, r: 0.95 });
    if (this.sled && !this.sled.hitched) solids.push({ x: this.sled.x, z: this.sled.z, r: 1.0 });
    return solids;
  }

  frameDriving(dt) {
    // the touch joystick is ANALOG (touch.js publishes touchStick while a
    // thumb holds it): proportional steer and throttle, so micro
    // corrections don't have to be full-lock skids. The keyboard's
    // switched read is the fallback, unchanged.
    const ts = this.touchStick;
    const input = ts ? {
      throttle: ts.y >= 0 ? ts.y : (this.buggy.u <= 0.5 ? ts.y * 0.85 : 0),
      brake: ts.y < 0 && this.buggy.u > 0.5 ? -ts.y : 0,
      steer: -ts.x,
      handbrake: !!this.keys.Space,
    } : {
      throttle: (this.keys.KeyW ? 1 : 0) + (this.keys.KeyS && this.buggy.u <= 0.5 ? -0.85 : 0),
      brake: this.keys.KeyS && this.buggy.u > 0.5 ? 1 : 0,
      steer: (this.keys.KeyA ? 1 : 0) - (this.keys.KeyD ? 1 : 0),
      handbrake: !!this.keys.Space,
    };
    // fixed-substep integration: cover the WHOLE frame dt in 120 Hz slices,
    // and sample the ground FRESH each slice — at speed a frame-stale
    // terrain read lets the chassis clip into rising ground
    const e = 0.7;
    const bx0 = this.buggy.x, bz0 = this.buggy.z; // pre-step, for the wall check
    const total = Math.min(dt, 0.1);
    const n = Math.max(1, Math.ceil(total / (1 / 120)));
    const h2 = total / n;
    let flags = { skidF: false, skidR: false, airborne: false, landed: false, impact: 0 };
    let wg = null, h = 0;
    for (let i = 0; i < n; i++) {
      const bx = this.buggy.x, bz = this.buggy.z;
      wg = this.wheelGround(bx, bz, this.buggy.heading);
      h = wg.h;
      const ground = {
        h,
        wh: wg.wh,
        at: wg.at,
        gx: (meshGroundHeight(bx + e, bz) - meshGroundHeight(bx - e, bz)) / (2 * e),
        gz: (meshGroundHeight(bx, bz + e) - meshGroundHeight(bx, bz - e)) / (2 * e),
      };
      const f = stepBuggy(this.buggy, input, ground, h2);
      flags = {
        skidF: flags.skidF || f.skidF, skidR: flags.skidR || f.skidR,
        airborne: flags.airborne || f.airborne, landed: flags.landed || f.landed,
        impact: Math.max(flags.impact, f.impact),
      };
    }
    this.buggyFlags = flags;

    // wheel ruts: paired marks land behind the axles as ground is covered —
    // but only while the wheels TOUCH it (a flying buggy prints nothing)
    if (!flags.airborne && Math.abs(this.buggy.u) > 0.5) {
      appendTrack(this.trail, this.buggy.x, this.buggy.z, this.buggy.heading, 'wheel');
    }

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

    // ---- boulders AND the built world deflect the buggy: the chassis
    // glances off stone, hull, machine and rig alike (inward speed dies,
    // tangential survives) and NOTHING eats outbound speed — nose into
    // anything and reversing out just works
    for (const c of [...collidersNear(this.buggy.x, this.buggy.z), ...this.worldSolids()]) {
      const hit = deflectBuggy(this.buggy, c.x, c.z, c.r);
      if (hit > 3 && this.buggyFlags) this.buggyFlags.impact = Math.max(this.buggyFlags.impact, hit);
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
    // the cargo sled tows on the same honest pin
    if (this.sled.hitched && this.driving) {
      const pin = this.hitchPin();
      const tf = stepTrailer(this.sled, pin.x, pin.z, this.buggy.heading, this.buggy.u, dt);
      if (tf.jackknife) {
        this.sled.hitched = false;
        this.say('jackknife');
      } else if (tf.sway) {
        this.swayTimer += dt;
        if (this.swayTimer > 0.6) { this.swayTimer = -8; this.say('trailer-sway'); }
      }
    }

    // no puffs handed over: the rover's spray particles are retired — the
    // wake belongs to the fractal dust registers (no-particles verdict)
    this.buggyLayer.update(dt, this.buggy, flags);

    // VESPER reads the same flags the physics raises
    if (flags.skidR && Math.abs(this.buggy.v) > 1.5) {
      this.driftTimer += dt;
      if (this.driftTimer > 0.7) { this.driftTimer = -60; this.say('buggy-drift'); }
    } else if (this.driftTimer > 0) this.driftTimer = 0;
    if (flags.airborne) {
      this.airTimer += dt;
      if (this.airTimer > 0.8) { this.airTimer = -60; this.say('buggy-air'); }
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

    // ---- the signal chain: the band warms, the arrival speaks, the
    // reading act gives up the relic, the scene plays as canon
    if (!this.attract) {
      const active = chainActive(this.mystery.found);
      this.activeSignal = active;
      if (active) {
        const p = siteXZ(active);
        const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
        this._sweepDist = d;
        this.hud.setSignal(
          signalStrength(active, this.pos.x, this.pos.z),
          sweepAt(active, this.pos.x, this.pos.z),
        );
        if (d < ARRIVE_M && !this.saidFirsts.has(`signal-close:${active.id}`)) {
          this.saidFirsts.add(`signal-close:${active.id}`);
          this.say('signal-close');
        }
        if (this.reading) {
          // walked off the heart (or drove over it): the ground keeps its page
          if (d > SWEEP_M * 1.6 || this.driving || this.hopFlight) {
            this.reading = null;
          } else {
            this.reading.t += dt;
            if (this.reading.t >= this.reading.need) {
              this.reading = null;
              this.mystery.found.push(active.id);
              this.sceneQueue = { lines: [...active.scene], i: 0, nextAt: this.t + 0.8 };
              this.say('signal-found'); // her live colour rides the tag
              this.persist();
            }
          }
        }
      } else {
        this._sweepDist = Infinity;
        this.hud.setSignal(0, 0);
      }
      // a beat's canon plays out line by line, unhurried
      if (this.sceneQueue && this.t >= this.sceneQueue.nextAt) {
        const q = this.sceneQueue;
        const line = q.lines[q.i++];
        if (line) {
          this.hud.say(line, this.t);
          this.voice.speak(line, 'calm');
          q.nextAt = this.t + Math.max(4.5, line.length * 0.075);
        }
        if (q.i >= q.lines.length) this.sceneQueue = null;
      }
    }

    // ---- heritage: the old machines underfoot — the story on arrival,
    // the salvage act, the reseat as terrain streams in beneath them
    if (!this.attract) {
      this._heritageReseat += dt;
      if (this._heritageReseat > 2.5) {
        this._heritageReseat = 0;
        this.heritageLayer.reseat();
      }
      let near = null, nearD = 40;
      for (const site of HERITAGE) {
        const p = heritageXZ(site);
        const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
        if (d < nearD) { near = site; nearD = d; }
      }
      this._heritageNear = near ? { site: near, d: nearD } : null;
      // the story speaks once, on first approach — history is canon
      if (near && nearD < 26 && !this.saidFirsts.has(`heritage:${near.id}`)) {
        this.saidFirsts.add(`heritage:${near.id}`);
        this.hud.say(`${near.name}, ${near.year}. ${near.story}`, this.t);
        this.say('heritage-visit');
      }
      if (this.salvaging) {
        const p = heritageXZ(this.salvaging.site);
        if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > SALVAGE_M * 1.6 || this.driving) {
          this.salvaging = null;
        } else {
          this.salvaging.t += dt;
          if (this.salvaging.t >= this.salvaging.need) {
            const site = this.salvaging.site;
            this.salvaging = null;
            // carry what fits: suit first, the rover deck alongside —
            // whatever stays keeps waiting; nothing is ever wasted
            let took = false, full = false;
            for (const [id, n] of remainingAt(site, this.heritage)) {
              for (let k = 0; k < n; k++) {
                let dest = null;
                if (massOf(this.suit) + ITEMS[id].kg <= SUIT_CAPACITY) dest = this.suit;
                else if (this.distToRover() < 9
                  && massOf(this.roverStore) + ITEMS[id].kg <= ROVER_CAPACITY) dest = this.roverStore;
                else if (this.distToSled() < 9
                  && massOf(this.sled.store) + ITEMS[id].kg <= this.sled.store.capacity) dest = this.sled.store;
                else if (this.distToLander() < 14
                  && massOf(this.shipHold) + ITEMS[id].kg <= this.shipHold.capacity) dest = this.shipHold;
                if (!dest) { full = true; break; }
                add(dest, id, 1);
                this.heritage = recordTake(site, this.heritage, id, 1);
                took = true;
              }
              if (full) break;
            }
            // a listening machine gives up its LOG with the first haul —
            // the old missions were not idle all those years
            if (took && site.record && !this._hadRecord?.[site.id]) {
              this._hadRecord = { ...(this._hadRecord || {}), [site.id]: true };
              this.hud.say(`${site.name}'s memory recovered — it kept a log. THE RECORD holds it now (J).`, this.t);
              this.say('heritage-record');
            } else if (took) this.say('heritage-salvage');
            if (full) this.say('suit-full');
            this.persist();
          }
        }
      }
    }

    // ---- the frost rig: frost.js dictates, the shaders obey (terrain and
    // vista share these uniform objects — one sword, two surfaces)
    {
      const F = this.terrain.frost;
      const ls = solarLongitude(this.simMillis);
      F.uFrostLineN.value = frostLineLat(ls, true);
      F.uFrostLineS.value = frostLineLat(ls, false);
      F.uMorningK.value = morningFrost(ltst(this.simMillis, lon) / 24);
      // azimuth deg clockwise from north -> world xz unit (north is -z)
      const azR = sunAz * Math.PI / 180;
      F.uSunAzimXZ.value.set(Math.sin(azR), -Math.cos(azR));
      F.uSunLow.value = sunEl > 0 ? Math.min(1, Math.max(0, 1 - sunEl / 25)) : 0;
      // the blade burns brightest at the grazing hour: the master gain
      // rides low sun up to ~1.9, settles to 1 by mid-morning
      F.uGlintK.value = Math.min(1, Math.max(0, sunEl / 3.5)) * (1 + F.uSunLow.value * 0.9);
      F.uCamPos.value.copy(this.cam.position);
      F.uGlintT.value = this.t;
    }
    const sol = Math.floor(this.simMillis / 88775244);
    const tau = this.attract && this.attractTau != null
      ? this.attractTau : tauAt(mtc(this.simMillis), sol);
    let L = lightState(sunEl, tau);
    // the altitude ladder: a hop in flight re-lights the whole world —
    // sky drying to black, stars at noon, fog dying, the limb waking
    if ((this.hopAlt || 0) > 1) L = altitudeLight(L, this.hopAlt);
    // the reel's planet shot is TRUE space: the globe's own rim shell is
    // the atmosphere — the dome must not draw a horizon band out there
    if (this.attract && this.attractShotId === 'planet') {
      L = { ...L, limb: 0, fogDensity: 0 };
    }
    this.L = L; // renderFrame's drives read the same state this frame set

    // the pairing's slow arithmetic: quiet sols decay the hidden score;
    // each season turn files the coarse official PAIRING REVIEW from
    // White Harbour (never a number, never her voice — paper first, then
    // the mind may note it)
    if (sol !== this.lastRegardSol) {
      this.lastRegardSol = sol;
      regardDecay(this.regard, sol);
    }
    // the recall in progress: the hands tow; driving the buggy yourself
    // cancels the errand (you clearly reached it after all — no refund,
    // the team was already out)
    if (this.recall) {
      if (this.driving) {
        this.recall = null;
      } else {
        this.recall.rem -= dt;
        if (this.recall.rem <= 0) {
          this.recall = null;
          this.buggy.x = this.crownPos.x + 7;
          this.buggy.z = this.crownPos.z + 6;
          this.buggy.u = 0; this.buggy.v = 0;
          if (this.rig.hitched) {
            this.rig.x = this.buggy.x - 3.4;
            this.rig.z = this.buggy.z;
          }
          this.say('buggy-recalled');
        }
      }
    }

    const seas = season(this.simMillis);
    if (this.lastSeason && seas !== this.lastSeason && this.booted) {
      this.hud.say(`PAIRING REVIEW — WHITE HARBOUR: ${regardVerdict(this.regard)}. Filed with the charter record.`, this.t, 9);
      this.say('pairing-review');
    }
    this.lastSeason = seas;

    // ---- the grid: sources, bank, loads — and the shed ladder when the
    // arithmetic fails. Computed FIRST: everything below reads this truth.
    const arrays = this.machines.filter((m) => m.type === 'solar-array').length;
    const batteries = this.machines.filter((m) => m.type === 'battery').length;
    const cooking = {};
    if (this.fab.queue.length) cooking.fab = 1;
    for (const m of this.machines) {
      if (m.queue.length) cooking[m.type] = (cooking[m.type] || 0) + 1;
    }
    const dugRooms = this.burrow.ringInstalled
      ? [...this.burrow.cells.values()].filter((c) => c.dug >= 1).length : 0;
    this.grid = tickPower(this.power, (dt * TIME_SCALE) / 3600,
      arrays, batteries, sunEl, tau, {
        // hands bill only while a FUNDED face is being cut: a queue
        // waiting on charge idles them, or the wait starves itself
        drones: handsBusy(this.burrow) ? this.droneCount : 0,
        cooking,
        warrenRooms: dugRooms,
      });
    const shed = new Set(this.grid.shed);
    // the instrument channel keeps watch: warn once per crisis, re-arm on recovery
    const bankFrac = this.grid.capacity > 0 ? this.grid.charge / this.grid.capacity : 1;
    if ((shed.size > 0 || bankFrac < 0.15) && this.grid.demand > this.grid.supply) {
      if (!this.saidPowerLow) { this.saidPowerLow = true; this.say('power-low'); }
    } else if (bankFrac > 0.4 || this.grid.demand <= this.grid.supply) {
      this.saidPowerLow = false;
    }

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

    // ---- the heavens: both moons and Earth from the pure frame — Phobos
    // rises west BECAUSE its period beats the sidereal sol, nothing scripted
    const pd = phobosWorld(this.simMillis, lat);
    const dd = deimosWorld(this.simMillis, lat);
    const phobosDir = new THREE.Vector3(...pd);
    const eEl = earthElongation(this.simMillis);
    const poleW = new THREE.Vector3(...marsEqToWorld([0, 1, 0], this.simMillis, lat));
    const earthDir = sunDir.clone()
      .applyAxisAngle(poleW, eEl.evening ? eEl.rad : -eEl.rad);
    const day = dayFactor(sunEl);
    this.sky.set(L, {
      sunDir, phobosDir,
      deimosDir: new THREE.Vector3(...dd),
      earthDir,
      earthI: Math.min(1, L.starVisibility * 1.5 + L.haloStrength * 0.25),
      // cirrus is OCCASIONAL — most sols carry none at all
      cirrus: Math.min(0.5, (1 - L.storm) * cirrusAt(sol) * (0.5 + 0.5 * L.haloStrength)),
      millis: this.simMillis, lat, t: this.t,
      camPos: this.cam.position,
    });

    // Phobos-light: the moving second key, night only, storm-doused
    this.phobosLight.position.copy(this.pos).addScaledVector(phobosDir, 90);
    this.phobosLight.target.position.copy(this.pos);
    this.phobosLight.intensity = Math.max(0, pd[1]) * 0.09 * (1 - day) * (1 - L.storm);

    // automatic lights: dusk switches them on, dawn off; L overrides
    const wantLit = this.lampMode === 'on' || (this.lampMode === 'auto' && sunEl < 4);
    if (wantLit !== this.lampLit) {
      this.lampLit = wantLit;
      if (wantLit && this.lampMode === 'auto') this.sayOnce('lights-on');
    }
    this.colonist.setLamp(this.lampLit && !this.driving);
    this.buggyLayer.setLamps(this.lampLit);

    // the first-sol briefing: she re-places a settler who knows HER well
    // but remembers nothing of the mechanics — staged over the first two
    // minutes, live in her own voice, once ever (sayOnce rides the save)
    if (this.freshLanding) {
      // the written half: LANDFALL ORDERS open once, before she speaks —
      // read at your pace, reopen with O, ask her the rest with ENTER
      if (this.t > 4 && !this.ordersShown && !this.attract) {
        this.ordersShown = true;
        let seen = null;
        try { seen = localStorage.getItem('marsstead-orders-seen'); } catch { /* fine */ }
        if (!seen) {
          this.orders.open();
          try { localStorage.setItem('marsstead-orders-seen', '1'); } catch { /* fine */ }
        }
      }
      if (this.t > 8) this.sayOnce('brief-wake');
      if (this.t > 32) this.sayOnce('brief-power');
      if (this.t > 58) this.sayOnce('brief-dig');
      if (this.t > 88) this.sayOnce('brief-works');
    }

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
      // the active signal's honest ring: site snapped to a coarse 4 km
      // grid, radius wide enough to always contain it — orientation,
      // never a pin (the band's warmth is the real instrument)
      let signalRing = null;
      if (this.activeSignal) {
        const p = siteXZ(this.activeSignal);
        const q = 4000;
        signalRing = {
          x: Math.floor(p.x / q) * q + q / 2,
          z: Math.floor(p.z / q) * q + q / 2,
          r: 3200,
        };
      }
      this.map.update(this.exploration, {
        player: { x: this.pos.x, z: this.pos.z, heading: this.driving ? this.buggy.heading : this.heading },
        lander: this.landerPos,
        buggy: { x: this.buggy.x, z: this.buggy.z },
        stead: this.steadOrigin,
        rig: { x: this.rig.x, z: this.rig.z },
        deposits: [...this.prospected].map(depositById).filter(Boolean),
        trail: this.trail.pts,
        crown: this.crownPos,
        hopper: this.hopperBuilt ? { x: this.hopper.x, z: this.hopper.z } : null,
        foundSites: this.mystery.found
          .map((id) => SITES.find((s) => s.id === id)).filter(Boolean)
          .map((s) => ({ ...siteXZ(s), name: s.name })),
        heritage: this.heritageFor(),
        signalRing,
      });
    }

    // ---- the expedition's slow machines
    if (drillTick(this.rig, dt)) this.sayOnce('drill-first-ore');
    const hopperNow = hopperCount(this.rig);
    if (hopperNow >= HOPPER_CAP && this.prevHopper < HOPPER_CAP) this.say('hopper-full');
    this.prevHopper = hopperNow;
    // benches cook only while the grid serves them — a shed station holds
    // its queue warm and waits (quiet, never broken)
    if (!shed.has('fab') && fabTick(this.fab, dt) === 'steel-panel') this.sayOnce('fab-first-steel');
    for (const m of this.machines) {
      if (shed.has(m.type)) continue;
      if (machineTick(m, dt) === 'steel-panel') this.sayOnce('fab-first-steel');
    }
    this.machineLayer.update(this.machines, this.t);
    this.rigLayer.update(this.rig, meshGroundHeight(this.rig.x, this.rig.z));
    this.rigLayer.syncOre(this.pos.x, this.pos.z, meshGroundHeight);

    // ---- the world layers: streaming freezes while the arc flies over
    // the vista (STRUCTURE.md: never low-level streaming under flight) —
    // it resumes on descent so the destination arrives under the dust
    if (!this.hopFlight || !this.hopFlight.hidTerrain) {
      this.terrain.update(this.pos.x, this.pos.z);
      this.rocks.update(this.pos.x, this.pos.z);
    }
    this.trackLayer.update(this.pos.x, this.pos.z, this.trail, meshGroundHeight);

    // the hopper on its pad (flight frames pose it themselves)
    if (this.hopperBuilt && !this.hopFlight) {
      const hgy = meshGroundHeight(this.hopper.x, this.hopper.z);
      this.hopperLayer.setPlaced(this.hopper.x, this.hopper.z, hgy + 0.1,
        this.hopperHeading || 0);
      this.hopperLayer.setFuel(this.hopper.fuelKg);
      this.hopperLayer.setFlame(0, this.t);
      // the touchdown's aftermath: legs spring back, the blast dust hangs
      if (this._legSquash > 0.002) {
        this._legSquash *= Math.exp(-dt * 3.2);
        this.hopperLayer.setSquash(this._legSquash);
      }
      if (this._scourPulse > 0.02) {
        this._scourPulse *= Math.exp(-dt * 0.75);
        this.hopperLayer.setScour(this.hopper.x, hgy, this.hopper.z,
          this._scourPulse * 0.8, this.t);
      } else {
        this.hopperLayer.setScour(this.hopper.x, hgy, this.hopper.z, 0, this.t);
      }
    } else if (!this.hopperBuilt) {
      this.hopperLayer.hide();
    }
    this.hopperLayer.update(this.t, (this.sunEl ?? 10) < 0);
    this.sledLayer.update(this.sled,
      meshGroundHeight(this.sled.x, this.sled.z),
      massOf(this.sled.store) / this.sled.store.capacity);
    this.hopUI.update(dt);
    if (this.globe) { this.globe.update(dt); this.globe.setSun(sunDir); }
    // the vista hands back to the streamed world once it has caught up
    if (!this.hopFlight && this.vista.mesh && this.terrain.queue.length === 0) {
      this.vista.dispose();
    }

    // ---- the Burrow: the hands dig in real seconds; spoil is ore — and
    // DESIGN PAYS: a staged store speeds the haul, lit gardens top your
    // air at the crown, a good bunk sends you out rested (warrenReport).
    // A shed grid stills the hands and dims the comforts.
    const wasHome = burrowPressurised(this.burrow);
    const rep = warrenReport(this.burrow);
    const handsPowered = !shed.has('drone');
    for (const e of burrowTick(this.burrow, dt,
      handsPowered ? this.droneCount * (1 + rep.haul) : 0,
      (kwh) => spend(this.power, kwh))) {
      if (e.type === 'dug') this.sayOnce('burrow-room');
      if (e.type === 'waiting') this.say('no-charge'); // the queue waits on income
    }
    if (rep.air > 0 && burrowPressurised(this.burrow) && this.distToCrown() < 7
      && !shed.has('warren')) {
      this.air = Math.min(1, this.air + dt * 0.03 * rep.air);
    }
    if (!wasHome && burrowPressurised(this.burrow)) this.sayOnce('burrow-home');
    if (this.distToCrown() < 7
      && (this.burrow.spoil.ore > 0 || this.burrow.spoil.regolith > 0)) {
      // the house pays: banked spoil walks into the bags when you pass —
      // ore first (the richer sack), regolith to fill the rest for the
      // fab's rake; the buggy parked at the crown loads its deck too
      let moved = 0;
      while (this.burrow.spoil.ore > 0 && canAdd(this.suit, 'iron-ore', 1)) {
        this.burrow.spoil.ore -= 1;
        add(this.suit, 'iron-ore', 1);
        moved += 1;
      }
      while (this.burrow.spoil.regolith > 0 && canAdd(this.suit, 'regolith', 1)) {
        this.burrow.spoil.regolith -= 1;
        add(this.suit, 'regolith', 1);
        moved += 1;
      }
      if (this.distToRover() < 9) {
        while (this.burrow.spoil.ore > 0 && canAdd(this.roverStore, 'iron-ore', 1)) {
          this.burrow.spoil.ore -= 1;
          add(this.roverStore, 'iron-ore', 1);
          moved += 1;
        }
        while (this.burrow.spoil.regolith > 0 && canAdd(this.roverStore, 'regolith', 1)) {
          this.burrow.spoil.regolith -= 1;
          add(this.roverStore, 'regolith', 1);
          moved += 1;
        }
      }
      if (moved) this.sayOnce('drill-first-ore');
    }
    this.crownLayer.update(this.t, this.burrow.queue.length > 0,
      [...this.burrow.cells.values()].filter((c) => c.dug >= 1).length,
      this.burrow.ringInstalled, (this.sunEl ?? 10) < 0);
    this.burrowUI.update(dt);
    this.worksUI.update(dt);

    // the heads-up map: always on while you're in the world — the glance
    // that makes every walk retraceable (the M map stays the instrument)
    this.minimap.setVisible(!this.attract && !this.burrowUI.visible
      && !this.worksUI.visible && !this.map.visible && !this.inLander);
    this.planetHud.setVisible(!this.attract && !this.burrowUI.visible
      && !this.worksUI.visible && !this.map.visible && !this.inLander
      && !this.hopUI.visible && !this.journalUI.visible);
    this.planetHud.update(dt, {
      player: { x: this.pos.x, z: this.pos.z },
      hopper: this.hopperBuilt ? { x: this.hopper.x, z: this.hopper.z } : null,
      homes: this.homesFor(),
      sites: this.mystery.found
        .map((id) => SITES.find((s) => s.id === id)).filter(Boolean)
        .map((s) => siteXZ(s)),
      heritage: this.heritageFor(),
    });
    this.minimap.update(dt, {
      player: {
        x: this.pos.x, z: this.pos.z,
        heading: this.driving ? this.buggy.heading : this.heading,
      },
      trail: this.trail.pts,
      lander: this.landerPos,
      crown: this.crownPos,
      buggy: { x: this.buggy.x, z: this.buggy.z },
      rig: { x: this.rig.x, z: this.rig.z },
      hopper: this.hopperBuilt ? { x: this.hopper.x, z: this.hopper.z } : null,
      deposits: [...this.prospected].map(depositById).filter(Boolean),
    });
    this.wake.update(dt, this.buggy, this.buggyFlags, L.sunIntensity);
    this.dust.update(dt, this.t, this.pos.x, this.pos.z, this.vel.x, this.vel.z);
    // the sheets wear the land: drape + true-rockiness mask (throttled)
    this.dust.conform(this.pos.x, this.pos.z, rockiness);
    // dust is sunlit matter: it fades with the light (never glows at night).
    // Motes retired to 0 — particle floaters read as noise; the fractal
    // dome/sheet registers carry suspension now (no-particles verdict)
    this.dust.moteMat.opacity = 0;
    this.dust.devilMat.opacity = 0.05 + 0.3 * L.sunIntensity;
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
    // rested (a good night in a good bunk): the body spends slower
    const rested = this.simMillis < (this.restedUntil || 0) ? (this.restedQ || 0) : 0;
    this.air = Math.max(0, this.air
      - (dt / (bottleHours * 3600 / TIME_SCALE)) * (1 - 0.25 * rested));
    const chill = temp < -60
      ? ((-60 - temp) / 40) * (this.everPressurised ? 1.5 : 1) * (1 - 0.35 * rested) : 0;
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
      `Ls ${solarLongitude(this.simMillis).toFixed(1)}° · ${season(this.simMillis)} · ${this.placeName()}`,
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

// boot: the title fronts the save — CONTINUE carries it, NEW LANDING
// wipes it, ?play skips the ceremony (live checks, the dev loop). The
// attract reel runs the world behind the title (sealed: no saves, no
// speech, no input); the Play choice reloads into a clean real start,
// so nothing of the reel ever leaks into a life.
loadGame().catch(() => null).then((save) => {
  const start = async (choice, name = '') => {
    if (choice === 'new' && save) await clearSave();
    window.marsstead = new Game(choice === 'continue' ? save : null, name);
  };
  const params = new URLSearchParams(location.search);
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem('marsstead-start') || 'null');
    sessionStorage.removeItem('marsstead-start');
  } catch { /* fine */ }
  if (params.has('play')) {
    start(save ? 'continue' : 'new');
  } else if (pending && (pending.choice === 'continue' || pending.choice === 'new')) {
    start(pending.choice, pending.name || '');
  } else {
    window.marssteadAttract = new Game(null, '', true);
    new TitleScreen(save, (choice, name = '') => {
      try {
        sessionStorage.setItem('marsstead-start', JSON.stringify({ choice, name }));
      } catch { /* fine */ }
      location.reload();
    });
  }
});
