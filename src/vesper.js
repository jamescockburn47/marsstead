// VESPER's deterministic floor — pure, no THREE, no DOM. verify-vesper.mjs
// guards it. AMENDED (the rapport rule): the canned PERSONALITY is dead —
// VESPER herself is live-only now, every bark and every reply, so the
// player meets one mind, not a lookup table. What remains here is the
// INSTRUMENT CHANNEL: terse, functional suit calls for the events a player
// must hear instantly and offline — safety, refusals, mechanics — plus the
// one honest off-relay notice (radio-static). Instruments never do wit;
// the mind never does telemetry-terse. Neither pretends to be the other.
//
// Append lines freely (append-only); never bend control flow.
// Deterministic pick: same event, same count, same line, every client.

import { hash2 } from './noise.js';

// every event the game can raise (main.js speaks through this list; the
// live brain barks the ones the instruments don't cover)
export const EVENTS = [
  'wake', 'first-steps', 'first-jump', 'lope', 'sunset', 'night',
  'dawn', 'devil-near', 'cold', 'air-low', 'idle', 'fall',
  'buggy-first', 'buggy-drift', 'buggy-air', 'buggy-crash', 'buggy-flip', 'buggy-rollover', 'lights-on', 'salvage-first', 'suit-full', 'ring-taken',
  'sleep', 'no-shelter', 'first-seal', 'pressurised', 'leak', 'airlock-cycle',
  'hab-too-small',
  'prospect', 'hitch', 'jackknife', 'trailer-sway', 'deploy',
  'drill-first-ore', 'hopper-full', 'pack-up', 'fab-first-steel',
  'lander-in', 'not-tired', 'salvage-unlocked',
  'radio-static',
  'crown-first', 'dig-start', 'burrow-room', 'burrow-home', 'ring-installed',
];

// the instrument channel: safety and mechanics, spoken plainly and at
// once. These are the suit's numbers in VESPER's mouth — urgency without
// personality, because rule 1 (safety before wit) is also an engineering
// rule: this channel must work with the relay down.
export const INSTRUMENT = {
  'air-low': [
    "Air at twenty-five percent. Turn for home now — steady pace, no detours.",
    "Air is low. You have walking margin, not wandering margin. Home.",
  ],
  cold: [
    "Core temperature falling. Find sun or shelter in the next few minutes.",
    "You're losing warmth faster than the suit can make it. Move somewhere warmer.",
  ],
  leak: [
    "The volume isn't holding — leak marked. Seal it where I'm pointing.",
    "Air is escaping at the marked seam. Close the gap and I'll re-check.",
  ],
  'suit-full': [
    "Suit's at capacity. The rover's deck takes the rest.",
    "No room left in the bags. Load the rover.",
  ],
  'no-shelter': [
    "Can't run the night out here. Get a hull between you and the sky first.",
    "No shelter in reach. The lander or a pressurised hab, then sleep.",
  ],
  'not-tired': [
    "It's still daylight. Sleep waits for dusk.",
    "Too early. The night starts when the sun is down.",
  ],
  'hab-too-small': [
    "It holds air, but it won't hold the night — thermal mass is short. Sleep in the lander; build bigger.",
    "That volume is too small to sleep in. The lander keeps the bed for now.",
  ],
  'airlock-cycle': [
    "Cycling. Pressure equalising… through you go.",
    "Airlock running. A few seconds between two worlds.",
  ],
  'hopper-full': [
    "Hopper's full; the drill is idling. Haul the load home.",
    "Rig hopper at capacity. It drills again when you empty it.",
  ],
  jackknife: [
    "Jackknife — the pin sheared to save the chassis. Straighten up and re-hitch.",
    "Trailer's gone past the stop and the hitch let go. Line up level and pin it again.",
  ],
  'trailer-sway': [
    "Sway building. Ease off and let the drawbar settle.",
    "The rig is wagging. Slow down before it chooses a direction for you.",
  ],
  'salvage-unlocked': [
    "Shakedown complete. New phase: construction — the hull is inventory now.",
    "You slept and the ship held. Mission rules make her a warehouse from this morning.",
  ],
  // the one honest failure notice: the mind is off-relay, the numbers remain
  'radio-static': [
    "I heard you, {name}, but my long thoughts live on the relay and it isn't answering. You have the numbers half of me for now.",
    "Static on the uplink. The instruments are still yours; say it again when the sky clears.",
  ],
};

// the settler's name, laundered: letters, digits, space, hyphen and
// apostrophe only; one line, sixteen characters, no markup teeth. Used at
// the title door, in the save, and by every voice that speaks it.
export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

// deterministic pick from the instrument channel; null means the event is
// the MIND's to notice (live bark), not the instruments'. Lines may carry
// {name}; the settler's name lands there, or "settler" serves.
export function suitSay(event, count = 0, name = '') {
  const table = INSTRUMENT[event];
  if (!table || table.length === 0) return null;
  const start = Math.floor(hash2(event.length * 17, 7) * table.length);
  const line = table[(start + count) % table.length];
  return line.replace(/\{name\}/g, cleanName(name) || 'settler');
}
