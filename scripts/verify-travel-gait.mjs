import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as locomotion from '../src/locomotion.js';
import { Colonist } from '../src/colonist.js';
import { BONES } from '../src/colonistrig.js';

assert.equal(typeof locomotion.stepTravel, 'function', 'physics must publish the CURRENT support/flight phase after touchdown');
for (const hz of [30, 60, 120]) for (const speed of [2.5, 6]) {
  const c = new Colonist(new THREE.Scene()), state = locomotion.strideState();
  let y = 0, vy = 0, airborne = false, z = 0, previous, contacts = 0, landings = 0, peak = 0;
  for (let i = 0; i < hz * 5; i++) {
    const dt = 1 / hz; z += speed * dt;
    const motion = locomotion.stepTravel(state, dt, { speed, moving: true, y, vy, airborne, ground: 0 });
    ({ y, vy, airborne } = motion);
    c.group.position.set(0, y, z);
    const pose = c.pose(dt, { x: 0, z, y, heading: 0, vx: 0, vz: speed, speed,
      airborne, vy, gait: motion.gait, groundAt: () => 0 });
    c.group.updateMatrixWorld(true);
    if (i > hz && motion.gait) {
      assert.equal(motion.gait.phase === 'flight', airborne, 'pose and physics agree this frame');
      if (previous?.airborne && !airborne) {
        landings++;
        assert.equal(c.rig.feet.filter(f => f.planted).length, 1, 'one landing foot, never a square two-foot replant');
      }
      for (const [leg, f] of [[c.legL, c.rig.feet[0]], [c.legR, c.rig.feet[1]]]) {
        if (!f.planted) continue;
        const contact = leg.ankle.localToWorld(new THREE.Vector3(0, -BONES.ANKLE_H, f.toe ? .20 : 0));
        peak = Math.max(peak, Math.hypot(contact.x - f.px, contact.y - f.py, contact.z - f.pz));
        contacts++;
      }
      for (const p of [pose.legL, pose.legR]) assert.ok(p.kneeFlex >= 0 && p.kneeFlex < 2.6, 'anatomical knee range');
    }
    previous = { airborne };
  }
  assert.ok(landings >= 4 && contacts >= landings * 2, 'exercise repeated real support');
  assert.ok(peak < .008, `rendered support pivot error ${peak} at ${speed} m/s, ${hz} Hz`);
  console.log(`travel gait: ${speed} m/s, ${hz} Hz, ${landings} single-foot landings, ${(peak * 1000).toFixed(2)} mm contact`);
}

// Exercise the old/new gait boundary, release and manual jump with the real
// rendered hierarchy. Fixed-pose tests missed 90-degree startup/landing snaps.
for (const hz of [30,60,120]) {
  const c=new Colonist(new THREE.Scene()), state=locomotion.strideState();
  let y=0,vy=0,airborne=false,z=0,speed=0,previous,peakHip=0,peakKnee=0;
  for(let i=0;i<hz*12;i++) {
    const dt=1/hz,t=i*dt,moving=t>.5&&t<7,target=moving?(t>3?6:2.5):0;
    speed+=(target-speed)*locomotion.movementEase(dt,airborne,moving); z+=speed*dt;
    const m=locomotion.stepTravel(state,dt,{speed,moving,y,vy,airborne,ground:0,
      contact:c.rig.supportHint(0,z,0),manualJump:i===8*hz});
    ({y,vy,airborne}=m); c.group.position.set(0,y,z);
    const pose=c.pose(dt,{x:0,z,y,heading:0,vx:0,vz:speed,speed,airborne,vy,gait:m.gait,groundAt:()=>0});
    if(previous) {
      peakHip=Math.max(peakHip,Math.abs(pose.hipY-previous.hipY));
      for(const leg of ['legL','legR']) peakKnee=Math.max(peakKnee,Math.abs(pose[leg].kneeFlex-previous[leg].kneeFlex));
    }
    previous=pose;
  }
  assert.ok(peakHip<.04,'no body-height discontinuity through startup/landing/release');
  assert.ok(peakKnee<.55,'no large joint reset through startup/manual jump/landing');
  assert.equal(airborne,false); assert.ok(c.rig.feet.every(f=>f.planted),'settles on both feet');
  console.log(`travel transitions ${hz} Hz: max hip ${(peakHip*100).toFixed(1)} cm, knee ${(peakKnee*180/Math.PI).toFixed(1)} degrees/frame`);
}

