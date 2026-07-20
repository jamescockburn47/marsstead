// The planet chart — the hop console's orbital page: the REAL planet
// (the global MOLA table, the same palette as every walked chunk, the
// seasonal caps), drawn orthographically on a canvas, dragged to turn,
// clicked to aim. DOM/canvas only — consoles are the indoors; no THREE
// here. The globe is a render of the map, never a walked surface.
//
// The world is a wrapped PLANE (mars.js): distances are planar with an
// x-wrap, so the fuel circle drawn here is the plane's own circle
// projected onto the sphere's face — honest to the game's geometry.

import {
  elevationReal, latLonToWorld, worldToLatLon, FEATURES, M_PER_DEG, HOME,
} from './mars.js';
import { colourFor } from './marschunk.js';
import { frostCover } from './frost.js';

const D2R = Math.PI / 180;
export const WORLD_WRAP = 360 * M_PER_DEG;

// wrap-shortest world x for an aim, measured from a reference x
export function nearestWrappedX(x, refX) {
  let ax = x;
  while (ax - refX > WORLD_WRAP / 2) ax -= WORLD_WRAP;
  while (ax - refX < -WORLD_WRAP / 2) ax += WORLD_WRAP;
  return ax;
}

export class PlanetChart {
  // canvas: the console's element; onPick({lat, lonE}) fires on a clean click
  constructor(canvas, onPick, seasonLs = 0) {
    this.cv = canvas;
    this.onPick = onPick;
    this.seasonLs = seasonLs;
    this.view = { lat: 12, lon: HOME.lon };  // start facing home country
    this.marks = {};
    this.N = 340;                             // render grid (CSS upscales)
    this.cv.width = this.N; this.cv.height = this.N;
    this._drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      this._drag = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this._drag.moved = true;
      if (!this._drag.moved) return;
      this.view.lon = ((this.view.lon - dx * 0.55) % 360 + 360) % 360;
      this.view.lat = Math.max(-78, Math.min(78, this.view.lat + dy * 0.45));
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      this.render(this.marks);
    });
    canvas.addEventListener('pointerup', (e) => {
      const wasClick = this._drag && !this._drag.moved;
      this._drag = null;
      if (!wasClick) return;
      const r = this.cv.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * this.N;
      const py = (e.clientY - r.top) / r.height * this.N;
      const hit = this.unproject(px, py);
      if (hit) this.onPick(hit);
    });
  }

  // view-space unit vector -> lat/lonE (y is the pole axis)
  viewToWorld(nx, ny, nz) {
    const f = this.view.lat * D2R, l = this.view.lon * D2R;
    // tilt back by view lat, then spin by view lon
    const y1 = ny * Math.cos(f) + nz * Math.sin(f);
    const z1 = nz * Math.cos(f) - ny * Math.sin(f);
    const x2 = nx * Math.cos(l) + z1 * Math.sin(l);
    const z2 = z1 * Math.cos(l) - nx * Math.sin(l);
    return { lat: Math.asin(Math.max(-1, Math.min(1, y1))) / D2R,
      lonE: ((Math.atan2(x2, z2) / D2R) % 360 + 360) % 360 };
  }

  // lat/lonE -> screen px (null when on the far hemisphere)
  project(lat, lonE) {
    const f = this.view.lat * D2R, l = this.view.lon * D2R;
    const la = lat * D2R, lo = lonE * D2R;
    const y = Math.sin(la), c = Math.cos(la);
    const x0 = c * Math.sin(lo - 0), z0 = c * Math.cos(lo - 0);
    // spin then tilt (inverse order of viewToWorld)
    const x1 = x0 * Math.cos(l) - z0 * Math.sin(l);
    const z1 = z0 * Math.cos(l) + x0 * Math.sin(l);
    const y2 = y * Math.cos(f) - z1 * Math.sin(f);
    const z2 = z1 * Math.cos(f) + y * Math.sin(f);
    if (z2 < 0.02) return null;               // the far side
    const C = this.N / 2, R = this.N * 0.46;
    return [C + x1 * R, C - y2 * R, z2];
  }

  unproject(px, py) {
    const C = this.N / 2, R = this.N * 0.46;
    const nx = (px - C) / R, ny = -(py - C) / R;
    const rr = nx * nx + ny * ny;
    if (rr > 1) return null;                  // clicked space
    return this.viewToWorld(nx, ny, Math.sqrt(1 - rr));
  }

  render(marks = {}) {
    this.marks = marks;
    const N = this.N, C = N / 2, R = N * 0.46;
    const ctx = this.cv.getContext('2d');
    const img = ctx.createImageData(N, N);
    const d = img.data;
    let prevRow = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      let prevH = 0;
      for (let i = 0; i < N; i++) {
        const k = (j * N + i) * 4;
        const nx = (i - C) / R, ny = -(j - C) / R;
        const rr = nx * nx + ny * ny;
        if (rr > 1) { d[k + 3] = 0; prevRow[i] = 0; continue; }
        const { lat, lonE } = this.viewToWorld(nx, ny, Math.sqrt(1 - rr));
        const h = elevationReal(lat, lonE);
        // palette + caps: the same laws as the ground and the globe
        const { x, z } = latLonToWorld(lat, lonE);
        let c = colourFor(h * 0.025, x, z, 0);
        const cap = frostCover(lat, this.seasonLs, 0.5);
        if (cap > 0.01) {
          c = [c[0] + (0.94 - c[0]) * cap * 0.85,
            c[1] + (0.93 - c[1]) * cap * 0.85,
            c[2] + (0.90 - c[2]) * cap * 0.85];
        }
        // hillshade from screen-space height gradient (lit upper-left)
        const shade = 1 + Math.max(-0.45, Math.min(0.45,
          ((prevH - h) + (prevRow[i] - h)) * 0.00006));
        // limb darkening: the sphere's own light
        const limb = 0.55 + 0.45 * Math.sqrt(1 - rr);
        d[k] = Math.min(255, c[0] * 255 * shade * limb);
        d[k + 1] = Math.min(255, c[1] * 255 * shade * limb);
        d[k + 2] = Math.min(255, c[2] * 255 * shade * limb);
        d[k + 3] = 255;
        prevH = h; prevRow[i] = h;
      }
    }
    ctx.putImageData(img, 0, 0);

    // the land's names: the biggest country on the visible face
    ctx.font = '9px Georgia';
    ctx.textAlign = 'center';
    const named = [...FEATURES].sort((a, b) => b.diamKm - a.diamKm).slice(0, 40);
    let drawn = 0;
    for (const f of named) {
      if (drawn >= 18) break;
      const p = this.project(f.lat, f.lonE);
      if (!p) continue;
      ctx.fillStyle = `rgba(246,237,226,${0.3 + 0.35 * p[2]})`;
      ctx.fillText(f.name.toUpperCase(), p[0], p[1]);
      drawn++;
    }

    // the fuel circle: the plane's own reach, worn on the sphere's face
    if (marks.craft && marks.rangeKm > 0) {
      const cw = latLonToWorld(marks.craft.lat, marks.craft.lonE);
      ctx.strokeStyle = 'rgba(63,208,201,.7)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      let pen = false;
      for (let a = 0; a <= 120; a++) {
        const th = (a / 120) * Math.PI * 2;
        const wx = cw.x + Math.cos(th) * marks.rangeKm * 1000;
        const wz = cw.z + Math.sin(th) * marks.rangeKm * 1000;
        const ll = worldToLatLon(wx, wz);
        const p = this.project(Math.max(-89, Math.min(89, ll.lat)), ll.lon);
        if (!p) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // home, the craft, the aim
    const dot = (m, colour, glyph) => {
      const p = m && this.project(m.lat, m.lonE);
      if (!p) return;
      ctx.fillStyle = colour;
      ctx.font = '13px Georgia';
      ctx.fillText(glyph, p[0], p[1] + 4);
    };
    dot(marks.home, '#e8c46a', '⌂');
    dot(marks.craft, '#3fd0c9', '●');
    if (marks.aim) {
      const p = this.project(marks.aim.lat, marks.aim.lonE);
      if (p) {
        ctx.strokeStyle = '#e8c46a'; ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(p[0] - 7, p[1]); ctx.lineTo(p[0] + 7, p[1]);
        ctx.moveTo(p[0], p[1] - 7); ctx.lineTo(p[0], p[1] + 7);
        ctx.stroke();
      }
    }
  }
}
