// The surveyor's map — DOM/canvas layer, M to open. The survey came
// first (2026-07-20): Mars is the best-charted dead world there is, so
// the relief draws EVERYWHERE in view — no fog, no unveiling. What the
// map still earns is YOUR story: the trail, the named finds, the
// homestead's marks. The view is square, north up (-z), and grows as
// the travelled bounds grow. Terrain re-renders only when bounds move;
// markers redraw every frame for free.

import { EXPLORE_CELL, bounds } from './explore.js';
import { featuresInBox } from './mars.js';

const CSS = `
  #marsmap { position: fixed; inset: 0; display: none; align-items: center;
    justify-content: center; background: rgba(10,4,2,.72); z-index: 40;
    font-family: Georgia, 'Times New Roman', serif; color: #f6ede2; }
  #marsmap.open { display: flex; }
  #marsmap .frame { position: relative; border: 1px solid rgba(232,196,106,.5);
    background: #1a0c07; padding: 14px 14px 10px; border-radius: 3px; }
  #marsmap canvas { display: block; width: 66vmin; height: 66vmin;
    image-rendering: auto; }
  #marsmap .title { text-align: center; font-size: 12px; letter-spacing: 4px;
    color: #e8c46a; margin-bottom: 8px; }
  #marsmap .foot { text-align: center; font-size: 10px; letter-spacing: 2px;
    opacity: .6; margin-top: 8px; }
`;

const MIN_SPAN = 420;        // m — the map never zooms tighter than this
const TERRAIN_PX = 176;      // sampling resolution of the relief image
// (FOG retired 2026-07-20 — the survey came first; the mist is gone)

export class MarsMap {
  constructor(groundAt) {
    this.groundAt = groundAt;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'marsmap';
    const frame = document.createElement('div');
    frame.className = 'frame';
    this.title = document.createElement('div');
    this.title.className = 'title';
    this.title.textContent = 'SURVEYED GROUND · JEZERO';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512; this.canvas.height = 512;
    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.textContent = 'M CLOSE · THE SURVEY KNOWS THE COUNTRY — THE TRAIL KNOWS YOU';
    frame.append(this.title, this.canvas, foot);
    this.root.appendChild(frame);
    document.body.appendChild(this.root);

    this.ctx = this.canvas.getContext('2d');
    this.terrain = document.createElement('canvas'); // cached relief+fog
    this.terrain.width = 512; this.terrain.height = 512;
    this.cacheStamp = '';
    this.view = null;
  }

  get visible() { return this.root.classList.contains('open'); }
  toggle() { this.root.classList.toggle('open'); }

  // square view box around the explored bounds (world metres)
  viewBox(exp) {
    const b = bounds(exp);
    if (!b) return { minX: -MIN_SPAN / 2, minZ: -MIN_SPAN / 2, span: MIN_SPAN };
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(MIN_SPAN, b.maxX - b.minX, b.maxZ - b.minZ);
    return { minX: cx - span / 2, minZ: cz - span / 2, span };
  }

