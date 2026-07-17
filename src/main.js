// Marsstead — Phase 0: the ground. One region of Mars (Jezero), streamed
// with no cheap tiles; a colonist bounding under 0.38 g; the backwards
// light of Mars from noon butterscotch to the blue hour; dust in three
// registers; the sol clock running real Mars time; VESPER's first words.
// The kill/go gate: if this doesn't feel right, the project stops here.
//
// Dev keys: WASD move, SHIFT lope, SPACE jump, mouse-drag orbit,
// L headlamp, [ ] scrub time (the demo's best friend).

import * as THREE from 'three';
import { groundHeight, latLonToWorld, worldToLatLon, HOME, IS_PLACEHOLDER } from './mars.js';
import { sunElevation, sunAzimuth, solClock, solarLongitude, season } from './marstime.js';
import { lightState, surfaceTempC } from './marslight.js';
import { tauAt } from './dust.js';
import { mtc } from './marstime.js';
import {
  G_MARS, WALK_SPEED, LOPE_SPEED, JUMP_V0,
  STRIDE_HZ_WALK, STRIDE_HZ_LOPE, fallStep, fallSeverity,
} from './physics.js';
import { TerrainLayer } from './terrain.js';
import { SkyDome } from './sky.js';
import { DustLayer } from './dustlayer.js';
import { Colonist } from './colonist.js';
import { Hud } from './hud.js';
import { vesperSay } from './vesper.js';

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
    this.dust = new DustLayer(this.scene, groundHeight);
    this.colonist = new Colonist(this.scene);
    this.hud = new Hud(IS_PLACEHOLDER);

    // the walker's state — spawned at HOME (the Jezero delta)
    this.pos = new THREE.Vector3(0, 0, 0);
    this.pos.y = groundHeight(0, 0);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.airborne = false;
    this.heading = 0;
    this.camYaw = 0.6; this.camPitch = 0.32; this.camDist = 7;

    // the clock: start late afternoon at HOME so the first minutes of play
    // walk into the blue hour (the demo IS the sunset)
    this.simMillis = Date.now();
    this.calibrateToLocalHour(16.4);

    // the suit
    this.air = 1; this.warm = 1;
    this.saidCounts = {}; this.lamp = false;
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
    if (e.code === 'KeyL') { this.lamp = !this.lamp; this.colonist.setLamp(this.lamp); }
    if (e.code === 'BracketLeft') this.simMillis -= 3698968.5 * 0.5;  // -30 Mars min
    if (e.code === 'BracketRight') this.simMillis += 3698968.5 * 0.5; // +30
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
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.simMillis += dt * 1000 * TIME_SCALE;

    // ---- movement under 0.38 g
    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const wish = new THREE.Vector3();
    if (this.keys.KeyW) wish.add(fwd);
    if (this.keys.KeyS) wish.sub(fwd);
    if (this.keys.KeyA) wish.add(right);
    if (this.keys.KeyD) wish.sub(right);
    const loping = this.keys.ShiftLeft || this.keys.ShiftRight;
    const target = wish.lengthSq() > 0
      ? wish.normalize().multiplyScalar(loping ? LOPE_SPEED : WALK_SPEED)
      : new THREE.Vector3();
    // low-traction ease: momentum carries a little on the dusty regolith,
    // more while airborne (you can't steer off the ground)
    const ease = this.airborne ? 0.4 : 6;
    this.vel.lerp(target, Math.min(1, ease * dt));
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (this.vel.lengthSq() > 0.05) {
      this.heading = Math.atan2(this.vel.x, this.vel.z);
      this.sayOnce('first-steps');
      if (loping) this.sayOnce('lope');
      this.idleTimer = 0;
    } else {
      this.idleTimer += dt;
      if (this.idleTimer > 45) { this.idleTimer = 0; this.say('idle'); }
    }

    const ground = groundHeight(this.pos.x, this.pos.z);
    if (!this.airborne && this.keys.Space) {
      this.vy = JUMP_V0; this.airborne = true;
      this.sayOnce('first-jump');
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

    // ---- camera: soft third-person orbit
    const co = new THREE.Vector3(
      Math.sin(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
      this.camDist * Math.sin(this.camPitch) + 1.6,
      Math.cos(this.camYaw) * -this.camDist * Math.cos(this.camPitch),
    ).add(this.pos);
    // keep the lens out of the ground
    co.y = Math.max(co.y, groundHeight(co.x, co.z) + 0.6);
    this.cam.position.lerp(co, Math.min(1, 8 * dt));
    this.cam.lookAt(this.pos.x, this.pos.y + 0.95, this.pos.z);

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

    // dusk / night / dawn beats
    if (sunEl < 6 && sunEl > -2 && this.lastSunEl > sunEl) this.sayOnce('sunset');
    if (sunEl < -8) this.sayOnce('night');
    if (sunEl > 4 && this.lastSunEl < sunEl && this.saidFirsts.has('night')) this.sayOnce('dawn');
    this.lastSunEl = sunEl;

    // ---- the world layers
    this.terrain.update(this.pos.x, this.pos.z);
    this.dust.update(dt, this.t, this.pos.x, this.pos.z, this.vel.x, this.vel.z);
    // dust is sunlit matter: it fades with the light (never glows at night)
    this.dust.moteMat.opacity = 0.06 + 0.44 * L.sunIntensity;
    this.dust.devilMat.opacity = 0.05 + 0.3 * L.sunIntensity;
    if (this.dust.nearestDevil < 220) this.sayOnce('devil-near');

    // ---- the suit's slow arithmetic
    const temp = surfaceTempC(sunEl, tau);
    this.air = Math.max(0, this.air - dt / (8 * 3600 / TIME_SCALE)); // an 8h EVA bottle
    const chill = temp < -60 ? ((-60 - temp) / 40) : 0;
    this.warm = Math.max(0, Math.min(1, this.warm + (0.05 - chill * 0.02) * dt));
    if (this.warm < 0.35) this.sayOnce('cold');
    if (this.air < 0.25) this.sayOnce('air-low');
    this.hud.setVitals(this.air, this.warm, temp);
    this.hud.setClock(
      solClock(this.simMillis),
      `Ls ${solarLongitude(this.simMillis).toFixed(1)}° · ${season(this.simMillis)} · Jezero`,
    );
    this.hud.update(this.t);

    this.renderer.render(this.scene, this.cam);
    requestAnimationFrame((n) => this.frame(n));
  }
}

const game = new Game();
window.marsstead = game; // the live handle, the family way
