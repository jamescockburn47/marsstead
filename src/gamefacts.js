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

// power.js is the ONE import — dependency-free, so the EVO relay carries
// the corpus without the world sim (ship power.js alongside)
import {
  RTG_KW, ARRAY_KW, BATTERY_CAP, LANDER_BANK_KWH, BUILD_KWH, LOADS,
  DIG_KWH, LIGHT_REACH,
} from './power.js';

export const GAME_FACTS = [
  // --- power, the currency ---
  { topic: 'power', keywords: ['power', 'charge', 'bank', 'kwh', 'kilowatt', 'energy', 'battery', 'rtg', 'electricity', 'budget'],
    text: `Power is the currency of building. The lander's RTG makes ${RTG_KW} kW always; a solar array adds up to ${ARRAY_KW} kW in clear sun; a battery bank stores ${BATTERY_CAP} kWh. The lander's own cells hold ${LANDER_BANK_KWH} kWh and landed holding 4.` },
  { topic: 'power', keywords: ['shed', 'quiet', 'shortage', 'short', 'brownout', 'dark', 'stall', 'stalled'],
    text: 'When demand beats supply and the bank runs dry, loads shed in a fixed order: assembler, mill, electrolyser, smelter, fabricator, then the drones, and the warren\'s comforts last. Shed benches hold their queues and resume when power returns — quiet, never broken.' },
  { topic: 'power', keywords: ['array', 'solar', 'panel', 'panels', 'sun', 'income', 'ahead', 'keep'],
    text: `To keep ahead of building costs: place solar arrays (${BUILD_KWH.machine} kWh each to print, built from two steel panels with B) and battery banks for the night (a steel panel plus electronics). Dust taxes solar — a clear sol pays best, and the forecast in the Works console is real.` },
  // --- the burrow ---
  { topic: 'burrow', keywords: ['dig', 'digging', 'burrow', 'warren', 'room', 'rooms', 'tunnel', 'shaft', 'corridor', 'plan', 'underground', 'home', 'base'],
    text: `The home is dug underground at the crown (E opens the console). Plans are free; breaking ground debits the bank — shaft ${DIG_KWH.shaft} kWh, corridor ${DIG_KWH.corridor}, bunk or store ${DIG_KWH.bunk}, works bay or garden ${DIG_KWH.garden}. A queue the bank cannot fund waits on charge and resumes with income.` },
  { topic: 'burrow', keywords: ['drone', 'drones', 'hands', 'fleet', 'robot', 'robots', 'faster'],
    text: `The drones do all digging; they draw ${LOADS.drone} kW each ONLY while actually cutting — a queue waiting on charge idles them, so the bank always fills. Three digging at night still outdraw the RTG. A new drone needs a drone frame (assembled from a steel panel) plus ${BUILD_KWH.drone} kWh, deployed from the Burrow console — cap eight.` },
  { topic: 'burrow', keywords: ['ring', 'airlock', 'seal', 'pressure', 'pressurise', 'air'],
    text: 'The salvaged airlock ring caps the shaft and its ONLY job is holding the warren\'s air — nothing else depends on it. Install it from the Burrow console once the first shaft cell is dug; it comes off the lander by rover (too heavy for the suit).' },
  { topic: 'burrow', keywords: ['bunk', 'sleep', 'rested', 'shelter', 'deep', 'garden', 'store', 'design', 'layout'],
    text: `Warren design pays: bunks score by depth (three levels down is best) and a garden next door closes the air loop — waking in a good bunk slows your air and warmth drain for hours. Gardens only grow within ${LIGHT_REACH} levels of the surface (light-pipes). A store within two columns of the shaft speeds every dig.` },
  { topic: 'burrow', keywords: ['spoil', 'ore', 'iron', 'pays', 'mining'],
    text: 'Every dug space pays spoil: regolith always, iron ore often (more at depth). Banked spoil walks into your bags automatically when you pass the crown — ore first, then regolith sacks — and fills a buggy parked there. The fabricator rakes regolith into iron ore, so ALL spoil ends as steel.' },
  // --- the works ---
  { topic: 'works', keywords: ['fabricator', 'fab', 'bench', 'panel', 'panels', 'steel', 'make', 'craft', 'smelt', 'glass', 'refine'],
    text: 'The lander fabricator works from sol one and needs NOTHING built first: stand at the lander, press T — it rakes regolith into iron ore, smelts ore into steel panels, silica into glass, ice into water, walking a sack of spoil all the way to a panel unattended. A built smelter (two steel panels) does the same roughly twice as fast.' },
  { topic: 'works', keywords: ['mill', 'assembler', 'parts', 'frame', 'tank', 'winch', 'chain', 'production'],
    text: 'The chain above the smelter: the mill turns steel panels into machine parts and glass into electronics (glass needs mined silica — the expedition unlocks the component tier); the assembler turns steel panels into drone frames, parts into methane tanks and salvaged cable into the winch rig. E at any bench opens the Works console — the whole flow on one screen.' },
  { topic: 'works', keywords: ['build', 'place', 'placing', 'machine', 'cost', 'b', 'construct'],
    text: `B enters build mode: Q cycles parts and machines, E places (each placement spends the bank — ${BUILD_KWH.steadPart} kWh for a part, ${BUILD_KWH.machine} for any machine), X removes. Machines want level ground and spacing.` },
  // --- survival & world ---
  { topic: 'survival', keywords: ['air', 'oxygen', 'cold', 'warm', 'warmth', 'suit', 'die', 'death', 'blackout'],
    text: 'Air and warmth are the suit\'s two clocks; the lander and a pressurised warren refill both. Running out never kills: you black out, wake at shelter, and the planet takes a tithe — dropped cargo, never your banked base.' },
  { topic: 'world', keywords: ['map', 'lost', 'retrace', 'tracks', 'trail', 'home', 'way', 'minimap', 'compass'],
    text: 'The compass ring (bottom left) always shows your trail and the way home; M opens the full surveyor\'s map — terrain draws where you have walked, and your bootprints and wheel ruts are permanent.' },
  { topic: 'world', keywords: ['rover', 'buggy', 'drive', 'vehicle', 'rig', 'drill', 'deposit', 'prospect'],
    text: 'E at the buggy drives it (F/G load and unload the deck). Prospecting is being there: ore bodies mark themselves as you range. Tow the drill rig (H hitches it) onto marked ore and E anchors it to drill.' },
  { topic: 'world', keywords: ['recall', 'stranded', 'stuck', 'cliff', 'fell', 'fetch', 'recover', 'tow', 'lost', 'far', 'abandoned', 'retrieve', 'crashed'],
    text: 'A buggy stranded anywhere — down a cliff, out past walking range — is never lost: open the Burrow console at the crown and press RECALL THE BUGGY. The drones tow it home in a few minutes for a few kilowatt-hours. The settler themselves can always walk home, or let the suit run out: a blackout wakes them at shelter, cargo dropped where they fell, never worse.' },
  { topic: 'world', keywords: ['storm', 'dust', 'weather', 'forecast', 'tau', 'clear', 'sky'],
    text: 'Dust is weather with a real forecast: clear spells and dusty spells run in sols-long runs. Dust taxes solar and thickens the sky; deep storms are coming in a later phase but have not arrived yet.' },
  // --- the hopper (Stage 3; pads died 2026-07-20 — fly anywhere) ---
  { topic: 'hopper', keywords: ['hopper', 'fly', 'flight', 'hop', 'landing', 'assemble', 'rocket', 'horizon', 'range', 'travel'],
    text: 'The hopper crosses horizons: assemble the craft at the ASSEMBLER (the works console, T at any bench) from six steel panels, four machine parts and two electronics. Hops are ballistic and plotted — E beside the craft opens its console; mark any target inside the fuel circle and light the engine. Every landing is exact where you aim.' },
  { topic: 'hopper', keywords: ['stuck', 'stranded', 'lost', 'landed', 'find', 'return', 'recover', 'console', 'enter'],
    text: 'The craft is its own console: E beside the hopper opens it wherever it stands — a far landing is never a stranding. Load fresh tanks there and plot the next hop home. The hopper rings teal on the wrist map, so the ship is always findable.' },
  { topic: 'hopper', keywords: ['fuel', 'methane', 'tank', 'tanks', 'cradle', 'payload', 'reach'],
    text: 'Hopper fuel is methane tanks (assembler-made from machine parts), loaded whole and spent whole at ignition: a full rack of six reaches about twenty-five kilometres, one tank a kilometre and a half. Cradling the buggy nearly halves range but brings wheels — and its stores — to the far country.' },
  // --- the signal chain and the planet ---
  { topic: 'signal', keywords: ['signal', 'band', 'sweep', 'anomaly', 'chain', 'mystery', 'read', 'ground', 'journal', 'record'],
    text: 'The SIGNAL band by the wrist map warms as you close on the source — no bearing, only warmth: fly toward hotter. Inside the last stretch it becomes a sweep played on foot; at the heart, E reads the ground and the record lands in THE RECORD (J). Each read record wakes a new, farther signal.' },
  { topic: 'signal', keywords: ['ring', 'circle', 'map', 'where', 'search', 'area'],
    text: 'After a signal is heard, the wrist map (M) draws a vague dashed circle around its country — coarse on purpose. The band\'s warmth is the honest instrument; the circle only orients the flight.' },
  { topic: 'world', keywords: ['landmark', 'landmarks', 'olympus', 'names', 'chart', 'places', 'visit', 'mons', 'crater'],
    text: 'The hop chart and the wrist map name the real country — Olympus Mons, the great basins, the named craters of the survey. They are places, not quests: wanting to see one is reason enough, and the fuel circle is the only permission needed.' },
  { topic: 'world', keywords: ['frost', 'glint', 'sparkle', 'morning', 'dawn', 'shimmer', 'caps', 'pole', 'ice'],
    text: 'Ground frost condenses overnight and burns off by mid-morning: step out at dawn and the plain toward the sun is a field of cold sparks. The polar caps carry seasonal frost that shimmers from the hopper\'s arc. It is only beautiful — and it is gone within the hour.' },
  // --- heritage: the cleanup charter ---
  { topic: 'heritage', keywords: ['heritage', 'salvage', 'viking', 'rover', 'perseverance', 'curiosity', 'pathfinder', 'mission', 'old', 'wreck', 'cleanup', 'charter'],
    text: 'The old robotic missions rest where they truly stopped — Perseverance a walk from home, Beagle 2 a buggy day into Isidis, Curiosity above Gale, the Vikings in the far country. The charter includes their cleanup: E beside one salvages its real kit (whatever the suit and rover can carry; the rest waits). Pale marks on every chart.' },
  { topic: 'heritage', keywords: ['stripped', 'honours', 'tended', 'logged', 'materials', 'kit'],
    text: 'Each old machine yields what it truly carried — power units and dishes read as electronics and cable, airbags as seal kits, the little helicopter as a drone frame. A fully salvaged site reads STRIPPED WITH HONOURS on the prompt and dims on the charts: tended, never forgotten.' },
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
