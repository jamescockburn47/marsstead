import * as THREE from 'three';
import {FBM_GLSL} from './glsl.js';

// Light catches fractured basalt and its settled dust. Surface shading only:
// the original scatter, rock dimensions, collision and horizon stay unchanged.
export function stoneMaterial(){
 const material=new THREE.MeshStandardMaterial({roughness:.94,metalness:0});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePos; varying vec3 vStoneNormal;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvStonePos=position;vStoneNormal=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vStonePos;varying vec3 vStoneNormal;
${FBM_GLSL}
float stoneRelief(vec3 p){return fbm(p.xz*8.+p.yy*3.1)*.7+vnoise(p.xy*43.+p.zz*11.)*.13;}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
float stoneGrain=fbm(vStonePos.xz*6.+vStonePos.yy*2.9);
float stoneDust=smoothstep(-.12,.72,vStoneNormal.y);
float stoneJoint=1.-smoothstep(.015,.055,abs(stoneGrain-.48));
diffuseColor.rgb*=mix(.73,1.12,stoneDust)*( .93+stoneGrain*.14);
diffuseColor.rgb*=1.-stoneJoint*.13;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.08,1.04,.96),stoneDust*.35);`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(.82,.98,stoneDust);`)
   .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
float stoneFade=1.-smoothstep(18.,65.,length(vViewPosition));
 float height=stoneRelief(vStonePos);
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
 vec3 r1=cross(dy,normal),r2=cross(normal,dx);
 float determinant=dot(dx,r1);
 vec3 gradient=sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
 // Derivatives must run for the whole fragment quad. At grazing MSAA edges
 // the tangent determinant can vanish; preserve the original finite normal.
 vec3 stonePerturbed=abs(determinant)*normal-gradient*.018*stoneFade;
 float stoneLength2=dot(stonePerturbed,stonePerturbed);
 if(stoneLength2>1e-12) normal=stonePerturbed*inversesqrt(stoneLength2);`);
 };
 material.customProgramCacheKey=()=> 'mars-basalt-finish-v2';return material;
}
