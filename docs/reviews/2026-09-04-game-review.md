# Marsstead: from a beautiful Mars to a game people want to inhabit

Review date: 4 September 2026. Local version: 0.0.75. Review only; no runtime changes, commits or deployment.

**Verdict:** Marsstead's strongest next investment is a complete, delightful short expedition that visibly improves a personal home. It already has enough technical systems to support this. At present, inaccessible progression, obscure instructions, weak action feedback and a landscape with few different things to do prevent those systems becoming a satisfying game.

The proposition should be: **make a home on Mars with VESPER; venture out for something intriguing; bring back something that changes your home and your possibilities.** Beauty supplies the invitation, playful interaction sustains the journey, and a home that remembers the journey supplies the reason to return.

## Evidence and limits

The review combined three independent source passes, lead review of their cross-system findings, the design/campaign documents, the complete `npm run verify` gate, and local browser inspection. The full headless gate passed. Browser checks covered the title, fresh landing/orders, surface and buggy views, construction mode, map, empty journal, Escape behaviour, and orders at a 390 × 844 viewport. Live VESPER lines appeared. The browser log sample contained a shader precision warning; this review did not measure performance or establish a rendering defect from it.

This was not a full campaign playthrough, a latency benchmark, a generated-dialogue safety evaluation, or a child usability study. A narrower viewport is not a real touch-device test. Movement occurred between some browser observations without an attributable test action, so no precise movement or journey timing is claimed. Mechanics identified below as source findings were traced through the actual integration code; hypothetical player responses remain design judgments to validate.

Supporting source reports: [core play](2026-09-04-core-play.md), [companion and discovery](2026-09-04-companion-discovery.md), [visual/interface](2026-09-04-visual-interface.md). Screenshots are under `media/review-2026-09-04/` (ignored local evidence).

The current campaign doctrine matters: `docs/STRUCTURE.md:24–50` deliberately makes the underground home a console experience, rejects a wear/repair economy, and defines difficulty through scale rather than punishment. Some other documentation and prompts still describe older designs. Recommendations here preserve those choices unless a change is expressly identified.

## 1. Why it currently feels bare and boring

### A. The advertised construction loop cannot be completed normally

Construction affordability and spending inspect only the suit (`src/main.js:1542–1550`, `1569–1575`). The suit holds 35 kg (`src/inventory.js:39`). Two steel panels weigh 52 kg; both the ordinary solar-array recipe and the smelter require them (`src/machines.js:20–25`, `45–52`). The mill, assembler and electrolyser also exceed suit capacity. The rover's large cargo capacity does not help this construction path. A recovered 18 kg solar wing provides an alternative array route, but does not unblock the manufacturing chain.

This is a concrete progression fault, not a taste question. The opening orders tell players to make two panels and build an array. An obedient player reaches an impossible action. Fix construction sourcing from explicitly nearby cargo/stores, or allow staged delivery to a construction site. Show the eligible sources and remaining quantities. Preserve the purpose of hauling; do not turn every inventory on Mars into a global magic pocket.

The fabricator also needs player transfer/refeed between regolith, iron and steel; it does not autonomously run the claimed full chain (`src/refine.js:34–43`, `src/main.js:1333–1362`). Manual staging can be legitimate, but must be visible and purposeful. A clear queue and an intentional later automation upgrade are preferable to undocumented key pressing.

The core review's deterministic pacing probe puts shaft→corridor→bunk at **15 minutes 8.8 seconds**, even with immediate planning, no cooking/solar and ring installation deferred. This excludes UI time and hauling, and is not a human completion time. It shows how much the opening depends on charge accumulation. Parallel exploration could turn that wait into enjoyable play, but the game must make that alternative apparent and rewarding. Initial flight is already available through the merged ship; the blocked industrial chain restricts renewable fuel production, not the first launch.

There is a related correctness issue to fix while repairing transactions: removing a working machine discards queued/output contents and refunds standard construction materials even if an alternative recipe paid for it (`src/main.js:1582–1598`). Preserve or explicitly return the player's materials.

