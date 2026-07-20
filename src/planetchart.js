// The planet chart — the hop console's orbital page, v2 (James's eye,
// 2026-07-20: "the ACTUAL planet, rotatable, labelled"). This is the
// attract reel's own globe — the displaced MOLA sphere with the walked
// palette, the seasonal caps and the atmosphere rim — rendered live in
// its own small THREE view inside the console (DESIGN.md sanctions it:
// "the orbital view IS the chart page"). Drag turns it with inertia,
// the gazetteer floats as DOM labels over the face, a click anywhere
// is an aim, and the fuel circle rides the sphere.
//
// The world is a wrapped PLANE (mars.js): distances are planar with an
// x-wrap, so the aim resolves wrap-shortest from the craft and the
// fuel circle drawn here is the plane's own circle worn on the face.

import * as THREE from 'three';
import { GlobeLayer, GLOBE_R } from './globelayer.js';
import {
  FEATURES, latLonToWorld, worldToLatLon, M_PER_DEG, HOME,
} from './mars.js';

const D2R = Math.PI / 180;
export const WORLD_WRAP = 360 * M_PER_DEG;

// wrap-shortest world x for an aim, measured from a reference x
export function nearestWrappedX(x, refX) {
  let ax = x;
  while (ax - refX > WORLD_WRAP / 2) ax -= WORLD_WRAP;
  while (ax - refX < -WORLD_WRAP / 2) ax += WORLD_WRAP;
  return ax;
}

