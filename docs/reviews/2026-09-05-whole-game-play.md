# Whole-game baseline audit — 5 September 2026

## Finding

The creative shortfall is whole-game, not limited to the last day's additions. The surface, avatar, vehicle, navigation and activity presentation need as much redesign as the habitat and cave. Working simulation is worth preserving; its present visual forms and interaction presentation are not a quality baseline to preserve automatically.

This is an adult expert evaluation, **not a child playtest or a completed campaign run**. Claims about eight-year-olds are design risks to test, not observed child behaviour.

## Evidence and coverage

- Browser: isolated headless Edge, actual local Three.js renderer, 1440×900, localhost:5207, current default graphics. No screenshot captions, hidden HUD or cinematic camera was added to ordinary captures.
- Fresh disposable browser storage; actual LAND button, W walking, E enter/exit rover, W acceleration, C cockpit toggle, M map, E planner, click shaft plan, sensor dial clicks, Enter chat field.
- Checkpoint actor relocation was used between home, rover and survey station. This did not award progress. Thus travel time and route discovery were not tested end to end.
- Expanded home/yard: developer attract-state fixture grants construction, then normal habitat renderer/input. Cave: direct session entry, actual W walking, then depth checkpoint at z=70. These are explicitly staged advanced states, not earned gameplay.
- Works panel was opened through its runtime API; actual manufacturing throughput was not tested. The shaft was planned through the UI and its immediate power/worker response observed; full excavation was not timed.
- VESPER remote calls were blocked in the disposable context; inspected chat/instrument presentation only. No claim about current live response quality or latency.
- No runtime exceptions in first capture pass. No performance benchmark, mobile pass, complete flight journey, heritage chain, or multiplayer session in this bounded audit.
- Reproduction scripts and raw visible text/state: `media/redesign/audit.mjs`, `audit-extra.mjs`, `baseline/observations.json`, `observations-extra.json`. These are disposable local evidence, not maintained verification commands.
- Captures 08/19 retain attract camera/visibility state and must **not** be used as evidence of normal settlement camera behaviour. 10 is a corridor, despite its initial filename; 20/21 are the actual garden. Teleported survey captures retain the pre-panel frozen background; judge the panel, not location composition.

## Highest-priority rebuilds

### 1. Opening promises a planet but initially presents anonymous ground

Observed: [01 first use](../../media/redesign/baseline/01-first-use.png) starts with a steep downward view, no horizon, generic rocks and an instruction card pointing to an offscreen home. [02 walk](../../media/redesign/baseline/02-normal-walk.png) restores a horizon but offers little visual reason to choose a direction. The objective is supplied by an arrow and paragraph instead of a recognisable place.

Reproduce: fresh session → LAND → wait for readiness; walk forward. Owner: main camera/landing staging, terrain composition, onboarding.

Rebuild: landing should frame three scales immediately: VESPER/ship beside you, a distinctive reachable landmark, and an extraordinary distant formation. Give the first action a physical subject and emotional purpose. Retain optional concise objective assistance; don't require a child to interpret the world map to move 16 metres.

### 2. Landscape detail is evenly distributed rather than composed

Observed: [05 driving](../../media/redesign/baseline/05-drive.png) shows coherent atmosphere and distant depth, but near/middle ground share a brown value range and scattered similarly shaped rock blobs. Surface detail does not communicate routes, shelter, ice, unstable ground or a destination. This finding applies to the sampled landing region; other planetary regions were not visited.

Rebuild: authored procedural rules for landform families—layered scarps, eroded gullies, talus fans, exposed slabs, sand pockets—with open paths and concentrated detail. A meaningful landmark every short leg is more useful than more scatter. Regional colour/material variation should follow geology rather than arbitrary biomes. Keep the existing broad Mars coordinates, sky and distant-scale foundations pending separate quality/performance checks.

### 3. The player and buggy still read as construction primitives

Observed: [02](../../media/redesign/baseline/02-normal-walk.png) has cylindrical limbs, spherical shoulder caps, a rectangular backpack and rectangular footprint stamps. Normal W movement responds; this brief pass does **not** establish gait quality over slopes/turns. [06 cockpit](../../media/redesign/baseline/06-drive-first-person.png) is dominated by large wheel forms and a rod/block instrument rather than a designed cockpit. Third-person driving does produce readable dust and tracks and reached 27 km/h with a short W hold.

Rebuild: a complete astronaut silhouette and suit articulation, boots with credible contact prints, and a purposeful rover with coherent chassis/suspension/cargo/cockpit geometry. Preserve reusable gait/physics maths only if new body proportions still pass contact checks. Judge walking in motion at ordinary camera distance; a high-quality still cannot certify it. Design the cockpit around view, speed, heading and VESPER's perch.

### 4. Activities disappear into unrelated panels

Observed: [07 Works](../../media/redesign/baseline/07-production.png) is a nearly empty black fullscreen sheet with four small recipe lists, very small text, and the subtitle “Stage 2 of the demonstration”. [04 Burrow](../../media/redesign/baseline/04-build-diagram.png) is much clearer, but opening it removes the machines and terrain. [16 survey](../../media/redesign/baseline/16-survey-puzzle.png) is another standalone overlay with three similar dials.

Rebuild: retain the diagram as the intentional planning mode. Move immediate repairs, loading, harvesting and companion care into world actions with visible before/after consequences. Works should answer “what can I make, what do I need, where does it go?” with a selected machine and large usable controls, rather than displaying the whole supply chain first. Retain advanced overview as optional. Remove obsolete demonstration labels from future production UI.

