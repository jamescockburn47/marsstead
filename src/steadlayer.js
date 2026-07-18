// The stead on screen — THREE layer over build.js's pure grammar. Every
// placed part is a small framed assembly on its face (slab + edge frame +
// dressing per type), built in ONE canonical frame — the part lying in the
// local x-y plane, normal +z — then rotated onto its axis, so there is a
// single code path for walls, floors and roofs. The ghost previews the
// cursor (green places, red refuses); leak markers point at the seams the
// pressure judge names.
//
// Grounding: the grid's world anchor (baseY, set at first placement) sits
// slightly BELOW the terrain sample, ground-level walls grow a skirt down
// to the dirt, and every ground wall raises a regolith berm along its
// base — the hab is bedded into the planet, not perched on it.

import * as THREE from 'three';
import { CELL, parseFaceKey, faceCentre } from './build.js';

const PANEL = 0xcfc5b6, STEEL = 0x9aa2ab, GLASS = 0x9fc4e0, LOCK = 0xb34a2a;
const FRAME = 0x3a3430, GOLD = 0xc9974a, BERM = 0x7e452b;
const THICK = 0.14;      // slab thickness, m
const BAR = 0.17;        // frame bar cross-section, m
const SKIRT_MAX = 1.1;   // how far a wall reaches down to meet the dirt

// how deep the build plane sits under the terrain sample at anchor time —
// main.js applies it when fixing baseY; exported so the two agree
export const BED_DEPTH = 0.3;

function mat(color) {
  return new THREE.MeshPhongMaterial({ color, shininess: 10 });
}
function bar(w, h, d, colour) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
  return m;
}