### B. The game asks for understanding before offering a satisfying action

The browser opening is a large orders sheet explaining a franchise demonstration, the crown, an airlock ring, drones, kilowatt-hours and refining. The surface then offers generic key hints. Construction opens on a panel ghost, without a visual catalogue of available projects. The empty journal says the band knows more than the book, without teaching how to use the band.

The prose is atmospheric; it is doing jobs that should belong to interaction design. A child need not understand Meridian's constitutional project to enjoy putting a first light on Mars. Neither does a new adult player.

There is contradictory guidance too: the lander board still tracks the older surface-hab objectives (`src/main.js:941–947`), while the orders teach the Burrow. Time-fired briefings advance whether the player has completed the preceding action (`2847–2862`). Replace them with action-dependent guidance, from one progression model shared by UI and VESPER.

### C. The best rewards are hidden or abstract

The planet looks expansive, while the home lives mainly in a schematic. Surface growth at the crown is principally a capped spoil heap and light changes; the rendered drone count is fixed at three (`src/crownlayer.js:157–207`). Manufacturing often pays out another ingredient. The mystery mostly pays out another paragraph and another journey.

A good action needs a perceptible consequence: the array unfolds and the lights come on; a garden develops visibly; a recovered instrument begins tracing a pattern; a new drone berth becomes active. Players should be able to tell what they achieved from looking at their home.

### D. Travel and discovery use too few different verbs

The world contains terrain, geological scatter, useful resource systems, heritage sites and five mystery records. The mystery interaction is principally proximity, waiting and reading (`src/main.js:2588–2633`); after the five records, the active chain ends (`src/marslegends.js:128–132`). The playable deep resolution described in the campaign documents is not present in this route.

More destinations with the same interaction will stretch this weakness. Distinct activities at a smaller number of places are more valuable: interpreting a rock layer, finding a listening angle, recovering a component, matching an observed pattern, navigating a low-g route, choosing how much to bring home.

### E. Threat is described more strongly than it operates

The temperature model ranges from −84°C to −12°C (`src/marslight.js:136–139`). At the coldest value, even the stronger cold coefficient makes the warmth update positive: `0.05 − 0.9 × 0.02 = +0.032` per simulation second (`src/main.js:3080–3082`). Warmth therefore does not deplete through this weather calculation. Oxygen reaches zero, but the reviewed code has no corresponding blackout/rescue transition, despite the game facts promising one.

The answer is not simply to make survival harsher. First make the contract real and understandable: generous warning, a reliable return/rescue option, and bounded consequences chosen through the player's settings. Then let experienced players opt into tighter expedition and power planning. Preserve no death and the no-repair-economy doctrine.

## 2. Preserve the things that make this worth pursuing

- The real-Mars geography and named destinations give exploration an identity.
- Low gravity, the buggy, tracks, dust and the blue dusk can make travelling itself pleasurable.
- Power and Burrow layout already offer meaningful system relationships: shallow gardens, deep bunks, stores near the shaft, capacity versus demand.
- The warm planet/cool signs of life palette gives a home an unusually strong visual role.
- A live, consistently allied VESPER can tie mechanical achievements to remembered shared experiences.
- Procedural generation is compatible with deliberate composition. A library of designed geological encounters, placed deterministically, can retain zero binary assets and real geographic structure.

Keep these. Additional world size, tech-tree tiers or atmospheric shader complexity are not the first answer.

## 3. Build one excellent first expedition

Prototype the following 15–25 minute slice. These timings are proposed targets for testing, not measured optima or implementation estimates. The current first-room target is about 20 minutes; bringing substantial home rewards forward would be a deliberate pacing revision.

