// Final support solve. Smooth the trajectory before IK, never the solved
// support joints: doing the latter makes the drawn boot skate off its target.
export function supportHeight(pose, feet, input, bones) {
  const forward = [Math.sin(input.heading), Math.cos(input.heading)];
  const right = [forward[1], -forward[0]];
  const ground = input.groundAt(input.x, input.z);
  // A loaded moving knee retains bend; solving near full extension makes
  // tiny target changes produce a large angular snap at heel strike.
  const reserve = 0.0015 + 0.005 * Math.min(1, input.speed / 0.8);
  const reach = bones.THIGH + bones.SHIN - reserve;
  let height = pose.hipY;
  const limits = [height];
  for (const foot of feet) {
    // Swing targets also limit height. The body prepares for touchdown as
    // the boot descends, instead of dropping abruptly on the contact frame.
    const wx = foot.px - input.x, wz = foot.pz - input.z;
    const dz = wx * forward[0] + wz * forward[1];
    const dx = wx * right[0] + wz * right[1] - foot.side * bones.FOOT_LAT - pose.sway;
    const vertical = Math.sqrt(Math.max(0.16, reach * reach - dx * dx - dz * dz));
    height = Math.min(height, foot.py - ground + vertical);
    limits.push(foot.py - ground + vertical);
  }
  // Smooth minimum stays BELOW every reach limit, while avoiding a knee
  // jerk when support transfers from one leg to the other.
  if (input.speed > 0.3) {
    height -= Math.log(limits.reduce((sum, value) => sum + Math.exp(-128 * (value - height)), 0)) / 128;
  }
  return height;
}

export function solveFoot(foot, pose, input, bones, solveLeg) {
  const fx = Math.sin(input.heading), fz = Math.cos(input.heading);
  const wx = foot.px - input.x, wz = foot.pz - input.z;
  const dx = wx * fz - wz * fx - foot.side * bones.FOOT_LAT - pose.sway;
  const dz = wx * fx + wz * fz;
  const dy = foot.py - input.groundAt(input.x, input.z) - pose.hipY;
  const hipRoll = Math.atan2(dx, -dy);
  const ik = solveLeg(bones.THIGH, bones.SHIN, dz, -Math.hypot(dx, dy));
  return { ...ik, hipRoll, ankleRoll: -hipRoll,
    ankleYaw: foot.planted ? (foot.yaw || 0) - input.heading : 0,
    anklePitch: -(ik.hipPitch - ik.kneeFlex) };
}

export function swingFoot(foot, input, u, duration, ahead, liftHeight, bones) {
  const fx = Math.sin(input.heading), fz = Math.cos(input.heading);
  if (!foot.swingStart) {
    const wx = foot.px - input.x, wz = foot.pz - input.z;
    foot.swingStart = { z: wx * fx + wz * fz + input.speed * u * duration,
      x: wx * fz - wz * fx };
  }
  // Body-relative swing keeps long low-g strides inside the suit's reach.
  // The old interpolation toward a distant WORLD landing point dragged the
  // boot a metre behind its hip at running speed and collapsed the pelvis.
  const s = 0.25 * u * u * (3 - 2 * u) + 0.75 * u;
  const tangent = -Math.min(input.speed * duration, 1.1) * 0.25;
  const dz = foot.swingStart.z * (1 - s) + ahead * s
    + tangent * u * (1 - u) * (1 - 2 * u);
  const dx = foot.swingStart.x * (1 - s) + foot.side * bones.FOOT_LAT * s;
  foot.px = input.x + fx * dz + fz * dx;
  foot.pz = input.z + fz * dz - fx * dx;
  const ground = input.groundAt(foot.px, foot.pz);
  foot.py = ground + Math.sin(Math.PI * u) ** 2 * liftHeight;
}
