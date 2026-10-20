# Study · Diddy Kong Racing (N64) · kart handling on the ground

Learned from the DavidSM64 decompilation, `github.com/DavidSM64/Diddy-Kong-Racing` at commit
`a5eb080fa8f91b97d6f6495e0549ef7121ae7496`. Everything below is from `src/racer.c` (the car path:
`update_car`, `update_player_car_velocity_ground`, `handle_car_steering`, `handle_base_steering`,
`handle_car_velocity_control`, `handle_racer_top_speed`, `update_car_velocity_offground`,
`update_racer_collision`) and the racer-vs-racer push in `src/objects.c` (`func_800159C8`,
`func_80016500`). No code taken; the mechanism and its constants are the subject.

Units. DKR's logic runs at 30 Hz but counts in 60 Hz frames: every update receives `updateRate` (whole
60 Hz frames since last tick, normally 2) and `updateRateF` (same, as a float). Velocities are world
units per 60 Hz frame and are multiplied by `updateRateF` when the object moves. A number of the
feel-defining adjustments are applied once per *tick* without scaling (the decomp tags these `!@Delta`);
below those are marked "per tick (30 Hz)". Angles are 16-bit: 65536 = 360°. Forward velocity is stored
negative in the original; this note flips the sign so that forward is positive. Per-character stats
(weight, handling, slide, the acceleration curve) live in ROM asset tables that are not in the repo, so
they appear here as named knobs with the shape of their use, not values.

## Why this one
A top-down or pseudo-3D canvas racer needs a kart that builds speed with a curve, loses it to drag that
depends on the ground, slides a little in corners, drifts a lot when asked, and bumps other karts
honestly. DKR's model is small: one scalar forward speed, one scalar sideways speed, a heading, and a
handful of eased inputs. It fits a kids' racer without a physics engine.

## State the kart keeps
`velocity` (forward, along the heading), `lateralVelocity` (sideways), `heading` (where velocity points),
`bodyYaw` (how far the visible body is twisted off the heading, chases a target each tick),
`driftHeadingOffset` (extra heading twist while drifting, eases toward ±45°), `steerAngle` (eased stick,
−75..75), `throttle` (0..1, decays), `brake` (0..1, ramps), `boostTimer` (60 Hz frames), `driftDir`
(−1/0/+1), `counterSteerAccum` (how long the player has fought the drift), `spinoutTimer`,
`groundedWheels` (0..4) and `wheelSurface[4]`, `bananas` (0..10, the speed pickup), `yVel`.

## Update order, each tick
1. **Eased steering.** `steerAngle += (stick − steerAngle) · 0.125 · updateRateF`, minimum step 1 so it
   always arrives. Stick is clamped to ±75 for AI; drift biases the stick (see 7).
2. **Throttle and brake.** `throttle −= 0.1` per tick, then `throttle = 1` while accelerate is held
   (so letting go leaves a 10-tick tail of push). Brake: `+0.2` per tick while held, to 1.0; `−0.1`
   per tick when released, stopping near 0.05.
3. **Top speed multiplier.** `topMult = 1 + 0.025 · clamp(bananas, −20, 20)`; human players cap
   bananas at 10 (+25 %). Zero before the start signal. Drifting with the trigger held: `topMult ×= 1.1`.
4. **Heading turn.** Only when |velocity| > 0.3. Turn rate per tick
   `k · steerAngle · updateRate / 2 · handling`, with `k = 6` normally, `12` while braking, `18` while
   braking in a drift. Reversing flips the sign. At full stick and k = 6 that is 450 angle units per tick,
   about 2.5°/tick, 74°/s.
5. **Body yaw (the slip look).** A target yaw is `−steerAngle · s` where
   `s = (clamp(|v|, 0, 1.8) − 0.2) · 58` (68 while drifting); at speed and full stick ≈ 38° off the
   heading. `bodyYaw` chases it: `bodyYaw += clamp((target − bodyYaw) / 4, ±750) · updateRate`. Below speed 3
   the target is scaled by `max(0, |v| − 2)`, so the body straightens as the kart stops. The model is
   drawn at `heading + bodyYaw`; velocity points along `heading + driftHeadingOffset`.
6. **Surface averaging.** For each grounded wheel look up `drag[surface]`, `slide[surface]`, `bob[surface]`;
   average drag and slide over the grounded wheels. On water: drag 0.02, slide 0.
7. **Drift entry/exit.** Enter when the trigger is held, |steerAngle| > 15 and speed > 3: `driftDir =
   sign(stick)`. Exit when speed < 2 or the trigger is released. While drifting: the stick is clamped to
   ±50, input in the drift direction is quartered, then `stick += 60 · driftDir` (the kart wants to keep
   turning in); `driftHeadingOffset += (8192 · driftDir − driftHeadingOffset) · updateRate / 16` (eases
   to 45°). Counter-steer (stick ≥ 26 against the drift) accumulates `counterSteerAccum += updateRate`
   per tick, resets when you stop fighting; past 80 the kart spins out (`spinoutTimer = −driftDir`) and
   the drift ends. Braking during a drift kicks tyre smoke and triples steering (step 4).
8. **Lateral velocity.** When moving faster than 2 and not drifting:
   `lateral += velocity · stick / slideStat[character]` per tick. Then `lateral ×= slideAvg` per tick
   (0.8 road, 0.85 grass and sand, 0.5 on the grippy surface types) and `×= |cos(pitch)|`. Below speed 3
   the slide factor blends toward 0.7 so a slow kart stops skating. Stone wheels zero it.
