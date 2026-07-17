// Dust scene layer: skins THREE points onto the pure drives in dust.js.
// Two populations — drifting motes riding the wind field (bent by the
// swirl register near the colonist), and the devils: coherent columns of
// spinning grains you can see coming from half a kilometre.

import * as THREE from 'three';
import { windAt, swirl, devilState, devilSpin, DEVIL_COUNT } from './dust.js';
import { hash2 } from './noise.js';

const MOTES = 1800;
const MOTE_RANGE = 45;       // motes live in a box around the colonist
const GRAINS_PER_DEVIL = 260;

// a soft round speck, drawn in code at boot (zero assets): PointsMaterial
// renders square sprites; this radial-alpha map rounds every grain off
function speckTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export class DustLayer {
  constructor(scene, groundHeight) {
    this.ground = groundHeight;

    // --- drifting motes
    // biased toward the ground: most dust lives below the knee, a thin
    // minority rides higher — the plain wears a visible skin of motion
    const mpos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      mpos[i * 3] = (hash2(i, 1) - 0.5) * 2 * MOTE_RANGE;
      mpos[i * 3 + 1] = Math.pow(hash2(i, 2), 2.2) * 4 + 0.05;
      mpos[i * 3 + 2] = (hash2(i, 3) - 0.5) * 2 * MOTE_RANGE;
    }
    this.moteGeo = new THREE.BufferGeometry();
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
    const speck = speckTexture();
    this.moteMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.62, 0.40, 0.24), size: 0.09, map: speck,
      transparent: true, opacity: 0.5, sizeAttenuation: true, depthWrite: false,
    });
    this.motes = new THREE.Points(this.moteGeo, this.moteMat);
    this.motes.frustumCulled = false;
    scene.add(this.motes);

    // --- the devils
    const dpos = new Float32Array(DEVIL_COUNT * GRAINS_PER_DEVIL * 3);
    this.devilGeo = new THREE.BufferGeometry();
    this.devilGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.devilMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.66, 0.46, 0.32), size: 0.4, map: speck,
      transparent: true, opacity: 0.28, sizeAttenuation: true, depthWrite: false,
    });
    this.devils = new THREE.Points(this.devilGeo, this.devilMat);
    this.devils.frustumCulled = false;
    scene.add(this.devils);
  }

  // px/pz/pvx/pvz: colonist position + velocity (the swirl register's body)
  update(dt, t, px, pz, pvx, pvz) {
    // motes: advect by wind + the colonist's vortex wake; recycle out-of-box
    const a = this.moteGeo.attributes.position.array;
    for (let i = 0; i < MOTES; i++) {
      const k = i * 3;
      let x = a[k] + px * 0 + 0, y = a[k + 1], z = a[k + 2];
      const wx = x + px, wz = z + pz; // world position (motes stored local)
      const w = windAt(wx, wz, t);
      const s = swirl(pvx, pvz, x, z);
      x += (w.x * 0.35 + s.x) * dt;
      z += (w.z * 0.35 + s.z) * dt;
      y += (Math.sin(t * 0.7 + i) * 0.08 + (hash2(i, 9) - 0.45) * 0.3) * dt;
      // keep motes hugging the ground plane band
      const g = 0.1 + Math.pow(hash2(i, 4), 2.2) * 3.5;
      y += (g - y) * 0.02;
      // recycle: drifted out of the box -> respawn on the windward edge
      if (Math.abs(x) > MOTE_RANGE || Math.abs(z) > MOTE_RANGE) {
        x = (hash2(i, Math.floor(t)) - 0.5) * 2 * MOTE_RANGE;
        z = (hash2(i + 7, Math.floor(t)) - 0.5) * 2 * MOTE_RANGE;
      }
      a[k] = x; a[k + 1] = y; a[k + 2] = z;
    }
    this.motes.position.set(px, this.ground(px, pz), pz);
    this.moteGeo.attributes.position.needsUpdate = true;

    // devils: place each column's grains on a spinning, rising helix
    const d = this.devilGeo.attributes.position.array;
    this.nearestDevil = Infinity;
    for (let i = 0; i < DEVIL_COUNT; i++) {
      const st = devilState(i, t);
      const gy = this.ground(st.x, st.z);
      const dist = Math.hypot(st.x - px, st.z - pz);
      if (st.intensity > 0.3 && dist < this.nearestDevil) this.nearestDevil = dist;
      for (let g = 0; g < GRAINS_PER_DEVIL; g++) {
        const k = (i * GRAINS_PER_DEVIL + g) * 3;
        const f = g / GRAINS_PER_DEVIL;             // height fraction
        const rad = st.radius * (0.5 + f * 1.6);    // column flares upward
        const spin = devilSpin(rad, st.radius, st.intensity);
        const ang = hash2(g, i) * Math.PI * 2 + t * (0.4 + spin * 0.25);
        d[k] = st.x + Math.cos(ang) * rad * (0.7 + 0.3 * hash2(g, 5));
        d[k + 1] = gy + f * st.height * st.intensity;
        d[k + 2] = st.z + Math.sin(ang) * rad * (0.7 + 0.3 * hash2(g, 6));
      }
    }
    this.devilGeo.attributes.position.needsUpdate = true;
    this.devilMat.opacity = 0.4;
  }
}
