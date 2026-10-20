# Study · Mario Tennis (Game Boy Color) · the ball, the swing, the rally AI, and the score

Learned from the gerbiljames disassembly, `github.com/gerbiljames/mario-tennis-gbc-disasm` at commit
`7f9ab5e7d040c5f867cd67aa732b1d99b56b2c21`, which is fully labelled and ships its own engine write-up,
`docs/match_engine.md` (every claim there carries a `bank:$addr`). Sources checked against it:
`src/engine/match/ball_effects_08.asm` (`StepBallPhysics`, drag, spin, bounce, net),
`src/engine/match/shot_power_07.asm` (`ExecuteShot`, `WeakenShotByCharge`, `BoostShotByCharge`,
`ShotTypePresets_07`), `src/engine/match/execute_07.asm` (`ComputeShotTrajectory`),
`src/engine/match/char_input_08.asm` / `char_movement_08.asm` / `char_states_08.asm` (the swing and the
mover), `src/engine/match/ai_rally_08.asm` / `ai_serve_08.asm`, `src/engine/match/point_08.asm`
(scoring), and the trajectory tables under `src/data/shots/`. No code taken. 60 frames per second
(the GBC's 59.7). World units: the court is modelled at **105 units per metre** (inferred in the doc from
five court constants, and gravity agrees); this note keeps units and gives metres beside them.

## Why this one
"Tennis", "volleyball", "baseball", "ping-pong" — every bat-and-ball game on the floor is this machine:
a ball with gravity, drag, spin and a bounce; a swing that is a button pressed in a window; a shot that
is *looked up*, not thrown; a little opponent that runs to where the ball will land. The lookup is the
idea worth stealing: the game never solves for a launch velocity at runtime. It chooses *where* the ball
should land and reads the speed and elevation that get it there from a table indexed by distance.

