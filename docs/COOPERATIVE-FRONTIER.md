# Marsstead: a inhabited, cooperative frontier

Design direction, 5 September 2026. This supersedes the solitary/one-home and mandatory Seed campaign direction in DESIGN.md, OVERVIEW.md and STRUCTURE.md. It is a target design, not a claim of implemented multiplayer. Existing saves and story flags remain intact until a tested migration exists.

## The promise

**Later approved correction:** [SETTLEMENT-NETWORK.md](SETTLEMENT-NETWORK.md)
governs multiplayer and time. Geographically separated settlements cooperate
asynchronously and sleep independently. Physical visits temporarily share time.
The continuous-presence and early-neighbour encounter proposals below are
superseded where they conflict with that direction.

Land apart. Make a home with VESPER. Venture farther. Find other people. Build places that help each other reach the dark.

Multiplayer means a persistent cooperative world; physical layers mean surface, inhabited subsurface rooms, natural caves and deeper machine works. These are distinct concepts with connected gameplay. Whole-Mars geography stays; distribute new settlers into a few reachable frontier regions rather than uniformly across the planet. Empty planetary scale must not make encounters practically impossible.

## First-session momentum

Target pacing to playtest, not an asserted balance result:

- First 2 minutes: land, discover VESPER's damaged body, restore its mobility.
- By 5 minutes: power and seal a small refuge; see a clear change in warmth and light.
- By 10 minutes: choose a nearby lead (useful salvage, a seed cache or a radio anomaly); a short buggy trip pays for a visible upgrade.
- By 20 minutes: erect the first expedition shelter at a valuable location, charge VESPER and reveal the next route. Another settler's signal may appear, but this beat works alone.
- By 30 minutes: return with something recognisable for home, or use the new shelter to reach a cave entrance. End at a safe stopping point with one attractive next lead.

Every 3–5 minutes should deliver a discovery, changed place, useful choice or payoff. Travel needs terrain decisions, short salvage opportunities and clear destinations; shorten dead travel rather than flood it with compulsory chores. Survival supports adventures; it must not consume most of the session in repetitive gauge maintenance. Avoid daily streaks and time-limited attendance rewards.

## VESPER: companion, equipment and responsibility

One persistent embodied companion per player. Hovering shell with folding legs, camera aperture and posture; clings to the buggy, holds lamps, scouts, carries small tools, curls into a home charging cradle. Different players' companions have distinct markings and their own private memories. Each player talks to their own VESPER; companions do not duplicate or expose private conversations to visitors.

Battery, temperature and condition are understandable needs. Failure produces recoverable hibernation, not permanent loss or deletion of the character. Care stops while the player is offline. No emotional guilt for absence. The live language model expresses personality and responds to observed events; deterministic game code owns abilities, resources, danger signals and quest completion. A disconnected speech service never disables essential help.

## Bases earn their place

A base is a location-specific collection of completed room cells, power/storage, local machines and access permissions. Keep burrow.cells as the authority within each base; do not keep several views of a single mutable global burrow.

| Site | Immediate advantage | Longer-term reason to return |
| --- | --- | --- |
| Expedition shelter | Warmth, air, VESPER charging, protected recovery point | Staging point for a previously impractical route |
| Ice outpost | Local water and fuel ingredients | Refuelling network, greenhouse support |
| Ridge relay | Finds leads and optional nearby-settler signals | Better regional survey and drone logistics |
| Mineral workshop | Process bulky ore at source | Ship useful parts instead of hauling raw loads |
| Cave-mouth refuge | Service lights, ropes and tools near the descent | Access to deeper excursions and recovered machinery |
| Community greenhouse | Food/seed variety and a welcoming meeting place | Exchange seeds, grow expedition supplies, personalise a shared home |