// lat/lonE -> a point on the globe's surface (globelayer's own mapping)
function surfacePoint(lat, lonE, lift = 1.0) {
  const phi = (90 - lat) * D2R, theta = lonE * D2R;
  const r = GLOBE_R * lift;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

export class PlanetChart {
  // canvas: the console's GL surface; labelHost: an overlay div the
  // labels live in; onPick({lat, lonE}) fires on a clean click
  constructor(canvas, labelHost, onPick, seasonLs = 0) {
    this.cv = canvas;
    this.host = labelHost;
    this.onPick = onPick;
    this.seasonLs = seasonLs;
    this.orbit = { lat: 16, lon: HOME.lon, vLon: 0, vLat: 0 };
    this.built = false;
    this._drag = null;
    this._ringSig = '';

    canvas.addEventListener('pointerdown', (e) => {
      this._drag = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this._drag.moved = true;
      if (!this._drag.moved) return;
      this.orbit.lon += dx * 0.35;
      this.orbit.lat = Math.max(-80, Math.min(80, this.orbit.lat + dy * 0.3));
      this.orbit.vLon = dx * 0.35 * 30;   // hand the speed to the inertia
      this.orbit.vLat = dy * 0.3 * 30;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
    });
    canvas.addEventListener('pointerup', (e) => {
      const wasClick = this._drag && !this._drag.moved;
      this._drag = null;
      if (!wasClick || !this.built) return;
      const r = this.cv.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.cam);
      const hit = this.ray.intersectObject(this.globe.planet)[0];
      if (!hit) return;
      const p = hit.point, len = p.length();
      this.onPick({
        lat: 90 - Math.acos(Math.max(-1, Math.min(1, p.y / len))) / D2R,
        lonE: ((Math.atan2(p.z, p.x) / D2R) % 360 + 360) % 360,
      });
    });
  }

  // the GL view is built on first use — most sessions never open it
  build() {
    if (this.built) return;
    this.built = true;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true, alpha: true });
    this.scene = new THREE.Scene();
    this.globe = new GlobeLayer(this.scene, this.seasonLs);
    this.globe.setVisible(true);
    // a chart's studio light, not the sim's sun: steady, three-quarter
    const sun = new THREE.DirectionalLight(0xfff2df, 2.1);
    sun.position.set(1.4, 0.7, 1.0);
    this.scene.add(sun, new THREE.AmbientLight(0x886655, 0.85));
    this.globe.setSun(sun.position.clone().normalize());
    this.cam = new THREE.PerspectiveCamera(36, 1, GLOBE_R * 0.05, GLOBE_R * 12);
    this.ray = new THREE.Raycaster();
    // the fuel circle: a dashed teal thread laid on the face
    this.ring = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: 0x3fd0c9, dashSize: GLOBE_R * 0.02, gapSize: GLOBE_R * 0.014,
        transparent: true, opacity: 0.9, depthTest: true,
      }),
    );
    this.scene.add(this.ring);
    // the labels: DOM spans floated over the face, reused every frame
    this.labels = [];
    const mk = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      s.style.display = 'none';
      this.host.appendChild(s);
      return s;
    };
    const named = [...FEATURES].sort((a, b) => b.diamKm - a.diamKm).slice(0, 30);
    for (const f of named) this.labels.push({ f, el: mk('pl-name', f.name.toUpperCase()) });
    this.mCraft = mk('pl-mark pl-craft', '●');
    this.mAim = mk('pl-mark pl-aim', '✛');
    this._mk = mk;
    this.homeEls = new Map();   // label -> span, created as roofs appear
  }

  // one frame while the page is open: inertia, camera, labels, render
  tick(dt, marks) {
    this.build();
    const w = this.cv.clientWidth || 640, h = this.cv.clientHeight || 640;
    if (this.cv.width !== w || this.cv.height !== h) {
      this.renderer.setSize(w, h, false);
      this.cam.aspect = w / h;
      this.cam.updateProjectionMatrix();
    }
    // idle drift when the hand is off; inertia after a throw
    if (!this._drag) {
      this.orbit.lon += (Math.abs(this.orbit.vLon) > 0.5 ? this.orbit.vLon : 1.2) * dt;
      this.orbit.lat += this.orbit.vLat * dt;
      this.orbit.lat = Math.max(-80, Math.min(80, this.orbit.lat));
      this.orbit.vLon *= Math.exp(-dt * 2.2);
      this.orbit.vLat *= Math.exp(-dt * 2.2);
    }
    const f = this.orbit.lat * D2R, l = this.orbit.lon * D2R;
    const dist = GLOBE_R * 3.3;
    this.cam.position.set(
      dist * Math.cos(f) * Math.cos(l),
      dist * Math.sin(f),
      dist * Math.cos(f) * Math.sin(l),
    );
    this.cam.lookAt(0, 0, 0);

    // the fuel circle follows the craft (rebuilt only when it changes)
    const sig = marks.craft
      ? `${Math.round(marks.craft.x)}:${Math.round(marks.craft.z)}:${marks.rangeKm.toFixed(1)}` : '';
    if (sig !== this._ringSig) {
      this._ringSig = sig;
      if (marks.craft && marks.rangeKm > 0) {
        const pts = [];
        for (let a = 0; a <= 128; a++) {
          const th = (a / 128) * Math.PI * 2;
          const wx = marks.craft.x + Math.cos(th) * marks.rangeKm * 1000;
          const wz = marks.craft.z + Math.sin(th) * marks.rangeKm * 1000;
          const ll = worldToLatLon(wx, wz);
          pts.push(surfacePoint(Math.max(-89, Math.min(89, ll.lat)), ll.lon, 1.015));
        }
        this.ring.geometry.dispose();
        this.ring.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        this.ring.computeLineDistances();
        this.ring.visible = true;
      } else this.ring.visible = false;
    }

    // labels + marks: projected each frame, hidden on the far side
    const place = (el, lat, lonE, lift = 1.01) => {
      const p = surfacePoint(lat, lonE, lift);
      const facing = p.clone().normalize().dot(this.cam.position.clone().normalize());
      if (facing < 0.12) { el.style.display = 'none'; return; }
      const s = p.project(this.cam);
      if (s.z > 1) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = `${(s.x * 0.5 + 0.5) * 100}%`;
      el.style.top = `${(-s.y * 0.5 + 0.5) * 100}%`;
      el.style.opacity = `${0.35 + 0.65 * Math.min(1, (facing - 0.12) * 1.6)}`;
    };
    for (const { f: feat, el } of this.labels) place(el, feat.lat, feat.lonE);
    const wll = (m) => { const ll = worldToLatLon(m.x, m.z); return { lat: ll.lat, lonE: ll.lon }; };
    // every roof you own, floated on the face
    for (const hm of marks.homes || []) {
      let el = this.homeEls.get(hm.label);
      if (!el) {
        el = this._mk('pl-mark pl-home', `${hm.glyph} ${hm.label}`);
        el.style.color = hm.colour;
        el.style.fontSize = '10px';
        el.style.letterSpacing = '1.5px';
        this.homeEls.set(hm.label, el);
      }
      const p = wll(hm);
      place(el, p.lat, p.lonE, 1.02);
    }
    if (marks.craft) { const p = wll(marks.craft); place(this.mCraft, p.lat, p.lonE, 1.02); } else this.mCraft.style.display = 'none';
    if (marks.aim) { const p = wll(marks.aim); place(this.mAim, p.lat, p.lonE, 1.02); } else this.mAim.style.display = 'none';

    this.renderer.render(this.scene, this.cam);
  }
}
