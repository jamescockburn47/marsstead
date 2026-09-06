# Settlement network: independent lives, asynchronous cooperation

Approved direction, 5 September 2026. Planned, not implemented. This supersedes
the continuously co-present multiplayer priority and global sleep consensus in
COOPERATIVE-FRONTIER.md. The original Marsstead visual identity remains binding.

## Player contract

Players inhabit geographically separated settlements on the same persistent Mars.
Each settlement has a local game calendar: individual pause, night skipping and
save/resume are first-class behaviours. Geography alone does not solve time;
independent calendars are an explicit game abstraction, not consistent global
astronomical chronology. No multiplayer sleep vote governs independent play.

Cooperation centres on messages, requests, cargo capsules, blueprints, survey
findings, seeds, loaned workers and contributions to joint projects. A received
machine retains its sender's markings and equipment. Physical visits are optional,
arranged events, not the baseline mode of participation. Keep existing family
permissions and child-safe communication controls; this direction does not
authorise unrestricted public chat.

## Clocks and authority

- Personal/settlement simulation advances during play and through explicit sleep.
  Pause and absence do not deteriorate the astronaut, VESPER or their home.
- The service owns transaction ordering, inventory custody, deliveries, loans,
  construction revisions and permissions. Its transaction clock does not dictate
  each player's visible sunrise or require the recipient to catch up in sols.
- A skipped night is not automatically elapsed economic production. Define
  bounded overnight work explicitly before enabling a shared economy; repeated
  sleeping must not multiply trade goods or accelerate the same installation
  from several clients. Each installation has one authoritative simulation owner.
- Rejoining receives acknowledged shared changes without rolling back personal
  progress. Offline local inventory cannot overwrite authoritative shared stock.

## Delivery loop

Request -> make or select -> pack -> launch -> in transit -> delivered -> collect.
The server transfers custody once and persists an idempotent receipt. A delivery
to an absent player waits safely; their next session can stage the physical
landing without depending on the sender's calendar. Transit pacing is a balance
decision, not a requirement to simulate literal inter-settlement travel in both
calendars. Define reject/return and interrupted-launch recovery before implementation.

Worker loans record ownership separately from current custody and permission to
operate. Reconnection cannot create a second worker. Loan duration must not
penalise an absent child; start with explicit return rather than automatic expiry.

## Landers and physical visits

Each astronaut keeps their own lander for whole-Mars exploration and outposts.
Fuel limits alone cannot enforce permanent separation and are not the solution.
Occupied-settlement arrival starts an explicit visit/rendezvous flow.

An accepted visit temporarily shares one scene clock. The arrival transition
synchronises forward to at least the latest participating simulation time, with
no production windfall or reversal of completed state. Personal rest remains
available; skipping the night together requires the present group to agree or
the visitor to depart. Independent clocks resume from departure. Repeated visits
must not yield free growth, recharge, fuel or transport. Detailed fuel/transit
costs and host-busy/decline behaviour remain to be specified and tested.

This sacrifices routine spontaneous face-to-face encounters in favour of
independent schedules. It does not claim that different calendars can coexist
inside one continuously shared physical encounter.

## Delivery order and acceptance

1. Local multi-base and clock boundaries: preserve existing saves, independent
   pause/sleep, lander travel and forward refuges. Define production during sleep.
2. Two-settlement service slice: private membership, one request, one capsule,
   server-authoritative custody, recipient offline, delivery on return, duplicate
   launch/reconnect rejection. No need for shared avatars in this first slice.
3. Cooperation: blueprint/survey exchange, one joint project, a marked worker loan
   and explicit return. Prove ownership and contributions survive absence.
4. Arranged visit: two landers, forward-only arrival synchronisation, consistent
   local lighting, rest, departure and restored independent sleep. Host departure,
   disconnect and arrival into an occupied pad must have safe outcomes.

The first demonstration must show A sleeping while B continues; a parcel sent in
either direction across different local dates; an offline recipient collecting
once; and a visit/departure without calendar, inventory or production duplication.
No runtime multiplayer, migration, deployment or sibling changes are authorised
by this planning update.
