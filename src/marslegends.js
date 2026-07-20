// marslegends — the signal chain, pure: no THREE, no DOM.
// verify-marslegends.mjs guards it. The family's legends.js idea
// (append-only anchored content) grown into Phase 3's spine: five
// signals at REAL places, walked in order, each with an act, a relic,
// and a scene — the surface on-ramp of the buried story.
//
// THE LAW OF THIS FILE: no plot word, ever. The relics carry tone and
// evidence; the secret lives in no string a player (or VESPER's
// prompt) can read. Discovered, never signposted: the band warms, the
// map draws a vague ring, nothing floats in the world. Tone ladder:
// wonder → wonder-with-a-splinter → the cosy leaves → quiet dread →
// held breath at a sealed door. Kid-safe at every rung: the fear is
// in what the ground remembers, never in anything graphic.

import { latLonToWorld, HOME } from './mars.js';

export const ARRIVE_M = 250;   // the band hands over to the sweep
export const SWEEP_M = 30;     // the heart: close enough to read the ground

export const SITES = [
  {
    id: 'delta',
    name: 'The Delta Record',
    place: 'Jezero delta, the western breach',
    lat: 18.75, lonE: 77.85,
    tone: 'wonder',
    relic: {
      id: 'delta-leaf',
      name: 'The Delta Leaf',
      journal: 'A flake of laminated mudstone from the delta face. The layers are '
        + 'seasons: a river, patient, for a very long time. Down near the base the '
        + 'mineral banding repeats — the same little run of layers, again and again, '
        + 'like a mark made more than once. Rivers do not usually sign their work.',
    },
    scene: [
      'A river laid this down and took its time about it.',
      'The banding near the base repeats. I want to say "coincidence". I am saying it quietly.',
    ],
  },
  {
    id: 'shoreline',
    name: 'The Old Shoreline',
    place: 'the dichotomy boundary, north of Isidis',
    lat: 23.2, lonE: 74.8,
    tone: 'wonder-unease',
    relic: {
      id: 'tide-line',
      name: 'The Tide Line',
      journal: 'Rounded pebbles in a band along the old scarp, sorted by size the way '
        + 'only standing water sorts. This was a shore. The northern plain below held a '
        + 'sea. And in the shore rock: the same repeated banding as the delta — higher '
        + 'up, older, farther from the water that should have made it.',
    },
    scene: [
      'A shoreline. You are standing on the edge of a sea that left.',
      'The delta banding is here too. Older here. That is the wrong direction.',
      'I have no explanation. I am noting that I want one.',
    ],
  },
  {
    id: 'seep',
    name: 'The Morning Seep',
    place: 'the slopes above Gale',
    lat: -5.0, lonE: 137.5,
    tone: 'cosy-leaves',
    relic: {
      id: 'survey-fragment',
      name: 'The Survey Fragment',
      journal: 'A dark streak on the slope that comes back every warm season, and a '
        + 'methane reading that rises with the dawn frost and hides by noon. The relay '
        + 'holds sixty years of survey passes over this slope. One annotation in the '
        + 'oldest file marks this exact streak. No author is logged. No instrument '
        + 'is logged either.',
    },
    scene: [
      'The streak is real. The methane is real. Both were real before we landed.',
      'Someone marked this slope in the old surveys. The file does not say who. Files usually say who.',
      'I would like to go home now. Noting that too.',
    ],
  },
  {
    id: 'skylight',
    name: 'The Skylight',
    place: 'the flank of Arsia Mons',
    lat: -8.26, lonE: 239.91,
    tone: 'dread-quiet',
    relic: {
      id: 'cold-ledger',
      name: 'The Cold Ledger',
      journal: 'A hole in the mountain\'s flank where a lava tube\'s roof let go, a '
        + 'very long time ago. Warm air moves OUT of it at dawn. The signal is under '
        + 'this mountain — deeper than any tube has a right to go. Descent needs the '
        + 'winch rig and more nerve than today has. The dark down there is older '
        + 'than the sky up here.',
    },
    scene: [
      'The signal is below us. Straight below.',
      'Air moves out of the mountain at dawn. Mountains do not breathe.',
    ],
  },
  {
    id: 'vault',
    name: 'The Deep Door',
    place: 'the high Tharsis rise',
    lat: -2.0, lonE: 243.0,
    tone: 'held-breath',
    relic: {
      id: 'the-address',
      name: 'The Address',
      journal: 'At the sweep\'s heart the signal finally resolved: not noise, not a '
        + 'beacon. A header block, repeated for a very long time, waiting to be '
        + 'received. It has a recipient. It is not addressed to you. The rest of the '
        + 'message stays sealed below, behind ground the instruments cannot see '
        + 'through. Whatever is listening for this has not answered yet.',
    },
    scene: [
      'It resolved. It is addressed.',
      'Not to you. I ran it four times.',
      'I think we should go home and think about this in the daylight.',
    ],
  },
];

export function siteXZ(site) {
  return latLonToWorld(site.lat, site.lonE);
}

// one signal live at a time, in the authored order; null when the
// surface chain is walked (the story continues below — later stages)
export function chainActive(foundIds) {
  const found = new Set(foundIds || []);
  return SITES.find((s) => !found.has(s.id)) || null;
}

// the band's warmth 0..1: 1 at the site, a whisper from home —
// normalised per-site so every leg of the chain reads on the same
// instrument no matter how far the road has grown
export function signalStrength(site, x, z) {
  const p = siteXZ(site);
  const home = latLonToWorld(HOME.lat, HOME.lon);
  const homeDist = Math.hypot(p.x - home.x, p.z - home.z);
  const d = Math.hypot(p.x - x, p.z - z);
  const reach = 1.3 * homeDist + 400;
  return Math.pow(Math.max(0, 1 - d / reach), 1.6);
}

// the on-foot sweep: sharp local gradient inside the arrival ring,
// zero outside it — the last few hundred metres are played by boot
export function sweepAt(site, x, z) {
  const p = siteXZ(site);
  const d = Math.hypot(p.x - x, p.z - z);
  if (d >= ARRIVE_M) return 0;
  return Math.pow(1 - d / ARRIVE_M, 0.7);
}

// ---- save ------------------------------------------------------------------
export function serializeMystery(m) {
  return {
    found: (m?.found || []).filter((id) => SITES.some((s) => s.id === id)),
    read: (m?.read || []).filter((id) => SITES.some((s) => s.relic.id === id)),
  };
}
export function deserializeMystery(raw) {
  const ids = new Set(SITES.map((s) => s.id));
  const relicIds = new Set(SITES.map((s) => s.relic.id));
  return {
    found: Array.isArray(raw?.found)
      ? [...new Set(raw.found.filter((id) => ids.has(id)))] : [],
    read: Array.isArray(raw?.read)
      ? [...new Set(raw.read.filter((id) => relicIds.has(id)))] : [],
  };
}
