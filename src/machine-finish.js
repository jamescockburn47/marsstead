import * as THREE from 'three';

// Powder-coated pressure covers and bead-blasted fittings, shared by both fleets.
// Small, derivative-filtered grain changes reflected light without changing shape.
export function machineFinish(color, roughness = .56, metalness = .3) {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 machineFinishPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nmachineFinishPosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 machineFinishPosition;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float finishAA=1.0-smoothstep(.002,.009,length(fwidth(machineFinishPosition)));
      float finishGrain=sin(machineFinishPosition.x*790.)*sin(machineFinishPosition.y*830.+machineFinishPosition.z*910.);
      roughnessFactor=clamp(roughnessFactor+finishGrain*.045*finishAA,.25,1.);`);
  };
  material.customProgramCacheKey = () => 'machine-powder-coat-v1';
  return material;
}
