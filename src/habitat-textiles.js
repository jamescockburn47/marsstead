import * as THREE from 'three';

export function textileMaterial(color) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 clothPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nclothPosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 clothPosition;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      float weave = sin(clothPosition.x*580.)*sin(clothPosition.z*610.);
      float threadAA = 1.0-smoothstep(.001,.007,length(fwidth(clothPosition)));
      diffuseColor.rgb *= .95 + .035*weave*threadAA;`);
  };
  material.customProgramCacheKey = () => 'woven-cloth-v2'; return material;
}

// A compressed superellipsoid gives an inflated stitched edge and a soft crown.
export function cushionGeometry(w, h, d) {
  const geometry = new THREE.SphereGeometry(1, 36, 24), a = geometry.attributes.position;
  const soft = (v, power) => Math.sign(v) * Math.pow(Math.abs(v), power);
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    a.setXYZ(i, soft(x, .5) * w / 2, soft(y, .75) * h / 2 + .014 * Math.sin(x * 16 + z * 8) * (1 - Math.abs(y)),
      soft(z, .5) * d / 2);
  }
  geometry.computeVertexNormals(); return geometry;
}

export function duvetGeometry(w, d) {
  const geometry = new THREE.PlaneGeometry(w, d, 48, 32); geometry.rotateX(-Math.PI / 2);
  const a = geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), z = a.getZ(i), edge = Math.abs(z) / (d / 2);
    a.setY(i, .045 + .026 * Math.sin(x * 7 + z * 3) + .012 * Math.sin(z * 17 - x * 2)
      + .016 * Math.cos(x * 13) - .16 * Math.pow(edge, 9));
  }
  geometry.computeVertexNormals(); return geometry;
}