| Time | What the player does | What makes it enjoyable | What visibly changes |
|---|---|---|---|
| 0–2 min | Takes control, makes a low-g bound, reaches an obvious worksite | Immediate bodily play; one clear objective | Bootprints, landing feedback, first project preview |
| 2–5 min | Chooses a starter layout or places its first pieces; commissions a drone action | Authorship without memorising the economy | A drone carries out the instruction; a named home begins to take shape |
| 5–9 min | Drives to a nearby glint or signal visible from home | A short journey with a ridge route and an easier basin route | A local trail and a recognisable new discovery |
| 9–13 min | Aligns a receiver or compares a sample pattern, with optional hints | Observation and manipulation, not a progress bar alone | The object responds; a recovered part/sample has a clear purpose |
| 13–18 min | Returns and uses the find in a useful home project | An expedition pays for a chosen improvement | A living garden cutaway, working instrument or illuminated home beacon |
| 18–25 min | Sees a blue sunset, reviews the discovery, chooses the next outing | Relief, pride and anticipation | VESPER recalls the actual event; two enticing next projects are available |

Do not force a sunset by secretly breaking the shared world clock. Schedule the tutorial start appropriately, or offer an explicit rest/advance in the local first-session flow. Ensure the first build does not depend on unearned power or an impossible transport step.

The player should understand three things without reading a manual: **what I want next; how to try it; what changed when I succeeded.** The larger constitutional fiction and detailed process diagrams remain optional depth.

## 4. Make the home the emotional centre

Give every room both an engineering role and a visual reward. Keep the non-walkable-home doctrine for the next slice, but replace a primarily abstract schematic with a readable, animated cutaway that can be zoomed into. Plants, lamps, bunks, storage and the player's specimens should make it recognisably a place they chose.

For example, a shallow garden gains light and helps the air loop; a deep bunk improves rest; a nearby store speeds work. Those are already compatible with the game's layout logic. Present before/after consequences while planning: “more daylight here”, “quieter sleep here”, “shorter delivery trip here”, with the numbers available on demand.

Surface changes should tell the same story: light pipes carrying a green glow, expanding arrays, active drone berths, a worked apron, crates that correspond to storage, a route beacon visible from the ridge. Let players select modest procedural details—suit accents, room palettes, a base emblem, a favourite specimen's display position. Personalisation is a reward, not a substitute for useful building.

Full walkable interiors might eventually deepen attachment, but they change the current design doctrine and expand scope considerably. An expressive cutaway earns much of that attachment sooner.

## 5. Turn the landscape into opportunities, while keeping its scale

The landscape needs **composition and interaction density**, not indiscriminate clutter. Use three linked scales: a silhouette that invites approach, an interesting route, and something to investigate at arm's reach. Preserve empty vistas between clusters so arriving at a distinctive place matters.

| Encounter | Readable attraction | Play | Reward |
|---|---|---|---|
| Basalt ridge | A split silhouette against the sky | Choose a bounding route or gentler buggy route | Shortcut, overlook, route mastery |
| Frost hollow | A pale patch in shadow | Compare shaded and exposed samples | Ice location or a new growing project |
| Old mission site | Recognisable machine silhouette | Recover a part; inspect clearly labelled historical information | Useful component and a specimen/record at home |
| Listening site | A visibly responsive instrument | Place or align probes and compare readings | New bearing and concrete mystery evidence |
| Sediment face | Alternating layers with a distinctive band | Match a nearby sample to the layer | Scientific observation and a discovery entry |
| Sheltered bowl | Inviting slopes and visible exit routes | Practice low-g traversal or optional buggy challenges | Enjoyment and skill; no compulsory medal grind |

Build a handful of these well before generating hundreds. Let encounters produce consequences elsewhere: the frost expedition improves a garden; the recovered power component lets a night project finish; the survey makes the next journey safer or more interesting.

Use an authored arrangement of nearby encounters to teach the first region, with stable seeded placement and procedural geometry. Preserve the real global skeleton and distinguish fictional local content from source-backed Martian facts. Do not imply that small synthetic features are NASA-resolved terrain.

## 6. Improve beauty through motion, contrast and consequence

The broad light and dust already work. The next visual pass should serve play:

