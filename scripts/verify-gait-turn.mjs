import {strict as assert} from 'node:assert';
import * as THREE from 'three';
import { Colonist } from '../src/colonist.js';
import { strideState, stepTravel, movementEase, movementHeading } from '../src/locomotion.js';
// Exercise the actual rendered hierarchy while reversing at different support
// and flight phases. Instant yaw and a synthetic takeoff previously teleported
// the boot by 425 mm in one 60 Hz frame.
for (const hz of [30,60,120]) {
  for (const phase of ['support','flight']) for (const at of [.1,.6,.9]) {
    const actor=new Colonist(new THREE.Scene()), state=strideState();
    const dt=1/hz;
    let z=0,y=0,vy=0,airborne=false,vz=0,heading=0,reverse=false,previous,peak=0,peakKnee=0;
    for(let i=0;i<hz*5;i++) {
      const oldHeading=heading;
      vz+=((reverse?-6:6)-vz)*movementEase(dt,airborne,true);
      heading=movementHeading(heading,0,vz,dt); z+=vz*dt;
      assert.ok(Math.abs(heading-oldHeading)<=4.5*dt+1e-10,'bounded body turn');
      const m=stepTravel(state,dt,{speed:Math.abs(vz),moving:true,y,vy,airborne,ground:0,
        contact:actor.rig.supportHint(0,z,heading)});
      ({y,vy,airborne}=m); actor.group.position.set(0,y,z);
      const pose=actor.pose(dt,{x:0,z,y,heading,vx:0,vz,speed:Math.abs(vz),airborne,vy,gait:m.gait,groundAt:()=>0});
      actor.group.updateMatrixWorld(true);
      const ankles=[actor.legL,actor.legR].map(leg=>leg.ankle.getWorldPosition(new THREE.Vector3()).sub(actor.group.position));
      if(previous) for(let j=0;j<2;j++) {
        peak=Math.max(peak,ankles[j].distanceTo(previous.ankles[j]));
        peakKnee=Math.max(peakKnee,Math.abs(pose[j?'legR':'legL'].kneeFlex-previous.pose[j?'legR':'legL'].kneeFlex));
      }
      previous={ankles,pose};
      if(!reverse&&i>hz&&m.gait?.phase===phase&&m.gait.u>=at) reverse=true;
    }
    assert.ok(reverse,'requested phase reached');
    console.log(`${hz}Hz reversal ${phase} ${at}: ${(peak*1000).toFixed(0)} mm, ${(peakKnee*180/Math.PI).toFixed(1)} deg/frame`);
    assert.ok(peak<.055+5*dt,'no ankle teleport during reversing takeoff');
  }
}
assert.equal(movementHeading(.4,0,0,1/60),.4,'stationary heading is stable');
assert.ok(Math.abs(movementHeading(Math.PI-.01,-.1,-2,1/60)-(Math.PI-.01))<.1,'turn across angle wrap follows the short arc');
