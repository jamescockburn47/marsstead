# Marsstead

**Procedural survival-homesteading on the real Mars.** Land alone on a dead world
that was once alive, keep a suit's worth of air and heat between you and the cold,
and *build* — hab by hab, from the regolith up. Range out by rover, jump the
horizon by rocket, and follow a thread the sand has kept for four billion years
down into the dark, toward where life on Earth began.

Third sibling to [Moorstead](https://www.moorstead.app) (the land) and
[Saltstead](https://www.saltstead.app) (the sea). Same identity: **browser-first,
procedural-only, zero binary assets, deterministic, verify-gated.** Every crater,
canyon and dry sea-floor is the true one — real MOLA topography and the USGS
Gazetteer, scaled down and drawn entirely by code. Nothing to download.

- **Live:** [www.marsstead.app](https://www.marsstead.app)
- **The plan:** [docs/DESIGN.md](docs/DESIGN.md) — the founding design & architecture.

## Licence

Marsstead is free to play and free and open-source software.
Copyright (C) 2026 James Cockburn and contributors.

Except where otherwise identified, the original software in this repository is
licensed under the **GNU General Public License, version 3 or (at your option)
any later version** (`GPL-3.0-or-later`). You may use, study, modify and redistribute
it under those terms. If you distribute modified versions, the GPL requires the
covered work to remain under the GPL and recipients to receive corresponding source.
The licence permits commercial use; Marsstead itself remains free to play.

The software is provided without warranty; see [LICENSE](LICENSE) for the full
terms. Scientific data and third-party components retain their own status and
terms: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Source is available at
[github.com/jamescockburn47/marsstead](https://github.com/jamescockburn47/marsstead).

## The two things that make it Marsstead

1. **VESPER, a real AI co-star.** The only other mind on the planet — driven by a
   language model, aware of the Mars you're actually standing in, and afraid in
   the dark with you. With a first-class canned voice underneath, so it never
   depends on a server.
2. **A genuinely terrifying aim.** The mystery pulls you underground into real
   survival-horror — atmospheric, never graphic, always escapable. Beautiful and
   dangerous, always fun.

## Designed into the ground

Mars's real physics are mechanics, not flavour: **0.38 g** (the bounding stride,
the leaping buggy, the far-flung hopper), **dust** (the blue sunset, the arrays
you must keep clean, the planet-wide storm that kills the sun), and the **harsh
sol** (the thermal cliff at dusk, two hurrying moons, the cold that makes shelter
matter).

## Status

Pre–Phase 0. The design is the contract; the landing page is the engine warming
up. See `docs/DESIGN.md` for the phase plan.

## Credits

The buggy's vehicle dynamics follow the **DFA-1 arcade-car model** from Dan's
[Dune Flip Arena](https://github.com/golnuggit/dune-flip-arena) — quarter-car
suspension, exaggerated grip over honest ballistics, judged flips — adapted to
Mars gravity and reimplemented procedurally. Used with permission; thank you,
Dan.

*Procedural-only, to the last polygon.*
