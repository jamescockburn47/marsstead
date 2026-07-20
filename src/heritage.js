// Heritage — humanity's old hardware on Mars, pure: no THREE, no DOM.
// verify-heritage.mjs guards it. Every site is REAL: the mission, the
// year, the place and the coordinates are the survey's own record, and
// each manifest reflects the actual kit that flew — RTGs and dishes
// read as electronics and cable, airbags as seal kits, Ingenuity as a
// drone frame. Part of the charter is CLEANUP: Meridian's demonstration
// includes stewardship of the old machines, and salvage is how a
// homestead honours them — nothing is wasted, everything is logged.
//
// Distances from Jezero make the travel tiers honest: Perseverance is
// a walk, Beagle 2 a buggy day-trip, Curiosity an expedition, Viking
// country a full-rack flight with tanks aboard.

import { latLonToWorld } from './mars.js';

export const SALVAGE_M = 8;    // stand this close to strip a site

// kind: lander | rover | crash — the layer draws each grammar
export const HERITAGE = [
  {
    id: 'perseverance', name: 'Perseverance & Ingenuity', year: 2021,
    kind: 'rover', lat: 18.4446, lonE: 77.4509,
    place: 'Jezero crater floor',
    story: 'The rover that proved the delta and the little helicopter that proved the sky. It parked for the last time long before Meridian came — the first neighbour, a short walk from the landing.',
    salvage: [['electronics', 2], ['machine-parts', 2], ['alloy-panel', 1], ['drone-frame', 1], ['glass', 1]],
  },
  {
    id: 'beagle2', name: 'Beagle 2', year: 2003,
    kind: 'lander', lat: 11.5265, lonE: 90.4295,
    place: 'Isidis Planitia',
    story: 'The little British lander that made it down and could not unfold its wings to call home. Found decades later, panels half-open, still waiting politely.',
    salvage: [['solar-wing', 1], ['electronics', 1], ['seal-kit', 1]],
  },
  {
    id: 'curiosity', name: 'Curiosity', year: 2012,
    kind: 'rover', lat: -4.5895, lonE: 137.4417,
    place: 'Gale crater, Aeolis Palus',
    story: 'The nuclear laboratory that climbed a mountain for a decade. Its wheels were famously holed by the very rocks it studied.',
    salvage: [['electronics', 2], ['machine-parts', 2], ['alloy-panel', 1]],
    record: 'Curiosity\'s methane campaign, recovered: the spikes it chased for years rise and fall with the mornings — but underneath the seasons there is a second period the papers never settled, and it does not belong to the sun.',
  },
  {
    id: 'insight', name: 'InSight', year: 2018,
    kind: 'lander', lat: 4.5024, lonE: 135.6234,
    place: 'Elysium Planitia',
    story: 'The lander that listened to the planet\'s heartbeat and heard marsquakes ring through the deep rock. Its solar discs finally dimmed under the dust.',
    salvage: [['solar-wing', 2], ['electronics', 2], ['cable', 1]],
  },
  {
    id: 'spirit', name: 'Spirit', year: 2004,
    kind: 'rover', lat: -14.5684, lonE: 175.4726,
    place: 'Gusev crater',
    story: 'Ninety sols were promised; six years were given. It dug a trench with a jammed wheel and found old water in the scar. It rests where the sand finally held it.',
    salvage: [['solar-wing', 1], ['electronics', 2], ['machine-parts', 1]],
  },
  {
    id: 'opportunity', name: 'Opportunity', year: 2004,
    kind: 'rover', lat: -1.9462, lonE: 354.4734,
    place: 'Meridiani Planum',
    story: 'Fifteen years on a ninety-sol warranty, a marathon on another world. The great storm of 2018 put it to sleep mid-sentence: its battery was low and it was getting dark.',
    salvage: [['solar-wing', 1], ['electronics', 2], ['machine-parts', 1]],
    record: 'Opportunity\'s final season logs, recovered: through the great storm its microphones-that-were-never-microphones — the accelerometers — kept picking up a slow, patterned knock in the ground. The engineers filed it as thermal creak. It kept perfect time for eleven sols.',
  },
  {
    id: 'schiaparelli', name: 'Schiaparelli', year: 2016,
    kind: 'crash', lat: -1.9, lonE: 353.79,
    place: 'Meridiani Planum, west of Opportunity',
    story: 'A landing rehearsal that mistook the sky for the ground and cut its engines high. The field of pieces is its own lesson, and the charter says even lessons get cleaned up.',
    salvage: [['steel-panel', 1], ['seal-kit', 1], ['electronics', 1]],
  },
  {
    id: 'pathfinder', name: 'Pathfinder & Sojourner', year: 1997,
    kind: 'lander', lat: 19.13, lonE: 326.79,
    place: 'Ares Vallis',
    story: 'It bounced down on airbags like a beach toy and unfolded a microwave-oven-sized rover onto the rocks. The little one never went far; it never needed to.',
    salvage: [['seal-kit', 2], ['drone-frame', 1], ['solar-wing', 1], ['steel-panel', 1]],
  },
  {
    id: 'viking1', name: 'Viking 1', year: 1976,
    kind: 'lander', lat: 22.48, lonE: 312.03,
    place: 'Chryse Planitia',
    story: 'The first machine to work on Mars and live. It ran six years on the heat of its own plutonium and asked the soil the biggest question there is.',
    salvage: [['electronics', 2], ['alloy-panel', 2], ['cable', 1], ['window-pane', 1]],
  },
  {
    id: 'viking2', name: 'Viking 2', year: 1976,
    kind: 'lander', lat: 47.97, lonE: 225.74,
    place: 'Utopia Planitia',
    story: 'The twin, far to the north, that photographed frost on the ground one morning — the first anyone had seen on another world. The frost still comes; the lander still faces it.',
    salvage: [['electronics', 2], ['alloy-panel', 2], ['cable', 1]],
    record: 'Viking 2\'s weather telemetry, recovered: a faint correlation rides the frost readings, morning after morning, for six years — a rhythm the instruments were never built to hear. The archive flags it "sensor drift". Drift does not keep a beat.',
  },
  {
    id: 'phoenix', name: 'Phoenix', year: 2008,
    kind: 'lander', lat: 68.2188, lonE: 234.2508,
    place: 'Vastitas Borealis, the far north',
    story: 'It scraped the arctic ground and found water ice inches down, then watched it sublime in the sun. The polar winter buried it in dry ice and broke its wings.',
    salvage: [['solar-wing', 1], ['machine-parts', 1], ['electronics', 1], ['ice', 2]],
  },
  {
    id: 'mars3', name: 'Mars 3', year: 1971,
    kind: 'lander', lat: -45, lonE: 202,
    place: 'the Ptolemaeus country',
    story: 'The first soft landing on Mars, half a century before anyone followed. It spoke for twenty seconds into a global dust storm and went silent forever. Nobody knows what it saw.',
    salvage: [['steel-panel', 1], ['cable', 1], ['electronics', 1]],
    record: 'Mars 3\'s twenty seconds, recovered whole at last: nineteen of camera noise in a brown sky. And under the noise, in the last second, the carrier settles — as if the storm around it had, just there, gone perfectly still to listen.',
  },
  {
    id: 'polarlander', name: 'Mars Polar Lander', year: 1999,
    kind: 'crash', lat: -76.57, lonE: 195.02,
    place: 'Planum Australe, the deep south',
    story: 'It felt its legs deploy and believed it had landed, forty metres up. The southern ice keeps the pieces. The longest recovery drive there is.',
    salvage: [['steel-panel', 1], ['cable', 1]],
  },
];