1. **Improve the near field.** More distinctive rock shapes and geological compositions, differentiated workable surfaces, clean object silhouettes and clear interaction ranges. Brown scatter alone cannot signal what matters.
2. **Show work happening.** A material arrives, a mechanism moves, a light changes, dust is displaced, the project becomes recognisable. Construction and extraction need short visible action sequences rather than immediate objects plus text.
3. **Protect the colour law.** Rust and ochre belong to the planet; cool instrument lights, clean whites and rare garden greens mark human care. Give the home a memorable night silhouette.
4. **Use visual breathing room.** Close-ups and enclosed working spaces contrast with vast views. Quiet views are earned rests between active decisions.
5. **Add procedural sound.** The reviewed source has speech but no separate gameplay soundscape. Synthesise suit-conducted footsteps, landing thumps, buggy motor/suspension, drill vibration, machinery, an airlock seal and a changing home hum. Use restrained musical motifs for discovery/homecoming, with independent volume controls. Important events need visual equivalents and captions.
6. **Keep Plain beautiful.** Touch defaults to the reduced graphics tier. Shape, palette, legibility and recognisable landmarks must survive that tier; expensive detail should enrich them. Measure actual frame pacing on representative hardware before adding effects.

Sound and object response can make the world feel much more alive without introducing wildlife, NPC crowds, downloaded assets or constant dialogue.

## 7. One game, different demands

Age should not define difficulty. Some eight-year-olds are experienced players; some adults want quiet gardening. Offer descriptive presets, then allow guidance, survival pressure, logistics assistance and fear intensity to be changed independently without losing progress.

| Setting | Gentle exploration | Standard homesteading | Demanding expedition |
|---|---|---|---|
| Guidance | Pictorial next step, optional route aid, automatic context hints | Hints on request | Instruments and evidence with minimal prompting |
| Survival | Broad margins and immediate return assistance; no cargo penalty | Generous margins and modest recoverable consequence | Tighter planning, still no death or irreversible loss |
| Logistics | Sensible blueprint defaults and explicit nearby-source assistance | Manual layout and transparent delivery rules | Greater scale, constrained budgets and multi-site planning |
| Mystery | Wonder and strange discoveries | Unease chosen by the player | Strong atmospheric dread by explicit choice |

These are illustrative presets, not three separate campaigns. Give everyone the same substantive discoveries and story resolution. A fear reduction should change presentation and pressure rather than lock the story away. Avoid labelling assistance “kids mode” or using status/shame to drive players toward harder settings.

The adult depth should come from interacting decisions: location, daylight, storage, timing, route, payload and what to build next. It should not come from more trips carrying one panel, longer waiting, obscure keys, or a larger list of materials with no uses. The child's path should preserve agency: choose between viable projects, predict what a room does, compare a discovery, see a result.

Practical necessities include a real pause; save/leave feedback; scalable text; persistent/replayable captions; icon-and-text prompts; remapping; camera sensitivity and reduced motion; controller support; hold/toggle alternatives; and touch access to Orders, journal and typed chat. The current UI is keyboard-centric even though touch movement exists. The 390-pixel orders check required substantial scrolling; at the ordinary narrow app-panel width, the planet thumbnail competes with the bottom action text.

These recommendations are consistent with Microsoft's guidance on [independently adjustable difficulty, progress preservation and pausing](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/108) and [readable/configurable text](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101). Those sources support accessibility practice; they do not establish that this particular game is enjoyable or suitable for every child.

## 8. Make VESPER useful, warm and accountable

VESPER should share the player's activity, not compensate for empty activity with more chatter. Give her concrete roles: compare two observations, remember a favourite route, explain a blocked project, notice that a garden has grown, hold a reading while the player moves. Let the player choose short hints, more conversation or quiet company.

The current `brainState()` lacks the detailed inventory, selected action, blocked prerequisites and discovery evidence needed for many natural questions (`src/main.js:1809–1843`). Compute facts and eligible next actions deterministically, expose them in a help card, and let the model express those facts in character. Fix stale prompts, including the obsolete separate hopper/pad story. Useful help must remain available when live conversation is unavailable or its daily allowance has been reached.

