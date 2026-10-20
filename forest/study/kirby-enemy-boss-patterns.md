# Study · Kirby's Dream Land (Game Boy) · enemies as velocity schedules, and the boss as a cycle of moves

Learned from ElectroDeoxys' `kirbydreamland` disassembly, commit `dba74416a66e4641204073276c0330f07b30cf12`.
Files: `src/macros/script.asm` (the motion-script bytecode), `src/data/scripts/motion_common.asm`,
`src/data/scripts/normal/motion_scripts.asm`, `src/data/scripts/extra/motion_scripts.asm` (every enemy and boss
pattern), `src/home/home2.asm` (object property blocks), `src/data/scripts/normal/anim_scripts.asm` (boss health
refill), `src/engine/bank05.asm` (boss hit counting). No code taken. ~60 fps, velocities in px/frame.

## Why this one
Mega Man 2's note (`megaman2-object-pool-gravity.md`) gives the *pool*; this gives the **behaviour**. Every enemy in
the game is a short list of `(frames, vx, vy)` rows with a few branches: no AI, no steering, no state machine in
code. That is exactly the right level for a kid's "make the bird go in a wave": the pattern *is* the data, and a
child can edit a row and see the arc change. Bosses are the same thing with sub-moves called in a fixed order and a
health bar made of hit-counts.

## The object record
Each enemy slot: `x, y` (relative to the level), `vx, vy` (8.8), an animation script, a **motion script** pointer and
its program counter, a frame countdown for the current row, and a property block: `flags (gravity? sinks in water?
relative-pos)`, collision box (standard **12 × 12**), `damage to player (1)`, `hp (1)`, `interaction bits
(vulnerable, inhalable)`, `score (200)`, and what to spawn on death. Two property blocks are swapped by scripts:
"standard" (no gravity, flies the path literally) and "standard + gravity" (the path is an impulse; gravity bends it).

## The bytecode (what a row can do)
| op | meaning |
|---|---|
| `vel frames vx vy` | set velocity, hold for `frames`; **frames = 0 means "hold until something else changes it"** (the row never ends) |
| `jump / jumpRel / call / ret` | sequence control; `call` lets a boss reuse a sub-move |
| `jumpRandom p% addr` | with probability p take the branch — chains of these pick 1-of-N |
| `branchKirbyPos L R` | branch on whether the player is left or right of me |
| `branchKirbyVertical` | branch on whether the player is roughly level with me |
| `jumpIfFlags / jumpIfEqual var` | read a global (boss hp, player facing) |
| `createObject anim motion props` | spawn a child (projectile, minion) with its own scripts |
| `setProperties block` | swap the property block (turn gravity on/off, change hitbox, make vulnerable) |
| `setAnim / sfx / position / repeat` | presentation and placement |
Velocities come from a fixed menu: 0.125, 0.25, 0.5, 0.75, 1.0, 1.25, 2.0, 3.0, 4.0 px/frame in each direction
(7.5 → 240 px/s). Nine speeds × four directions is enough for the whole bestiary.

## The patterns, as rows
- **Walker**: one row, `vel 0 ±0.25..1.0 0` with gravity on; the engine's wall bump flips it. 0.25 px/f = 15 px/s is
  the slowest thing in the game and the first enemy a kid meets.
- **Hopper**: gravity on, then a hand-drawn arc while drifting 0.75: `8 f at −3.0, 8 at −1.25, 8 at −0.5, 8 at +0.5,
  8 at +1.25, 7 at +3.0`, then a 32-frame walk, loop. The arc is drawn, not simulated: ~48 frames, ~36 px tall.
- **Waiting swooper**: `80 f still`, then an accelerating dive `−3.0, −1.25, −0.75, 0, +0.75, +3.0, +1.25, +0.75`
  (8–10 f each) while x grows 0.25 → 3.0: a hesitation, then a committed swoop that exits at full speed.
- **Diver that waits for you**: fall 2 f at 1.25, `branchKirbyVertical` — not level yet → loop; level → swoop toward
  the player's side in 6-f steps 0.5, 1.0, 2.0, then 3.0 forever. The whole "it saw me" moment is one branch.
- **Sine flyer**: nine 4-frame rows cycling `vy = −0.25, 0, +0.25, +1.0, +0.25, 0, 0, −0.25, −1.0` while `vx` wobbles
  0.5–1.25: a 36-frame wave, amplitude ~6 px. No trig anywhere.
- **Loop-the-loop bird**: `40 f still`, then 16 rows of 8 f tracing a circle (`vy −3 … +3`, `vx −2 … +2`), loop.
- **Random jumper**: `jumpRandom 25%`, then `33%`, then `50%` → four equally likely arcs (left/right × strong/weak),
  each 6 rows of 4 f (−4.0 → +4.0 vertical ramp). Chaining per-step odds is how 1-of-4 is spelled.
- **Projectiles**: puff `16 f 3.0, 8 f 0.75, 8 f 0.125, stop`; spit star `0 f 3.0` (forever); a pellet `8 f 4.0, 8 f
  2.0, 10 f 0.5, end` — ranged attacks are *decelerating* schedules so they have a visible range.
- **Recoil**: `2 f +4.0, 4 f 0, 2 f −4.0, 0` — a thing that got hit twitches back and returns in 8 frames.

## A boss
```
 entrance (fixed rows, ~150 f)      refill meter: 1 bar every 10 f with a tick sound
            │
            ▼
   loop:  call sweep → call dive → call pause+spawn → call sweep2 → repeat
            ▲                           │
            └── each sub-move is a list of 3-frame rows (a smooth curve) ──┘
```
- **Health = bars × hitsPerBar.** `bars` 3, 6, or 8; `hitsPerBar` 1 (most) or 5 (the one you can only puff at,
  so 40 puffs). Each registered hit increments a counter; when it reaches `hitsPerBar` a bar is removed and the HUD
  redraws. A hit also sets `hurtTimer` (5 f palette flash on colour hardware, 30 f shake otherwise), during which the
  boss is not hittable again.
- **The ammo is spawned by the boss.** The "pause" sub-move waits 40 f and `createObject`s a 1-HP minion on the
  player's side (`branchKirbyPos`), with gravity, walking toward the player at 0.75. The kid inhales it and spits it
  back: a boss you cannot hurt bare-handed, that politely hands you the rock.
- The sweep is ~130 rows of 3 frames drawing a figure-eight (`vx` ramps ±1.25, `vy` ±1.25, with 6-f holds at the
  extremes). Three frames per row at 60 fps is the sweet spot where a drawn curve reads as smooth.
- Order is fixed, so after one loop the kid can predict it; randomness here is only in *where* the minion lands.

## Edge cases to keep
- `frames = 0` rows are the idle state; make them explicit so a script that "runs out" does not freeze with a stale
  velocity.
- Property swaps mid-script are the hard part on a canvas: gravity on/off must be a per-object flag read by the
  shared mover, not two mover classes.
- Branches read the *player's* position at that frame only; a pattern never tracks continuously. That is why these
  enemies feel fair — they commit.
- Spawned children get their own scripts and die with the normal rules; a boss's minion is just an enemy with a
  parent pointer so clearing the room can clean it up.
- Scores stack: swallowing two things in one inhale pays `score × 2` on the second (see `kirby-inhale-float.md`).
