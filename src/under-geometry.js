// Geometry samples the exact locomotion shell. Relief never moves the floor.
import { centreAt, floorAt, UNDER_LENGTH } from './underworld.js';

export const UNDER_SIDES = 96;
export const UNDER_STEP = .5;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Piecewise-linear fracture profiles replace the smooth radial modulation.
function jointWave(n){const i=Math.floor(n),f=n-i;const h=k=>Math.sin(k*12.9898+78.233)*43758.5453%1;return h(i)*(1-f)+h(i+1)*f;}
export function shellPoint(z, angle) {
  const c = centreAt(z), s = Math.sin(angle), co = Math.cos(angle);
  if(s <= 0) {
    const x = c.x + c.width * co;
    return [x, floorAt(x,z), z];
  }
  const vault = Math.pow(s,.62);
  const relief=.075*jointWave(z*.27+co*1.3)+.065*jointWave(z*.09+angle*1.1);
  return [c.x+c.width*co*(1+.10*s*jointWave(z*.18+angle)),
    c.y+c.height+c.height*vault*(1+relief),z];
}

export function shellNormal(z, angle) {
  const a=shellPoint(z,angle-.001),b=shellPoint(z,angle+.001);
  const c=shellPoint(Math.max(0,z-.01),angle),d=shellPoint(Math.min(UNDER_LENGTH,z+.01),angle);
  const u=b.map((n,i)=>n-a[i]),v=d.map((n,i)=>n-c[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const length=Math.hypot(...n)||1;
  return n.map(value=>-value/length);
}

export function underShellData() {
  const rows = Math.round(UNDER_LENGTH/UNDER_STEP)+1;
  const positions = new Float32Array(rows*(UNDER_SIDES+1)*3), indices=[];
  for(let i=0;i<rows;i++) for(let j=0;j<=UNDER_SIDES;j++) {
    positions.set(shellPoint(i*UNDER_STEP,j/UNDER_SIDES*Math.PI*2), (i*(UNDER_SIDES+1)+j)*3);
  }
  for(let i=0;i<rows-1;i++) for(let j=0;j<UNDER_SIDES;j++) {
    const a=i*(UNDER_SIDES+1)+j,b=a+1,c=a+UNDER_SIDES+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  return {positions,indices:new Uint32Array(indices),rows};
}
export function underCapData(z) {
  const c=centreAt(z), positions=[c.x,c.y+c.height,z], indices=[];
  for(let j=0;j<=UNDER_SIDES;j++) positions.push(...shellPoint(z,j/UNDER_SIDES*Math.PI*2));
  for(let j=1;j<=UNDER_SIDES;j++) {
    if(z===0) indices.push(0,j,j+1); else indices.push(0,j+1,j);
  }
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices)};
}

// Large joint-bounded masses penetrate the wall/roof. Their lower edge follows
// actual floor contact; no floating rounded stones and no new walk obstacles.
export function fractureShelfData(z, side, seed, {ceiling=false, span=1, rise=.7, length=2}={}) {
  const positions=[],indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
  const hash=n=>{const f=Math.sin(n*127.1+seed*311.7)*43758.5453;return f-Math.floor(f);};
  // Four corners clockwise in x/z; side changes geological placement, not winding.
  for(let top=0;top<2;top++)for(const [j,[dx,dz]] of [[-1,-1],[1,-1],[1,1],[-1,1]].entries()){
    const zz=clamp(z+dz*length*(.86+hash(j)*.22)+(top? (hash(j+31)-.5)*1.8:0),.3,UNDER_LENGTH-.3),c=centreAt(zz);
    let x,y;
    if(ceiling){
      x=c.x+side*c.width*.40+dx*Math.min(span,c.width*.65);
      const a=Math.acos(clamp((x-c.x)/c.width,-.98,.98));
      const roof=shellPoint(zz,a)[1];
      y=top?roof+1.2:Math.max(c.y+c.height*.4+3.12,roof-.45-rise*.3+hash(j+9)*.3);
    }else{
      const inside=side*dx<0;
      x=c.x+side*c.width*(inside?.845+hash(j)*.04:1.24);
      // The rear penetrates the existing shell. Front faces lean slightly.
      if(top&&inside)x+=side*(.08+hash(j+43)*.35);
      y=top?c.y+c.height*(1.13+hash(seed)*.47)+hash(j+8)*rise:floorAt(x,zz)-.24;
    }
    positions.push(x,y,zz);
  }
  // A second fracture level folds each large face instead of presenting a
  // straight concrete panel. Outward offsets preserve the walk-clearance shell.
  const mid=[];
  for(let j=0;j<4;j++){
    const a=positions.slice(j*3,j*3+3),b=positions.slice((j+4)*3,(j+4)*3+3);
    const f=.35+hash(j+81)*.30;
    const p=a.map((v,k)=>v+(b[k]-v)*f);
    if(!ceiling)p[0]+=side*(.12+hash(j+91)*.34);
    else p[1]+=.12+hash(j+91)*.24;
    mid.push(...p);
  }
  positions.push(...mid);indices.length=0;
  indices.push(0,1,2,0,2,3,4,6,5,4,7,6);
  for(let j=0;j<4;j++){
    const n=(j+1)%4,a=j,b=n,c=8+j,d=8+n,e=4+j,f=4+n;
    indices.push(a,c,b,b,c,d,c,e,d,d,e,f);
  }  // A planar facet can cut inside a curved corridor between its vertices.
  // Sample each triangle and shift the whole attached mass outward if needed.
  let correction=0;
  for(let i=0;i<indices.length;i+=3)for(let a=0;a<=8;a++)for(let b=0;b<=8-a;b++){
    const w=[a/8,b/8,1-(a+b)/8],p=[0,0,0];
    for(let k=0;k<3;k++)for(let d=0;d<3;d++)p[d]+=positions[indices[i+k]*3+d]*w[k];
    const c=centreAt(p[2]);
    correction=Math.max(correction,ceiling?c.y+c.height*.4+3.12-p[1]:c.width*.845-side*(p[0]-c.x));
  }
  if(correction>0)for(let i=0;i<positions.length;i+=3)positions[i+(ceiling?1:0)]+=correction*(ceiling?1:side)+.005*(ceiling?1:side);  return {positions:new Float32Array(positions),indices:new Uint32Array(indices)};
}
