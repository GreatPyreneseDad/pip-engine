# Study · Diddy Kong Racing and Crash Team Racing · boosts, zippers and the drift that charges one

Two sources. DKR (`github.com/DavidSM64/Diddy-Kong-Racing`, commit
`a5eb080fa8f91b97d6f6495e0549ef7121ae7496`): `src/racer.c` (`handle_racer_top_speed`,
`update_player_car_velocity_ground`, `handle_racer_items`, `racer_activate_magnet`),
`src/object_functions.c` (`obj_loop_groundzipper`). DKR's drift does not charge a boost, so the
charge-and-release half comes from CTR's native decompilation (`github.com/CTR-tools/ctr-native`, commit
`4682773232715bfd3f39b8c7066ab12e1c37c23e`): `game/Vehicle/VehPhysProc.c` (`PowerSlide_Init`,
`PowerSlide_Update`, the spin-out block), `game/Vehicle/VehFire.c` (`VehFire_Increment`),
`game/Vehicle/VehPhysGeneral.c` (`GetBaseSpeed`), `game/Vehicle/VehPhysForce.c` (turbo pads), and the
per-class stat table in `game/zGlobal_DATA.c` (`metaPhys`). No code taken.

Units. DKR timers are 60 Hz frames (see `dkr-kart-handling.md`). CTR runs at 30 Hz and keeps time in
"ms" where one frame is 32 units; a stat given in frames is shifted left by 5 to become time. CTR speeds
are 16-bit fixed point; the balanced class top speed is 13140.

## Why this one
A boost is the loudest reward a racer gives. Two shapes are worth having: the **pad / pickup boost**
(DKR: a timer that forces full throttle and a high fixed acceleration) and the **charged drift boost**
(CTR: hold a slide, release at the right moment, get a reserve of boost time; do it three times in one
slide for more). Kids find the second one by accident and then chase it on purpose, which is the point.

## DKR: the boost is a timer
State: `boostTimer` (60 Hz frames), `boostType` (small/medium/large, plus a "released the throttle first"
flag that only changes the flame), `throttleReleased` (set the first time the accelerate button is not
held after the start).

Effect each tick while `boostTimer > 0` and the race has started: `throttle = 1`, acceleration constant
`= 2.0` per tick (replacing the normal `curve · 1.7 · topMult`, which is about 0.56 at top speed), and
`boostTimer −= updateRate`. In the air: `v += 1.6` per tick up to 20, gravity halved. The boost raises
acceleration, not the speed cap; the cap is set by drag (`v² · 0.004`), so a boosted kart on a long
straight tends to √(2 / 0.004) ≈ 22 units/frame, 1.9× the normal 11.8, but no boost lasts long enough to
get there. The result reads as a surge, then a slow bleed back to normal.

| source | frames (60 Hz) | seconds | notes |
|---|---|---|---|
| ground zipper | 45 | 0.75 | only if `boostTimer < 15` already (no double-dipping) and wheels on the ground; detection: racer within the pad's radius (default 255 units) |
| nitro balloon level 1 / 2 / 3 | 35 / 55 / 75 | 0.58 / 0.92 / 1.25 | consumes the balloon |
| start boost | `(24 − |t − 14|) / 2`, max 20 | up to 0.33 | `t` = countdown frames remaining when accelerate is first pressed; perfect press at t = 14 gives 20 frames; pressing early (before the 30-frame window) gets nothing |
| magnet (tractor beam) | 3 (refreshed) | — | pulls toward target at `clamp(targetSpeed, 8, 20) + 5` while 150 < distance < 2000 |

Boost type is a cosmetic tier: < 20 frames small, < 35 medium, else large. The "released A first" flag
only picks the flame emitter, despite the manual's claim; the kit can make it a real multiplier if it
wants the mechanic.

AI: Expert AI copies the player's start boost length; Master AI always gets a 5-frame one when the player
fails.

## CTR: the drift charges a meter, the release pays out
State per kart: `reserves` (boost time left, counts down ~32 per frame), `fireSpeedCap` (how much the
boost raises the top speed), `meterRoomLeft` (the drift meter, counts down), `numBoostsAttempted`,
`numBoostsSuccess` (0..3), `framesDrifting` (signed: positive while the stick is held into the slide,
negative the other way), `driftBoostTime` (15-frame visual kick after a release).

Class stats (balanced / accel / speed / turn), from `metaPhys`:

| stat | value | meaning |
|---|---|---|
| turboMaxRoom | 30 frames | the drift meter's length |
| turboLowRoomWarning | 15 frames | the meter turns red; releases before this point fail |
| turboFullBarReserveGain | 60 frames (2 s) | reserves for a perfect release |
| DriftBoostDurationFrames | 15 | the body tilt kick after a release |
| Drifting_FramesTillSpinout | 60 | hold the stick into the slide this long with no release → spin out |
| Speed_ClassStat | 13140 / 13520 / 13900 / 12950 | base top speed |
| Accel_ClassStat | 480 / 544 / 448 / 512 | normal acceleration |
| Accel_Reserves | 1152 | acceleration while reserves > 0 (2.1–2.6× normal) |
| SingleTurboSpeed | 2048 | top-speed bonus for the first drift boost (+15.6 % of 13140) |
| SacredFireSpeed | 4096 | top-speed bonus at the highest fire level (+31 %) |
| TerminalVelocity | 20480 | hard cap |
| DriftTurnBase | 14 / 10 / 5 / 18 | how much the slide tightens the turn |

Update order while sliding (`PowerSlide_Update`), each frame:
1. On entering the slide (a hop with a shoulder button while turning): `meterRoomLeft = 30 frames`,
   counters zeroed.
2. **No release this frame:** if the meter has room, `meterRoomLeft −= dt`. When it reaches zero without a
   release: play the "meter full" sound and `numBoostsAttempted += 3`, which locks out any further boost
   this slide (but the slide itself continues). If the meter is at zero and fewer than 3 attempts were
   made, re-arm it to 30 frames (this is how the second and third boosts get their own meter).
3. **Release (the other shoulder button tapped):** `framesDrifting = 0` (spin-out clock reset). If the
   meter still has room: when `meterRoomLeft < 15 frames`, `gain = lerp(60 frames → 0) over meterRoomLeft
   ∈ [0, 15 frames]`, i.e. the later the better, a perfect release just before empty pays 2 s; add `gain`
   to `reserves`, set fire level `= numBoostsSuccess · 64` (0, 64, 128 → speed cap +2048, +2560, +3072),
   `numBoostsSuccess += 1`, kick the body for 15 frames. When `meterRoomLeft ≥ 15 frames` (too early):
   an exhaust puff and nothing else. Either way `meterRoomLeft = 0` and `numBoostsAttempted += 1`.
4. **Spin out** if `framesDrifting > 60` (stick held into the slide too long with no release) or if the
   kart is moving backwards off a pad. **Drop out of the slide** (no penalty) when speed falls under half
   the class top speed, when against a wall, or when the starting shoulder button is let go.

Reserves (`VehFire_Increment`): sources add time; a turbo pad gives 30 frames but is *frozen* while you
are on the pad and only starts counting once you leave; a turbo item gives 75 frames (2.5 s); the
"super engine" sets rather than adds. `fireSpeedCap = SingleTurbo + fireLevel · (Sacred − SingleTurbo) /
256`, only raised, never lowered, until reserves hit zero. While `reserves > 0`: acceleration becomes
`Accel_Reserves` and top speed becomes `classSpeed + fireSpeedCap + min(pickupBonus, 6144 −
fireSpeedCap)`, so the fruit bonus (up to 9 wumpa ≈ +150 each) is squeezed as the fire grows. Everything
is clamped at 25600 (`NET_CAP`).

The feel in one line: a slide is a 1-second meter; release in its last half-second for up to 2 seconds of
fire; chain three releases in one slide for a bigger, longer fire; hold too long and you spin.

## Translating to a 2D kids' racer
- Keep DKR's boost as the plugin's core: `boost(frames)` sets a timer; while it runs, throttle is 1 and
  acceleration is a fixed high constant. Speed cap comes from drag, so no separate "max speed" state.
- Add CTR's meter on top of the drift state from `dkr-kart-handling.md`: `meter` counts down from
  `meterLen` (1 s), release in the last `window` (0.5 s) pays `gain · (1 − t / window)` seconds of boost,
  three releases per slide, `spinAfter` (2 s) of uninterrupted slide spins the kart.
- On a phone there is one drift button; "release" can be tapping it again, or letting the stick/finger
  cross centre. DKR's own drift (hold trigger, 45° offset, counter-steer to spin) is the one that works
  with a single thumb.

## Edge cases to keep
- A pad must not re-trigger while the boost it gave is still running (DKR: `boostTimer < 15`).
- A failed (early) release costs an attempt; three failures end the chance without a spin. Kids need the
  puff of smoke so they know they were early.
- The spin-out counter resets on every successful release; it only counts while the stick is held into
  the slide, and drains by 1 per frame when neutral.
- Reserves from several sources stack additively, so a drift boost into a pad keeps the fire. The speed
  cap only ratchets up within one fire.
- Boost should halve gravity or otherwise help in the air, or jumps will feel like they steal the boost.