export function heritageXZ(site) {
  return latLonToWorld(site.lat, site.lonE);
}

// what still lies at a site, after what the taken-map says was carried off
export function remainingAt(site, taken) {
  const t = (taken && taken[site.id]) || {};
  return site.salvage
    .map(([id, n]) => [id, n - (t[id] || 0)])
    .filter(([, n]) => n > 0);
}

export function isStripped(site, taken) {
  return remainingAt(site, taken).length === 0;
}

// record a haul: returns a NEW taken-map (pure — the caller owns state)
export function recordTake(site, taken, id, n) {
  const next = { ...(taken || {}) };
  next[site.id] = { ...(next[site.id] || {}) };
  next[site.id][id] = (next[site.id][id] || 0) + n;
  return next;
}

// ---- save ------------------------------------------------------------------
export function serializeHeritage(taken) {
  const out = {};
  for (const site of HERITAGE) {
    const t = (taken && taken[site.id]) || null;
    if (!t) continue;
    const clean = {};
    for (const [id, cap] of site.salvage) {
      const n = Math.round(t[id]);
      if (Number.isFinite(n) && n > 0) clean[id] = Math.min(cap, n);
    }
    if (Object.keys(clean).length) out[site.id] = clean;
  }
  return out;
}
export function deserializeHeritage(raw) {
  return serializeHeritage(raw && typeof raw === 'object' ? raw : null);
}
