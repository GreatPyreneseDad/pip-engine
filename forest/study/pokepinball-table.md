# Study · Pokémon Pinball (Game Boy Color) · ball, flippers, mask collision, the ball saver, and a catch minigame driven by table state

Learned from pret's `pokepinball` disassembly, commit `0a6f6dca71548a726e6808250b303d9e97a8e2f8`.
Files: `engine/pinball_game.asm` (the per-frame order), `home.asm` (gravity, limits, mask collision, bounce,
spin), `engine/pinball_game/flippers.asm`, `home/tilt.asm`, `engine/pinball_game/ball_saver/*`,
`engine/pinball_game/object_collision/red_stage_resolve_collision.asm` (saver countdown, catch-mode triggers),
`engine/pinball_game/ball_loss/ball_loss_red_field.asm`, `engine/pinball_game/catchem_mode.asm` and
`catchem_mode/catchem_mode_red_field.asm`, `engine/pinball_game/timer.asm`. No code taken. ~60 fps; velocities are
8.8 fixed point in px/frame.

## Why this one
"Pinball" is a top-five request and the naive version (circle vs rectangles, random bounce) feels like soap. This
table has four small ideas that make a ball feel heavy: a **16-point ring test against a 1-bit mask** for walls, a
**rotate-into-normal-space bounce** with asymmetric damping, a **flipper force proportional to radius × swing
speed**, and a **ball saver** that is just a countdown drawn as a blinking light. On top sits a catch loop that is
pure table state: hit things to fill a meter, the meter spawns a target, hit the target three times. That structure
— *collect → reveal → hit N → reward* — is the generic pinball mode.

## State
Ball: `x, y` (8.8), `vx, vy` (8.8), `spin` (signed byte), `prevX, prevY`. Collision scratch: `isColliding` (count of
consecutive touching ring points), `normalAngle` (0..255 = full turn), `forceAmplification` (0 wall, 1 flipper/some
bumpers), `noCollisionApplied`. Flippers: `state` (8.8, 0 = down … 15 = fully up), `stateChange` per frame,
`xForce, yForce`. Tilt: three one-shot nudges with cool-downs. Saver: `seconds, frames`, `savesLeft`, `flashRate`.
Mode: `inSpecialMode, specialMode, specialModeState`, `tilesFlipped (0..24)`, `monHits (0..3)`, a `timer`
(mm:ss + frames) with `paused` and `ranOut`.

## Frame order
1. `vy += gravity` (`0x000B` = 0.043 px/f², **≈ 155 px/s²**); clamp each axis to ±7 px/f (420 px/s).
2. Tilt input (below).
3. Flippers: update both states, test the ball against the flipper masks, compute force.
4. Wall test (ring vs mask) → `normalAngle`, push-out deltas. A flipper hit overrides the wall's normal.
5. Table objects (bumpers, lanes, holes) → their own normals/forces/mode events.
6. If colliding: rotate `(vx, vy)` by `−normalAngle` so the normal points up, apply the bounce, add flipper force,
   rotate back.
7. Move: `pos += v`, with the per-frame step clamped to ±4.996 px so the ball never skips a wall.
8. Mode state machine, saver countdown, timer, HUD.

## Wall collision (ring vs mask)
The board is a 32-tile-wide grid of 8×8 collision tiles, each tile an attribute → a 1-bpp 8×8 mask (some tiles have
"special" masks that change with table state: a closed gate, a raised bumper). Sixteen points on the ball's rim are
tested against the masks; the longest **run of consecutive touching points** gives `isColliding` (0 = free) and the
run's first/last index looks up a **normal angle** and an **(dx, dy) push-out** from two tables. Longest-run instead
of any-touch means a corner graze picks the wall it is mostly against, and a ball half-inside a wall is pushed out,
not teleported.

## The bounce (in normal space, +y toward the wall)
- Moving away from the wall (`vy < 0`) → no-op.
- `|vy| ≥ 3 px/f` → rumble and a thud sound (the "hard hit" threshold).
- `vy' = −(vy/4 + amplification · vy/8)`: walls return **25%** of the normal speed, flippers and soft bumpers
  **37.5%**. Tangential velocity is kept, plus `spin/2`; new `spin = (vx_tangential · 4) >> 8` (spin is the top
  bits of tangential speed, so a ball rolling along a wall curls back on the next hit).