### 5. The first reward is legible, but the journey lacks a dramatic change

Observed: planning the shaft instantly changes the objective to “Follow the glint”; [15](../../media/redesign/baseline/15-shaft-workers.png) also displays a power-short instrument message. This creates a potentially useful reason for the expedition, but the visible world still looks essentially unchanged. The survey dials visibly improve and solve after six directional clicks; the targets are exposed by gold marks. This is accessible cause/effect but thin as the centrepiece of an expedition.

Code evidence: `fieldwork.js:firstLightGoal` progresses plan → sensor reward → solar array → ring → bunk → workings → open suggestion; underground reward is a fixed sequential three-instrument route (`underworld.js`). This review did not earn the whole sequence.

Rebuild: make first recovery require reading the world or cooperating with VESPER—move a reflector, hold a hatch, route power—then carry a recognisable recovered object home and watch it make a real change. Preserve immediate rewards and assistance. Adults can optimise route/resources; children should not need to solve accounting before their first success.

### 6. VESPER is text attached to systems, not a relationship visible in play

Observed: [18 chat](../../media/redesign/baseline/18-vesper-offline.png) opens a narrow field at the bottom over existing prompts; the power warning appears as a subtitle. No embodied companion is present in this baseline. With remote calls blocked, this is evidence of presentation only, not dialogue competence.

Rebuild: one distinct physical companion, clear attention/posture, a visible useful act in the first minute, and recoverable needs. Its care must produce small satisfying interactions, not another meter to babysit. Keep the dependable instrument layer and truthful state grounding. Do not substitute scripted personality for the live character. Children need a safe fallback when the network is unavailable.

### 7. Home is mechanically useful but visually harsh and interaction-poor

Observed: [09 home](../../media/redesign/baseline/09-home-fixture.png) has bright nearly featureless cream walls, shiny trim and very noisy ceiling detail; the light reads institutional. [20 garden](../../media/redesign/baseline/20-garden-fixture.png), [21 aisle](../../media/redesign/baseline/21-garden-aisle.png) show oversized pale leaves, repeated bare pole stems and strong flat illumination. Thin geometry alone has not achieved botanical credibility. The generic “Use room” affordance does not promise a specific satisfying action.

Code evidence: `habitat-session.js` garden use is an information response; this is not a harvesting/growing simulation. Warmth, air, sleeping and walked layout are genuine systems and should be retained.

Rebuild: room proportions, recessed services, indirect light, material roughness hierarchy and a few personal focal objects as one composition. Plants need branching structure, credible scale/density, growth variation and restrained leaf lighting. Give a garden interaction a real visual consequence and small reward before multiplying species further.

### 8. Cave atmosphere works locally; the activity structure remains a corridor

Observed: [11 entry](../../media/redesign/baseline/11-cave-entry-fixture.png) and [13 deeper fixture](../../media/redesign/baseline/13-cave-depth-fixture.png) have strong light/dark contrast and an interrupted view. The closer wall still reads as noisy material on a rounded boundary. The character/backpack occupies the lit centre. Objective panel tells the player exactly which lamp to choose and to remain still; this reduces uncertainty to following instructions.

Code evidence: 150-metre authored centreline and three ordered objectives; no branching expedition decision in this model. This is a capability limit, not a bug.

Rebuild: a navigable network with occasional spatial choices, recoverable equipment problems and a calm refuge between tense stretches. Distinguish natural cave mass from impossibly precise rogue-machine structures. Darkness should hide a discovery, not simply hide unfinished geometry. Preserve opt-in fear, reliable retreat and non-graphic content.

## Keep / rebuild / remove decision

| Keep as a foundation | Rebuild presentation and experience | Remove or defer |
|---|---|---|
| Real-Mars location model, streaming and broad day/night physics | Near/midground geology and exploration landmarks | Treating whole-planet scale alone as entertainment |
| Responsive movement, buggy physics subject to retest | Astronaut, camera, tracks, rover/cockpit art | Calling gait “fixed” from static evidence |
| Diagram → exact walked home, shelter/sleep | Architecture, lighting, personalisation, room actions | More passive decor without meaningful use |
| Power/resource accounting and funded workers | Physical production feedback and task-oriented controls | Mandatory reading of a full production chain on first use |
| Small reward-led first expedition | VESPER-led physical problem and return payoff | Repeated rotate-three-dials/hold-still templates |
| Trustworthy VESPER plus deterministic instrument channel | Embodied companionship and gentle care | Mandatory betrayal narrative or guilt/punishment for absence |
| Optional soft horror and safe return | Branching, purposeful expeditions and machine mysteries | A fixed scan corridor as the whole underground campaign |

## Proposed 15-minute quality test (target, not implemented)

1. Minute 0–2: land with a memorable view, locate disabled VESPER nearby, physically help it. Movement and assistance taught through this act.
2. Minute 2–5: restore a small warm refuge; VESPER visibly helps. Player owns a recognisable home before a long resource chain.
3. Minute 5–9: drive to a landmark seen from camp, with one route choice and something worth stopping for. Reward clear before departure.
4. Minute 9–12: recover equipment through a short physical task; VESPER is useful, and needs help once. A second player can participate without being required.
5. Minute 12–15: establish a useful forward shelter or return with the equipment; a visible home upgrade and a distant new lead create momentum.

Acceptance must include ordinary uninterrupted play, not developer teleporting: player can identify the next action without repeated explanation; travel contains a decision/discovery; first useful success arrives early; no required activity consists only of waiting for a timer; at least one action depends on and helps VESPER; reward visibly changes the world. These are hypotheses for observed adult/child tests, not completion claims.