  // relief where seen, fog where not — cached until exploration changes
  renderTerrain(exp) {
    const v = this.view;
    const tc = this.terrain.getContext('2d');
    const img = document.createElement('canvas');
    img.width = TERRAIN_PX; img.height = TERRAIN_PX;
    const ic = img.getContext('2d');
    const d = ic.createImageData(TERRAIN_PX, TERRAIN_PX);
    const step = v.span / TERRAIN_PX;
    // height range pass for the ramp
    let lo = Infinity, hi = -Infinity;
    const hs = new Float32Array(TERRAIN_PX * TERRAIN_PX);
    for (let j = 0; j < TERRAIN_PX; j++) {
      for (let i = 0; i < TERRAIN_PX; i++) {
        const h = this.groundAt(v.minX + (i + 0.5) * step, v.minZ + (j + 0.5) * step);
        hs[j * TERRAIN_PX + i] = h;
        if (h < lo) lo = h; if (h > hi) hi = h;
      }
    }
    const range = Math.max(1, hi - lo);
    for (let j = 0; j < TERRAIN_PX; j++) {
      for (let i = 0; i < TERRAIN_PX; i++) {
        const h = hs[j * TERRAIN_PX + i];
        const e = (h - lo) / range;
        // slope shade: lit from the north-west, the cartographer's habit
        const hx = hs[j * TERRAIN_PX + Math.min(TERRAIN_PX - 1, i + 1)] - h;
        const hz = hs[Math.min(TERRAIN_PX - 1, j + 1) * TERRAIN_PX + i] - h;
        const shade = Math.max(0.55, Math.min(1.25, 1 - (hx + hz) * 0.35 / step * 6));
        const r = (96 + e * 120) * shade;
        const g = (52 + e * 66) * shade;
        const b = (34 + e * 40) * shade;
        const k = (j * TERRAIN_PX + i) * 4;
        d.data[k] = r; d.data[k + 1] = g; d.data[k + 2] = b; d.data[k + 3] = 255;
      }
    }
    ic.putImageData(d, 0, 0);
    tc.imageSmoothingEnabled = true;
    tc.clearRect(0, 0, 512, 512);
    tc.drawImage(img, 0, 0, 512, 512);

    // (the unveiling mist died 2026-07-20, James's call: Mars is the
    // best-surveyed dead world there is — the chart knows the country
    // before your boots do. The trail still tells where YOU have been.)
  }

  toPx(x, z) {
    const v = this.view;
    return [(x - v.minX) / v.span * 512, (z - v.minZ) / v.span * 512];
  }

