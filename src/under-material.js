// Dry basalt responds to the real lamps; mineral seams carry specular catches.
import * as THREE from 'three';
import { FBM_GLSL } from './glsl.js';

export function underRockMaterial() {
  const mat=new THREE.MeshStandardMaterial({color:0x696760,roughness:.88,metalness:.015});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vUnderPos;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvUnderPos=position;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vUnderPos;
${FBM_GLSL}
float underHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float underNoise(vec3 p) {
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(underHash(i),underHash(i+vec3(1,0,0)),f.x),
    mix(underHash(i+vec3(0,1,0)),underHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(underHash(i+vec3(0,0,1)),underHash(i+vec3(1,0,1)),f.x),
    mix(underHash(i+vec3(0,1,1)),underHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float underGrain(vec3 p) {
  return underNoise(p*2.1)*.65+underNoise(p*7.3+4.1)*.25+underNoise(p*19.0)*.10;
}
float underSeam(vec3 p) {
  float seam=abs(underNoise(p*.8)-.48);
  return (1.0-smoothstep(.006,.025,seam))*smoothstep(.52,.76,underNoise(p*.23+6.7));
}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
float ug=underGrain(vUnderPos);
float us=underSeam(vUnderPos);
float mass=underNoise(vUnderPos*.47);
vec3 basalt=mix(vec3(.44,.43,.41),vec3(.68,.63,.55),smoothstep(.2,.85,mass));
float bed=vUnderPos.y+vUnderPos.z*.075+underNoise(vUnderPos*.28)*.9;
float joint=1.0-smoothstep(.012,.038,abs(fract(bed*.73)-.5));
float broken=smoothstep(.3,.65,underNoise(vUnderPos*.9+17.));
diffuseColor.rgb*=basalt*(.93+ug*.14)*(1.0-joint*broken*.11);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.37,.3),us*.04);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(.86+ug*.10-us*.08,.76,.98);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
metalnessFactor=.015+us*.07;`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float ue=.038;
float un=underGrain(vUnderPos);
vec3 grad=vec3(underGrain(vUnderPos+vec3(ue,0.,0.))-un,
  underGrain(vUnderPos+vec3(0.,ue,0.))-un,
  underGrain(vUnderPos+vec3(0.,0.,ue))-un)/ue;
vec3 vg=(viewMatrix*vec4(grad,0.)).xyz;
normal=normalize(normal-(vg-normal*dot(vg,normal))*.055);`);
  };
  mat.customProgramCacheKey=()=> 'under-basalt-v4';
  return mat;
}

export function underMachineMaterial(color=0x596765) {
  const mat=new THREE.MeshStandardMaterial({color,roughness:.37,metalness:.72});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vMachinePos;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvMachinePos=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vMachinePos;\n${FBM_GLSL}`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(.26+fbm(vMachinePos.xy*31.0+vMachinePos.zz*9.0)*.35,.24,.63);`);
  };
  mat.customProgramCacheKey=()=> 'under-machine-v1';
  return mat;
}
