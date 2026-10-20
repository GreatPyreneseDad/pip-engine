# Study · Super Mario Bros. (NES) · walk, run, skid, the speed-dependent jump, and the camera that only moves right

Learned from the nukep `SMB-Vanilla` C decompilation, commit `20f4e02614412f9dbd407dd4e4fab4ade5eb79da`, file
`src/smbcore/common.c`: `PlayerPhysicsSub` (jump launch tables, run/walk/water speed caps, friction adders),
`ImposeFriction`, `GetPlayerAnimSpeed`, `JumpSwimSub` (the hold-to-rise rule), `MoveObjectHorizontally` and
`ImposeGravity` (the fixed-point integrators), `ScrollHandler` / `ScrollScreen` (camera), `ChkPOffscr`;
`src/smbcore/vars.h` for the timer layout. No code taken; the numbers are the subject. NES: 60 fps. Horizontal speed
is stored in **1/16 px per frame** with an 8-bit fraction underneath it; vertical speed in **px per frame** with an
8-bit fraction. Both are converted to px and px/s below.

## Why this one
`sonic-movement.md` is the fast-and-slippery platformer; this is the other pole, the one most kids have in their
hands when they say "make it jump like Mario": a walk that builds over two-thirds of a second, a run you have to
earn by holding a button, a skid that bites, and a jump whose height depends on how fast you were going *and*
how long you hold. Plus the simplest camera rule ever shipped: it never goes left.

## State the mover keeps
`x` (24-bit: page + pixel + fraction), `y` (likewise), `vx` (signed, 1/16 px/f), `vy` (signed, px/f, plus a fraction),
`|vx|`, `movingDir` and `facingDir` (they differ during a skid), `state` (ground, jump/swim, fall, climb),
`runTimer` (10 frames; "still counts as running after letting go of B"), `runningSpeed` (a latch set once `|vx| ≥ 28`),
`verticalForce` (the gravity in use this frame) and `verticalForceDown` (the one to switch to), `jumpOrigin`
(the y the jump began at), `sideCollisionTimer`, `size` and `crouching`.

## Horizontal, each frame (`PlayerPhysicsSub` then `ImposeFriction`)
1. **Pick the cap.** `running = (held direction == movingDir) && B held` refreshes `runTimer = 10`. Caps:
   - **run** 2.5 px/f (`$28`) when `runTimer > 0` and still pushing the same way,
   - **walk** 1.5 px/f (`$18`) otherwise,
   - **water** 1.0 px/f (`$10`) on the ground in a water level.
2. **Pick the adder** (the acceleration *and* the deceleration — it is one number): `$98` normally,
   `$E4` while running, `$D0` once fast (`runningSpeed` latched or `|vx| > 2.0`). If `facingDir != movingDir`
   (a **skid**) the adder is **doubled**. In the air: `$E4` when `|vx| > 1.5`, else as on the ground.
3. **Apply.** Pushing: `vx += adder` toward the push and clamp at the cap. Not pushing: `vx` moves toward 0 by the
   same adder (there is no separate "friction"; letting go decelerates at the same rate the current state would
   accelerate). Reversing in the air is allowed; reversing on the ground is the skid.
4. Facing flips the frame a direction is pressed; movingDir flips only when `vx` crosses zero.

Per-frame adders in px/f² (adder/256 of a 1/16-px unit): `$98` → 0.037, `$D0` → 0.051, `$E4` → 0.056; skids
0.074 / 0.102 / 0.111. From rest to walk speed takes **40 frames** (0.67 s), walk to run another **18**; a skid
from full run stops in **25 frames**; coasting from walk stops in **30**.

## The jump (`PlayerPhysicsSub`, `JumpSwimSub`)
A new press on the ground (or in water, when the swim timer allows) reads `|vx|` and picks a row:

| `|vx|` (px/f) | launch `vy` | gravity while holding A | gravity after release / past apex |
|---|---|---|---|
| ≤ 0.5 | −4 | `$20` = 0.125 px/f² | `$70` = 0.4375 |
| < 1.0 | −4 | 0.125 | 0.4375 |
| ≤ 1.5 | −4 | `$1E` = 0.117 | `$60` = 0.375 |
| < 1.75 | −5 | `$28` = 0.156 | `$90` = 0.5625 |
| ≥ 1.75 (running) | −5 | 0.156 | 0.5625 |
| swimming | −2 (−1 in a whirlpool) | `$0D` = 0.051 | `$0A` = 0.039 |

- **The rule**: each frame in the air, if `vy ≥ 0` (past the apex) *or* A is not held and we have risen at least
  1 px (`DiffToHaltJump = 1`), `verticalForce = verticalForceDown`. So the low gravity applies only while rising
  with A held; the moment you let go, gravity jumps 3–3.6×. That is the variable-height jump, done with two
  gravities rather than a velocity cut (Sonic's way) or a divide (SM64's).
