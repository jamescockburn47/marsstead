import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Colonist } from '../src/colonist.js';
import { strideState, stepTravel, movementEase } from '../src/locomotion.js';
import { BONES } from '../src/colonistrig.js';

function simulation(hz) {
  const c = new Colonist(new THREE.Scene()), state = strideState(), dt = 1 / hz;
  let y = 0, vy = 0, airborne = false, z = 0, speed = 0;
  return { c, dt, step(target, moving) {
    speed += (target - speed) * movementEase(dt, airborne, moving); z += speed * dt;
    const motion = stepTravel(state, dt, { speed, moving, y, vy, airborne, ground: 0,
      contact: c.rig.supportHint(0, z, 0) });
    ({ y, vy, airborne } = motion); c.group.position.set(0, y, z);
    const pose = c.pose(dt, { x: 0, z, y, heading: 0, vx: 0, vz: speed, speed,
      airborne, vy, gait: motion.gait, groundAt: () => 0 });
    c.group.updateMatrixWorld(true);
    const ankles = [c.legL, c.legR].map(leg => leg.ankle.getWorldPosition(new THREE.Vector3()).sub(c.group.position));
    return { motion, pose, ankles, speed };
  } };
}

for (const hz of [30, 60, 120]) for (const speed of [2.5, 6]) {
  // Choose actual sampled phases, then replay their full controller history.
  const warmup = simulation(hz), samples = [];
  for (let i = 0; i < hz * 5; i++) {
    const frame = warmup.step(speed, true), gait = frame.motion.gait;
    if (gait?.cycle >= 3) samples.push({ i, phase: gait.phase, u: gait.u });
  }
  let peakAnkle = 0, peakKnee = 0, exits = 0;
  for (const phase of ['support', 'flight']) for (const u of [.15, .6, .85]) {
    const chosen = samples.filter(s => s.phase === phase).reduce((a, b) =>
      Math.abs(a.u - u) < Math.abs(b.u - u) ? a : b);
    const run = simulation(hz);
    let previous;
    for (let i = 0; i <= chosen.i; i++) previous = run.step(speed, true);
    let exited = false, recovering = -1, recoveryFrames = 0;
    for (let i = 0; i < hz * 3; i++) {
      const frame = run.step(0, false);
      if (previous.motion.gait && !frame.motion.gait) {
        exited = true; exits++;
        recovering = run.c.rig.feet.findIndex(f => !f.planted);
        assert.ok(recovering >= 0, 'lope exit keeps the recovering boot airborne for a settling step');
      }
      if (exited && recovering >= 0 && !run.c.rig.feet[recovering].planted) recoveryFrames++;
      for (let leg = 0; leg < 2; leg++) {
        const ankleMove = frame.ankles[leg].distanceTo(previous.ankles[leg]);
        const tag = leg ? 'legR' : 'legL';
        const kneeMove = Math.abs(frame.pose[tag].kneeFlex - previous.pose[tag].kneeFlex);
        peakAnkle = Math.max(peakAnkle, ankleMove); peakKnee = Math.max(peakKnee, kneeMove);
        assert.ok(ankleMove < .035 + 5 * run.dt,
          `${hz} Hz ${speed} m/s ${phase} release u=${chosen.u.toFixed(3)} frame${i} gait${frame.motion.gait?.phase} u${frame.motion.gait?.u}: ankle jumps ${Math.round(ankleMove * 1000)} mm`);
        assert.ok(kneeMove < .22 + 12 * run.dt,
          `${hz} Hz ${speed} m/s ${phase} release frame${i} gait${frame.motion.gait?.phase} u${frame.motion.gait?.u}: knee changes ${(kneeMove * 180 / Math.PI).toFixed(1)} degrees`);
      }
      if (exited) for (const [leg, foot] of [[run.c.legL, run.c.rig.feet[0]], [run.c.legR, run.c.rig.feet[1]]]) {
        if (!foot.planted) continue;
        const sole = leg.ankle.localToWorld(new THREE.Vector3(0, -BONES.ANKLE_H, foot.toe ? .20 : 0));
        assert.ok(sole.distanceTo(new THREE.Vector3(foot.px, foot.py, foot.pz)) < .008, 'settling preserves actual rendered support');
      }
      previous = frame;
    }
    assert.ok(exited && recoveryFrames >= hz * .12, 'exercise a real recovery interval after the controller stops loping');
    assert.equal(previous.motion.airborne, false, 'release returns to the ground');
    assert.ok(run.c.rig.feet.every(f => f.planted), 'release settles on both feet');
    assert.ok(run.c.rig.feet.every(f => Math.abs(f.py) < 1e-8), 'settled soles meet ground');
  }
  assert.equal(exits, 6);
  console.log(`gait release ${hz} Hz ${speed} m/s: max ankle ${(peakAnkle * 1000).toFixed(0)} mm, knee ${(peakKnee * 180 / Math.PI).toFixed(1)} degrees/frame`);
}
