// The heads-up map — a small always-on compass ring, bottom-left: the
// local 340 m, north up, your own trail threading it, the places that
// matter as dots, you as the gold arrow in the centre. No terrain, no
// fog logic — orientation is the job, and the trail is the orienteer:
// the way home is ALWAYS on screen (James's rule — retrace your steps).
// The M map remains the surveyor's instrument; this is the glance.

const SIZE = 172;      // css px
const RADIUS = 170;    // metres shown from centre to rim

const CSS = `
  #minimap { position: fixed; left: 16px; bottom: 16px; z-index: 20;
    width: ${SIZE}px; height: ${SIZE}px; pointer-events: none; }
  #minimap canvas { width: 100%; height: 100%; }
`;

export class MiniMap {
  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'minimap';
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE * 2; this.canvas.height = SIZE * 2; // retina
    this.root.appendChild(this.canvas);
    document.body.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d');
    this._t = 0;
  }

  setVisible(v) { this.root.style.display = v ? 'block' : 'none'; }

  // pois: { player:{x,z,heading}, trail, lander, crown, buggy, rig, deposits }
  update(dt, pois) {
    this._t += dt;
    if (this._t < 0.25) return; // ~4 Hz is plenty for a glance
    this._t = 0;
    const ctx = this.ctx;
    const C = SIZE; // centre in retina px
    const px = pois.player.x, pz = pois.player.z;
    const toPx = (x, z) => [C + ((x - px) / RADIUS) * (C - 14),
      C + ((z - pz) / RADIUS) * (C - 14)];
    const inRange = (x, z) => Math.hypot(x - px, z - pz) < RADIUS * 0.96;

    ctx.clearRect(0, 0, C * 2, C * 2);
    // the ring: a dark instrument face with a rim and a north tick
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(16,9,5,.62)';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(232,196,106,.5)';
    ctx.stroke();
    ctx.clip(); // everything below stays inside the face

    // the trail (newest ~600 marks): boots dotted cream, wheels solid gold
    if (pois.trail && pois.trail.length > 1) {
      for (const [kind, dash] of [[0, [3, 6]], [1, []]]) {
        ctx.strokeStyle = kind ? 'rgba(232,196,106,.6)' : 'rgba(246,237,226,.55)';
        ctx.lineWidth = kind ? 3 : 2;
        ctx.setLineDash(dash);
        ctx.beginPath();
        let pen = false, last = null;
        for (let i = Math.max(0, pois.trail.length - 600); i < pois.trail.length; i++) {
          const pt = pois.trail[i];
          if (pt.k !== kind) continue;
          if (!inRange(pt.x, pt.z)) { pen = false; continue; }
          if (pen && last && Math.hypot(pt.x - last.x, pt.z - last.z) > 24) pen = false;
          const [u, w] = toPx(pt.x, pt.z);
          if (!pen) { ctx.moveTo(u, w); pen = true; } else ctx.lineTo(u, w);
          last = pt;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // the places: dots, with off-ring bearings pinned to the rim so home
    // never falls off the instrument
    const dot = (x, z, colour, ringed) => {
      let [u, w] = [x, z] && toPx(x, z);
      if (!inRange(x, z)) {
        const a = Math.atan2(z - pz, x - px);
        u = C + Math.cos(a) * (C - 16);
        w = C + Math.sin(a) * (C - 16);
        ctx.globalAlpha = 0.65;
      }
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.arc(u, w, ringed ? 5 : 4, 0, Math.PI * 2); ctx.fill();
      if (ringed) {
        ctx.strokeStyle = colour; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(u, w, 8.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    if (pois.lander) dot(pois.lander.x, pois.lander.z, '#cfc5b6');
    if (pois.crown) dot(pois.crown.x, pois.crown.z, '#e8c46a', true);
    if (pois.buggy) dot(pois.buggy.x, pois.buggy.z, '#8fb6d8');
    if (pois.rig) dot(pois.rig.x, pois.rig.z, '#c9974a');
    // the hopper: teal, the colour of signal — a scattered landing must
    // always be findable again
    if (pois.hopper) dot(pois.hopper.x, pois.hopper.z, '#3fd0c9', true);
    for (const d of pois.deposits || []) {
      if (inRange(d.x, d.z)) dot(d.x, d.z, '#d1685a');
    }

    // you: the gold arrow, nose to heading (north up, -z)
    const h = pois.player.heading || 0;
    ctx.translate(C, C);
    ctx.rotate(Math.atan2(Math.sin(h), -Math.cos(h)));
    ctx.fillStyle = '#e8c46a';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(5.6, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.6, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // north tick + label, outside the clip
    ctx.fillStyle = 'rgba(232,196,106,.8)';
    ctx.font = '600 13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('N', C, 18);
  }
}
