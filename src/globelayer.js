// The globe — the whole planet at once, for the attract reel's opening
// (and one day the orbital chart: DESIGN.md — "the orbital view IS the
// chart page"). A sphere whose radius closes the game world's own wrap
// (mars.js M_PER_DEG: ~107 km around), displaced by the real MOLA
// skeleton and painted by the same colourFor palette as every walked
// chunk — one truth, three readers. Around it, a back-side rim shell
// carries the atmosphere: the butterscotch band fringed blue that real
// orbital photography shows, the same colours the sky dome's limb wears.
// Zero assets; built once; a render of the map, never a walked surface.

import * as THREE from 'three';
import { M_PER_DEG, elevationReal, latLonToWorld } from './mars.js';
import { colourFor } from './marschunk.js';
import { FBM_GLSL } from './glsl.js';

// the world's own geometry: circumference = 360 * M_PER_DEG
export const GLOBE_R = (360 * M_PER_DEG) / (2 * Math.PI);   // ~16,960 m
// relief exaggeration: real relief/radius on Mars is ~0.6% — honest but
// invisible; ×8 keeps Olympus and Hellas legible without cliff-world
export const RELIEF = 0.08;

export class GlobeLayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    // ---- the planet: lat/lon grid displaced by MOLA ----------------------
    const NLON = 192, NLAT = 96;
    const pos = [], col = [], idx = [];
    for (let j = 0; j <= NLAT; j++) {
      const lat = 90 - (j / NLAT) * 180;
      for (let i = 0; i <= NLON; i++) {
        const lon = (i / NLON) * 360;
        const hReal = elevationReal(lat, lon);
        const r = GLOBE_R + hReal * RELIEF;
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = lon * (Math.PI / 180);
        pos.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        );
        const { x, z } = latLonToWorld(lat, lon);
        const c = colourFor(hReal * 0.025, x, z, 0);
        col.push(c[0], c[1], c[2]);
      }
    }
    for (let j = 0; j < NLAT; j++) {
      for (let i = 0; i < NLON; i++) {
        const a = j * (NLON + 1) + i, b = a + 1;
        const c2 = a + (NLON + 1), d = c2 + 1;
        idx.push(a, b, c2, b, d, c2); // outward winding: a planet, not a bowl
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
    // per-pixel country over the vertex palette — the family's fbm, so
    // the planet from space wears the same skin language as the ground
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGlobePos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlobePos = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vGlobePos;
${FBM_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float gA = fbm(vGlobePos.xy * 0.0016 + 5.0) - 0.5;
  float gB = fbm(vGlobePos.zx * 0.0007 + 31.0) - 0.5;
  diffuseColor.rgb *= 1.0 + gA * 0.13 + gB * 0.17;
}`);
    };
    this.planet = new THREE.Mesh(geo, mat);
    this.group.add(this.planet);

    // ---- the atmosphere: a back-side fresnel rim shell -------------------
    const rimGeo = new THREE.SphereGeometry(GLOBE_R * 1.035, 96, 64);
    const rimMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false,
      uniforms: { uSunDir: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vW;
        void main() {
          vN = normalize(normalMatrix * normal);
          vW = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vN; varying vec3 vW;
        uniform vec3 uSunDir;
        void main() {
          // back-side shell: the rim is where the view grazes the sphere —
          // butterscotch at the deck, blue fringing outward, sun-side lit
          vec3 V = normalize(cameraPosition - vW);
          float rim = pow(1.0 - abs(dot(normalize(vN), V)), 2.2);
          vec3 nOut = normalize(vW - vec3(0.0));
          float sunSide = 0.35 + 0.65 * max(0.0, dot(normalize(uSunDir), -normalize(vN)));
          vec3 col = mix(vec3(0.82, 0.44, 0.19), vec3(0.45, 0.62, 0.85), rim * 0.75);
          gl_FragColor = vec4(col, rim * 0.85 * sunSide);
        }`,
    });
    this.rim = new THREE.Mesh(rimGeo, rimMat);
    this.group.add(this.rim);
  }

  // park the globe far below the flat world; the reel's planet shot flies
  // the camera to it. Spin is the only motion — a world turning in space.
  setPlaced(x, y, z) { this.group.position.set(x, y, z); }
  setVisible(v) { this.group.visible = v; }
  setSun(dir) { this.rim.material.uniforms.uSunDir.value.copy(dir); }
  update(dt) { this.group.rotation.y += dt * 0.02; }

  get centre() { return this.group.position; }
}
