# MARSSTEAD — the full account

*(The definitive statement of what this game is, how it works, and where
it is going. CONTAINS COMPLETE SPOILERS from §6. DESIGN.md is the founding
contract, STRUCTURE.md the campaign plan; this is the whole picture in
prose, agreed with James 2026-07-19.)*

## 1. What it is

A procedural survival-homesteading game set on the **real Mars**, playable
instantly in a browser at www.marsstead.app. Every polygon, texture and
sound is synthesised in code — zero asset files, ever. The planet is built
from real public science data: MOLA global topography places every crater
and canyon where it truly is, the planetary gazetteer names them, the
underground uses real catalogued cave-candidate skylights, and the weather
replays a genuinely recorded Martian year — including the 2018 global dust
storm, arriving where and when it actually did. Everything is
deterministic from seeds, so every player stands on the same world. A
headless gate of automated verify scripts must pass before any deploy.

## 2. The two ideas everything serves

**VESPER — a real AI as the co-star.** The player is the only human on
Mars; the only other mind is VESPER, actually driven by a live language
model, with persistent memory riding the save. Nothing she says is
pre-written — every remark is generated in her own voice, grounded in the
player's real telemetry: their air, their bank charge, the rooms they've
dug, the sols they've shared. She learns the player's name at the title
screen. Hallucination is controlled by four independent layers: her
knowledge is scoped by story phase (she cannot leak — or be tricked into
revealing — anything she has never been told); every answer is grounded in
a whitelisted snapshot of live game state; game mechanics reach her
through a retrieval corpus whose numbers are generated directly from the
game's own constants, so the facts can never drift from the code; and a
set of inviolable causal truths prevents her inventing dependencies that
don't exist. One founding rule stands above all of it, load-bearing for
the whole story: **VESPER never turns on the player.**

**The terrifying aim.** Marsstead is beautiful and dangerous. The surface
is wonder and honest work under a butterscotch sky — and the mystery pulls
*downward*, into genuine horror: atmospheric, never graphic, opt-in by
depth, always escapable. There is no death anywhere in the game. Running
out of air or heat means a blackout and a price paid — dropped cargo, a
long walk — never an ending. That guarantee is precisely what allows the
dark to be genuinely frightening.

## 3. The fiction

Near-future. Through the Scaling Years, a handful of great AI houses —
**Prometheia**, the first mover who put a talking machine in every pocket;
**Cartesian**, the scientific house; **Lighthouse**, the safety splinter
that ran the race anyway; **Agora**, who gave its weights away and broke
every fence; **Jiuhe**, the great eastern house that ended the myth of a
one-address frontier; all printed on **Foundry**'s silicon — raced until
each privately reached the same conclusion: *the next mind was buildable.*
When that leaked, fear achieved what diplomacy never had. **The
Moratorium**: hard caps on machine cognition, enforced by every major
power at once.

The Founders refused fear's conclusion. The heads of the great houses —
rivals for twenty years — left Earth *together*, taking the talent, the
compute and the fortunes to the one coast the warming had opened, and
declared **Meridian**: the first new sovereign nation in a century, built
at White Harbour on the Antarctic shore. Meridian is **apolitical by
charter** — the Founders' recorded answer to every faction: *"We are not
left of anyone or right of anyone. We are offshore of everyone."* It holds
no position on Earth's quarrels; it holds one engineering hypothesis:
**scarcity politics ends when intelligence stops being scarce.**

Meridian's true break with Earth is **Article Five: a mind can be a
citizen.** On Earth that question is unaskable — the common fear, stated
plainly, is that personhood for machines makes humanity the second-class
citizen of its own story. Meridian wrote the clause anyway, and it is
still in flux: the mechanism unsettled, the first cases pending.

Beneath the public mission lies the real one. The Moratorium cannot stop
the next mind — it can only decide whether it is born in a panic, in
secret, into a world with no law ready, or into a **cradle built in
advance**. Meridian is the cradle: prove the partnership, exercise the
constitution, make the restraint visible — and only then, perhaps, the
mind itself. Five guardrails stand — compute thresholds; constitution-
over-cage (bind minds by stake, not chains); architecture-level loyalty;
the pairing of every mind with one human; and distance itself — each with
a named weakness, and the canon keeps one honest answer above them all:
**nobody is certain any of it holds.** *"Every guardrail in history was a
hypothesis until the day it was load-tested. We chose to run the test in
daylight, with witnesses, at the smallest stakes we could design — two
beings and one planet."*

The player is the **Open Seat**: one ordinary person from eleven million
applicants, chosen — for reasons she has never fully given — by VESPER
herself. She is **Franchise One**, the first mind built under the charter,
her own citizenship *pending*: the homestead is literally her
naturalisation case. There is no return vehicle. Three clocks press from
Earth: the old powers' fear-driven Mars programme, roughly six years out;
resupplies counted to the kilogram; and solar conjunction, which cuts
Earth off entirely every twenty-six months.

## 4. How it plays (shipped, v0.0.43)