9. **Drag.** If |v| < 1 and no throttle: `v −= v · drag · 8` (coast to a stop). Otherwise
   `v −= sign(v) · v² · dragAvg` per tick. Road drag 0.004, grass 0.007, sand 0.01.
10. **Acceleration.** `a = curve(|v|) · 1.7 · topMult`, where `curve` is a per-vehicle table indexed by
    whole speed 0..12 with linear interpolation (clamped at 12). Boosting overrides: `throttle = 1`,
    `a = 2.0`. Then `v += a · throttle` per tick, and brake pulls `v` toward zero by
    `brake · a · 0.32` per tick, never crossing zero. Reverse: when −2 < v < 3, brake held, stick down,
    no throttle: `v −= (3 − v) · 0.15` (quartered on sand).
11. **Gravity and slope.** `yVel −= weight · updateRateF`. On a slope with the brake off:
    `v += weight · pitch / (4 − f(pitch)) · updateRateF`, where `f` = 35 · clamp(|pitch| − 0.3, 0, 0.1)
    for downhill pitch (steeper downhill accelerates more), 0 uphill.
12. **Move.** Rotate `(lateral, velocity)` by `heading + driftHeadingOffset` into world x/z, add any
    crash impulse, move, resolve collision (four wheel spheres), then read back the *actual* displacement
    and clamp `velocity` and `lateral` to within 0.5 of what really happened. That last step is what makes
    walls feel solid without an explicit "hit wall → zero speed" rule.
13. **Wall crash.** If the collision normal is within 45° of head-on and `|v| · 1.075 > 4`: `velocity ×=
    0.15`, `lateral = 0`, apply an impulse along the normal of magnitude `|v| · 1.075` for 7 ticks,
    camera shake 3. Also kills any drift and eases body yaw and drift offset by 7/8.
14. **Off the ground** (`update_car_velocity_offground`): `yVel −= yVel · 0.025 · updateRateF`
    (air drag), `yVel −= weight · updateRateF` with stick-forward making weight × 1.33 and stick-back
    × 0.53 (dive / float), halved while boosting. Steering still turns the visible heading
    (`6 · steerAngle` per tick). Boosting in the air: `v += 1.6` per tick up to 20. Landing speed sets a
    squash: `stretch = 1 − (clamp(−yVel · 20, 50, 127) − 40) · 0.004`.

## Derived speeds (road, no bananas, acceleration curve at its top ≈ 0.33)
At top speed `curve · 1.7 ≈ 0.561` balances `v² · 0.004` (the AI code uses exactly this to pick target
speeds), so:

| condition | terminal speed (units / 60 Hz frame) | relative |
|---|---|---|
| road, 0 bananas | √(0.561 / 0.004) ≈ 11.8 | 1.00 |
| road, 10 bananas (×1.25) | ≈ 13.2 | 1.12 |
| grass (drag 0.007) | ≈ 9.0 | 0.76 |
| sand (drag 0.01) | ≈ 7.5 | 0.63 |
| boost (a = 2.0), if held long enough | √(2 / 0.004) ≈ 22.4 | 1.9 |

Boosts never last long enough to reach 22.4; a zipper gives 45 frames (0.75 s), nitro balloons 35/55/75
frames, the start boost at most 20. The *acceleration* is what you feel: 2.0 per tick versus about 0.56
at top speed, 3.6× the normal push.

## Racer-vs-racer bump (`objects.c`)
Both bodies are spheres (`hitboxRadius`, 20 for a balloon, per-vehicle for racers) with a `pushForce`
class (`weightStat[character] + 1`). On overlap depth `d` along the centre line: each is moved apart by
`d / 2` (an immovable object takes none and the racer takes all). Velocity change `Δ = d / 2 ·
(1 / updateRateF)`; the mass factor `f = 1 + 0.3 · (pushOther − pushMe)`; the pusher gets `Δ · (2 − f)`,
the pushed `Δ · f`. Then world velocity is re-projected into forward/lateral on the new heading
(`func_80016500`), the crash sound volume is `clamp(|Δspeed| · 14 + 35, 0, 127)` and camera shake
`min(|Δspeed|, 3)`, with a 30-frame cooldown. A kart carrying a shield gives the other a spinout.

## Knobs the line will turn
`topMult` base (slow kid vs fast kid), `drag` per ground type, `slide` per ground type (ice = 0.95),
`k` turn rate, `handling`, `slideStat` (bigger = less slide), `driftAngle` (8192 = 45°; smaller is
gentler), `counterSteerLimit` (80), boost `a` and durations, bump `0.3` mass spread.

## Edge cases to keep
- Drag uses `v²`, so a stopped kart never jitters; the `|v| < 1` branch coasts it to true zero (`|v| <
  0.04 → 0`).
- The brake never pushes past zero; reverse is a separate, slower rule.
- Letting go of the throttle leaves a 10-tick tail; the kit should keep that, it is why DKR karts do not
  lurch.
- Clamp model speed to the *measured* displacement after collision (step 12). Without that, a kart pinned
  against a wall keeps "going fast".
- Spinout and reverse both kill the drift state; a drift must not survive a wall hit.
- Inputs are eased (`steerAngle`), never raw; touch controls on a phone will thank you.
