# Marsstead — vehicle & body dynamics design note

*The thinking behind `src/physics.js` and `src/buggy.js`, written down so the
model is a plan, not an accretion. Every number here is exported from the
modules and held by `verify-physics` / `verify-buggy`.*

## The governing fact

Grip is μ·m·**g**. Mars keeps 38% of the g under 100% of the inertia, so every
traction number is ~1/3 of Earth's while every momentum number is unchanged.
Nothing in either module fights this; everything expresses it.

| Quantity | Earth intuition | Mars (μ=0.65 regolith) |
|---|---|---|
| Max lateral acceleration | ~7 m/s² (road car) | **2.42 m/s²** |
| Braking from 54 km/h | ~18 m | **~47 m** |
| Corner radius at 54 km/h | ~32 m | **~93 m** |
| Static rollover threshold (flat) | tips before sliding (tall cars) | **slides before tipping** (LTR peaks ~0.38) |

## The colonist

- **Jump**: `JUMP_V0 = 2.3` → apex 0.71 m, hang 1.24 s. Deliberately *not* the
  Moon: Mars reads springy, never floating. (First playtest shipped 3.2 —
  1.4 m apex — and read as exaggerated moon-jumping; the regression stands.)
- **The lope**: running IS ballistics — each stride is a real hop
  (`LOPE_HOP_V0 = 1.15`: apex 0.18 m, flight 0.62 s, ~3.7 m per bound at
  6 m/s). The walker genuinely leaves the ground each stride; steering
  authority drops while airborne (you commit to a bound). Walking stays
  grounded.
- **Falls** are survivable by design (severity saturates; a ~19 m Mars fall is
  the worst case and costs a stumble) — the blackout rule's foundation.

## The buggy — model choice and layout

**Model**: the standard linear bicycle model (slip angles α, per-axle
cornering stiffness C_α) with **friction-circle saturation** per axle —
longitudinal force spends first, lateral gets `sqrt((μN)² − Fx²)`, exceeding
either means that axle skids. Chosen over (a) arcade kinematic steering
(cannot produce emergent drifts/understeer) and (b) per-wheel multibody
simulation (unwarranted complexity for a low-poly third-person game; revisit
if per-wheel suspension ever matters visually).

**Layout**: AWD, rear-biased 75/25 (`FRONT_SPLIT` — every real Mars rover
drives all wheels; the rally split keeps power-oversteer character), engine
power-limited at speed (`POWER`), soft-regolith rolling resistance
(`ROLL_DRAG`).

**The three stability guards** (each was a shipped bug once; each is a named
regression now):

1. **Traction cap** (`TRACTION = 0.82`): drive may never consume an axle's
   whole circle — full throttle cannot zero rear lateral grip. Without this
   the car can't hold a straight line under power.
2. **Kinematic blend** (`U_KIN = 3.5`): the dynamic model is invalid near
   standstill (a standing car cannot yaw); below U_KIN the yaw rate eases to
   the kinematic bicycle's and sideslip dies.
3. **Static hold**: a parked car inside the friction cone is held (steeper
   slopes honestly slide).

## Lateral stability — how it tips, and why mostly it doesn't

**Load-transfer ratio**: `LTR = |a_lat|·H_CG / (g·HALF_TRACK) + side-slope
term`. At 1.0 the inner wheels unload. On flat ground friction caps a_lat at
μg, so LTR tops out ≈ 0.38: **the buggy slides before it tips — that's the
real physics**, not a missing feature. What actually rolls it:

- **Side-slopes**: gravity stacks its own lever on the same side; traversing
  steep cross-slopes at speed pushes LTR through 1.
- **The trip rollover** (`TRIP_V = 4.5`): sliding sideways fast into rising
  ground — the way real cars actually roll. Drift into a bank and over she
  goes.

A rollover doesn't need its own animation system: it **launches** the buggy
(vy kick + imposed roll rate) and hands it to the airborne machinery, whose
**judged landing** already knows what an upside-down arrival costs (speed
mostly gone, never death — the blackout rule's shape).

## Airborne — the flip layer

Off a crest the ground falls away and flight is pure ballistics under
`G_MARS` (verified against the closed-form apex). In the air, throttle/steer
become pitch/roll authority (`PITCH_RATE`/`ROLL_RATE`) — low gravity's long
hang time is flip time. Rotation accumulates in `airSpin`; a full revolution
is a **flip**, and the landing is judged by attitude: level = clean (flips
stick), crooked = hard scrub, inverted = crash-out. Skill loop: pick the
crest, commit the rotation, level out before the ground arrives.

## Integration

Fixed-substep at 120 Hz covering the whole frame dt (stable and identical at
any framerate). All state deterministic — same inputs, same trajectory, every
client (invariant 4). Terrain enters as data `{h, gx, gz}` sampled from
`meshGroundHeight` — the drawn surface, sampled at the **four wheel contacts**
(height = axle average, attitude = the wheel-height differences), so the body
rides the slope it is drawn on; the same no-floating rule the walker follows.

## Deferred, deliberately

Per-wheel suspension travel (visual only when it comes), longitudinal weight
transfer under braking (grip currently split statically), tyre relaxation
length, powertrain curves beyond the power cap. Each gets added only when a
playtest asks for what it provides.
