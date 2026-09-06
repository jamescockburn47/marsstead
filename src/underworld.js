// Human-excavated workings below the homestead. This authored procedural
// gallery is game geometry, not a reconstruction of a catalogued Martian cave.
// No scene, DOM, clock or randomness: walking and drawing share this model.
export const UNDER_LENGTH = 150;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const depth = (z) => clamp(finite(z), 0, UNDER_LENGTH);

export function centreAt(z) {
  const d = depth(z);
  const chambers = [38, 85, 132].reduce((sum, at) =>
    sum + Math.exp(-0.5 * ((d - at) / 6.8) ** 2), 0);
  return {
    // Broad bends conceal the next chamber; smaller offsets avoid a swept pipe.
    x: 4.8 * Math.sin(d / 12) + 1.8 * Math.sin(d / 5.7),
    y: -0.08 * d,
    width: 2.65 + 3.7 * chambers + .34 * Math.sin(d * .39 + .5),
    height: 2.7 + 1.8 * chambers + .28 * Math.sin(d * .31),
  };
}

// A drained lava floor is broad and shallow with curbs at its margins. This
// exact function drives both walking contact and every lower-shell vertex.
export function floorAt(x, z) {
  const c = centreAt(z);
  const u = clamp((finite(x, c.x) - c.x) / c.width, -1, 1);
  return c.y + c.height * Math.abs(u) ** 8
    + .075 * u * u * (1-u*u) * Math.sin(finite(z)*.67+u*5);
}

export function constrainPosition(x, z, radius = 0.4) {
  const boundedZ = clamp(finite(z, 1), 1, UNDER_LENGTH - 1);
  const c = centreAt(boundedZ);
  const bodyRadius = Math.max(0, finite(radius, 0.4));
  const reach = Math.max(0, Math.min(c.width - 0.6, c.width * 0.8) - bodyRadius);
  const boundedX = clamp(finite(x, c.x), c.x - reach, c.x + reach);
  return { x: boundedX, y: floorAt(boundedX, boundedZ), z: boundedZ };
}

const node = (id, z, offset, name, description) => Object.freeze({
  id, z, x: centreAt(z).x + offset, name, description,
});

export const UNDER_NODES = Object.freeze([
  node('relay', 30, 0.8, 'Restore the relay',
    'A cable reaches from the excavation lamps to a silent relay. Restore its local connection.'),
  node('brood', 78, -1, 'Inspect the manufacturing brood',
    'Small mechanical spiders move between printing cradles. Read the cradle instruments to learn what they are making.'),
  node('lattice', 128, 0.6, 'Record the lattice',
    'The far chamber holds a repeating lattice under the work lights. Record its pattern, then return to the surface.'),
]);

// Progress is a sequential prefix, regardless of raw order or duplicate IDs.
// A later completion cannot be imported without the instruments before it.
export function acceptUnderworld(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const supplied = new Set(Array.isArray(source.completed)
    ? source.completed.filter((id) => typeof id === 'string') : []);
  const completed = [];
  for (const n of UNDER_NODES) {
    if (!supplied.has(n.id)) break;
    completed.push(n.id);
  }
  return { completed, returned: completed.length === UNDER_NODES.length && source.returned === true };
}

export function nextUnderNode(state) {
  return UNDER_NODES[acceptUnderworld(state).completed.length] ?? null;
}

// The caller checks proximity; this core enforces the story sequence. No
// inventory reward exists, so repeated visits cannot manufacture materials.
export function interactUnderworld(state, id) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const accepted = acceptUnderworld(state);
  const next = UNDER_NODES[accepted.completed.length];
  if (!next || next.id !== id) return false;
  state.completed = [...accepted.completed, next.id];
  state.returned = false; // root marks a completed return at the actual exit
  return true;
}
