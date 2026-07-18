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
  'buggy-first', 'buggy-drift', 'buggy-air', 'buggy-crash', 'buggy-flip', 'buggy-rollover', 'lights-on', 'salvage-first', 'suit-full', 'ring-taken',
  'sleep', 'no-shelter', 'first-seal', 'pressurised', 'leak', 'airlock-cycle',
  'hab-too-small',
  'prospect', 'hitch', 'jackknife', 'trailer-sway', 'deploy',
  'drill-first-ore', 'hopper-full', 'pack-up', 'fab-first-steel',
  'lander-in', 'not-tired', 'salvage-unlocked',
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
    "The buggy. All-wheel drive, no air worth the name, and a third of the grip you grew up with. Unlearn everything.",
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
  'buggy-flip': [
    "A full rotation, landed clean. I have no protocol for this. Inventing one: magnificent.",
    "Flip logged and stuck. Somewhere, the engineers who rated this chassis are applauding through their fingers.",
    "That was a complete revolution of a motor vehicle. Mars gravity approves; I'm withholding comment.",
  ],
  'buggy-rollover': [
    "That's a rollover. The chassis is rated for optimism; the dust broke your fall.",
    "Over she goes. Sliding sideways into a bank does that on any planet. Logged, tenderly.",
    "Rolled it. Speed's gone, pride's negotiable, everything else survives. Mars keeps accounts.",
  ],
  'salvage-first': [
    "First part off the hull. The lander doesn't mind — it did its job; now its job is being a warehouse.",
    "Unbolted clean. Everything we build starts as something that flew here.",
    "That panel crossed two hundred million kilometres to become your wall. Spend it well.",
  ],
  'suit-full': [
    "Hands full, settler. The rover's deck exists for exactly this.",
    "You can't carry that too. Load the rover — hauling is what it's for.",
  ],
  'ring-taken': [
    "The airlock ring. The only one on the planet. Whatever you build around this had better hold.",
    "That ring is the one part we can't make twice. I've flagged it in my inventory as 'precious'. New category.",
  ],
  'lights-on': [
    "Dark enough. Lights are on — I'll mind the shadows with you.",
    "Sun's gone; lamps up. The dust eats the beams a little. Drive to what you can see.",
  ],
  'buggy-crash': [
    "Landed. The chassis forgives you. Once.",
    "The suspension logged that one. So did I.",
    "Speed is free here; stopping is expensive. Note taken, I trust.",
  ],
  sleep: [
    "Lights out, settler. I'll idle at one hertz and keep the cold on its side of the hull.",
    "Sleep. The planet has waited four billion years; it can manage one more night.",
    "Good night. I'll count Phobos laps — it should manage three before dawn.",
  ],
  'no-shelter': [
    "Not out here. Find a hull between you and the sky and I'll gladly run the night for you.",
    "Sleeping under the open sky is how the planet wins. The lander's right there, settler.",
  ],
  'first-seal': [
    "That volume is closed. Closed, on Mars, is the whole game — now door it and feed it air.",
    "I show an enclosed space that isn't the lander. You built the second room on the planet.",
  ],
  pressurised: [
    "Pressure. Holding. You are standing in the only weather on Mars that's on our side.",
    "The gauges agree: one atmosphere of somewhere else, right here. Welcome home, settler.",
    "It holds. I've rechecked it four hundred times since you asked. It holds.",
  ],
  leak: [
    "Air's slipping out — I've marked the seam. The planet always finds the honest gap.",
    "Not sealed yet. Follow my markers; the leak is exactly where I'm pointing.",
  ],
  'airlock-cycle': [
    "Cycling. Thirty seconds of bureaucracy between two worlds. Worth every one.",
    "Airlock's doing its slow arithmetic. Pressure equalising… there. Through you go.",
  ],
  'hab-too-small': [
    "It holds air, and I'm proud of it — but it's a closet, settler. The lander keeps the bed until you build bigger than it.",
    "The thermal mass isn't there. A night in this and I'd be reading you the cold ledger by 03:00. Sleep in the lander; build bigger.",
    "Cosy is not a rating. Mine the steel, raise a real hab, and I'll happily run your nights from in here.",
  ],
  prospect: [
    "Reading the ground… there's a body under this. I've marked it on your map. The planet does pay, it just pays in rock.",
    "Ore signature, right where the colour changes. Marked. Now it's a logistics problem, which is my favourite kind.",
    "That's a deposit. Four billion years of geology, and you found it by driving past. Marked on the map.",
  ],
  hitch: [
    "Pin's in. You are now a road train, settler — brake early, turn wide, and never, ever reverse in a hurry.",
    "Hitched. The rig adds three metres you have to think for. The thinking is the cargo.",
  ],
  jackknife: [
    "And that's a jackknife. The pin sheared to save the chassis. Straighten up, back to it, and we don't speak of this.",
    "The trailer just overtook you sideways. Pin's out. Physics sends its regards; re-hitch when you're level.",
  ],
  'trailer-sway': [
    "Sway. Ease off — let the drawbar breathe or it'll choose a ditch for you.",
    "The rig's wagging. Speed down, settler; a trailer argues at exactly the speed you can't win.",
  ],
  deploy: [
    "Anchors set, mast up. The drill knows its one job and has started doing it. We are, officially, a mining concern.",
    "Rig anchored and level. It'll chew quietly; come back with deck space.",
  ],
  'drill-first-ore': [
    "First unit in the hopper. That noise is the planet becoming your house, slowly.",
    "The hopper has ore in it. I've updated your net worth: one rock. It compounds.",
  ],
  'hopper-full': [
    "Hopper's full — the drill's idling. Haul it home, settler; wealth doesn't count until it crosses your threshold.",
    "Full hopper. Eight units of planet, ready to ride. The rover earns its keep now.",
  ],
  'pack-up': [
    "Mast down, anchors up. The rig travels; the hole stays. Mars won't miss what it kept for four billion years.",
    "Packed. Leave the site tidy — the next visitor is probably us.",
  ],
  'fab-first-steel': [
    "The fabricator just handed you a steel panel that was gravel this morning. THIS is the whole homestead, in one object.",
    "First steel off the bench. The lander brought ten panels across space; you just made the eleventh out of Mars.",
  ],
  'lander-in': [
    "Hatch sealed behind you. One atmosphere, plus sentiment. This cabin flew two hundred million kilometres to be your spare room.",
    "Inside. Warm air, real pressure, and every gauge where I can see it. The planet can knock all it likes.",
    "Welcome back aboard. She's a warehouse now, but she still keeps the cold out better than anything you'll build this month.",
  ],
  'not-tired': [
    "The sun's still up, settler. Beds are for the dark — Mars runs a strict household.",
    "Not yet. Sleep is a night instrument. Plenty of sol left to spend first.",
    "I could dim the windows, but the planet would still know. Wait for dusk.",
  ],
  'salvage-unlocked': [
    "Good sol. Shakedown's complete — new mission phase: CONSTRUCTION. The hull is inventory now; every bolt on her is yours to spend.",
    "You slept, the ship held, and mission rules say she's a warehouse from this morning. Unbolt gently — she flew well.",
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