export class SteadLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = new Map();   // faceKey -> group
    this.baseY = null;         // world Y of the grid's y=0 plane

    // one ghost, retinted and reshaped as the cursor moves
    this.ghostMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.38, depthWrite: false,
    });
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.ghostMat);
    this.ghost.visible = false;
    scene.add(this.ghost);

    // leak markers: small hot beacons on the open faces
    this.leakMat = new THREE.MeshBasicMaterial({
      color: 0xff5a3c, transparent: true, opacity: 0.85, depthWrite: false,
    });
    this.leakMarkers = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), this.leakMat);
      m.visible = false;
      scene.add(m);
      this.leakMarkers.push(m);
    }
  }

  setBase(y) {
    this.baseY = y;
    this.group.position.y = y;
  }

  // the canonical part: slab in the x-y plane (normal +z), framed, dressed.
  // skirt extends the slab downward (walls only — callers pass 0 otherwise).
  makePart(type, skirt) {
    const g = new THREE.Group();
    const H = CELL + skirt, yMid = -skirt / 2;
    const inner = CELL - BAR * 2;

    if (type === 'window') {
      // a mullioned pane filling the edge frame; the skirt goes solid
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(inner, inner, 0.05),
        new THREE.MeshPhongMaterial({
          color: GLASS, shininess: 60,
          transparent: true, opacity: 0.42,
        }));
      const mull = bar(0.09, inner, THICK * 0.9, FRAME);
      const mull2 = bar(inner, 0.09, THICK * 0.9, FRAME);
      g.add(glass, mull, mull2);
      if (skirt > 0) {
        const under = bar(CELL, skirt + 0.2, THICK * 0.8, PANEL);
        under.position.y = -CELL / 2 - skirt / 2 + 0.1;
        g.add(under);
      }
    } else if (type === 'airlock') {
      const slab = bar(CELL, H, THICK, LOCK);
      slab.position.y = yMid;
      g.add(slab);
      // the recessed door + its precious gold ring
      const door = bar(1.15, 1.75, THICK * 0.6, 0x8f3a20);
      door.position.set(0, -CELL / 2 + 1.75 / 2 + 0.08, THICK * 0.45);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.08, 6, 14), mat(GOLD));
      ring.position.copy(door.position);
      ring.position.z += 0.12;
      g.add(door, ring);
    } else {
      const slab = bar(CELL, H, THICK * (type === 'steel-panel-part' ? 1 : 0.85),
        type === 'steel-panel-part' ? STEEL : PANEL);
      slab.position.y = yMid;
      g.add(slab);
      // a horizontal stiffening rib, proud of the face on both sides
      const rib = bar(CELL - 0.2, 0.12, THICK * 1.5, FRAME);
      rib.position.y = 0.15;
      g.add(rib);
    }

    // the edge frame every part wears (bottom bar rides the skirt down)
    const top = bar(CELL, BAR, THICK * 1.6, FRAME); top.position.y = CELL / 2 - BAR / 2;
    const bot = bar(CELL, BAR, THICK * 1.6, FRAME); bot.position.y = -CELL / 2 - skirt + BAR / 2;
    const lef = bar(BAR, H, THICK * 1.6, FRAME); lef.position.set(-CELL / 2 + BAR / 2, yMid, 0);
    const rig = bar(BAR, H, THICK * 1.6, FRAME); rig.position.set(CELL / 2 - BAR / 2, yMid, 0);
    g.add(top, bot, lef, rig);
    return g;
  }

  buildMesh(key, type, groundAt) {
    const f = parseFaceKey(key);
    const c = faceCentre(f.x, f.y, f.z, f.axis);
    const isGroundWall = f.axis !== 1 && f.y === 0;

    // skirt: how far past the slab bottom the dirt sits
    let skirt = 0;
    let groundLocalY = null;
    if (isGroundWall && groundAt) {
      const g = groundAt(c[0], c[2]);
      groundLocalY = g - (this.baseY ?? 0) - c[1]; // in the part's local y
      skirt = Math.max(0, Math.min(SKIRT_MAX, -(groundLocalY + CELL / 2) + 0.25));
    }

    const part = this.makePart(type, skirt);
    // canonical normal +z -> the face's axis
    if (f.axis === 0) part.rotation.y = Math.PI / 2;
    if (f.axis === 1) part.rotation.x = -Math.PI / 2;
    part.position.set(c[0], c[1], c[2]);

    // the berm: a half-buried ridge of regolith along a ground wall's base
    if (isGroundWall && groundLocalY !== null) {
      const berm = new THREE.Mesh(
        new THREE.BoxGeometry(CELL + 0.5, 0.66, 0.66), mat(BERM));
      berm.rotation.x = Math.PI / 4; // diamond section: a banked ridge
      berm.position.set(0, groundLocalY + 0.1, 0);
      part.add(berm);
    }

    part.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    return part;
  }

  // reconcile meshes with the stead (add-only diffs both ways)
  sync(stead, groundAt) {
    for (const [key, mesh] of this.meshes) {
      if (!stead.parts.has(key)) {
        this.group.remove(mesh);
        this.meshes.delete(key);
      }
    }
    for (const [key, part] of stead.parts) {
      if (!this.meshes.has(key)) {
        const mesh = this.buildMesh(key, part.type, groundAt);
        this.group.add(mesh);
        this.meshes.set(key, mesh);
      }
    }
  }

  // the cursor ghost: null hides it
  showGhost(key, ok, baseY) {
    if (!key) { this.ghost.visible = false; return; }
    const f = parseFaceKey(key);
    const c = faceCentre(f.x, f.y, f.z, f.axis);
    const dims = f.axis === 0 ? [THICK, CELL, CELL]
      : f.axis === 1 ? [CELL, THICK, CELL] : [CELL, CELL, THICK];
    this.ghost.geometry.dispose();
    this.ghost.geometry = new THREE.BoxGeometry(...dims);
    this.ghost.position.set(c[0], c[1] + baseY, c[2]);
    this.ghostMat.color.setHex(ok ? 0x7fd18a : 0xd1685a);
    this.ghost.visible = true;
  }

  // point at up to three open faces on the escape path
  showLeaks(keys, baseY, t) {
    for (let i = 0; i < this.leakMarkers.length; i++) {
      const m = this.leakMarkers[i];
      const key = keys[i];
      if (!key) { m.visible = false; continue; }
      const f = parseFaceKey(key);
      const c = faceCentre(f.x, f.y, f.z, f.axis);
      m.position.set(c[0], c[1] + baseY + (f.axis === 1 ? 0.3 : 0), c[2]);
      m.rotation.y = t;
      m.scale.setScalar(0.85 + 0.25 * Math.sin(t * 4));
      m.visible = true;
    }
  }

  clearLeaks() {
    for (const m of this.leakMarkers) m.visible = false;
  }
}
