// VESPER — the canned voice, pure, no THREE, no DOM. verify-vesper.mjs
// guards it. USP 1's floor: the live LLM brain (Phase 3, the EVO) is a
// LAYER on top of this table, never a dependency — offline, guest, or
// relay-down, VESPER still speaks, still has a personality, still fills
// the silence. The register is the contract: dry, warm, watchful; openly
// a machine mind; never menacing, never dishonest, and it NEVER turns on
// you (DESIGN.md, the design rule).
//
// Append lines freely (append-only, like every family content table);
// never bend control flow. Deterministic pick: same event, same count,
// same line, every client.

import { hash2 } from './noise.js';

export const EVENTS = [
  'wake', 'first-steps', 'first-jump', 'lope', 'sunset', 'night',
  'dawn', 'devil-near', 'cold', 'air-low', 'idle', 'fall',
  'buggy-first', 'buggy-drift', 'buggy-air', 'buggy-crash',
];

export const LINES = {
  wake: [
    "Good sol, settler. Suit's holding, air's sweet, and Mars is exactly where we left it.",
    "Systems green. Outside it's minus sixty and magnificent. Take your time; the planet has plenty.",
    "I ran the numbers while you slept. All of them. It's what I'm for. — We're fine.",
  ],
  'first-steps': [
    "There. First bootprints on a page nothing has written on in four billion years.",
    "Gait telemetry looks good. You walk like you're forgiving the ground for something.",
    "Every step out here is a first. I log them all. Someone should.",
  ],
  'first-jump': [
    "Point three eight g. Your knees have been waiting your whole life for this planet.",
    "Nice hang time. On Earth that jump would be a hop. Here it's practically flight.",
    "Careful — low gravity is a promise the landing still collects on. Gently does it.",
  ],
  lope: [
    "That bounding stride is the correct way to cross Mars. The rovers were always jealous.",
    "You're loping. Good. Walking here always looked like a misunderstanding.",
  ],
  sunset: [
    "There it is — the blue hour. The only sky in the solar system that saves its blue for goodnight.",
    "Sun's going down. Watch the halo — the dust bends the blue in around it. I never file this one under routine.",
    "Dusk. The thermals are about to fall off a shelf. Stay if you want to. It's worth one more minute.",
  ],
  night: [
    "Night, then. Minus eighty and falling. I'll keep the numbers; you keep moving.",
    "Stars are out. All of them, I think. I counted; you'd doubt the figure.",
    "That fast one rising in the west is Phobos — it does the sky backwards. It'll lap us before breakfast.",
    "The pale blue one low in the sky is Earth. Everyone you've ever heard of, at one glance.",
  ],
  dawn: [
    "Sun's up. The plain looks new again. It does this every sol and I fall for it every sol.",
    "Morning. Air's cold enough to ring. Panels are drinking; the day is yours.",
  ],
  'devil-near': [
    "Company — a devil crossing the plain. It'll clean the panels or coat them. Its choice, apparently.",
    "Dust devil, half a klick out. Harmless. Beautiful. Both things are true of most of this planet.",
    "There goes a devil. Eighty metres of weather with somewhere better to be.",
  ],
  cold: [
    "Temperature's on the floor. The suit's fighting for you, but let's find some sunlight.",
    "Cold's getting through my margins. I don't like the arithmetic. Move, please.",
  ],
  'air-low': [
    "Air's low. Not scary-low. Steadily-walk-home low. So: steadily walk home.",
    "I'm watching your air and I'd rather be watching anything else. Homeward, settler.",
  ],
  idle: [
    "No rush. The view's doing all the work anyway.",
    "I ran a diagnostic on the silence. It passed.",
    "Four billion years, and you're what showed up. I find that oddly encouraging.",
    "The dunes have moved eleven millimetres since we landed. Riveting stuff. I'm keeping a chart.",
  ],
  fall: [
    "Logged the tumble. The gravity forgives; try to land where I can see you.",
    "That's suit wear, not damage. Mars pulls softly, but it always collects.",
  ],
  'buggy-first': [
    "The buggy. Rear-wheel drive, no air worth the name, and a third of the grip you grew up with. Unlearn everything.",
    "Gently on the throttle — the wheels will spin long before she moves. Mars grades on traction.",
    "Braking distances are two and a half times what your reflexes expect. I've done the arithmetic; your job is believing it.",
  ],
  'buggy-drift': [
    "Sideways. Intentional, I hope. It does look tremendous.",
    "That's the regolith two-step. The dust needed raking anyway.",
    "Textbook oversteer. The textbook is new here, but you're writing it.",
  ],
  'buggy-air': [
    "Airborne. A car is flying. I'm filing this under routine Mars physics.",
    "All four wheels off the planet. The suspension and I are braced.",
    "Long hang time. Low gravity turns every dune into an invitation.",
  ],
  'buggy-crash': [
    "Landed. The chassis forgives you. Once.",
    "The suspension logged that one. So did I.",
    "Speed is free here; stopping is expensive. Note taken, I trust.",
  ],
};

// deterministic pick: nth call for an event walks the table without
// repeats until the cycle closes (same order for every client)
export function vesperSay(event, count = 0) {
  const table = LINES[event];
  if (!table || table.length === 0) return null;
  const start = Math.floor(hash2(event.length * 17, 7) * table.length);
  return table[(start + count) % table.length];
}
