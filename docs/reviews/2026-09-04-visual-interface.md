# Visual world, interface and first-use review — 4 September 2026

Scope: source-based review of the visual layers, controls, HUD, onboarding and console interfaces. Browser observation is being conducted separately by the lead reviewer. Statements below distinguish implemented facts from design recommendations; no user study has been performed. This review changes no runtime code.

## Finding

Marsstead already has substantial visual craft. The missing ingredient is not primarily another shader. It is a frequent, readable relationship between what the player sees, what they can do, and how the world changes because they did it. The early game communicates an engineering manual, while much of the visible surface is decorative geology and much of the player's home is hidden in a console. This can produce beautiful screenshots and weak moment-to-moment motivation simultaneously.

The strongest existing ingredients to retain are the blue dusk, physical low-g movement, recognisable machine silhouettes, tracks and dusty boots, the crown's warm light, and a living companion. All recommendations below can remain procedural and zero binary assets.

## Evidence and priorities

### 1. Replace the initial reading test with a playable first success

`src/orders.js:43–96` opens with Meridian, White Harbour, a franchise demonstration, underground doctrine, kilowatt-hours, refining and key bindings. The body is 13.5px with smaller and lower-opacity subheads (`:14–24`). It is shown four seconds after a new landing; additional briefings fire at 8, 32, 58 and 88 seconds whether the player has completed an action (`src/main.js:2847–2862`). Movement is disabled while orders are open, but the simulation still advances (`src/main.js:1904–1925`, `:2032–2038`).

An eight-year-old's difficulty here is not lack of intelligence: it is having to retain names, economy, navigation and controls before having any concrete reference for them. Adult newcomers bear the same cost. Keep Orders as a reference, but teach through one small objective at a time, triggered by completed actions. Put the player in control immediately, ask for a short low-g jump, lead them to the visible crown, then let them commission a meaningful first piece and see the drone do it. Explain the next resource only when they need it. VESPER should enrich that experience; deterministic task cards must work if the relay fails.

The written instructions also disagree. The current Burrow loop is in `orders.js:75–86`, whereas the lander board still lists the older surface-building goals “seal a volume,” “pressurise the first hab” and “raise a hab that beats the lander” (`src/main.js:941–947`). A novice following the board may work on the wrong progression. A single progression state should drive the board, current task, contextual hints and VESPER's facts.

Proposed first-use target to test, not an established optimum: a visible self-authored change within 2–3 minutes; a satisfying first resource-to-power loop within 10–15 minutes. Preserve the larger first-room achievement, but do not make the player wait for it before experiencing success.

### 2. Make the growing home visible and personal

The current contract explicitly says the player never walks the hab (`docs/STRUCTURE.md:24–33`). The surface crown already has good environmental storytelling: worked apron, beacon, drones, heap, light pipes (`src/crownlayer.js:1–8`, `:28–69`, `:171–207`). However, visible home growth is largely expressed by a heap capped at scale 2.2 and light strength capped after six dug cells (`:196–207`). Three drones are constructed in the visual layer (`:157–173`), so adding actual working capacity is not naturally a one-to-one visible enlargement of the settlement.

Retain the console-only doctrine for this iteration, but let each class of achievement visibly dress the surface and the cutaway: a garden brings green behind a light-pipe window; a store adds labelled crates and delivery movement; more drones add distinct active berths; a deep bunk adds a warm little domestic scene; a power milestone illuminates a route home. Add inexpensive procedural personal choices—suit accent, base stripe, room palette, banner glyph, specimen display—so two competent players do not produce visually interchangeable homes.

If walkable cosy interiors are later desired, that is a deliberate change to the current product doctrine, not a missing implementation detail. A close-up living cutaway with animated chores can provide attachment sooner and at lower scope.

### 3. Give the landscape recognisable things to do

Terrain already contains multiscale shading, frost, slope-dependent colour and distance fading (`src/terrain.js:90–177`). Rocks are clustered by geology, with four size classes (`src/rocks.js:19–37`, `:71–126`); the layer chooses from six displaced icosahedra and a narrow brown palette (`src/rocklayer.js:16`, `:32–49`, `:74–91`). This is good ground texture but limited interaction variety. More copies will add clutter before they add curiosity.

Build a small library of deterministic geological encounter compositions: a split basalt ridge, an exposed bright seam, a shallow frost hollow, an eroded arch-like formation where plausible, a patterned sediment face, a rover-sized bowl, a sheltered overlook. Use three scales together: a distant silhouette that invites approach, a mid-range route choice, and an arm's-reach interaction. Each should support a distinct verb or decision: bounce, balance, scan, compare, collect a specimen, mark a trail, or choose a safe crossing. Keep wide untouched vistas between encounter clusters; emptiness is valuable when it frames something.

For a first region, prototype a short discovery circuit near home, with several points reachable by sight. Tune travel-time gaps using observed player attention rather than evenly sprinkling markers. Do not put Earth-like wildlife or fabricated ancient ruins on real-Mars geography merely to fill the screen.

### 4. Add a procedural soundscape and tangible action feedback

The audio implementation found in this source tree is VESPER's speech (`src/vespervoice.js:41`, `:110–138`). There is no separate movement, machine or environmental sound system in the reviewed imports and source search. A wind-filled, low-g industrial world needs more audible response than dialogue.