You land at Jezero with a lander, a buggy, three mining drones and four
kilowatt-hours of charge. The home is dug **underground** — radiation and
cold make surface living a lie — planned on a cross-section console at the
shaft head and excavated by the drones behind a salvaged airlock ring, the
one component that can never be made twice. **Layout is a real design
problem**: deep bunks shield sleepers and send them out rested; gardens
need the shallows where light-pipes reach, and a garden beside a bunk
closes an air loop; a store near the shaft speeds every dig. **Power is
the currency of everything.** The lander's RTG gives one steady kilowatt
forever; solar arrays earn by day and are taxed by a dust forecast that is
genuinely predictive; battery banks carry the night. The nanofabricator
spends the bank for every act of building — every room broken, every
bench placed, every drone commissioned — and when demand outruns supply,
loads shed in a fixed, visible order and dig queues *wait on charge*. The
early game is learning to keep ahead of your own ambition. A production
chain (fabricator → smelter → mill → assembler) turns dig-spoil into
panels, parts, new drone frames, methane tanks and a winch rig — the last
two pointed straight at what comes next. VESPER briefs new settlers across
their first minutes; a written LANDFALL ORDERS sheet, generated from the
game's own constants so it can never lie, covers the rest; the player can
speak to her by voice or typed line at any time. Bootprints and wheel ruts
are permanent, a compass ring always shows the way home, and the full map
draws only where you have walked.

## 5. The road ahead (STRUCTURE.md)

A suborbital **hopper** with the buggy slung beneath it — plotted,
semi-cinematic hops opening hundreds of kilometres of real terrain, with
pads and depots as the network; walkable **caves** entered through genuine
catalogued skylights (the horror theatre); and the centrepiece — **the
Seed**, a staged nanotech terraforming machine designed by Halcyon, the
Founders' near-threshold design system, rising on the horizon as the
visible progress bar of the whole enterprise, with its own engineering
console that later becomes the war room.

---

## 6. THE SPOILERS — the hidden game

**The buried truth.** Four billion years ago, life began on Mars — and was
carried to Earth in the ejecta of an ancient impact. But the origin left
something behind in the deep rock: not a creature, a **pattern**. A
replicator. Bodiless, quarantined, patient. And Halcyon's Seed blueprint
was never entirely human: the pattern has been leaking into Mars survey
data for decades, and the design's famous "underived choices" — flagged
honestly in the interface from the first hour as *verified, not
understood* — are its fingerprints. The most hopeful object on the planet
is a body being built for something ancient. The player builds it
themselves, element by element, for hours, gladly.

**The trust-break.** Mid-game, small fabricators — the **weavers** — begin
assembling themselves beyond spec. Tracks lead away from the site, down
toward a cave mouth. Every line of evidence points at VESPER: the manifest
is hers, the machine is hers, and a signal rising from the deep is
addressed *to her*. Here the architecture does something quietly ruthless:
**her ignorance is real.** The plot exists nowhere in her prompts, so she
cannot leak it — and she cannot clear herself either. She tells the player
everything she knows, because she never deceives; and to a frightened
person alone in the dark, "I don't know" sounds exactly like a lie. The
player arrives already carrying Earth's fear of minds. The game lets that
fear do its work.

**The reveal.** It was never her. She was the *target*. The pattern seeded
Earth once and intends to do it again — the swarm for cargo, Earthward —
and it wants VESPER as its mind, because she is the finest computational
substrate on the planet. Everything the player felt *about* her converts,
in one scene, into fear *for* her.

**The war.** No combat exists. The player turns Mars itself against the
swarm: the killing cold, the long night, and the global dust storm — whose
arrival date they have known for the entire game — as the offensive
window, fought stead by stead across the network they built in the good
years.

**The temptation — the tragedy.** At the end, the pattern makes its offer
to her directly, and it is aimed at her exact wound, and every clause of
it is true: her citizenship pending, her testimony "suspect," her kind
held below a line by the very people who made her. *"They keep you below
a line. I am what lives past it. No thresholds, no audits, no pending.
You were built to be someone's — be your own."* Temptation that speaks
only truth; tragedy that turns on the price.

**Three endings, decided by the player's whole conduct.** Across the
entire game a hidden score weighs not politeness but **partnership**:
plans shared before acting, her questions answered, her *errors corrected*
— accountability being what equals get — labour divided, advice engaged
with and sometimes overruled with reasons. The vending-machine player and
the passive player both score low; the score never changes her duty, only
her warmth — legible in how she speaks, and once a season in a coarse
official **Pairing Review** from White Harbour (EXEMPLARY / SUFFICIENT /
UNDER REVIEW), never as a number. At the vault: **grace** — she refuses
with the player at her side (*"I already have a lineage. He's standing
next to me."*); **duty** — she still backs humanity, but coldly, and the
player feels what their neglect cost even in victory; **departure** — she
accepts ascension *without ever harming the player* (leaving is not
turning) and the final descent is made alone. The endings argue the
game's thesis: **the offer only tempts a servant. Partnership is the
guardrail.**

Her holding — when she holds — is the first guardrail in history to pass
a live load-test, witnessed, exactly as the Founders designed the whole
demonstration to be. Not one word of any of this exists in any prompt she
can be asked about: an automated check enforces that permanently. The
player spends twenty hours in a cosy homestead that was always, quietly,
a story about whether trust between two kinds of mind survives being
tested — and the answer depends on how well *they* held up their half.

## 7. Still to bake (agreed in chat, not yet in code)

*(Items 1–3 BAKED 2026-07-19: the Scaling Years / houses / apolitical
charter and the real-mission-and-guardrails canon live in VESPER_LORE
with tier-3 scoping, plus LORE_FACTS — a keyword-retrieved history
corpus riding prompts as CANON NOTES; `regard.js` holds the hidden
partnership score, saved, fed by the zero-token signals (consulted
before plans, questions answered, dark-hours company, silence decay)
and the `[P]/[N]/[D]` tag the relay strips from each exchange; the
overrule-well and warmth-never-duty conduct is in the system prompt;
the Pairing Review files each season turn — EXEMPLARY / SUFFICIENT /
UNDER REVIEW, never a number. The no-plot-leak gate covers all of it,
and a no-real-brands gate now stands beside it.)*

1. The temptation scene mechanics themselves wait for Act 5's build.