## State
Ball: `x, depth, height` (16.16; depth 0 at the net, height negative-up), velocity triple (24-bit, read
as 1/256 units/frame), `topspin`, `sideSpin` (coefficients), `bounceCount`, `quadrant` (which side of
the net, which lateral half), `hitEvent`, `bounceEvent`, `crossedNet`, `touchedNet`, `targetX`,
`targetDepth` (where the solver meant it to land — the AI's main input), `rallyLength`.
Per character: `x, depth, height`, velocity, `facing` (256 = full turn), `state` (8 states × phases),
`swingFrames` (the charge), `button1/button2` (the buffered swing), `aimOffset` (−2..+2), `reachX`,
`reachHeight`, speed/accel/decel stats, and the AI timers.

## The ball, each frame (`StepBallPhysics`)
1. Remember last position. `pos += vel` on three axes.
2. Fence bounce (apply the court damping twice), then the **net test**: depth sign changed this frame?
   If so and `height + netHeight ≥ 0` (at or below the net top, net = 96 units = 0.91 m): X velocity
   ÷ 4, depth position reflected, and by contact height: within 6 units of the top → set to the top,
   kicked up by `|vDepth| / 8 + rand(0..1020)`, continues forward at ¼ depth speed (the dribbler); the
   next 2 units → same kick, depth velocity negated and ÷ 8 (pops back); lower → negated ÷ 8 (drops on
   the hitter's side). Sets `touchedNet`.
3. Rebuild `quadrant` from the signs. Heading = `atan2(vX, vDepth)`, pitch from the horizontal speed.
4. **Drag**: `b = (speed3D >> 12) + 1`; each axis `v −= (v / 2) · b / 256` — proportional to speed.
5. **Spin**: side spin adds `−k · vDepth` to `vX` and `+k · vX` to `vDepth` (the slice curve); topspin
   rotates the (horizontal, vertical) pair the other way (Magnus dip). Both coefficients decay by
   `3/256` per frame.
6. Airborne: `vHeight += 0x4A00` of the 24-bit word = **0.289 units/frame² = 9.9 m/s²**. On or through
   the ground: horizontal velocity × court `friction`, vertical × court `restitution` (two bytes per
   court, 0..255/256), reflect the penetration, negate `vHeight`, raise `bounceEvent`; if the upward
   speed is below `0x250` the ball comes to rest.

## The swing
- Input is `(dpad held) | (buttons newly pressed)`; there is no release information, so **charge is the
  number of windup frames**, not hold time.
- Button buffering with a **5-frame simultaneity filter**: A and B on the same frame = both; a second
  press within 5 frames of the first = both; a different button after the filter = a two-button combo.
  Button pairs map to 15 shot types: A topspin, B slice, A→A power topspin, B→B power slice, A→B lob,
  B→A drop, A+B neutral (upgrades to a smash when the ball is high and in the cone), reach versions near
  the net, three serves (A / B / A+B).
- Fewer than 5 windup frames = a **quick swing** (different animation, flagged). `charge = min(windup,
  63)`.
- Geometry picks the animation: ball predicted beyond `reachX` and the stick held that way → **dive**
  (lunge, contact box ×1.25, shot speed −3072, no power strokes); ball high relative to `reachHeight`
  → jump smash; else forehand / backhand.
- Three nested boxes, tested every frame (depth / lateral / height, in units):
  `swing range < 160 / 1.5·reachX / —` (may start a swing); `contact window < 96 / reachX / 2·reachHeight`
  (the racket connects); `body < 16 / reachX/2 / reachHeight` (hit by the ball: depth velocity ÷ 16,
  X and height ÷ 2, the character freezes, point lost).
- Recoil after every stroke: steering suspended until the animation ends, depth velocity ÷ 4.

## The shot solver (`ExecuteShot` → `ComputeShotTrajectory` → a table bank)
1. **Target depth** past the net by shot type: ground strokes 640 (6.1 m), power strokes and neutral
   960 (9.1 m), smash 1088 (10.4 m), lob and drop 512 (4.9 m), serves 672 (the service line). Then
   charge bends it: ground strokes `−4 · charge`, lobs `+12 · charge`; plus `±vDepth / 16` of the
   hitter's own run.
2. **Target X**: five-way by the stick (`aimOffset` −2..+2 → full-left … full-right), magnitude
   `(spreadBase + |depth| / 8) · aimScale / 256` with `spreadBase` 544 singles / 800 doubles — deeper
   hitters swing it wider — clamped to the court limit + 32, plus a jitter `rng · jitterScale / 16`
   **for the human too** (a character stat, not difficulty).
3. `aimAngle = atan2(depth leg, X leg)`. Distance window along that line: rows for landings between
   320 (3 m) and 1152 (11 m) past the net, `row = distance / 64` (0.61 m per row); shortened where the
   line crosses the sideline.
4. **Speed budget**: per-shot-type table row (by the character's power stat) + a pace term (a fraction
   of the incoming depth speed, forced negative — a fast incoming ball *lowers* the budget) + charge,
   `±vDepth / 2`, `−3072` diving, floor 256.
5. **Row search**: from the shallowest legal row, step deeper while `row.speed < budget` and
   `row < rowMax` — *the farthest landing the budget pays for, capped at the deepest legal one*. The row
   gives launch speed, elevation and a lateral delta; a spin pair comes from the placement table. If
   even the shallowest row costs more than the budget, a fallback table drops a short lob-like shot.
6. Tables: `[placement variant][contact height band (32 bands of 16 units)][distance row]`, 6-byte
   rows `(speed, elevation, aimDelta)`, one bank per family; the smash has no table (elevation = angle to
   the landing point + a per-power offset). Court does not change the tables, only the two damping bytes.

Build the solver as: pick landing point → distance → look up `(speed, elevation)` from a curve fitted
once offline (or at load) under your own gravity and drag. Then the ball always lands where you said.

## The mover
Acceleration and max speed per axis scaled by `cos/sin(facing)` so the cap follows the run direction;
no acceleration while the shown facing is more than `0x30/256` (42°) from the desired one — turn, then
run; velocity ÷ 8 while charging a swing. Court bounds are hard (X within ±928, depth 144..1760 on the
near side, mirrored far side) and **refused per axis**, so a diagonal push into a wall slides along it.
Jump gravity `0x90` per frame on the 24-bit character height. CPU characters skip the sideline bound.

## The AI (`CharInputHandler1_08` and friends)
A **fake controller**: it writes the same input byte the human's state machine reads, so every swing,
movement and contact rule applies. Per rally, five phases:
1. **Reaction delay**: `(near net ? delayNear : delayFar) + rng(0..3)` inert frames. Difficulty sets
   `delayNear 28 → 2`, `delayFar 24 → 2`, `tracking 12 → 0` frames, and the **aim-away chance 23 % → 90 %**;
   nothing else reads difficulty.
2. **Position by strategy** (a per-character byte, 0..7): behind the landing spot (`+192` beyond it),
   rush to it (`−352` short, depth floored at 256), intercept at mid-court (depth 512) or near the net
   (256), slide laterally to the ball's line, or adaptive (net player: intercept and chase drops/lobs;
   baseliner: stay behind and chase lobs only). Landing = the solver's `target*`; the X along the line is
   `(depth − ballDepth) · tan(aimAngle) + ballX` — it reads the shooter's intent, not the live heading.
3. **Track**: steer toward the target with the d-pad quantised to 16 sectors; advance on arrival or when
   the ball is in swing range.
4. **Pick a shot**: lob incoming → A+B (smash if in range); else half the time, when the opponent is
   inside depth 480 (he came to the net) and the ball is deep enough → A→B lob; else a 16-entry
   button-pair table by the character's style. First button now, second after exactly 5 frames.
5. **Swing**: keep homing on the ball while outside the contact window; on the contact frame, aim:
   `2/4` away from where the opponent is *moving*, `1/4` away from where he is, `1/4` at him — gated by
   the aim-away chance.
Between rallies: home position (baseline 1120, mid 384, or hold at the net), X = `targetX / 4`.
Serve: walk to one of eight baseline spots, toss with A, strike after a 35- or 50-frame gap (a per-style
probability; the long gap means a higher contact and a power serve), buttons 3/8 topspin, 2/8 slice,
3/8 flat, aim 50/50.
Doubles: the forward partner poaches if the ball enters its swing range or sits more than 32 units
deeper than the partner; the baseliner parks in the opposite lateral half at ∓192.

## Scoring (`point_08.asm`)
- Point end is a fall-through ladder on each bounce: second bounce → winner for the striker; bounced on
  the striker's own side → net; out of bounds → out; a serve that did not change lateral half → out;
  a serve that touched the net and landed → let (replay). Body hit → the hit player loses. Returning a
  serve before it bounces, or by the wrong player, is a point against.
- The **serve box** is just the normal out-test with the limits temporarily set to the service line
  (672) and singles width until the serve is returned, when `rallyLength` becomes 2.
- First fault → replay with the fault flag; second → double fault. Faults and lets award nothing.
- `win = (a − b ≥ 2 and a ≥ min)`: game `min 4`, deuce at 3-3 and 4-4 resets to 3-3; tiebreak `min 7`,
  6-6 ↔ 7-7; set `6 games, 2 clear` (short sets 2), tiebreak at 6-6; match best of 1 / 3 / 5. Game, set
  and match point are found by **dry-running the scoring code** on a saved copy of the score with each
  possible winner — no hand-written "is it match point" rule.
- Ends change after every odd game; the service box flips with the point count's low bit.

## Knobs the line will turn
Gravity, drag `b`, court `friction` / `restitution`, net height, the five target depths, `spreadBase`,
`jitterScale`, the charge weights (−4 / +12), the three contact boxes, AI `delayNear/Far`, `aimAwayChance`,
strategy byte, the 5-frame combo filter, `min` and `clear` in the scoring rule.

## Edge cases to keep
- Two swings cannot hit the ball in one frame: the hit event is a one-frame flag, first writer wins.
- The net test uses the sign change of depth between frames, not a distance, so a fast ball never
  tunnels the net.
- A ball at rest (upward speed below threshold) must stop integrating or it jitters on the floor.
- The AI's five-frame second-button delay exists only so the combo filter reads A-then-B; keep both or
  neither.
- The serve must bounce before it is returned; test `bounceCount == 0` at the second hit.
- Deuce is not a "situation": only game/set/match point change the music.
