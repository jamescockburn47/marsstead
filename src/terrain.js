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
import { FBM_GLSL, FROST_GLINT_GLSL } from './glsl.js';
import { HOME, M_PER_DEG } from './mars.js';

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
    // the frost rig: main.js drives these each frame from frost.js +
    // marstime (the pure contract) — the shader only renders them
    this.frost = {
      uFrostLineN: { value: 90 },   // frost line latitudes (deg)
      uFrostLineS: { value: -90 },
      uMorningK: { value: 0 },      // morningFrost(hourFrac), pre-lat-boost
      uSunAzimXZ: { value: new THREE.Vector2(0, -1) },
      uSunLow: { value: 0 },        // 1 at grazing sun
      uGlintK: { value: 0 },        // master: 0 at night
      uCamPos: { value: new THREE.Vector3() },
      uGlintT: { value: 0 },
    };
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uAlbedoAmp = this.detail.uAlbedoAmp;
      shader.uniforms.uNormalAmp = this.detail.uNormalAmp;
      for (const k of Object.keys(this.frost)) shader.uniforms[k] = this.frost[k];
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
varying vec3 vMarsPos;
varying vec3 vMarsNrm;
varying float vMarsDist;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vMarsPos = position;      // chunk positions are world-space
vMarsNrm = objectNormal;  // the analytic normal, for the slope key`)
        .replace('#include <project_vertex>', `#include <project_vertex>
vMarsDist = -mvPosition.z; // view depth: high-frequency detail fades out`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vMarsPos;
varying vec3 vMarsNrm;
varying float vMarsDist;
uniform float uAlbedoAmp, uNormalAmp;
uniform float uFrostLineN, uFrostLineS, uMorningK, uSunLow, uGlintK, uGlintT;
uniform vec2 uSunAzimXZ;
uniform vec3 uCamPos;
${FBM_GLSL}
${FROST_GLINT_GLSL}
const float MARS_LAT0 = ${HOME.lat.toFixed(4)};
const float MARS_LAT_PER_Z = ${(-1 / M_PER_DEG).toFixed(8)};
const vec2 MARSWIND2 = vec2(0.879, 0.477);
// wind-frame coordinates, stretched along the prevailing wind: isotropic
// blobs read as leopard at grazing sun; elongated ones read as dunes and
// wind streaks (DESIGN.md's own colour spec: wind-streak albedo)
vec2 marsAniso(vec2 p) {
  return vec2(dot(p, MARSWIND2), dot(p, vec2(-MARSWIND2.y, MARSWIND2.x)) * 2.2);
}
// the detail height-field the normal tilt reads: metre-scale rubble over
// a longer wind-stretched undulation — same fbm family as sky and dust.
// rubbleW lets the caller fade the fine band with distance (sub-pixel
// noise at range is shimmer, not detail).
float marsDetailH(vec2 p, float rubbleW) {
  return fbm(p * 1.7) * rubbleW + fbm(marsAniso(p) * 0.23 + 5.0) * 0.35;
}
// NOTE (James's eye, 2026-07-19, twice): periodic ripple fields are OUT.
// Uniform corduroy read artificial; patchy variable-frequency ripples
// moiréd into fringes at grazing sun. The ground's character comes from
// the aperiodic fbm bands alone — no sin() anywhere in this material.`)
        .replace('#include <color_fragment>', `#include <color_fragment>
if (uAlbedoAmp > 0.001) {
  // per-pixel albedo, all bands MULTIPLICATIVE so the vertex palette's
  // warm ordering (the colour law) survives per channel.
  // Past the angle of repose the dust slides off: bared rock reads
  // darker and a touch cooler than the dust that films the flats.
  float mSlope = clamp(1.0 - vMarsNrm.y, 0.0, 1.0);
  float mRocky = smoothstep(0.10, 0.32, mSlope);
  // 65 m country drift, rotated off the lattice: tone, never leopard
  float aP = fbm(vMarsPos.xz * mat2(0.8, -0.6, 0.6, 0.8) * 0.015 + 9.7) - 0.5;
  float aN = fbm(marsAniso(vMarsPos.xz) * 0.45) - 0.5; // 2 m wind-streaked mottle
  float aF = fbm(vMarsPos.xz * 3.1 + 17.3) - 0.5;      // 30 cm speckle
  float mBand = aP * 0.28 + aN * 0.32 + aF * 0.25;
  // sand grain inside arm's reach, gone before it can shimmer
  mBand += (vnoise(vMarsPos.xz * 15.0) - 0.5) * 0.5 * smoothstep(45.0, 8.0, vMarsDist);
  diffuseColor.rgb *= 1.0 + mBand * 2.0 * uAlbedoAmp;
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.70, 0.67),
    mRocky * min(1.0, uAlbedoAmp * 8.0));
}
// the frost lies ON the palette: whitening toward a near-neutral warm
// white where cover holds (flats first — dust slides off the steeps),
// patchy at the edge of cover via the country fbm. mFrostCover is a
// main()-scope local: the glint pass below the lighting reads it too.
float mFrostCover = 0.0;
{
  float mfLat = MARS_LAT0 + vMarsPos.z * MARS_LAT_PER_Z;
  float mfPatch = 0.75 + 0.5 * fbm(vMarsPos.xz * 0.06 + 31.7);
  float mFrost = marsFrost(mfLat, uFrostLineN, uFrostLineS, uMorningK) * mfPatch;
  mFrost *= 1.0 - smoothstep(0.10, 0.32, clamp(1.0 - vMarsNrm.y, 0.0, 1.0));
  mFrostCover = clamp(mFrost, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.93, 0.90), mFrostCover * 0.55);
}`)
        .replace('#include <opaque_fragment>', `
// the sword of the sun, on ground frost: added AFTER lighting so the
// pinpricks punch through the dawn's own dimness
outgoingLight = frostGlint(outgoingLight, vMarsPos, mFrostCover, uCamPos,
  uSunAzimXZ, uSunLow, uGlintK, uGlintT, 1.7, 8.0, 30.0, 600.0, 2400.0);
#include <opaque_fragment>`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
if (uNormalAmp > 0.001) {
  // per-pixel normal detail: height fields read as gradients tilting the
  // smooth analytic normal. Shading only — the drawn surface never moves
  // (the walked-surface contract).
  float e = 0.35;
  // the metre rubble is sub-pixel past ~90 m: fade it before it shimmers
  float mRubbleW = 0.65 * smoothstep(90.0, 20.0, vMarsDist);
  float hC = marsDetailH(vMarsPos.xz, mRubbleW);
  float hX = marsDetailH(vMarsPos.xz + vec2(e, 0.0), mRubbleW);
  float hZ = marsDetailH(vMarsPos.xz + vec2(0.0, e), mRubbleW);
  vec2 mG = vec2(hX - hC, hZ - hC) / e;
  // grain relief only inside ~40 m: crisp boots-level sparkle, no shimmer
  float mGFade = smoothstep(40.0, 7.0, vMarsDist);
  if (mGFade > 0.001) {
    float ge = 0.09;
    float gC = vnoise(vMarsPos.xz * 15.0);
    mG += vec2(vnoise((vMarsPos.xz + vec2(ge, 0.0)) * 15.0) - gC,
               vnoise((vMarsPos.xz + vec2(0.0, ge)) * 15.0) - gC) / ge * 0.02 * mGFade;
  }
  vec3 wPerturb = vec3(-mG.x, 0.0, -mG.y) * uNormalAmp;
  normal = normalize(normal + (viewMatrix * vec4(wPerturb, 0.0)).xyz);
}`);
    };
    this.chunks = new Map();   // key -> { mesh, res }
    this.queue = [];
  }

  // the hopper's arc: streamed ground hides under the vista and returns
  // for the descent — chunks built while hidden arrive hidden
  setVisible(v) {
    this.hidden = !v;
    for (const c of this.chunks.values()) c.mesh.visible = v;
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
      mesh.visible = !this.hidden;
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
