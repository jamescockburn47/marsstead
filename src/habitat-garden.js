import { plant } from './habitat-plants.js';
import { habitatObstacles } from './habitat-model.js';

export function furnishGarden(room, draw, m) {
  const { box, cylinder } = draw;
  const b = (x, y, z, w, h, d, material) => box(room.x + x, room.y + y, z, w, h, d, material);
  const c = (x, y, z, r, h, material) => cylinder(room.x + x, room.y + y, z, r, h, material);
  // Two full cultivated banks, four different crop zones; the side-door crossing
  // and central growing aisle share the collision model rather than fake scenery.
  for (const bed of habitatObstacles(room)) {
    const x = bed.x - room.x;
    b(x, .42, bed.z, bed.w, .72, bed.l, m.cream);
    b(x, .8, bed.z, bed.w - .16, .07, bed.l - .16, m.soil);
    for (const edge of [-1, 1]) b(x, .81, bed.z + edge * (bed.l / 2 - .07), bed.w, .12, .08, m.bronze);
    // Visible drip irrigation, compact valve, marker stakes.
    b(x, .86, bed.z, bed.w - .22, .035, .035, m.dark);
    c(x - bed.w / 2 + .25, 1.0, bed.z, .027, .32, m.bronze);
  }
  let id = 0;
  for (const side of [-1, 1]) {
    for (let col = 0; col < 10; col++) for (let row = 0; row < 2; row++) {
      const x = -2.6 + col * .57 + Math.sin(col*7+row*3)*.075,
        z = side * (2.35 + row * .64) + Math.sin(col*3.7+row)*.06;
      const kind = side < 0 ? (col < 4 ? 'tomato' : col < 7 ? 'bean' : 'grass')
        : (col < 5 ? 'lettuce' : col < 8 ? 'herb' : 'seedling');
      plant(draw, m, room.x + x, room.y + .85, z, kind, ++id + room.col * 99);
    }
    // Suspended baskets and high crops fill the vertical growing volume.
    for (const x of [-2.55, 2.55]) {
      c(x, 2.7, side * 3.08, .025, .85, m.bronze);
      c(x, 2.3, side * 3.08, .23, .26, m.teal);
      plant(draw, m, room.x + x, room.y + 2.34, side * 3.08, 'vine', ++id + 191);
    }
    for (const x of [-2.9, 2.9]) c(x, 1.96, side * 3.45, .024, 2.2, m.bronze);
    for (let i = 0; i < 8; i++) b(-2.6 + i * .75, 1.93, side * 3.48, .012, 2.08, .012, m.bronze);
    for (const h of [1.2, 1.8, 2.4, 2.95]) b(0, h, side * 3.48, 5.85, .016, .016, m.bronze);
    b(0, 3.11, side * 2.75, 5.75, .12, .22, m.metal);
    b(0, 3.035, side * 2.75, 5.5, .035, .17, m.glow);
    // Large readable crop labels made from geometry, not texture assets.
    for (const x of [-1.55, 1.55]) {
      b(x, 1.02, side * 1.96, .31, .17, .025, m.linen);
      b(x, 1.02, side * 1.94, .22, .023, .026, m.teal);
    }
  }
}
