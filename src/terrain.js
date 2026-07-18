// Terrain scene layer: streams smooth-shaded Mars around the colonist.
// There is NO cheap tile — every chunk in radius builds (the hard-sibling
// rule), so LOD carries the load: near rings at full resolution, far rings
// coarse, skirts hiding the seams. One shared material; geometries are
// disposed when out of range. A chunk whose ring tier changes is rebuilt
// at the new resolution.
//
// The look (DESIGN.md invariant 1, amended): normals are ANALYTIC from the
// pure module — position-only, so chunk borders and LOD rings can never
// disagree — and the fragment shader lays per-pixel procedural detail over
// the vertex-colour base: fbm albedo modulation (multiplicative, so the
// colour law survives) and an fbm normal tilt. Shading only, never
// displacement: the walked surface IS the drawn surface, still.

import * as THREE from 'three';
import { CHUNK, buildChunkData, resForRing } from './marschunk.js';
import { FBM_GLSL } from './glsl.js';

const RADIUS = 9;            // chunks kept loaded around the colonist
const BUILDS_PER_FRAME = 3;

export class TerrainLayer {
  constructor(scene) {
    this.scene = scene;
    // detail amplitudes: the fine tier's values; plain parks both at 0 and
    // the shader's uniform branch skips the noise entirely
    this.detail = {
      uAlbedoAmp: { value: 0.16 },
      uNormalAmp: { value: 0.5 },
    };
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uAlbedoAmp = this.detail.uAlbedoAmp;
      shader.uniforms.uNormalAmp = this.detail.uNormalAmp;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMarsPos;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvMarsPos = position;'); // chunk positions are world-space
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vMarsPos;
uniform float uAlbedoAmp, uNormalAmp;
${FBM_GLSL}
// the detail height-field the normal tilt reads: metre-scale rubble over
// a longer undulation — same fbm family as the sky and the dust
float marsDetailH(vec2 p) {
  return fbm(p * 1.7) * 0.65 + fbm(p * 0.23 + 5.0) * 0.35;
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
if (uAlbedoAmp > 0.001) {
  // per-pixel albedo: two bands of fbm, MULTIPLICATIVE so the vertex
  // palette's warm ordering (the colour law) is preserved per channel
  float aN = fbm(vMarsPos.xz * 0.45) - 0.5;
  float aF = fbm(vMarsPos.xz * 3.1 + 17.3) - 0.5;
  diffuseColor.rgb *= 1.0 + (aN * 0.7 + aF * 0.3) * 2.0 * uAlbedoAmp;
}`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
if (uNormalAmp > 0.001) {
  // per-pixel normal detail: the fbm read as a height field, its XZ
  // gradient tilting the smooth analytic normal. Shading only — the
  // drawn surface never moves (the walked-surface contract).
  float e = 0.35;
  float hC = marsDetailH(vMarsPos.xz);
  float hX = marsDetailH(vMarsPos.xz + vec2(e, 0.0));
  float hZ = marsDetailH(vMarsPos.xz + vec2(0.0, e));
  vec3 wPerturb = vec3(-(hX - hC) / e, 0.0, -(hZ - hC) / e) * uNormalAmp;
  normal = normalize(normal + (viewMatrix * vec4(wPerturb, 0.0)).xyz);
}`);
    };
    this.chunks = new Map();   // key -> { mesh, res }
    this.queue = [];
  }

  // the tier lever: plain zeroes the amps (and the shader's uniform branch
  // skips the noise); fine restores the authored values
  setDetail(on) {
    this.detail.uAlbedoAmp.value = on ? 0.16 : 0;
    this.detail.uNormalAmp.value = on ? 0.5 : 0;
  }

  key(cx, cz) { return `${cx},${cz}`; }

  update(wx, wz) {
    const ccx = Math.floor(wx / CHUNK), ccz = Math.floor(wz / CHUNK);

    // enqueue missing or wrong-res chunks, nearest ring first
    for (let r = 0; r <= RADIUS; r++) {
      const res = resForRing(r);
      for (let cz = ccz - r; cz <= ccz + r; cz++) {
        for (let cx = ccx - r; cx <= ccx + r; cx++) {
          if (Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz)) !== r) continue;
          const k = this.key(cx, cz);
          const have = this.chunks.get(k);
          if (have && have.res === res) continue;
          if (this.queue.some((q) => q.k === k)) continue;
          this.queue.push({ k, cx, cz, res, r });
        }
      }
    }

    // build a few per frame, nearest first
    this.queue.sort((a, b) => a.r - b.r);
    for (let i = 0; i < BUILDS_PER_FRAME && this.queue.length; i++) {
      const { k, cx, cz, res } = this.queue.shift();
      const prev = this.chunks.get(k);
      if (prev) { this.scene.remove(prev.mesh); prev.mesh.geometry.dispose(); }
      const { pos, col, nrm, idx } = buildChunkData(cx, cz, res);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.chunks.set(k, { mesh, res });
    }

    // dispose chunks out of range (invariant 7: geometry never leaks)
    for (const [k, c] of this.chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz)) > RADIUS + 1) {
        this.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        this.chunks.delete(k);
      }
    }
  }
}