Replace the hidden conversational grade. `src/regard.js` penalises terse/lookup-shaped talk and decays with silence; a model's interpretation can make warmth “thin” and lead to “UNDER REVIEW”. That is a poor incentive for a family game, and particularly ill suited to quiet players or struggling readers. Keep VESPER a reliable ally. Let shared actions unlock memories, without requiring eloquence or frequent reassurance from the player.

Memory should be a small, inspectable record of real game events: named rooms, first successful power loop, discoveries, favourite projects and chosen preferences. Six recent exchanges and a few milestone identifiers cannot carry the whole promised relationship. Preserve authored scientific evidence separately from live personality; current mystery lines directly voice authored companion-like speech and should be reconciled with the live-only rule.

Before presenting open-ended live dialogue as suitable for eight-year-olds, evaluate actual generated responses against a versioned family-play set and validate replies before both text and speech delivery. Test garbled input, misleading premises, attempts to change role, distress, inappropriate topics and real-world personal questions. Keep the AI identity and voice/data controls clear. Prompt instructions and markup stripping are not evidence of semantic safety. This is a concrete child-facing product dependency, not a formal age-rating or legal-compliance opinion.

Likewise, clearly separate real mission archive facts from invented anomaly logs. Source-backed astronomy and geology can support incidental learning; fictional mystery material should not masquerade as historical evidence.

## 9. The build order I recommend

| Order | Deliverable | Reason | Evidence required |
|---|---|---|---|
| 1 | Repair the first resource-to-array/industry loop; unify guidance; establish real rescue/pause behaviour | Removes impossible and misleading journeys | Fresh-save journey with real mass/power rules; shortages and rescue counterexamples |
| 2 | The complete 15–25 minute local expedition and visible home reward | Tests whether this is enjoyable before expanding it | Independent newcomer sessions; observe choices and confusion |
| 3 | Living cutaway, surface home growth, procedural feedback audio and context interaction UI | Makes work pleasurable and progress perceptible | Before/after screenshots, muted play, keyboard/touch checks, frame pacing |
| 4 | Three or four different encounter verbs and meaningful automation/layout depth | Gives repeated outings variety and adults mastery | Players voluntarily choose another expedition; viable alternative plans |
| 5 | Persistent event-based VESPER memory, reliable context help and validated family dialogue | Makes companionship earn its central role | Grounded callbacks; relay-down help; produced-output evaluations |
| 6 | One complete optional cave episode with a return route and a real discovery payoff | Proves the second USP without promising an unbuilt campaign | Gentle and intense routes both finish; instant retreat and resume work |
| Later | More planetary sites, large industry, broad campaign and carefully bounded co-op | Expands a demonstrated loop | Evidence that existing content is being exhausted, not abandoned early |

Family dialogue safeguards and accessibility basics should accompany the first child-facing slice, even though deeper companion development appears later in the table. No public release or production change is authorised by this review. Multi-file product changes would ordinarily be Tier B; confidential dialogue/data handling or shared-world authority changes may introduce Tier A consequences and require corresponding assurance.

Do not begin by adding generic quest-board chores, enemies/combat, a repair treadmill, obligatory daily tasks, more empty land, or a longer linear technology ladder. Private co-op may be valuable later, but it introduces substantial shared-state and child-interaction work; it will not fix a dull solo loop.

## 10. What would prove the new version is working

Use fresh saves with several children around eight to ten, older children, adult newcomers and experienced builders. Observe separately rather than treating one family member explaining everything as proof of usability. Include keyboard, touch, low graphics, muted speech, relay unavailable and interrupted sessions.

Record time to first independent action and visible success; where players become stuck; whether they can explain what a build changed; whether they find home without rescue; which detours they choose; and whether they elect to continue when the scheduled session ends. Ask what they wanted to do next and which moment they would tell someone about. Compare enjoyment and assistance needs by player and setting, not only average completion.

Candidate acceptance targets for the first slice: a self-authored visible change within three minutes; a understandable reason to leave home; one novel interaction away from it; a useful and visible reward upon return; an obvious safe stopping point; and an enticing next choice. These are hypotheses to tune from observation. A passing test suite proves specified behaviour; repeat voluntary play is the evidence that the design is becoming fun.
