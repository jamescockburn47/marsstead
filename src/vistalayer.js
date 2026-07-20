// The vista — the world from above, for the hopper's arc. STRUCTURE.md's
// doctrine: the flight plays over the baked global MOLA truth, never over
// low-level streamed terrain. This layer builds ONE coarse far-field mesh
// per hop — the same analytic ground the walker stands on (marschunk's
// meshGroundHeight) and the same palette (colourFor), sampled at
// kilometre stride across the whole track — shows it for the arc, and
// throws it away at touchdown. The real planet is the grandest
// instrument the game owns; this is its page.

import * as THREE from 'three';
import { meshGroundHeight, colourFor } from './marschunk.js';
import { latLonToWorld, HOME, M_PER_DEG } from './mars.js';
import { FBM_GLSL, FROST_GLINT_GLSL } from './glsl.js';

const N = 110;                 // verts per side — coarse is honest at altitude

export class VistaLayer {
  // frostRig: the SAME uniform objects the terrain material holds
  // (terrain.frost) — one rig, two surfaces, no drift
  constructor(scene, frostRig = null) {
    this.scene = scene;
    this.frostRig = frostRig;
    this.mesh = null;
  }

  // build centred on the hop's midpoint, spanning the track with margin —
  // or, with { world: true }, one full east-west wrap of the planet
  // (106.56 km: the seam closes on itself, so no square edge can ever
  // show east or west) across the whole latitude range
  build(from, to, { world = false } = {}) {
    this.dispose();
    const cx = (from[0] + to[0]) / 2, cz = (from[1] + to[1]) / 2;
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    // world mode: one full E-W wrap (the seam closes on itself) but only
    // the REAL latitude range north-south — beyond the poles the
    // projection is nonsense and must never be sampled
    const spanX = world ? 360 * 296 : Math.max(90000, dist * 1.7 + 60000);
    let z0, z1;
    if (world) {
      z0 = latLonToWorld(89.2, 0).z;
      z1 = latLonToWorld(-89.2, 0).z;
    } else {
      z0 = cz - spanX / 2; z1 = cz + spanX / 2;
    }
    const stepX = spanX / (N - 1);
    const stepZ = (z1 - z0) / (N - 1);
    const pos = new Float32Array(N * N * 3);
    const col = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = cx - spanX / 2 + i * stepX;
        const z = z0 + j * stepZ;
        const h = meshGroundHeight(x, z);
        const k = (j * N + i) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
        const hx = meshGroundHeight(x + stepX, z) - h;
        const hz = meshGroundHeight(x, z + stepZ) - h;
        const steep = Math.min(1, Math.hypot(hx, hz) / Math.max(stepX, 1) * 3);
        const c = colourFor(h, x, z, steep);
        col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2];
      }
    }
    const idx = [];
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals(); // coarse far-field: recomputed normals are fine here
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // the world from above must not read as a flat ramp: kilometre-scale
    // fbm country over the vertex palette — the same family noise, the
    // same multiplicative colour-law discipline as the walked terrain
    mat.onBeforeCompile = (shader) => {
      if (this.frostRig) {
        for (const k of Object.keys(this.frostRig)) shader.uniforms[k] = this.frostRig[k];
      }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vVistaPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVistaPos = position.xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vVistaPos;
uniform float uFrostLineN, uFrostLineS, uMorningK, uSunLow, uGlintK, uGlintT;
uniform vec2 uSunAzimXZ;
uniform vec3 uCamPos;
${FBM_GLSL}
${FROST_GLINT_GLSL}
const float MARS_LAT0 = ${HOME.lat.toFixed(4)};
const float MARS_LAT_PER_Z = ${(-1 / M_PER_DEG).toFixed(8)};`)
        .replace('#include <color_fragment>', `#include <color_fragment>
float vFrostCover = 0.0;
{
  float vA = fbm(vVistaPos * 0.0011 + 3.3) - 0.5;
  float vB = fbm(vVistaPos * 0.0058 + 21.0) - 0.5;
  float vC = fbm(vVistaPos * 0.00016 + 47.0) - 0.5;  // the 40 km provinces
  diffuseColor.rgb *= 1.0 + (vC * 0.34 + vA * 0.36 + vB * 0.18);
  // the caps from altitude: the same frost law, kilometre patching
  float vfLat = MARS_LAT0 + vVistaPos.y * MARS_LAT_PER_Z;
  float vfPatch = 0.7 + 0.6 * fbm(vVistaPos * 0.0004 + 63.0);
  vFrostCover = clamp(marsFrost(vfLat, uFrostLineN, uFrostLineS, uMorningK) * vfPatch, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.93, 0.90), vFrostCover * 0.6);
}`)
        .replace('#include <opaque_fragment>', `
// the caps SHIMMER from the arc: the same sword, kilometre cells
outgoingLight = frostGlint(outgoingLight, vec3(vVistaPos.x, 0.0, vVistaPos.y),
  vFrostCover, uCamPos, uSunAzimXZ, uSunLow, uGlintK, uGlintT,
  0.02, 500.0, 3000.0, 40000.0, 200000.0);
#include <opaque_fragment>`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  setVisible(v) { if (this.mesh) this.mesh.visible = v; }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
