# Companion, discovery and family-play review — 4 September 2026

Scope: source and design review of VESPER, mystery/discovery, heritage, journal, mission orders and the Burrow. No live model was queried, no external service was changed. This is an evidence-backed design assessment, not a claim to have tested children's responses. The source is the authority for implemented behaviour; DESIGN, OVERVIEW and STRUCTURE also contain future plans and obsolete descriptions.

## Judgment

The game has a strong emotional premise and useful mechanical foundations. Its companion and mystery currently promise more agency, knowledge and payoff than the implementation supplies. The most valuable improvement is to make a short expedition produce an interesting action, a visible change at home and a specific shared memory. Adding more terrain, longer journeys or more live chatter alone will not achieve that.

For eight-year-olds and adults, use the same beautiful world and substantive mechanics with adjustable assistance, reading load and intensity. Do not equate no death/no gore with universal suitability. Nor should an age setting be a substitute for observing actual children play.

## What already earns its place

- The instrument/live personality split is sound. Core warnings and refusal feedback are deterministic and bypass live generation in `src/main.js:1744-1761`; the warning table is `src/vesper.js:54-116`.
- Real-place discovery has identity: five records at named locations, rising unease, a strengthening signal and local sweep (`src/marslegends.js:20-122`, `138-153`). This can become a tactile scientific treasure hunt rather than a generic quest list.
- Heritage gives long travel an intelligible destination and a tangible reward (`src/heritage.js:19-115`). Keeping a real machine's history attached to the parts it gives the player is unusually good material for family play.
- Burrow layout already contains meaningful spatial choices: shallow gardens, deep bunks, noisy workshops, stores near the shaft (`src/burrow.js:188-236`). The comfortable home can become the emotional reason to return from danger.
- Text input exists beside speech, and the model sees a bounded state whitelist. These are useful accessibility and privacy foundations, though neither establishes a complete child-facing product.

## Highest-impact problems

### 1. The mystery is currently travelling to prose, repeated five times

The implementation selects the next unfound record, waits for proximity and a reading timer, then records a discovery and plays authored lines (`src/main.js:2588-2633`). `chainActive` returns null after the five records (`src/marslegends.js:128-132`). There is no playable deep resolution in this route; OVERVIEW and STRUCTURE describe future caves and the Seed. At present the tease ends at the door.

The journal is paragraphs, with one sealed future page (`src/journal.js:70-97`). Opening it marks every acquired record read regardless of whether a player read the text (`51-57`). The record's payoff is primarily another record to chase. Five variations on arrival are insufficient to support a long campaign.

**Change:** give each expedition a different small verb: photograph the matching layer; compare two spectral bands; place three listening probes; follow a frost pulse; align an old antenna; recover a sample without contaminating its pattern. Each needs an immediate visible response and a reward that alters what can be built or explored. Failure should invite another attempt, not destroy progress. Keep the journal as optional depth with a picture, a one-line finding and a replayable narration above the full prose.

**Eight-year-old route:** an optional pulse trail, concrete silhouettes and one-step hints. **Adult route:** bearings, triangulation and interpreting the same evidence with hints withheld. Both discover the same truth. The current no-floating-marker rule can remain: use diegetic instruments and projected local survey marks.

### 2. The game silently grades the player's conversational style

`src/regard.js:19-39` awards partnership tags and penalises directive/lookup tags. Silence drifts the score down (`58-63`). It changes the companion's warmth to “thin” (`68-70`) and can yield “UNDER REVIEW” (`74-76`), delivered to the player at season change (`src/main.js:2763-2766`). A model decides whether a question is partnership-shaped or merely using VESPER as a lookup (`src/vesperbrain.js:60-75`). This is more than flavour: the game's only companion becomes less warm under a hidden linguistic evaluation.

The likely design consequence is unfairness to terse children, early readers, players with speech-recognition trouble and people who simply enjoy building quietly. That consequence needs user testing, but the score path itself is certain. A 30-exchange daily default (`src/vespermeter.js:14-18`) also makes rationed conversation an awkward basis for a relationship.

**Change:** remove negative regard and silence decay from the family experience; preferably replace the grade entirely with a shared-adventure scrapbook. Unlock callbacks through actions together, not eloquence. VESPER can learn “likes driving”, “asks for short hints”, or “named the first garden” without judging whether the player treated her correctly. Keep consistent warmth and duty. Adults can have deeper optional dialogue without relational punishment for declining it.

### 3. VESPER lacks much of the information needed to be a useful co-player

`brainState()` supplies total rooms, a few scores, grid totals, bench types, counts and the latest events (`src/main.js:1809-1843`). It does not supply the current inventory, blocked recipe, selected action, local nearby interactables, actual coordinates, current discovered record or a detailed Burrow layout. Whitelist entries for `place` and `event` exist but that reader does not populate them. It therefore cannot reliably answer several natural questions: “what do I do here?”, “why won't this work?”, “which room should I move?”, “what does this sample mean?”

There is also an actual contradiction: the landfall addendum still describes building a separate hopper/pad and imperfect open-ground landings (`src/vesperbrain.js:120`), while current ship facts describe the merged flight-ready lander and exact landings (`src/gamefacts.js:60-68`). Keyword retrieval may add the right fact, but the contradictory instruction remains in the prompt. Claims of hallucination-proofing exceed this evidence.

**Change:** compute suggested next actions and their prerequisites in pure game logic. Give VESPER a structured explanation of those facts; let her phrase it, not infer hidden inventory or dependencies. Surface the same explanation in a help card so asking for help still works when the relay is unavailable. Author one canon for active mechanics and derive prompt facts from it. Include current discovery evidence, not future spoilers.