A bed alone is not free interplanetary teleportation. Recovery uses a suitable registered refuge; normal transport retains physical routes and fuel. Forward bases reduce real travel and payload costs. Retained independent starter supplies and an emergency recovery path prevent fuel traps. Outposts should be inexpensive to make safe, optional to specialise, and never decay while owners are absent. Initial personal active-base cap is a measured performance/balance parameter, not a progression paywall.

## Meeting and cooperating

Private invite worlds are the default family path. Shared-frontier worlds are a separate opt-in. Spawn reservations give each player a viable starter resource envelope and protected building clearance. Target early neighbours a few minutes away by buggy, tuned from measured route time and terrain, not arbitrary real-Mars kilometres. Friends can choose neighbouring landing regions; never spawn inside another player's build.

Presence should first be visible in the world: a distant light, tracks, an approaching flyer, a relay signal. Exact remote locations are not globally broadcast to every player. Offer legible actions: wave, point, request help, offer supplies, invite on an expedition. No open voice or free-text chat by default for children. Interaction permissions and visibility are explicit.

Cooperation improves convenience and possibilities without requiring a party: haul together, contribute agreed materials to a project, split a survey, recover a disabled machine, stage a cave expedition. VESPER or a slower solo method substitutes for a second pair of hands. Essential resources are renewable or personally allocated, avoiding a race that leaves late joiners stranded. Optional shared deposits have authoritative reservations and conservation.

Roles: owner; invited builder; visitor. Visitors can use designated refuge services, not empty stores or move objects. Contributions go to explicit projects; building rights apply to bounded approved plots. Other players cannot demolish, block airlocks, turn off essential life support, steal VESPER or impose horror on you. No player-body blocking or PvP. A host can revoke access. A helper disconnecting never leaves another player physically trapped or consumes a payment twice.

## Revised story: the network below

Keep Halcyon as the name behind old autonomous survey/manufacturing machinery, and keep the eerie weaver swarm. Make their failed coordination system a comprehensible mystery: machines continue a task whose meaning has been lost. Some guide you; some dismantle abandoned equipment to finish structures nobody ordered; lights turn on in sealed chambers. The rogue intelligence is separate from VESPER. Its motives can become more complex through optional evidence.

Retire the compulsory constitutional exposition, chosen-only-settler premise and fixed twenty-hour Seed betrayal spine. Meridian can remain a small background emblem and optional archive. Panspermia becomes an optional scientific question, not a compulsory declared answer. Existing completed discoveries remain records and rewards; new campaign progression does not invalidate old effort.

Use regional, repeatable episodes: investigate a missing work team; repair a signal; identify an unauthorised construction; recover a module; reroute a machine network. Restoring an area opens a workshop, route, crop or companion ability. Players at different story stages can cooperate: public machinery uses shared episode state, personal discovery flags control exposition/rewards, spoilers require opting into the deeper expedition.

Soft horror is environmental uncertainty and strange machine intention, never graphic violence. Accessible exits, selectable intensity, no mandatory jump scares. A party uses the lowest requested presentation intensity. Do not simulate different physical hazards on different clients; only lighting/sound/cues vary. Deep events never raid or destroy player homes while they are absent.

## Visual direction: inhabited frontier, uncanny machine depths

Unify scale, silhouettes, material response and illumination before adding more small objects. Preserve procedural-only/browser-first constraints.

- Surface: strong geological silhouettes and distinct regional palettes; dust accumulates in recesses rather than coating everything in uniform brown. Machines have recognisable mass, joints and tools; terrain/contact shadows anchor them.
- Home: warm indirect-looking light, rounded edges where bodies touch, layered textiles, imperfect arrangements and persistent personal finds. Keep ceilings quieter; coarse high-contrast noise currently competes with focal objects. Warm does not mean uniformly yellow.
- Greenhouse: varied plant architecture, irregular spacing and growth stages; organic stems and leaf curvature, restrained highlights. A larger room alone does not cure repeated synthetic-looking leaves. Include low crops, overhead vines and one memorable tall plant. Readable gardening interactions take priority over clutter.
- Underground: geological spaces have fractured, stratified shapes and occluded sightlines; machine-altered spaces introduce unnervingly repeated structures. Contrast makes the artificial influence meaningful. Broken rock must meet the cave wall convincingly rather than look like floating lumps.
- VESPER: expressive whole-body animation, low-intensity practical light, folding/perching/carrying transitions. Its familiar silhouette is identifiable in darkness. Worker robots share a manufacturing language but have visibly different jobs.
- Sound: purposeful local wind, fabric, motors, drills, distant taps and refuge ambience. The teaser remains silent. Do not reintroduce a continuous score without a new request.

