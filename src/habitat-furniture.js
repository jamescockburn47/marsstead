import { furnishGarden } from './habitat-garden.js';
import { cushionGeometry, duvetGeometry } from './habitat-textiles.js';
// Human-scale procedural furniture, kept against the same occupied back-wall
// footprints exported by habitat-model. The centre of every room stays traversable.
export function furnishHabitat(room, draw, materials) {
  const { box, cylinder, sphere } = draw, m = materials;
  const x = room.x, y = room.y;
  const b = (px, py, pz, w, h, d, mat = m.cream) => box(x + px, y + py, pz, w, h, d, mat);
  const c = (px, py, pz, r, h, mat = m.bronze) => cylinder(x + px, y + py, pz, r, h, mat);
  // Universal air/heat exchanger, a clearly inhabited detail above furniture.
  b(2.9, 2.5, -3.63, 1.0, .72, .18, m.dark);
  for (let i = 0; i < 5; i++) b(2.9, 2.25 + i * .11, -3.49, .8, .022, .05, m.metal);
  b(2.45, 2.65, -3.48, .035, .23, .03, m.mint);
  if (room.piece === 'bunk') {
    b(-1.3, .34, -2.65, 3.8, .5, 1.7, m.bronze);
    draw.custom(cushionGeometry(3.7, .29, 1.62), x - 1.3, y + .69, -2.65, m.linen);
    draw.custom(duvetGeometry(2.65, 1.64), x - .88, y + .86, -2.65, m.teal);
    const pillow = draw.custom(cushionGeometry(.75, .3, 1.14), x - 2.58, y + .96, -2.65, m.linen);
    pillow.rotation.y = -.09;
    const spare = draw.custom(cushionGeometry(.58, .25, .61), x - 2.5, y + 1.15, -3.0, m.rust);
    spare.rotation.set(.27, -.2, .13);
    // A folded throw, well-read books and bedside personal objects.
    draw.custom(duvetGeometry(.64, 1.58), x + .18, y + .94, -2.65, m.rust);
    // Recessed storage under the berth and a padded protective head panel.
    for (const px of [-2.6, -1.35, -.1]) {
      b(px, .34, -1.79, 1.13, .34, .03, m.dark);
      b(px, .37, -1.76, .24, .035, .04, m.metal);
    }
    draw.custom(cushionGeometry(.16, .58, 1.42), x-3.12, y+1.02, -2.65, m.teal);
    // A few held objects give the room an occupant without a pile of props.
    b(.6, 1.91, -3.55, .72, .05, .3, m.metal);
    for (let i=0;i<4;i++) {
      const book=b(.35+i*.11,2.09,-3.52,.075,.3-i*.018,.19,i%2?m.rust:m.linen);
      book.rotation.z=i===3?-.16:0;
    }
    for (const px of [2.7,3.0]) {
      const boot=draw.custom(cushionGeometry(.23,.32,.45),x+px,y+.22,-2.85,m.dark);
      boot.rotation.y=-.12;
    }
    for (let i = 0; i < 3; i++) b(2.05, .96 + i * .047, -3.39, .34 - i * .025, .04, .26, i % 2 ? m.rust : m.linen);
    b(1.9, .48, -3.3, .8, .85, .7, m.cream);
    c(1.9, 1.08, -3.3, .045, .36);
    c(1.9, 1.3, -3.3, .23, .12, m.glow);
    b(-1.3, .035, -.85, 3.6, .022, 1.1, m.rust);
    for (let i = 0; i < 9; i++) b(-2.8 + i * .37, .051, -.85, .035, .012, 1.02, m.linen);
    // Ceramic mug and a personal landscape mosaic; no external image asset.
    c(1.67, .99, -3.12, .075, .16, m.teal);
    b(-1.6, 2.1, -3.7, 1.65, .85, .09, m.bronze);
    b(-1.6, 2.1, -3.63, 1.5, .7, .04, m.dark);
    b(-1.6, 1.93, -3.59, 1.4, .22, .03, m.teal);
    sphere(x - 1.88, y + 2.23, -3.54, .12, m.glow);
  } else if (room.piece === 'garden') {
    furnishGarden(room, draw, m);
  } else if (room.piece === 'store') {
    for (const px of [-2.9, -.97, .97, 2.9]) b(px, 1.3, -3.55, .065, 2.6, .1, m.bronze);
    for (let row = 0; row < 3; row++) {
      b(0, .32 + row * .83, -3.15, 5.9, .075, 1.05, m.metal);
      for (let col = 0; col < 5; col++) {
        const px = -2.35 + col * 1.16, py = .66 + row * .83;
        b(px, py, -3.17, .92, .6, .88, (col + row) % 2 ? m.teal : m.cream);
        b(px, py + .1, -2.71, .42, .075, .025, m.dark);
        b(px, py - .1, -2.71, .25, .08, .026, m.linen);
      }
    }
  } else if (room.piece === 'bay') {
    b(0, 1.0, -2.75, 5.4, .16, 1.65, m.metal);
    for (const px of [-2.48, 2.48]) b(px, .5, -2.75, .15, 1, 1.4, m.bronze);
    b(1.65, 1.58, -3.1, 1.35, .98, .65, m.cream);
    b(1.65, 1.6, -2.76, 1.15, .62, .04, m.dark);
    b(1.65, 1.64, -2.72, .9, .045, .03, m.mint);
    b(-1.68, 1.23, -2.8, .85, .32, .75, m.dark);
    c(-1.68, 1.6, -2.8, .12, .55);
    b(-1.34, 1.88, -2.8, .85, .15, .18, m.bronze);
    c(-.96, 1.7, -2.8, .07, .4, m.metal);
    for (let i = 0; i < 5; i++) b(-2.2 + i * .28, 2.5, -3.63, .07, .5 - i % 2 * .18, .1, m.metal);
  } else if (room.piece === 'shaft') {
    for (const px of [-.65, .65]) c(px, 1.8, -3.55, .065, 3.6, m.bronze);
    for (let i = 0; i < 11; i++) b(0, .2 + i * .32, -3.51, 1.3, .06, .08, m.metal);
    b(0, 3.53, -3.1, 1.65, .12, 1.25, m.dark);
    b(1.12, 1.5, -3.68, .4, .65, .12, m.dark);
    b(1.12, 1.65, -3.59, .15, .15, .03, m.mint);
  } else {
    b(0, 1.8, -3.66, 1.7, .88, .16, m.dark);
    for (let i = 0; i < 4; i++) b(-.5, 2.06 - i * .17, -3.55, .57 + i * .18, .035, .02, m.mint);
    b(0, .65, 3.53, 3.1, .18, .45, m.cream);
  }
}
