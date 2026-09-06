import * as THREE from 'three';

// Curved, thin laminae: silhouette and posture vary before surface detail.
export function leafGeometry(length, width, curl = .3, lobes = 0, tint = 0x689b47) {
  const p = [], uv = [], colors = [], indices = [], color = new THREE.Color(tint);
  const rows = 10, cols = 6;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const t = i / rows, s = j / cols * 2 - 1;
    const edge = Math.pow(Math.sin(Math.PI * t), .85) * (1 + lobes * Math.sin(t * 28));
    p.push(s * width * edge * (1 + .07 * Math.sin(t*17+s)),
      length * (curl * t * t + .13 * Math.abs(s) * Math.sin(t * Math.PI) + .02*Math.sin(t*25)*s*s), t * length);
    uv.push(j / cols, t);
    const shade = .69 + .19 * t - .09 * Math.abs(s);
    colors.push(color.r * shade, color.g * shade, color.b * shade);
    if (i < rows && j < cols) {
      const a = i * (cols + 1) + j;
      indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function foliageMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .94, metalness: 0,
    vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vLeafUv;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      float midrib = exp(-abs(vLeafUv.x-.5)*130.);
      float sidevein = pow(max(0.,cos((vLeafUv.y-abs(vLeafUv.x-.5)*.65)*100.)),28.);
      diffuseColor.rgb *= 1. + .13 * midrib + .055 * sidevein;
      diffuseColor.rgb *= .96 + .04*sin(vLeafUv.x*890.)*sin(vLeafUv.y*650.);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * .015;`);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vLeafUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLeafUv = uv;');
  };
  m.customProgramCacheKey = () => 'living-leaf-v2'; return m;
}

// Every plant has a repeatable age, angle and posture; no shared randomness.
export function plant(draw, m, x, y, z, kind, seed) {
  const rnd = n => { const v = Math.sin(seed * 73.17 + n * 19.31) * 43758.5453; return v - Math.floor(v); };
  const age = .63 + rnd(1) * .54;
  const leaf = (px, py, pz, len, width, angle, tilt, n, lobes = 0) => {
    const color = new THREE.Color().setHSL(.24 + rnd(n + 31) * .09, .42 + rnd(n + 6) * .27, .12 + rnd(n + 7) * .12);
    const g = leafGeometry(len * age, width * age, -.28 + rnd(n + 9) * .48, lobes, color);
    const mesh = draw.custom(g, px, py, pz, m.foliage);
    mesh.rotation.set(tilt, angle, rnd(n + 4) * .4 - .2);
  };
  const stem = (a, b, r = .008) => {
    const delta = new THREE.Vector3(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
    const twig = draw.cylinder((a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2, r, delta.length(), m.stem);
    twig?.quaternion?.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize());
  };
  if (kind === 'lettuce') {
    for (let i = 0; i < 17; i++) {
      const a = i * 2.39996, ring = i / 17;
      leaf(x, y + ring * .11, z, .43 - ring * .21, .19 - ring * .07, a, -.05 - ring * .95, i, .09);
    }
  } else if (kind === 'grass') {
    for (let i = 0; i < 19; i++) leaf(x + (rnd(i + 5) - .5) * .15, y, z + (rnd(i + 29) - .5) * .15,
      .46 + rnd(i) * .38, .012, i * 2.4, -1.08, i);
  } else if (kind === 'tomato' || kind === 'bean') {
    const height = (kind === 'tomato' ? 1.35 : 1.75) * age;
    let previous = [x,y,z];
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4 + rnd(51)*6, py = y + height * (.1 + i / 12);
      const origin = [x+Math.sin(i*.62+seed)*.055,py,z+Math.cos(i*.74+seed)*.06];
      stem(previous, origin, .012); previous=origin;
      const reach = (.19 + rnd(i+13)*.19)*(1-i*.035);
      const tip = [origin[0]+Math.sin(a)*reach,py+.025,origin[2]+Math.cos(a)*reach];
      stem(origin,tip,.006);
      for(let j=0;j<(kind==='tomato'?5:3);j++) {
        const f=.32+j*.15, side=j%2?1:-1;
        leaf(origin[0]+(tip[0]-origin[0])*f, py+.02*f, origin[2]+(tip[2]-origin[2])*f,
          kind==='tomato'?.18:.25, kind==='tomato'?.052:.085,a+side*.85,-.15+rnd(i+j)*.25,i*9+j,kind==='tomato'?.18:0);
      }
      if (kind === 'tomato' && i % 4 === 1) {
        for (let k = 0; k < 3; k++) {
          const fx=tip[0]+k*.045, fy=py-.10-k*.038, fz=tip[2];
          stem(tip,[fx,fy+.035,fz],.003);
          draw.sphere(fx,fy,fz,.044+rnd(i+k)*.012,k===2?m.unripe:m.fruit);
        }
      }
    }
  } else if (kind === 'vine') {
    for (let i = 0; i < 16; i++) leaf(x + Math.sin(i * .55) * .16, y - i * .082,
      z + i * .018, .18, .085, i * 2.4, .24, i);
  } else {
    for (let branch = 0; branch < 4; branch++) {
      const px = x + (rnd(branch + 33) - .5) * .23, pz = z + (rnd(branch + 44) - .5) * .23;
      const height = kind === 'seedling' ? .13 : .42 * age;
      draw.cylinder(px, y + height / 2, pz, .009, height, m.stem);
      for (let i = 0; i < (kind === 'seedling' ? 2 : 6); i++) leaf(px, y + height * (.22 + i * .12), pz,
        kind === 'seedling' ? .075 : .17, kind === 'seedling' ? .035 : .07, i * 2.4 + branch, -.15, i + branch);
    }
  }
}