  marker(ctx, x, z, colour, label) {
    const [u, w] = this.toPx(x, z);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(u, w, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '10px Georgia';
    ctx.fillStyle = 'rgba(246,237,226,.85)';
    ctx.fillText(label, u + 7, w + 3);
  }

  // call every frame while open. pois: { player:{x,z,heading}, lander,
  // buggy, stead? } — stead only once something is built
  update(exp, pois) {
    const stamp = `${exp.cells.size}`;
    if (stamp !== this.cacheStamp) {
      this.view = this.viewBox(exp);
      this.renderTerrain(exp);
      this.cacheStamp = stamp;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(this.terrain, 0, 0);

    // the trail: your own marks, drawn before the markers so waypoints sit
    // on top — boots a dotted thread, wheels a solid one. This is how you
    // retrace your steps: the planet remembers, so the map does too.
    if (pois.trail && pois.trail.length > 1) {
      for (const [kind, style] of [[0, [2, 5]], [1, []]]) {
        ctx.save();
        ctx.strokeStyle = kind ? 'rgba(232,196,106,.55)' : 'rgba(246,237,226,.5)';
        ctx.lineWidth = kind ? 2.2 : 1.4;
        ctx.setLineDash(style);
        ctx.beginPath();
        let pen = false;
        let last = null;
        for (const pt of pois.trail) {
          if (pt.k !== kind) continue;
          const [u, w] = this.toPx(pt.x, pt.z);
          // lift the pen across gaps (hops, drives between walks)
          if (pen && last && Math.hypot(pt.x - last.x, pt.z - last.z) > 24) pen = false;
          if (!pen) { ctx.moveTo(u, w); pen = true; } else ctx.lineTo(u, w);
          last = pt;
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    if (pois.lander) this.marker(ctx, pois.lander.x, pois.lander.z, '#cfc5b6', 'LANDER');
    if (pois.buggy) this.marker(ctx, pois.buggy.x, pois.buggy.z, '#8fb6d8', 'ROVER');
    if (pois.crown) this.marker(ctx, pois.crown.x, pois.crown.z, '#e8c46a', 'BURROW');
    if (pois.stead) this.marker(ctx, pois.stead.x, pois.stead.z, '#e8c46a', 'HAB');
    if (pois.rig) this.marker(ctx, pois.rig.x, pois.rig.z, '#c9974a', 'RIG');
    if (pois.hopper) this.marker(ctx, pois.hopper.x, pois.hopper.z, '#3fd0c9', 'SHIP');

    // the land's own names: quiet small caps, places not markers
    const v2 = this.view;
    ctx.font = '10px Georgia';
    ctx.fillStyle = 'rgba(246,237,226,.45)';
    for (const f of featuresInBox(v2.minX, v2.minZ, v2.minX + v2.span, v2.minZ + v2.span)) {
      const [fu, fw] = this.toPx(f.x, f.z);
      ctx.fillText(f.name.toUpperCase(), fu - f.name.length * 2.6, fw);
    }

    // walked chain sites are known ground now — named in signal teal
    for (const s of pois.foundSites || []) {
      this.marker(ctx, s.x, s.z, '#3fd0c9', s.name.toUpperCase());
    }

    // the old machines: humanity's record on the land, pale and patient;
    // a stripped site keeps its name but loses its glow
    for (const h of pois.heritage || []) {
      const [hu, hw] = this.toPx(h.x, h.z);
      ctx.fillStyle = h.stripped ? 'rgba(178,168,148,.4)' : 'rgba(200,190,170,.9)';
      ctx.beginPath();
      ctx.moveTo(hu, hw - 4.5); ctx.lineTo(hu + 4, hw + 3.5); ctx.lineTo(hu - 4, hw + 3.5);
      ctx.closePath(); ctx.fill();
      ctx.font = '9px Georgia';
      ctx.fillStyle = h.stripped ? 'rgba(246,237,226,.35)' : 'rgba(246,237,226,.7)';
      ctx.fillText(h.name.toUpperCase(), hu + 7, hw + 3);
    }

    // the live signal's honest ring: a vague circle on a coarse grid —
    // the band's warmth is the real instrument; this only orients
    if (pois.signalRing) {
      const [cu, cw] = this.toPx(pois.signalRing.x, pois.signalRing.z);
      const rr = pois.signalRing.r / v2.span * 512;
      ctx.save();
      ctx.strokeStyle = 'rgba(63,208,201,.55)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(cu, cw, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const ORE = { 'iron-ore': ['#d1685a', 'IRON'], ice: ['#cfe0e8', 'ICE'], silica: ['#d8c9a8', 'SILICA'] };
    for (const d of pois.deposits || []) {
      const [colour, label] = ORE[d.type] || ['#d1685a', 'ORE'];
      this.marker(ctx, d.x, d.z, colour, label);
    }

    // THE WAY HOME (2026-07-20): a dashed gold thread from the walker to
    // the nearest roof — crown, hab, or the ship — with the distance on
    // it. The map's first job is getting you back.
    const p = pois.player;
    const roofs = [pois.crown, pois.stead, pois.hopper].filter(Boolean);
    if (roofs.length) {
      let home = roofs[0], hd = Infinity;
      for (const r of roofs) {
        const d = Math.hypot(r.x - p.x, r.z - p.z);
        if (d < hd) { hd = d; home = r; }
      }
      if (hd > 60) {
        const [hu, hw] = this.toPx(home.x, home.z);
        const [pu, pw] = this.toPx(p.x, p.z);
        ctx.save();
        ctx.strokeStyle = 'rgba(232,196,106,.75)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(pu, pw); ctx.lineTo(hu, hw); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '11px Georgia';
        ctx.fillStyle = '#e8c46a';
        const label = hd >= 950 ? `${(hd / 1000).toFixed(1)} KM HOME` : `${Math.round(hd)} M HOME`;
        ctx.fillText(label, (pu + hu) / 2 + 6, (pw + hw) / 2 - 4);
        ctx.restore();
      }
    }

    // the walker: a gold arrow nosing their heading, RINGED — the one
    // mark that must never be hunted for
    const [u, w] = this.toPx(p.x, p.z);
    ctx.save();
    ctx.strokeStyle = 'rgba(242,214,138,.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(u, w, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.translate(u, w);
    ctx.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)));
    ctx.fillStyle = '#e8c46a';
    ctx.beginPath();
    ctx.moveTo(0, -8.5); ctx.lineTo(5.6, 6); ctx.lineTo(-5.6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
