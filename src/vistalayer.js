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
import { FBM_GLSL } from './glsl.js';

const N = 110;                 // verts per side — coarse is honest at altitude

export class VistaLayer {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
  }

  // build centred on the hop's midpoint, spanning the track with margin
  build(from, to) {
    this.dispose();
    const cx = (from[0] + to[0]) / 2, cz = (from[1] + to[1]) / 2;
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const span = Math.max(90000, dist * 1.7 + 60000);
    const step = span / (N - 1);
    const pos = new Float32Array(N * N * 3);
    const col = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = cx - span / 2 + i * step;
        const z = cz - span / 2 + j * step;
        const h = meshGroundHeight(x, z);
        const k = (j * N + i) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
        const hx = meshGroundHeight(x + step, z) - h;
        const hz = meshGroundHeight(x, z + step) - h;
        const steep = Math.min(1, Math.hypot(hx, hz) / step * 3);
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
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vVistaPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVistaPos = position.xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vVistaPos;
${FBM_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float vA = fbm(vVistaPos * 0.0011 + 3.3) - 0.5;
  float vB = fbm(vVistaPos * 0.0058 + 21.0) - 0.5;
  diffuseColor.rgb *= 1.0 + (vA * 0.30 + vB * 0.16);
}`);
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
