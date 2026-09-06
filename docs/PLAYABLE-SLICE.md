# First light — implementation record

Authorised 5 September 2026: implement the review's first-session loop, excellent
home visuals consistent with Marsstead, repair walking, and use lean agent teams.

The local slice is: plan a home → investigate a nearby survey station → align
its optical instrument → recover its solar wing → install useful power at home
→ see a detailed, growing home and choose the next project. Existing industry,
planetary flight and mystery remain available. This is not the unbuilt full
twenty-hour cave campaign.

Acceptance:
- Real suit/rover/ship material limits permit construction without loss or
  duplicated refunds; old saves still load; new rewards persist exactly once.
- Guidance progresses from actions and never requires live AI to explain a
  prerequisite. Orders are optional, pause works, camera/input respect menus.
- The survey is a small manipulable puzzle with visible feedback and a useful
  reward; homecoming is a visible achievement.
- Home presentation uses procedural native rock, ivory ceramic, cool slate,
  restrained teal and living green; the 3D crown and detailed cutaway reflect
  actual built rooms. No binary assets or new render framework.
- Walking solves rendered foot placement, turn/stop behaviour and the duplicate
  lope jump clock; inspect motion in the browser as well as pure pose math.
- The canonical verify/build and a fresh integration review close the slice.

Ownership: lead integrates main/save/fieldwork/guidance; home agent owns
cutaway/crown; locomotion agent owns rig/model; economy agent owns transactional
stores, refining and starter pacing, then session controls/audio.

The updated AGENTS.md records the lean workflow. No global policy files are
changed. No deployment, commit, production service change or formal child-safe
certification is implied by this implementation.

## Progress

- Economy contracts: distance-filtered store pools; atomic materials and charge;
  atomic full-content refunds; exact paid recipes saved. Starter first corridor
  and bunk costs reduced once per warren; normal later costs retained.
- Locomotion diagnosis: post-IK angle smoothing invalidated foot planting,
  sagittal-only IK ignored lateral plant positions, and main launched repeated
  lope jumps independently of the rig's own stride clock.
- The final support solve now places the rendered boots at their ground targets,
  including lateral steps, turning slopes, starts/stops and landing recovery.
  Automatic whole-body lope jumps were removed; Space retains the Mars-gravity jump.
- Home rendering now includes lit room shells, planted gardens, a furnished bunk,
  a workshop and supplies. Surface light wells, crates and lamps follow the same
  built state. The cutaway remains the home interaction model required by the
  existing design; this does not introduce a walkable underground interior.
- First Light is an actual sensor puzzle with a single recoverable solar wing,
  nearby-cargo construction, saved progress, a discovery record and a visible
  home keepsake. Guidance advances on completed actions. The initial cold-start
  economy reaches a completed bunk at 8m05s even without the new solar reward.
- Pause, help, safe return, optional fullscreen, typed chat access and independent
  guidance/survival/text/effects/motion choices are available. Suit depletion
  returns the player safely aboard, preserving cargo. The display uses expedition
  day and local sunlight time; air and warmth include numbers as well as bars.
- Companion regard no longer punishes silence or disobedience. Local prompt
  facts reflect the merged ship, immediate salvage and the new project; live
  personality still comes from the AI service.

## Verification and limits

`npm run verify` and `npm run build` pass. The source-size check names seven
legacy exceptions and enforces the limit elsewhere, without a mechanical rewrite.
The production bundle still produces Vite's existing large-chunk warning.

Browser regression: start `npm run dev -- --host 127.0.0.1 --port 5207 --strictPort`,
then `npm run verify:browser`. `FIRSTLIGHT_URL` and `CHROMIUM_PATH` override the
local URL and installed browser. The test owns a fresh, disposable browser context,
uses real IndexedDB, blocks AI/diagnostic endpoints and never edits the player's save.
It exercises title entry, held walking/lope/jump input, pause, map, home planning,
actual drone excavation, full-suit reward refusal, nearby-rover collection,
solar construction, sealing, the journal, rover rescue and save/reload.
Travel checkpoints relocate actors to keep regression time bounded; they do not
award resources or advance the simulation. Expanded-home screenshots are explicitly
labelled art fixtures, distinct from the earned first-home journey.

One independent integration review found map freeze, resume focus and rover-rescue
parenting defects. All three were fixed and the bounded re-review cleared them.
The browser also checks these paths. Visual evidence is in `media/firstlight/`
(disposable output), including side-on walking samples and desktop/phone homes.
The separate actual touch-context check also passes: guidance leaves the character
visible, session controls do not overlap it, pause/resume works by tapping, and
the page does not overflow. A final phone-only layout refinement received that
focused check and a fresh build after the full desktop journey had passed.

This slice does not establish that the game is fun for every age. The next product
check is observing children aged 8–10 and adults attempt the first home without
coaching: can they explain the goal, find the sensor controls, understand cargo,
and choose their next project? Record time stuck and voluntary replay, not just
completion. The deeper mystery/content campaign and controller testing remain
separate work. No child playtest or generated-dialogue moderation evaluation has
been performed here. Hosted VESPER prompt changes require an authorised relay
rollout; local browser tests deliberately prove the instrument-led loop offline.

## Lean team practice

Use one lead and two or three subsystem owners only when the work has genuinely
independent boundaries. For this slice those were home visuals, gait and economy;
the lead owned entry/input/save and the playable loop. Keep one shared integration
owner, short handoffs with exported APIs, focused checks per owner, then one
assembled browser journey and one fresh review. A small fix stays with one agent.
Classify consequence once for the slice. Reserve extra assurance for specific
save-loss, authority, secret or production risks; do not repeatedly classify files
or run per-file review agents. Summarise passing verification and expand failures.
Keep the project policy here and in AGENTS.md; the user's global policy was not
rewritten. This is the working process now, not a proposed orchestration project.