// Manual jump can interrupt a loaded lope, not just the resting pose. Verify
// the rendered takeoff that originally reset joint smoothing by 30+ degrees.
for (const hz of [30,60,120]) for (const speed of [2.5,6]) for (const at of [.15,.7]) {
  const c=new Colonist(new THREE.Scene()), state=locomotion.strideState(),dt=1/hz;
  let y=0,vy=0,z=0,airborne=false,previous,trigger=false,checked=false;
  for(let i=0;i<hz*3&&!checked;i++) {
    z+=speed*dt;
    const m=locomotion.stepTravel(state,dt,{speed,moving:true,y,vy,airborne,ground:0,manualJump:trigger});
    ({y,vy,airborne}=m);c.group.position.set(0,y,z);
    const pose=c.pose(dt,{x:0,z,y,heading:0,vx:0,vz:speed,speed,airborne,vy,gait:m.gait,groundAt:()=>0});
    if(trigger) {
      assert.ok(airborne&&vy>1.9&&!m.gait,'manual jump interrupts support with its own launch');
      for(const leg of ['legL','legR']) {
        assert.ok(Math.abs(pose[leg].kneeFlex-previous[leg].kneeFlex)<15*dt,'manual takeoff keeps the actual knee seed');
        assert.ok(Math.abs(pose[leg].hipPitch-previous[leg].hipPitch)<10*dt,'manual takeoff keeps the actual hip seed');
      }
      checked=true;
    }
    previous=pose;
    if(i>hz&&m.gait?.phase==='support'&&m.gait.u>=at)trigger=true;
  }
  assert.ok(checked,'loaded manual jump exercised');
}
console.log('loaded manual jumps: 12 rendered takeoffs preserve pose continuity');

// A manual landing must not reconstruct a fictitious mid-walk swing after
// seating both boots. At6m/s this previously moved an ankle846mm relative
// to the body and dropped the pelvis140mm on the contact frame.
for(const hz of [30,60,120]) for(const speed of [1.55,2.5,6]) {
  const c=new Colonist(new THREE.Scene()), state=locomotion.strideState(),dt=1/hz;
  let z=0,y=0,vy=0,airborne=false,jumped=false,landed=false,previous,peak=0;
  for(let i=0;i<hz*4;i++) {
    const manualJump=!jumped&&i>hz&&!airborne;
    if(manualJump) jumped=true;
    z+=speed*dt;
    const m=locomotion.stepTravel(state,dt,{speed,moving:true,y,vy,airborne,ground:0,manualJump,
      contact:c.rig.supportHint(0,z,0)});
    ({y,vy,airborne}=m);c.group.position.set(0,y,z);
    const pose=c.pose(dt,{x:0,z,y,heading:0,vx:0,vz:speed,speed,airborne,vy,gait:m.gait,groundAt:()=>0});
    c.group.updateMatrixWorld(true);
    const ankles=[c.legL,c.legR].map(leg=>leg.ankle.getWorldPosition(new THREE.Vector3()).sub(c.group.position));
    if(jumped&&previous?.airborne&&!airborne)landed=true;
    if(landed) {
      for(let j=0;j<2;j++)peak=Math.max(peak,ankles[j].distanceTo(previous.ankles[j]));
      assert.ok(Math.abs(pose.hipY-previous.pose.hipY)<.045,'manual landing keeps pelvis continuous');
      assert.ok(peak<.08+6*dt,'manual landing and resumed travel have no fictitious recovery target');
    }
    previous={ankles,airborne,pose};
  }
  assert.ok(landed,'actual manual landing exercised');
  console.log(`manual landing ${hz}Hz ${speed}m/s: peak postlanding ankle ${(peak*1000).toFixed(0)}mm/frame`);
}