## Architecture and delivery boundaries

Marsstead currently has one local IndexedDB save, a fixed crown position and one active burrow/power model. Its VESPER relay is not a multiplayer game authority. Client warden flags are explicitly a single-player cheat and cannot grant shared-world powers.

Separate player state (identity, companion, personal inventory, discovery) from world/base state (IDs, locations, cells, queues, deposits, permissions). Base-local coordinates plus stable base IDs distinguish equal room keys in different homes. Load nearby detailed bases, retain bounded lightweight distant markers, and scope presence to region plus interior instance. Snapshot migration must preserve a byte-for-byte backup and deterministically wrap the existing home as the first base.

Shared commands require server authority for membership, position-sensitive interaction, costs, permissions and ownership; idempotent action IDs and persisted outcomes for reconnect/retry. Preview locally but never credit shared resources until acknowledged. Offline solo progress does not upload as an authoritative shared inventory or overwrite a shared base. Shared clocks and personal sleep must not let one player advance time for everyone.

Build in playable slices:

1. Multi-base local foundation and first forward shelter: preserve existing home/save, travel, establish, refuel/rest, return and reload. Integrate embodied VESPER care and one physical assistance action.
2. Two-settlement private-network slice: separate calendars, requests and one physical cargo delivery, including an offline recipient and idempotent custody transfer. Establish authority before enabling shared writes. Add arranged visits after asynchronous cooperation works; see SETTLEMENT-NETWORK.md.
3. First regional expedition: home -> outpost -> cave task -> tangible home/companion upgrade. Works solo or together; depth and story flags remain coherent.
4. Art pass across that complete route, then broader geography/logistics/public frontier. Do not polish another trailer before this route is fun to play.

Authority and save migration are critical-consequence work: focused counterexamples, independent review and isolated multi-client probes precede any live release. Art and balancing stay lightweight. No production migration, deployment or public-world launch is authorised by this design document.

## Moorstead implementation reference

Read-only audit of the sibling client and deployed EVO world service (5 September 2026):

- `C:/Users/James/Desktop/Moorcraft/src/main.js:3135`: shared deterministic terrain, room-scoped state; `:3151` identity-stable village starts. Reuse stable candidates, but add authoritative reservation and separation: hashing alone can collide.
- `C:/Users/James/Desktop/Moorcraft/src/multiplayer.js:397`: approximately 5 Hz presence with eased remote positions; `:60` and `:189` provide reconnect/stale diagnostics. Reuse the presentation and diagnostics patterns, scoped to nearby regions/interiors.
- `C:/Users/James/Desktop/Moorcraft/src/main.js:2777` and `:2861`: gifting and offers are useful interaction precedents, but local deductions/late payment cannot guarantee shared-resource conservation.
- Deployed `/home/james/moorstead/worldsvc/server.py` broadcasts room presence, filters speech to 60 m and caps rooms at 15 players. These are small-room mechanisms, not proven planetary-scale interest management.
- The inspected relay accepts client-authored save/deed state and lacks atomic inventory/build transactions. Marsstead must not import that trust boundary or assume all Moorstead rooms require authentication.

Use shared persistent base entities with independent settlement calendars, as specified in SETTLEMENT-NETWORK.md. Start with two clients and acknowledged, revisioned transactions. Sleep consensus applies only to a temporary physically co-present visit, never independent settlement play. No sibling code or deployed service was modified.
