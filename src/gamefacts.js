// gamefacts.js — VESPER's fact corpus (the Moorstead mini-RAG pattern,
// game-facts.js ported). Plain-English, keyword-tagged chunks covering
// what a settler can actually DO; retrieval picks the two or three that
// match each question and they ride the prompt as FIELD NOTES — she
// answers in her own voice, but the numbers are never from memory.
//
// Mechanical constants are interpolated where the relay dependency boundary
// permits. Focused checks hold other claims against the implemented journey;
// retrieval helps grounding but does not guarantee a generated answer.
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
    text: `Power is the currency of building. The lander's RTG makes ${RTG_KW} kW always; a solar array adds up to ${ARRAY_KW} kW in clear sun; a battery bank stores ${BATTERY_CAP} kWh. The lander's own cells hold ${LANDER_BANK_KWH} kWh on their own. New arrivals include a supplied battery and start with 12 kWh total.` },
  { topic: 'power', keywords: ['shed', 'quiet', 'shortage', 'short', 'brownout', 'dark', 'stall', 'stalled'],
    text: 'When demand beats supply and the bank runs dry, loads shed in a fixed order: assembler, mill, electrolyser, smelter, fabricator, then the drones, and the warren\'s comforts last. Shed benches hold their queues and resume when power returns — quiet, never broken.' },
  { topic: 'power', keywords: ['array', 'solar', 'panel', 'panels', 'sun', 'income', 'ahead', 'keep'],
    text: `To keep ahead of building costs: place solar arrays (${BUILD_KWH.machine} kWh each to print, built from two steel panels with B) and battery banks for the night (a steel panel plus electronics). Dust taxes solar — a clear sol pays best, and the forecast in the Works console is real.` },
  // --- the burrow ---
  { topic: 'burrow', keywords: ['dig', 'digging', 'burrow', 'warren', 'room', 'rooms', 'tunnel', 'shaft', 'corridor', 'plan', 'underground', 'home', 'base'],
    text: `The home is dug underground at the crown (E opens the console). Regular prices: shaft ${DIG_KWH.shaft} kWh, corridor ${DIG_KWH.corridor}, bunk or store ${DIG_KWH.bunk}, bay or garden ${DIG_KWH.garden}. Starter forms reduce the first corridor to 1 and first bunk to 2. Plans are free; an unfunded queue waits on charge.` },
  { topic: 'burrow', keywords: ['drone', 'drones', 'hands', 'fleet', 'robot', 'robots', 'faster'],
    text: `The crew does all digging; each worker draws ${LOADS.drone} kW ONLY while cutting. Waiting on charge idles the motors; other loads still affect the bank. Three digging at night outdraw the RTG. A new drone needs a drone frame plus ${BUILD_KWH.drone} kWh, deployed from the Burrow console — cap eight. Weather and crew mode can also pause work.` },
  { topic: 'crew', keywords: ['crew', 'drone', 'robot', 'follow', 'park', 'work', 'command'],
    text: 'At a new landing the crew starts parked. Approach a worker and press E: Call over makes the crew follow locally; Hold position parks it; Resume excavation works on your planned room queue. Park and follow pause digging. The crew stays near home.' },
  { topic: 'crew', keywords: ['crew', 'vesper', 'command', 'commands', 'follow', 'hold', 'resume', 'recall', 'release'],
    text: 'Crew controls also have exact local command phrases: "crew follow me", "crew hold position", "crew resume excavation", "recall crew" and "release crew". Follow, hold and resume retain the nearby-worker and home-area checks of their buttons. Recall and release use the weather control hub rules. A live reply does not itself change crew mode; the local command result is authoritative.' },
  { topic: 'burrow', keywords: ['first', 'starter', 'corridor', 'bunk', 'cost', 'early'],
    text: 'New arrivals have a sealed bunk, workshop, two shaft levels, battery and prepaid lower passage. Direct the crew to finish it; earn solar power and add a garden. Existing settlements keep their layout. Empty legacy burrows retain starter forms: first corridor to 1 kWh and first bunk to 2 kWh, then regular prices. Follow the current task card; planning or chatting grants no power.' },
  { topic: 'survey', keywords: ['survey', 'sensor', 'sensors', 'align', 'light', 'wing', 'first', 'reward'],
    text: 'The first local survey is a three-light-sensor alignment puzzle. Completing it awards exactly one 18 kg solar wing; collect it once, bring it home and use it to build a solar array. A disabled worker beside that station can come home on the same rover trip for workshop repair. There is no repeat reward.' },
  { topic: 'heritage', keywords: ['salvage', 'lander', 'start', 'sleep', 'locked', 'ring'],
    text: 'The lander can be salvaged immediately; sleeping first is not required. New arrivals already have their finite airlock ring installed at home. In an empty legacy burrow the heavy ring needs nearby cargo storage and installs at the crown after the first shaft is dug.' },
  { topic: 'burrow', keywords: ['ring', 'airlock', 'seal', 'pressure', 'pressurise', 'air'],
    text: 'New arrivals have the ring installed. The airlock ring caps the shaft; its ONLY job is holding the warren\'s air. Surface production needs no ring, while habitat activities need sealed rooms. Install the ring from HOME after digging the first shaft; a legacy lander\'s ring needs the rover because it is too heavy for the suit.' },
  { topic: 'burrow', keywords: ['bunk', 'sleep', 'rested', 'shelter', 'deep', 'garden', 'store', 'design', 'layout'],
    text: `Warren design pays: bunks score by depth (three levels down is best) and a garden next door closes the air loop — waking in a good bunk slows your air and warmth drain for hours. Gardens only grow within ${LIGHT_REACH} levels of the surface (light-pipes). A store within two columns of the shaft speeds every dig.` },
  { topic: 'habitat', keywords: ['habitat', 'inside', 'walk', 'walking', 'room', 'bunk', 'ladder', 'home', 'shelter'],
    text: 'Completed HOME diagram rooms are walkable in 3D. Enter at the shaft; WASD or the stick moves inside, Q/F or ladder buttons change levels. The fitted ring seals finished rooms, restoring air and warmth. Unfinished or unsealed rooms give no weather protection. In a sealed bunk, E sleeps until dawn after sunset; Surface exits home.' },
  { topic: 'habitat', keywords: ['worker', 'repair', 'workshop', 'bench', 'diagnose', 'equip', 'attachment', 'disabled'],
    text: 'Recover the disabled spider beside the survey station on the solar-wing outing. At the sealed Works Bay bench, press E to place, diagnose, repair and equip it, one step at a time; no new production machine is needed. Later, deploy the equipped worker at the field hatch. Clearing takes 12 active seconds and opens a second entrance into the workings.' },
  { topic: 'habitat', keywords: ['garden', 'greenhouse', 'nursery', 'crop', 'plant', 'water', 'harvest', 'tomato', 'ration', 'food'],
    text: 'At the growing bed in a completed, sealed Garden Room, E plants, then waters. Growth takes 60 active seconds with a sealed garden present. E harvests one packed ration; Eat tomato reduces air use for one Mars hour. The workshop Production overview opens surface production queues, separately from recovered-worker repair.' },
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
    text: 'Air and warmth are suit reserves, with independent survival pressure in Options. Return home rescues the player aboard the ship with cargo safe; the buggy stays where parked. Exhaustion never kills or drops cargo. Use the written instruments and the Home control when you need shelter.' },
  { topic: 'world', keywords: ['map', 'lost', 'retrace', 'tracks', 'trail', 'home', 'way', 'minimap', 'compass'],
    text: 'The compass ring (bottom left) always shows your trail and the way home; M opens the full surveyor\'s map — terrain draws where you have walked, and your bootprints and wheel ruts are permanent.' },
  { topic: 'world', keywords: ['rover', 'buggy', 'drive', 'vehicle', 'rig', 'drill', 'deposit', 'prospect'],
    text: 'E at the buggy drives it (F/G load and unload the deck). Prospecting is being there: ore bodies mark themselves as you range. Tow the drill rig (H hitches it) onto marked ore and E anchors it to drill.' },
  { topic: 'world', keywords: ['recall', 'stranded', 'stuck', 'cliff', 'fell', 'fetch', 'recover', 'tow', 'lost', 'far', 'abandoned', 'retrieve', 'crashed'],
    text: 'Return home rescues you aboard the ship with cargo safe and leaves the buggy where parked. To recover the buggy, open the Burrow console at the crown and press RECALL THE BUGGY. Drones tow it home for charge. Do not rely on running out of air to tow a vehicle.' },
  { topic: 'world', keywords: ['storm', 'dust', 'weather', 'forecast', 'tau', 'clear', 'sky'],
    text: 'Dust storms are implemented. The first local warning comes after 15 active-equivalent minutes, the first storm runs from minute 18 to 20, and the cycle repeats every 30 minutes. Read the current forecast. Dust cuts visibility and solar output. Sleep skips still expose uncovered equipment; pausing the simulation pauses weather.' },
  { topic: 'weather', keywords: ['storm', 'weather', 'secure', 'cover', 'uncover', 'clean', 'wipe', 'clogged', 'equipment', 'battery'],
    text: 'Use Weather to cover nearby machines, rover or rig. Covers reduce dust exposure and stop work until uncovered; battery storage stays connected. Covering never removes dust. At 60% dust, equipment is clogged and production stops. After a storm, stand still within 4 metres outdoors and wipe for 4 seconds. Cleaning changes no cargo or materials.' },
  { topic: 'weather', keywords: ['cold', 'night', 'storm', 'shelter', 'crew', 'recall', 'release', 'rover', 'safe'],
    text: 'The open rover and ground near the crown are not shelter; the cabin or a sealed room protects the suit. Cold nights halve equipment efficiency. Recall crew from the home weather hub for protection; after release, storms or clogged condition still prevent digging. Clean the dock if needed. An uncovered rover retains at least 40% throttle response.' },
  // --- THE SHIP (2026-07-20: lander + hopper merged, flight from sol one) ---
  { topic: 'ship', keywords: ['ship', 'hopper', 'lander', 'fly', 'flight', 'hop', 'landing', 'rocket', 'horizon', 'range', 'travel'],
    text: 'The ship is lander, workshop and wings in ONE hull — you landed flight-ready with three tanks aboard. E beside it opens the flight console; mark any target inside the fuel circle and light the engine. Every landing is exact, and the WHOLE ship moves with you: the bench, the stores, the bed, the spare skin.' },
  { topic: 'ship', keywords: ['stuck', 'stranded', 'lost', 'landed', 'find', 'return', 'recover', 'console', 'enter'],
    text: 'The ship is its own console: E beside it opens the chart wherever it stands — a far landing is never a stranding, because home came with you. It rings teal as SHIP on every map. Out of fuel far afield, the buggy still drives and the works can be raised anywhere there is sun and ore.' },
  { topic: 'ship', keywords: ['hold', 'cargo', 'sled', 'tow', 'haul', 'carry', 'load', 'store', 'transport'],
    text: 'Two ways to haul salvage home: the WORKSHOP HOLD in the ship (F loads it, G takes back, twelve hundred kilos — but hold mass rides every hop as payload, so flying cargo costs fuel and reach) and the CARGO SLED (six hundred kilos, hitched behind the buggy with H like the rig, one trailer at a time). Air is fast and priced; the ground is slow and free.' },
  { topic: 'ship', keywords: ['fuel', 'methane', 'tank', 'tanks', 'cradle', 'payload', 'reach', 'mining'],
    text: 'Methane tanks are made by the assembler from machine parts and loaded whole. Ignition spends the calculated fuel for the plotted distance; unused fuel stays aboard. Three tanks arrive at landfall. More cargo or a cradled buggy reduces reach: read the flight console for the current range.' },
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
  { topic: 'heritage', keywords: ['stripped', 'honours', 'tended', 'logged', 'materials', 'kit', 'solar', 'wing', 'panel', 'recycle'],
    text: 'Each old machine yields what it truly carried — solar wings that re-raise WHOLE as working arrays (B places one: the fastest power there is), power units and dishes as electronics and cable, airbags as seal kits. Reclaimed electronics are earmarked by the charter for the great work to come. A tended site reads STRIPPED WITH HONOURS and dims on the charts.' },
  { topic: 'heritage', keywords: ['log', 'logs', 'record', 'memory', 'data', 'listening', 'anomaly'],
    text: 'Some of the old machines kept LOGS — and the logs hold things their own engineers filed away as sensor error. Salvaging such a site recovers its memory into THE RECORD (J), under THE OLD LOGS. The machines were not idle all those years. Some of them were listening.' },
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
