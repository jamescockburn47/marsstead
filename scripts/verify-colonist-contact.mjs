// Exercise the rendered hierarchy: a locked debug target alone cannot prove
// a planted boot. THREE's matrix math runs headlessly without a renderer.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Colonist } from '../src/colonist.js';
import { BONES } from '../src/colonistrig.js';
import { ColonistRig } from '../src/colonistrig.js';
import { floorAt, centreAt } from '../src/underworld.js';

for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
  for (const speed of [1, 2.6, 6]) {
    for (const turning of [false, true]) {
      const c = new Colonist(new THREE.Scene());
      const groundAt = (x, z) => turning ? x * 0.12 + z * 0.08 : 0;
      let x = 0, z = 0, peak = 0, contacts = 0;
      for (let t = 0; t < 5; t += dt) {
        const heading = turning ? t * 0.7 : 0;
        const vx = Math.sin(heading) * speed, vz = Math.cos(heading) * speed;
        x += vx * dt; z += vz * dt;
        c.group.position.set(x, groundAt(x, z), z);
        const pose = c.pose(dt, { x, z, heading, vx, vz, speed, airborne: false, vy: 0, groundAt });
        c.group.updateMatrixWorld(true);
        if (t < 1) continue;
        if (!turning) assert.ok(pose.hipY > 0.60, 'long swing cannot collapse the pelvis into a squat');
        for (const [leg, foot] of [[c.legL, c.rig.feet[0]], [c.legR, c.rig.feet[1]]]) {
          if (!foot.planted) continue;
          const ankle = leg.ankle.getWorldPosition(new THREE.Vector3());
          const up = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(leg.ankle.getWorldQuaternion(new THREE.Quaternion()));
          assert.ok(up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-6,
            'support soles stay level as hips lean and turn');
          const toeDirection = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(leg.ankle.getWorldQuaternion(new THREE.Quaternion()));
          assert.ok(toeDirection.distanceTo(new THREE.Vector3(Math.sin(foot.yaw), 0, Math.cos(foot.yaw))) < 1e-6,
            'planted boot does not rotate with the turning torso');
          peak = Math.max(peak, Math.hypot(ankle.x - foot.px,
            ankle.y - foot.py - BONES.ANKLE_H, ankle.z - foot.pz));
          contacts++;
        }
      }
      assert.ok(contacts > 10, 'both gait and test must observe actual support');
      assert.ok(peak < 0.005,
        `rendered boot misses plant by ${(peak * 100).toFixed(1)} cm; speed ${speed}, turning ${turning}, dt ${dt}`);
      console.log(`  ok  rendered contact ${(peak * 1000).toFixed(3)} mm at ${speed} m/s, ${1 / dt} Hz${turning ? ', turning slope' : ''}`);
    }
  }
}

// Stopping mid-swing must finish a visible catch-up step, never slide a foot
// whose contact flag still says it is supporting the body.
{
  const rig = new ColonistRig();
  const input = { x: 0, z: 0, heading: 0, vx: 0, vz: 2.6, speed: 2.6,
    airborne: false, vy: 0, groundAt: () => 0 };
  for (let i = 0; i < 51; i++) { input.z += 2.6 / 60; rig.step(1 / 60, input); }
  input.speed = 0; input.vz = 0;
  let previous = rig.feet.map((foot) => ({ ...foot }));
  for (let i = 0; i < 180; i++) {
    rig.step(1 / 60, input);
    rig.feet.forEach((foot, j) => {
      if (foot.planted && previous[j].planted) {
        assert.ok(Math.hypot(foot.px - previous[j].px, foot.pz - previous[j].pz) < 1e-8,
          'stopping moves a lifted boot, never a supporting boot');
      }
    });
    previous = rig.feet.map((foot) => ({ ...foot }));
  }
  assert.ok(rig.feet.every((foot) => foot.planted));
  console.log('  ok  stopping finishes a planted, square stance');
}

{
  const rig = new ColonistRig();
  const input = { x: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0,
    airborne: true, vy: 2.3, groundAt: () => 0 };
  let rising, falling;
  for (let i = 0; i < 20; i++) rising = rig.step(1 / 60, input);
  input.vy = -2.3;
  for (let i = 0; i < 30; i++) falling = rig.step(1 / 60, input);
  assert.ok(falling.legL.kneeFlex < rising.legL.kneeFlex - 0.3,
    'jump legs extend to receive the landing instead of holding a frozen tuck');
  input.airborne = false; input.vy = 0;
  const landed = rig.step(1 / 60, input);
  assert.ok(landed.footL.planted && landed.footR.planted);
  const gentle = new ColonistRig();
  for (let i = 0; i < 50; i++) gentle.step(1 / 60, { ...input, airborne: true });
  const softLanding = gentle.step(1 / 60, input);
  assert.ok(landed.hipY < softLanding.hipY - 0.003,
    'a faster impact compresses the knees more even after physics clears vy');
  console.log('  ok  airborne recovery and impact squash');
}
// Trailer cadence on the real curved cave floor: actual displacement is the
// gait input, with exactly one pose step per rendered frame.
{
  const c = new Colonist(new THREE.Scene()), dt = 1 / 24;
  let x=centreAt(72).x,z=72,contacts=0,peak=0;
  for(let i=0;i<144;i++) {
    const heading=.1+Math.sin(i/144*3)*.15, speed=2.35;
    const vx=Math.sin(heading)*speed,vz=Math.cos(heading)*speed;
    x+=vx*dt;z+=vz*dt;c.group.position.set(x,floorAt(x,z),z);
    c.pose(dt,{x,z,heading,vx,vz,speed,airborne:false,vy:0,groundAt:floorAt});
    c.group.updateMatrixWorld(true);
    for(const [leg,foot] of [[c.legL,c.rig.feet[0]],[c.legR,c.rig.feet[1]]]) {
      if(!foot.planted||i<24)continue;
      const ankle=leg.ankle.getWorldPosition(new THREE.Vector3());
      peak=Math.max(peak,Math.hypot(ankle.x-foot.px,ankle.y-foot.py-BONES.ANKLE_H,ankle.z-foot.pz));contacts++;
    }
  }
  assert.ok(contacts>40&&peak<.005,'cave walking maintains rendered support at trailer cadence');
  console.log(`  ok cave support ${(peak*1000).toFixed(3)} mm at 24 fps`);
}
console.log('verify-colonist-contact: all green');