- Push the ball out by the table deltas before integrating.

## Flippers
`state` moves toward 15 (up) at `+0x333`/frame while held and toward 0 at `−0x333`/frame when released: **~5
frames** each way. The flipper's shape is pre-rendered for each of the 16 states as a radius mask and a normal-angle
mask over a 48 × 32 px window above each flipper (the right one is the left mirrored). On contact at radius bucket
`r` (0..19) with swing speed `Δstate`:
```
 yForce = radiusMagnitude[r] × (4·Δstate)      magnitudes: 0, 12, 28, 48, 56, 72, 92, 108, 112, 128 … 252 (/256)
 xForce = 0
```
so the tip throws ~20× harder than the pivot and a *held* flipper (Δ = 0) is just a 37.5%-damped wall. A negative
force (flipper moving down into the ball) is discarded. The force is added in normal space after the bounce. The
ball also tests the state it *was* in last frame and walks toward the current one, so a fast flip cannot pass through
the ball.

## Tilt (nudge)
Each of left / right / up has a counter 0..3: holding the key raises it one per frame and shifts the ball 1 px per
frame (max 3 px), then forces a cool-down until released. While a nudge is "pushing", a small force from a table
indexed by (which nudges, normalAngle) is added **only during a collision**, so nudging a ball in flight does nothing
and nudging one resting on a wall pops it loose. Three frames, three pixels, then nothing: that is the whole
anti-abuse rule.

## Ball saver
Started at **20 s** on every new ball; a slot prize can grant 30 / 60 / 90 s; a special mode grants 60 s with
unlimited saves. Counts down one frame at a time **only while the ball is on the table** (`x < 154`, i.e. not in the
launch lane). Light: steady at 10 s or more left, blink every 16 f from 5–9 s, every 4 f from 1–4 s, off in the last second. On a
drain with time left: "saved", re-launch, and `savesLeft −= 1`; after the second save the timer is cut to ~1 s so a
20-second saver cannot be farmed. On a drain with no saver: end-of-ball bonus (summary of catches, evolutions, lane
counts), then extra ball if banked, else next ball or game over. All special modes end on a drain.

## The catch mode as a state machine
```
 table idle ──(right lane passed ≥2 times, then ball sinks into the catch hole; or slot prize)──► START
   START: pick a target from the area's table (1/16 rare; a 1/16 × conditions legendary), timer = 2:00,
          saver = 60 s unlimited, 24 billboard tiles dark
   FILL:  bumper hit → flip 4 tiles (+100k); lane/spinner → flip some; 24/24 → REVEAL
   REVEAL: billboard shows the silhouette, then the target appears on the table with its own collision mask
   HIT×3: each ball contact with the target is a hit (+300k, hurt-anim lockout so one touch ≠ two hits)
   3 hits → CATCH: timer paused, capture animation, add to party/collection, text
   timer 0 at any step → ESCAPE: mode ends, table restored
```
`timer` is mm:ss:frames with a `paused` flag; a low-time sound plays under 10 s. The mode never changes the physics;
it only swaps which objects are present and what their hits mean, which is why it is cheap to add more modes
(evolution mode is the same skeleton with "collect 3 arrows, then hit the target").

## Edge cases to keep
- Clamp velocity per axis (±7) *and* the per-frame step (±5): the first bounds energy, the second guarantees the
  ring test sees every wall.
- Rotate into normal space for the bounce; never special-case horizontal/vertical walls. Diagonals come free.
- The saver only ticks while the ball is in play — a kid waiting at the plunger keeps the full 20 s.
- "Hard hit" feedback (`|vy| ≥ 3`) is the single biggest contributor to feel; wire it to a sound and a 1-frame shake.
- Count mode hits with a lockout timer on the target, not on the ball; otherwise a ball resting on it farms hits.
- Draining ends every mode. Pausing the mode timer during the catch animation is what makes the catch always complete.
