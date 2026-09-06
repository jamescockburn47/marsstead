// Whole-body travelling gait. The controller owns phase and the supporting
// side. Foot paths are artistic suited-Mars motion, not captured Mars data.
import { solveFoot, supportHeight } from './colonistcontact.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
// Hermite paths ease foot exchange into a quieter airborne carrying interval.
function curve(keys, u) {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], p = keys[Math.max(0, i - 1)], n = keys[Math.min(keys.length - 1, i + 2)];
  const d = b[0] - a[0], t = clamp((u - a[0]) / d, 0, 1);
  const m0 = (b[1] - p[1]) / (b[0] - p[0]), m1 = (n[1] - a[1]) / (n[0] - a[0]);
  return (2*t**3-3*t*t+1)*a[1] + (t**3-2*t*t+t)*d*m0
    + (-2*t**3+3*t*t)*b[1] + (t**3-t*t)*d*m1;
}
function localFoot(f, input, z, height) {
  const fx = Math.sin(input.heading), fz = Math.cos(input.heading);
  f.px = input.x + fx * z + fz * f.side * .10;
  f.pz = input.z + fz * z - fx * f.side * .10;
  f.py = input.y + height;
  f.yaw = input.heading; f.planted = false; f.toe = false;
}
export function stepLope(rig, dt, input, bones, solveLeg, springStep) {
  const { gait: g, speed, heading, x, z } = input, u = g.u;
  const grounded = g.phase === 'support';
  const ground = input.groundAt(x, z);
  const rootY = Number.isFinite(input.y) ? input.y : ground;
  input = { ...input, y: rootY };
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const entering = !rig.lope || rig.first || Math.hypot(x-rig.lastX,z-rig.lastZ)>1.5;
  if (entering) rig.lope = { cycle: -1, blend: 0,
    hip: rig.lastPose?.hipY ?? .78, phase: null,
    feet: rig.feet.map(f=>({z:(f.px-x)*fx+(f.pz-z)*fz, h:f.py-ground})) };
  const memo = rig.lope;
  memo.blend = Math.min(1, memo.blend + dt / .16);
  // Seed each takeoff from the actual ankle, including a turning support.
  // Express the offset in world axes: yaw must not rotate a planted boot.
  if (!grounded && memo.phase !== 'flight') {
    memo.takeoff = rig.feet.map(f => {
      const a = -(f.style || 0), along = .20*Math.cos(a)-bones.ANKLE_H*Math.sin(a);
      return { x: f.px-rig.lastX-(f.toe?Math.sin(f.yaw)*along:0),
        z: f.pz-rig.lastZ-(f.toe?Math.cos(f.yaw)*along:0),
        h: f.py-(memo.rootY ?? rootY)+(f.toe?.20*Math.sin(a)+bones.ANKLE_H*(Math.cos(a)-1):0),
        style: f.style || 0 };
    });
  }
  const pose = { legL: {}, legR: {} };
  // Compression is in the knees; flight height comes ONLY from physics.
  const hip = grounded
    ? curve([[0,.774],[.30,.750],[.65,.767],[1,.788]],u)
    : .788 - .014 * smooth(u);
  pose.hipY = memo.hip + (hip-memo.hip)*smooth(memo.blend);
  const accel = clamp((speed-rig.lastSpeed)/dt,-12,12);
  springStep(rig.leanS, .10 + speed*.010 + accel*.010, 12, 1, dt);
  let turn = (heading-rig.lastHeading+Math.PI*3)%(Math.PI*2)-Math.PI;
  springStep(rig.rollS, clamp(-turn/dt*speed*.015,-.20,.20),10,1,dt);
  springStep(rig.swayS, grounded ? g.side*.026*Math.sin(Math.PI*u) : 0,14,1,dt);
  pose.sway = rig.swayS.x;
  const styles = [0,0];
  for (let i=0;i<2;i++) {
    const f=rig.feet[i], supportSide=f.side===g.side;
    f.lift=null; f.swingStart=null;
    if (grounded && supportSide) {
      if (memo.cycle!==g.cycle) {
        // Toe is the fixed support pivot, also when the sole is flat.
        f.px=x+fx*(g.ahead-g.distance+.20)+fz*f.side*bones.FOOT_LAT;
        f.pz=z+fz*(g.ahead-g.distance+.20)-fx*f.side*bones.FOOT_LAT;
        f.py=input.groundAt(f.px,f.pz); f.yaw=heading;
      }
      f.planted=true; f.toe=true;
      const pushStyle=-.28*smooth((u-.64)/.36)*smooth(memo.blend);
      styles[i] = g.stopping ? (f.style || 0)*Math.exp(-12*dt) : pushStyle;
    } else if (grounded) {
      localFoot(f,input,curve([[0,-.08],[.35,-.04],[1,.16]],u),
        curve([[0,.045],[.38,.085],[1,.075]],u));
      styles[i] = -.10;
    } else if (supportSide) {
      // The unloaded boot trails low through flight. Carrying both boots
      // ahead of the hip made the first reference pass look seated.
      localFoot(f,input,curve([[0,-g.ahead+.035],[.28,-.17],[.56,-.13],[.80,-.11],[1,-.08]],u),
        curve([[0,.050],[.28,.075],[.56,.06],[.80,.05],[1,.045]],u));
      styles[i]=curve([[0,-.28],[.3,-.22],[1,-.10]],u);
    } else {
      // Swing knee leads; the boot opens late and approaches ground with
      // the body. It is this same foot that receives the NEXT support.
      const catchAhead=Math.min(.28,Math.max(.08,speed*Math.min(.24,.56/Math.max(speed,1))*.5));
      localFoot(f,input,curve([[0,.16],[.28,.24],[.68,.25],[1,catchAhead]],u),
        curve([[0,.075],[.28,.085],[.68,.055],[1,0]],u));
      styles[i]=curve([[0,-.10],[.40,.05],[1,0]],u);
    }
    if (!grounded && memo.takeoff) {
      const from=memo.takeoff[i], k=smooth(u/.32);
      f.px=x+from.x+(f.px-x-from.x)*k;
      f.pz=z+from.z+(f.pz-z-from.z)*k;
      f.py=rootY+from.h+(f.py-rootY-from.h)*k;
      styles[i]=from.style+(styles[i]-from.style)*k;
    }
    f.style=styles[i];
    if (grounded && !f.planted && memo.blend<1) {
      const k=smooth(memo.blend), from=memo.feet[i];
      const dz=(f.px-x)*fx+(f.pz-z)*fz;
      localFoot(f,input,from.z+(dz-from.z)*k,from.h+(f.py-rootY-from.h)*k);
    }
  }
  memo.cycle=g.cycle; memo.phase=g.phase; memo.rootY=rootY;
  // Convert support pivot into the ankle target. The toe remains fixed
  // while the heel lifts, instead of rotating a boot through the ground.
  const targets=rig.feet.map((f,i)=>{
    if (!f.planted) return {...f,py:f.py-rootY+ground};
    const a=-styles[i], along=.20*Math.cos(a)-bones.ANKLE_H*Math.sin(a);
    return {...f,px:f.px-Math.sin(f.yaw)*along,pz:f.pz-Math.cos(f.yaw)*along,
      py:f.py+.20*Math.sin(a)+bones.ANKLE_H*(Math.cos(a)-1)};
  });
  pose.hipY=supportHeight(pose,targets,{...input,groundAt:()=>ground},bones);
  for (let i=0;i<2;i++) {
    const out=i===0?pose.legL:pose.legR;
    Object.assign(out,solveFoot(targets[i],pose,{...input,groundAt:()=>ground},bones,solveLeg));
    out.anklePitch+=styles[i];
  }
  const legDifference=pose.legR.hipPitch-pose.legL.hipPitch;
  // Apollo reference: hands carried ahead/out for balance, restrained
  // opposition rather than a sprinter's mirrored shoulder drive.
  const swing=clamp(legDifference*.18,-.18,.18);
  springStep(rig.armS[0],swing,24,1,dt); springStep(rig.armS[1],-swing,24,1,dt);
  pose.armL={shoulderPitch:.18+rig.armS[0].x,elbowFlex:.70+Math.max(0,swing)*.20,abduct:.24};
  pose.armR={shoulderPitch:.18+rig.armS[1].x,elbowFlex:.70+Math.max(0,-swing)*.20,abduct:.24};
  pose.pelvisYaw=clamp(legDifference*.07,-.10,.10);
  pose.torsoYaw=-pose.pelvisYaw*.65;
  pose.pelvisPitch=rig.leanS.x;
  pose.torsoPitch=pose.pelvisPitch*.6; // view retains .4 pelvis lean for walking
  pose.pelvisRoll=rig.rollS.x+(grounded?-g.side*.024*Math.sin(Math.PI*u):0);
  springStep(rig.packS,pose.hipY,13,.7,dt);
  pose.packOff=clamp((rig.packS.x-pose.hipY)*.10,-.008,.008);
  pose.breath=Math.sin(rig.t*1.46);
  pose.footL={x:rig.feet[0].px,y:rig.feet[0].py,z:rig.feet[0].pz,planted:rig.feet[0].planted};
  pose.footR={x:rig.feet[1].px,y:rig.feet[1].py,z:rig.feet[1].pz,planted:rig.feet[1].planted};
  pose.duty=grounded?1:0;
  rig.hipYS.x=pose.hipY; rig.hipYS.v=0;
  rig.lastX=x; rig.lastZ=z; rig.lastSpeed=speed; rig.lastHeading=heading;
  rig.prevAirborne=input.airborne; rig.lastVy=input.vy; rig.first=false;
  rig.lastLopePose=pose;
  rig.lastPose=pose;
  return pose;
}