### 4. The claimed persistent relationship is much thinner than the fiction

The save keeps six recent turns (`src/main.js:820`) and the prompt uses the latest eight milestone identifiers (`1816`). That can remember a recent exchange but cannot sustain a rich shared life by itself. Ambient barks also enter this short conversation history (`1788-1789`), displacing player exchanges. A missed live bark is generally silence (`1793-1798`).

**Change:** add a small explicit memory structure: named places, completed expeditions, player-selected favourites, the first successful garden, a memorable rescue and promises the game can actually fulfil. Store provenance for each memory as a game event, allow correction/deletion, and expose it as a shared log. Let the model choose a relevant callback from real events. Do not save unbounded conversations or infer sensitive real-world facts. The companion becomes interesting by participating in systems: holding a probe reading while you move, spotting a changed landmark, comparing yesterday's garden to today's.

### 5. “Kid-safe” is currently a prompt instruction, not an established output property

`src/vesperbrain.js:41-46` instructs no profanity, threats, romance, etc. The relay takes a completion, strips its pairing tag, clamps it and returns it (`server/vesper-relay.mjs:208-226`). `clampLine` strips reasoning/markup and limits length (`src/vesperbrain.js:453-464`); it does not validate meaning. The tests check that safety language exists in the prompt and exercise sanitation/mood/format functions (`scripts/verify-vesperbrain.mjs:22-46`), not whether produced replies consistently obey it. Player text and previous conversation are also transmitted, so the state whitelist does not mean no personal information can reach a provider.

**Change before specifically presenting this as suitable for eight-year-olds:** evaluate actual generated outputs on a versioned family-play corpus, including distressed language, prompt injection, name tricks, garbled speech, real-life personal questions, teasing and requests to hide things from adults. Put a suitable reply validation/moderation step before text display and TTS, with an honest bounded fallback. Offer clear guardian-facing voice/data settings and an obvious live-AI explanation. Keep gameplay help deterministic. Any particular legal obligations need a separate sourced review; this review makes no legal compliance claim.

### 6. Mystery speech currently undermines the live-only personality rule

Each record has prewritten companion-like scene lines (`src/marslegends.js:35-38`, for example); these are put straight on the HUD and spoken (`src/main.js:2624-2631`). That contradicts the stated rule that all personality is live. It also means the live “signal-found” bark and the authored sequence can compete for the same voice/HUD channel.

**Change:** preserve authored evidence as record/instrument narration with a distinct visual/audio treatment. VESPER's reaction can be live and informed by precisely that evidence. Give the presentation a single sequence owner; never allow an ambient reply to replace a safety warning or discovery record mid-read.

### 7. The fiction's reading burden and stakes should be layered

Mission orders begin with Meridian's franchise demonstration, “evidence” and no return vehicle, then introduce the economics and numerous controls (`src/orders.js:44-83`). The background includes sovereignty, machine citizenship and a twenty-hour conspiracy/horror arc. It can reward adults but is a poor prerequisite for the first ten minutes of play.

**Change:** first give a child a concrete shared project: “Let's make the first room on Mars.” Show one useful control at the relevant object. Keep the complete orders one button away. Retain the deeper fiction as optional conversations and records. For younger or sensitive players, an independently adjustable mystery-intensity setting should affect audio, lighting, threat framing and retreat cost; “no gore” does not make darkness, abandonment and a distrusted companion equally fun for everyone. A quick return to a warm home should be an explicit choice, not waiting for the suit to run out.

### 8. Fact and fiction need clear provenance

Heritage combines historical mission statements with explicitly invented anomalous logs in the same presentation (`src/heritage.js:35-40`, `57-62`, `100-106`). The corpus asserts machines rest where they “truly stopped” (`src/gamefacts.js:80`), stronger than can be concluded from the table alone. `heritage.js:104` also says Mars 3 preceded any follower by half a century, inconsistent even with the later missions listed in the same table. Some asserted recovery narratives are intentionally speculative.

**Change:** use clearly labelled “Mission archive” and “Marsstead story” fields and retain source links for the real facts. This supports the game's real-Mars educational promise without making children distinguish history from invented logs unaided. Verify the factual prose independently before release; source comments saying REAL do not establish it.

## Recommended first playable slice

Build one 15–25 minute loop before extending the planet:

1. Land, bound across a small gap, meet VESPER, see a nearby failed robot/probe.
2. Recover it with one physical interaction; choose its name or destination at home.
3. Place the first useful Burrow room through a readable cutaway; watch drones work visibly.
4. Follow a nearby signal, perform one evidence interaction, bring back a sample.
5. Use that sample/part to create a visible garden or observatory improvement.
6. Watch the first blue sunset from the improved home. VESPER recalls the actual adventure; choose the next outing from two enticing possibilities.

This respects the current non-walkable-hab doctrine in `docs/STRUCTURE.md`: render a lively dollhouse cutaway with plants, moving drones, light shafts and a recognisable nook rather than silently rebuilding the game around interior walking. A walkable home is a separate deliberate design change.

Test this slice with children around eight, older children and adults. Measure time to first self-directed action, first success, first independent return home, help requests, confusion, frustration and voluntary desire for another expedition. Have players explain what their last action changed. Use observations to tune assistance and pacing; completion rate alone does not establish fun.

## Verification performed

`node scripts/verify-vesperbrain.mjs` passed on 4 September 2026. It establishes the existing deterministic prompt/format/mood checks, not generated reply safety, historical accuracy, live latency or enjoyment. No full verification gate was run for this read-only design review, and no product code was changed.
