// The wrist planet — a permanent small chart of the WHOLE world in the
// HUD's corner (2026-07-20, James's call: Mars is surveyed; the settler
// always knows where on the planet they stand). An equirectangular
// render of the global MOLA table with the stratigraphy palette and the
// seasonal caps, baked ONCE at boot; live dots ride on top at ~2 Hz.
// DOM/canvas only, zero assets.

import { elevationReal, latLonToWorld, worldToLatLon } from './mars.js';
import { colourFor } from './marschunk.js';
import { frostCover } from './frost.js';

const CSS = `
  #planethud { position: fixed; right: 16px; bottom: 16px; z-index: 20;
    width: 236px; border: 1px solid rgba(232,196,106,.4); border-radius: 3px;
    background: rgba(20,10,6,.72); padding: 5px 5px 3px; }
  #planethud canvas { display: block; width: 226px; height: 113px; }
  #planethud .cap { font-family: Georgia, serif; font-size: 8.5px;
    letter-spacing: 2px; color: #e8c46a; opacity: .7; text-align: center;
    padding-top: 2px; }
`;

const W = 452, H = 226;   // 2x for crisp text-free relief

export class PlanetHud {
  constructor(seasonLs = 0) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'planethud';
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = 'MARS · THE WHOLE SURVEY';
    this.root.append(this.canvas, cap);
    document.body.appendChild(this.root);

    // ---- the base relief, baked once: lat 90..-90, lonE 0..360
    this.base = document.createElement('canvas');
    this.base.width = W; this.base.height = H;
    const bc = this.base.getContext('2d');
    const img = bc.createImageData(W, H);
    const d = img.data;
    let prevRow = new Float32Array(W);
    for (let j = 0; j < H; j++) {
      const lat = 90 - (j / (H - 1)) * 180;
      let prevH = 0;
      for (let i = 0; i < W; i++) {
        const lonE = (i / W) * 360;
        const h = elevationReal(lat, lonE);
        const { x, z } = latLonToWorld(lat, lonE);
        let c = colourFor(h * 0.025, x, z, 0);
        const capF = frostCover(lat, seasonLs, 0.5);
        if (capF > 0.01) {
          c = [c[0] + (0.94 - c[0]) * capF * 0.85,
            c[1] + (0.93 - c[1]) * capF * 0.85,
            c[2] + (0.90 - c[2]) * capF * 0.85];
        }
        const shade = 1 + Math.max(-0.4, Math.min(0.4,
          ((prevH - h) + (prevRow[i] - h)) * 0.00005));
        const k = (j * W + i) * 4;
        d[k] = Math.min(255, c[0] * 255 * shade);
        d[k + 1] = Math.min(255, c[1] * 255 * shade);
        d[k + 2] = Math.min(255, c[2] * 255 * shade);
        d[k + 3] = 255;
        prevH = h; prevRow[i] = h;
      }
    }
    bc.putImageData(img, 0, 0);
    this._acc = 9;
  }

  px(lat, lonE) {
    return [((lonE % 360) + 360) % 360 / 360 * W, (90 - lat) / 180 * H];
  }

  setVisible(v) { this.root.style.display = v ? '' : 'none'; }

  // dots: { player:{x,z}, hopper:{x,z}|null, home:{x,z}, sites:[{x,z}] }
  update(dt, dots) {
    this._acc += dt;
    if (this._acc < 0.5) return;
    this._acc = 0;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.base, 0, 0);
    const dot = (w, colour, r = 3) => {
      if (!w) return;
      const ll = worldToLatLon(w.x, w.z);
      const [u, v] = this.px(ll.lat, ll.lon);
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.arc(u, v, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const hm of dots.homes || []) dot(hm, hm.colour || '#e8c46a', 2.5);
    for (const s of dots.sites || []) dot(s, '#3fd0c9', 2.5);
    dot(dots.hopper, '#3fd0c9', 3);
    // you: gold, ringed — the one mark that matters at a glance
    if (dots.player) {
      dot(dots.player, '#f2d68a', 3.2);
      const ll = worldToLatLon(dots.player.x, dots.player.z);
      const [u, v] = this.px(ll.lat, ll.lon);
      ctx.strokeStyle = 'rgba(242,214,138,.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(u, v, 6, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
