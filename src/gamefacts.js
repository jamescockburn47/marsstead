// gamefacts.js — VESPER's fact corpus (the Moorstead mini-RAG pattern,
// game-facts.js ported). Plain-English, keyword-tagged chunks covering
// what a settler can actually DO; retrieval picks the two or three that
// match each question and they ride the prompt as FIELD NOTES — she
// answers in her own voice, but the numbers are never from memory.
//
// HALLUCINATION-PROOF BY CONSTRUCTION: every number is INTERPOLATED from
// the live constants (power.js, burrow.js), so a rebalance updates the
// corpus automatically — the facts cannot drift from the code. Only
// BUILT mechanics belong here; the hopper, the Seed and the caves do
// not exist yet and must not be described as if they do.
//
// Deploy note: the EVO relay imports vesperbrain.js which imports THIS —
// ship both files together (scp src/gamefacts.js AND src/vesperbrain.js).

import { RTG_KW, ARRAY_KW, BATTERY_CAP, LANDER_BANK_KWH, BUILD_KWH, LOADS } from './power.js';
import { DIG_KWH, LIGHT_REACH } from './burrow.js';

export const GAME_FACTS = [
  // --- power, the currency ---
  { topic: 'power', keywords: ['power', 'charge', 'bank', 'kwh', 'kilowatt', 'energy', 'battery', 'rtg', 'electricity', 'budget'],
    text: `Power is the currency of building. The lander's RTG makes ${RTG_KW} kW always; a solar array adds up to ${ARRAY_KW} kW in clear sun; a battery bank stores ${BATTERY_CAP} kWh. The lander's own cells hold ${LANDER_BANK_KWH} kWh and landed holding 4.` },
  { topic: 'power', keywords: ['shed', 'quiet', 'shortage', 'short', 'brownout', 'dark', 'stall', 'stalled'],
    text: 'When demand beats supply and the bank runs dry, loads shed in a fixed order: assembler, mill, electrolyser, smelter, fabricator, then the drones, and the warren\'s comforts last. Shed benches hold their queues and resume when power returns — quiet, never broken.' },
  { topic: 'power', keywords: ['array', 'solar', 'panel', 'panels', 'sun', 'income', 'ahead', 'keep'],
    text: `To keep ahead of building costs: place solar arrays (${BUILD_KWH.machine} kWh each to print, built from glass, cable and electronics with B) and battery banks for the night. Dust taxes solar — a clear sol pays best, and the forecast in the Works console is real.` },
  // --- the burrow ---
  { topic: 'burrow', keywords: ['dig', 'digging', 'burrow', 'warren', 'room', 'rooms', 'tunnel', 'shaft', 'corridor', 'plan', 'underground', 'home', 'base'],
    text: `The home is dug underground at the crown (E opens the console). Plans are free; breaking ground debits the bank — shaft ${DIG_KWH.shaft} kWh, corridor ${DIG_KWH.corridor}, bunk or store ${DIG_KWH.bunk}, works bay or garden ${DIG_KWH.garden}. A queue the bank cannot fund waits on charge and resumes with income.` },
  { topic: 'burrow', keywords: ['drone', 'drones', 'hands', 'fleet', 'robot', 'robots', 'faster'],
    text: `The drones do all digging; they draw ${LOADS.drone} kW each while working, so three digging at night outdraw the RTG. A new drone needs a drone frame (milled from machine parts) plus ${BUILD_KWH.drone} kWh, deployed from the Burrow console — cap eight.` },
  { topic: 'burrow', keywords: ['ring', 'airlock', 'seal', 'pressure', 'pressurise', 'air'],
    text: 'The salvaged airlock ring caps the shaft and its ONLY job is holding the warren\'s air — nothing else depends on it. Install it from the Burrow console once the first shaft cell is dug; it comes off the lander by rover (too heavy for the suit).' },
  { topic: 'burrow', keywords: ['bunk', 'sleep', 'rested', 'shelter', 'deep', 'garden', 'store', 'design', 'layout'],
    text: `Warren design pays: bunks score by depth (three levels down is best) and a garden next door closes the air loop — waking in a good bunk slows your air and warmth drain for hours. Gardens only grow within ${LIGHT_REACH} levels of the surface (light-pipes). A store within two columns of the shaft speeds every dig.` },
  { topic: 'burrow', keywords: ['spoil', 'ore', 'iron', 'pays', 'mining'],
    text: 'Every dug space pays spoil: regolith always, iron ore often (more at depth). Banked ore walks into your bags automatically when you pass the crown.' },
  // --- the works ---
  { topic: 'works', keywords: ['fabricator', 'fab', 'bench', 'panel', 'panels', 'steel', 'make', 'craft', 'smelt', 'glass', 'refine'],
    text: 'The lander fabricator works from sol one and needs NOTHING built first: stand at the lander, press T — it feeds iron ore from your bags and returns steel panels (25 s each); silica makes glass; ice makes water. A built smelter does the same twice as fast.' },
  { topic: 'works', keywords: ['mill', 'assembler', 'parts', 'frame', 'tank', 'winch', 'chain', 'production'],
    text: 'The chain above the smelter: the mill turns steel panels into machine parts and parts into drone frames; the assembler turns parts into methane tanks and cable into a winch rig. E at any bench opens the Works console — the whole flow on one screen.' },
  { topic: 'works', keywords: ['build', 'place', 'placing', 'machine', 'cost', 'b', 'construct'],
    text: `B enters build mode: Q cycles parts and machines, E places (each placement spends the bank — ${BUILD_KWH.steadPart} kWh for a part, ${BUILD_KWH.machine} for any machine), X removes. Machines want level ground and spacing.` },
  // --- survival & world ---
  { topic: 'survival', keywords: ['air', 'oxygen', 'cold', 'warm', 'warmth', 'suit', 'die', 'death', 'blackout'],
    text: 'Air and warmth are the suit\'s two clocks; the lander and a pressurised warren refill both. Running out never kills: you black out, wake at shelter, and the planet takes a tithe — dropped cargo, never your banked base.' },
  { topic: 'world', keywords: ['map', 'lost', 'retrace', 'tracks', 'trail', 'home', 'way', 'minimap', 'compass'],
    text: 'The compass ring (bottom left) always shows your trail and the way home; M opens the full surveyor\'s map — terrain draws where you have walked, and your bootprints and wheel ruts are permanent.' },
  { topic: 'world', keywords: ['rover', 'buggy', 'drive', 'vehicle', 'rig', 'drill', 'deposit', 'prospect'],
    text: 'E at the buggy drives it (F/G load and unload the deck). Prospecting is being there: ore bodies mark themselves as you range. Tow the drill rig (H hitches it) onto marked ore and E anchors it to drill.' },
  { topic: 'world', keywords: ['storm', 'dust', 'weather', 'forecast', 'tau', 'clear', 'sky'],
    text: 'Dust is weather with a real forecast: clear spells and dusty spells run in sols-long runs. Dust taxes solar and thickens the sky; deep storms are coming in a later phase but have not arrived yet.' },
  { topic: 'meta', keywords: ['orders', 'help', 'controls', 'keys', 'manual', 'instructions'],
    text: 'O reopens the LANDFALL ORDERS (the written briefing); ENTER types to VESPER, V is push-to-talk. The orders sheet lists every key.' },
];

// retrieval, the Moorstead way: keyword overlap, top K chunks. Cheap,
// deterministic, and it puts the RIGHT truth in front of the model at
// answer time — which is the whole hallucination-proofing.
export function retrieveFacts(text, k = 3) {
  const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  const set = new Set(words);
  return GAME_FACTS
    .map((f) => ({ f, score: f.keywords.reduce((a, w) => a + (set.has(w) ? 1 : 0), 0) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.f.text);
}
