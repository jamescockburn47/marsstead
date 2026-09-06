// Six contact legs, alternating tripods. +Z is forward; Y=0 is the work plane.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
export const SPIDER_PERIOD = 0.88;
export const SPIDER_STANCE = 0.66;
export function spiderPhase(seed = 0) {
  const n = Math.sin((Number.isFinite(seed) ? seed : 0) * 127.1 + 17.7) * 43758.5453;
  return n - Math.floor(n);
}

export function spiderPose(t, { moving = 0, working = false, reducedMotion = false, seed = 0 } = {}) {
  const speed = clamp(moving, 0, 1.2);
  const time = reducedMotion ? 0 : clamp(t, 0, 1e12);
  const period = Math.min(SPIDER_PERIOD, 0.24 / (Math.max(speed, 0.001) * SPIDER_STANCE));
  const phase = time / period + spiderPhase(seed);
  const stride = speed * period * SPIDER_STANCE;
  const bodyY = 0.245 + (speed > 0.01 ? Math.cos(phase * TAU * 2) * 0.005 : 0);
  const legs = [];
  for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
    const cycle = ((phase + ((row + (side > 0 ? 1 : 0)) % 2) * 0.5) % 1 + 1) % 1;
    const stance = cycle < SPIDER_STANCE || speed < 0.01 || reducedMotion;
    const u = cycle < SPIDER_STANCE ? cycle / SPIDER_STANCE : (cycle - SPIDER_STANCE) / (1 - SPIDER_STANCE);
    const swing = u * u * (3 - 2 * u);
    const travel = speed < 0.01 || reducedMotion ? 0 : stance ? stride * (0.5 - u) : stride * (swing - 0.5);
    const lift = stance ? 0 : Math.sin(Math.PI * u) ** 2 * 0.09;
    const hip = [side * 0.115, bodyY, (row - 1) * 0.125];
    const shoulder = [side * 0.19, bodyY + 0.025, (row - 1) * 0.17];
    const foot = [side * (row === 1 ? 0.405 : 0.35), 0.022 + lift, (row - 1) * 0.25 + travel];
    // Two-link solve in the shoulder/foot plane. The perpendicular points
    // outward and up, giving the recognisable raised mechanical knee.
    const delta = foot.map((v, i) => v - shoulder[i]);
    const distance = Math.hypot(...delta), upper = 0.19, lower = 0.29;
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    const horizontal = Math.hypot(delta[0], delta[2]);
    const perpendicular = [-delta[0] * delta[1] / (horizontal * distance), horizontal / distance,
      -delta[2] * delta[1] / (horizontal * distance)];
    const knee = shoulder.map((v, i) => v + delta[i] / distance * along + perpendicular[i] * height);
    legs.push({ hip, shoulder, knee, foot, stance, side, row });
  }
  return { legs, bodyY, tool: working && !reducedMotion ? Math.sin(time * 30 + spiderPhase(seed) * TAU) * 0.008 : 0,
    toolAngle: working && !reducedMotion ? time * 14 : 0 };
}