- `vy` is integrated first, then gravity added, then **clamped at 4 px/f** falling (`ImposeGravity`, q = 4).
- Heights: standing jump 4 px/f against 0.125 → **32 frames up, 64 px (4 blocks)**; running 5 against 0.156 →
  **32 frames, 80 px (5 blocks)**; a tap (release at once) ≈ 18 px. Falls take about half the rise time.
- Running makes the jump *longer* mostly through the higher launch and lower gravity, not through air speed: the
  air adder keeps `vx` near what it was.

```
   GROUND ──A pressed──▶ RISING (verticalForce = row.hold) ──vy ≥ 0 or A released──▶ FALLING (row.fall; vy ≤ 4)
     ▲                                                                                   │ land (block under feet)
     └───────────────────────────────────────────────────────────────────────────────────┘
```

## Vertical, each frame (`ImposeGravity`)
`y += vy` (with fraction), then `vy += force`; if `vy ≥ 4.5` clamp to 4. The same routine, with other forces and
caps, moves every enemy and item (walkers fall at `$3D` ≈ 0.24 px/f², cap 3; see `smb-enemies-powerups-economy.md`).

## The camera (`ScrollHandler`)
- Scroll only when the player is at screen x **≥ 80** (`$50`), moved right this frame (`dx > 0`), the level is not
  scroll-locked, and no side collision happened in the last few frames.
- Between **80 and 112** scroll by `dx − 1`: the player drifts right one pixel per frame of running until they sit
  at 112 (`$70`), 7 tiles in, and the camera then moves exactly with them. There is no easing and no look-ahead;
  the drift *is* the easing.
- **Never left.** The screen's left edge is a wall: `ChkPOffscr` pushes the player back when they would leave it.
  Everything scrolled off the left is gone — enemies despawn, blocks are forgotten. That rule is what makes a
  level a one-way ribbon and makes "go back for the mushroom" impossible, which simplifies everything else.
- Standing on a moving platform adds the platform's dx to the scroll decision.
- The world streams in 32-px columns (two tiles) as the scroll crosses each boundary; the camera position is
  `pageLoc·256 + x`, three bytes, and so is every object's.

## Constants (NES, 60 fps)
| | per frame | per second |
|---|---|---|
| walk cap | 1.5 px | 90 px/s |
| run cap | 2.5 px | 150 px/s |
| water cap | 1.0 px | 60 px/s |
| walk accel/decel (`$98`) | 0.037 px/f² | 134 px/s² |
| fast accel/decel (`$D0`) | 0.051 px/f² | 183 px/s² |
| run accel (`$E4`) | 0.056 px/f² | 200 px/s² |
| skid | ×2 of the above | 268–400 px/s² |
| run latch | 10 frames after B released | |
| jump launch | −4 / −5 px | −240 / −300 px/s |
| gravity holding A | 0.125 / 0.156 px/f² | 450 / 562 px/s² |
| gravity released | 0.4375 / 0.5625 px/f² | 1575 / 2025 px/s² |
| terminal fall | 4 px | 240 px/s |
| standing / running jump height | 64 / 80 px | |
| swim stroke | −2 px; gravity 0.05 | |
| camera start / lock | screen x 80 / 112 | |

The sprite is 16 px (32 big); scaled to a 40-px small sprite (×2.5) the walk is 225 px/s, hold-gravity
1125 px/s², release-gravity 3900 px/s². Next to Sonic (gravity 788) and SM64 (900 at 40 px) the Mario *held* jump is
in the family and the *released* one is the heavy outlier — that snap-down is the Mario feel. Knobs: `walkCap`,
`runCap`, `adder` (one number: accel = decel), `skidFactor` (2), `holdGravity`, `releaseGravity`, `launchBySpeed`
(the two-row table), `cameraStart/Lock`, `oneWay` (true here).

## Edge cases to keep
- Acceleration and deceleration are the same number in the same state; only the skid doubles it. Do not add a
  separate friction knob until a game needs ice.
- The run latch (10 frames) means a quick B release mid-jump-prep still gives the run jump.
- Switch to the release gravity once past the apex even if A is still held — otherwise the fall floats.
- The "risen at least 1 px" test keeps a one-frame A tap from being a no-jump: the launch always happens, the cut
  happens a frame later.
- Clamp falling at 4 px/f: a 16-px tile and a 4-px step means no tunnelling with per-frame collision.
- Camera: test `dx > 0` from the *player's* movement, not the input; being pushed back by a wall never scrolls.
- Objects that cross the left edge are deleted, including power-ups; that is a feature, keep it behind a flag.