Use synthesised sound tied to verified action events: boot contact through the suit, a low-g landing thump, the buggy's motor and suspension, drill vibration, an airlock seal, a furnace ramp, a distinct “work ready” cue, and a changing home hum. Thin external air and body/suit-conducted sounds can provide a coherent Martian language without sacrificing feedback. Give important information both a visible and audible form; offer separate speech/effects controls and captions for meaningful non-speech cues.

Construction should progress in view—ghost, material arriving, assembly movement, complete silhouette, operating light—rather than relying principally on percentage text. Existing tracks (`src/tracklayer.js:1–14`), dusty boots (`src/colonist.js`, `setDust` and `pose`) and differentiated machine silhouettes (`src/machinelayer.js:1–7`) are good precedents.

### 5. Treat accessibility and family usability as core controls

The current HUD uses 10–15px text, letter spacing and translucent text over a varying scene (`src/hud.js:8–40`). Air and warmth are five-pixel bars with no HUD numeric percentage or time estimate (`:14–17`, `:105–109`). VESPER's default subtitle hold is seven seconds and is not adjusted for reading pace (`:155–166`). The local map distinguishes several locations mainly by coloured dots (`src/minimap.js:83–119`). Building accepts or refuses primarily through a red/green ghost (`src/steadlayer.js:175–185`).

Provide scalable interface text, a solid/high-contrast panel option, persistent/replayable subtitles, labelled shapes for navigation, and placement refusal text attached to the ghost. Show “AIR 72%” with an optional estimated return margin rather than expecting a thin bar to communicate risk. Keep advanced telemetry expandable. Preserve serif headings if desired, but use a more readable body style for instructions and repeated decisions.

There is no general pause/options route in the reviewed key handler and frame dispatch (`src/main.js:849–889`, `:1896–1930`). Escape handles only chat cancellation (`:599–603`). The kiosk traps browser back and rearms fullscreen whenever it is exited (`src/kiosk.js:20–55`), while page zoom is disabled in `index.html:5`. Children and adults need a dependable pause, clear save status, leave-game control and a voluntary fullscreen toggle. Pausing matters especially when a child is called away or an adult needs to read a console.

The Burrow uses a fixed 218px side column without a narrow-screen layout (`src/burrowconsole.js:31–38`); its cards are click-handled `div`s (`:202–210`, `:229–233`) and sockets are SVG click targets. Do not infer full keyboard accessibility from the fact that walking uses keys. Make cards/buttons focusable and labelled, support keyboard/controller socket navigation, preserve focus on close, and redesign the console for tablet and phone rather than only scaling down the SVG.

Touch has large primary buttons and an analogue buggy stick, both useful existing foundations. But `controlsFor` and `MORE_ITEMS` (`src/touch.js:89–153`) contain no route to reopen Orders, open the journal, or open typed VESPER chat. The startup orders explicitly recommend Enter to ask VESPER. Add those touch actions and use context-specific labels such as “Drive buggy” or “Open Burrow” instead of the generic “DO”.

Provide remapping, controller support, hold/toggle choices, camera sensitivity/inversion and reduced camera motion/glare. No gamepad or reduced-motion implementation was found. Test those features as actual entry journeys, not settings labels.

### 6. Preserve the signature on lower-end devices

`src/gfx.js:51–53` defaults touch devices to Plain; Plain disables the detailed terrain amplitudes (`src/terrain.js:166–169`) and bypasses the Fine rendering stack. This makes the family audience especially likely to see the visually reduced version. Good performance is necessary, but shape, composition, colours, readable silhouettes and lighting transitions should remain attractive in Plain. Review screenshots and playability on the lowest supported tier, not only a powerful desktop.

## Design direction

Use the same world for different kinds of delight. A younger player can build a bright home, master jumps, name a favourite drone and discover specimens with generous guidance. An adult can optimise the power network, plan expeditions and investigate the mystery. Guidance, survival pressure and fear intensity should be separate options: age is not a reliable proxy for skill or taste.

“No gore” and “no death” do not by themselves make frightening content comfortable for every child. Surface wonder should be a complete worthwhile experience. Provide an explicit, reversible fear setting before descent, predictable escape, and no punishment for backing out. Preserve wonder and the same story facts in a gentler presentation. This is a product recommendation, not a claim of a formal age rating.

The first implementation should be a polished small circuit: learn one move, direct one drone, make one useful thing, notice one nearby mystery, return to a visibly warmer home. Evaluate whether players voluntarily repeat or extend that loop before adding more regions, machines or rendering effects.

## Proof that would change the verdict

Run fresh-save sessions with several eight-to-ten-year-olds and adult newcomers, with the observer withholding explanations. Record where each player looks, which control they expect, first self-authored change, first voluntary detour, first successful return home, and whether they choose to continue after 15 minutes. These are proposed usability measures; no such observations have yet been collected here. Include touch, keyboard-only and Plain graphics sessions, subtitles with speech muted, relay unavailable, and someone opening help mid-expedition. Test fun by observed curiosity, decisions and return intention, not by counting implemented systems or passing rendering tests.
