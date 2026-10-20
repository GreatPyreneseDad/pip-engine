# Study · Link's Awakening DX (Game Boy Color) · enemy archetypes on a grid: wanderer, shooter, jumper, pouncer, flyer

Learned from the zladx `LADX-Disassembly`, commit `2a5c2c0d6df93a54df81ae9e1fe28b5c2fd60d03`, files
`src/code/entities/03_moblin.asm` (`AnimateRoamingEnemy`, shared by three ground enemies), `03_octorok.asm`,
`06_tektite.asm`, `06_stalfos_aggressive.asm`, `06_keese.asm`, `src/data/entities/health.asm`, and the Hysm25
`LADX-Decompile`, commit `f94840f19fcd2f11947b0a4f1e9d0bf101524cfb`, `src/bank3/entities_physics.c`
(`AddEntitySpeedToPos_03`, `BouncingEntityPhysics`, `func_003_6B7B` gravity, `GetVectorTowardsLink_with_length`),
`src/bank3/entities.c` (`ConfigureNewEntity`). No code taken; the state machines and their numbers are the subject.
60 fps assumed; entity speeds are 4.4 fixed point (`$10` = 1 px/frame), the same unit as the player.

## Why this one
A kid asks for "monsters" and means four or five behaviours, not forty. This game's bestiary is built from a
handful of tiny state machines sharing one entity record, one physics step, one hit-reaction, and one random
timer idiom. Build the five below and most "make a monster that…" requests are a parameter change.

## The shared entity record
Every entity, enemy or not, has: `x, y, z`, `vx, vy, vz` (4.4 fixed, with per-axis sub-pixel accumulators),
`direction` (0 right, 1 left, 2 up, 3 down), `state` (small integer, the machine's node), `privateState1..5`
(scratch), `countdown` (the one general-purpose timer; "transition countdown"), `privateCountdown1..3`,
`inertia` (a free-running counter used for animation and turn hysteresis), `health`, `healthGroup`,
`hitbox (offX, halfW, offY, halfH)`, `physicsFlags`, `status` (inactive, dying, falling, burning, init, active,
stunned, lifted, thrown), `ignoreHits`, `flash`, `recoilVx/Vy`, `collisions` (bits for wall contact this frame:
up/down/left/right). All of it comes from per-type tables at spawn (`ConfigureNewEntity`): physics flags, hitbox,
health group → initial health, options.

## The shared step, in every handler, in this order
1. draw (sprite pair by `direction` and animation bit);
2. return if not interactive (room transition, dialog, inventory);
3. **recoil step** if `ignoreHits > 0` (see `ladx-sword-shield.md`); most ground enemies also force
   `state = standing, countdown = 64` here, which is the visible stun;
4. **damage collision**: player contact on alternate frames, then weapon box test;
5. the type's own state machine;
6. move by speed, then **background interaction** (push out of solid tiles, set `collisions` bits, fall into pits,
   sink in water).

Gravity for anything with a `z`: `vz −= 2/16` per frame for bouncing objects (`func_003_6B7B`), `vz −= 1/16` for the
light jumper below; landing is `z < 0` → `z = 0`. Bounce: `vz = −vz/2`, stop when the rebound is under 7/16; `vx, vy`
halve per bounce.

Randomness is always `GetRandomByte & mask | base`: a window `[base, base+mask]` with uniform spread. Timers are
frames.

## 1. Wanderer / shooter (`AnimateRoamingEnemy`; speed 0.5 px/frame)
```
          countdown expired or wall hit                countdown expired
  WALK ──────────────────────────────────▶ STAND ─────────────────────────▶ WALK (new direction)
  (vx,vy = ±0.5 in `direction`,           (speed 0; countdown = 16..31;
   countdown = 32..63)                      at countdown == 10, if facing the player: SHOOT)

  hit (ignoreHits > 0) ─▶ STAND with countdown = 64 (from any state)
```
- Choosing the new direction: a 2-bit cycle; **every fourth decision faces the player**, the other three are
  random. That ratio is why the thing feels like it is hunting you but can be walked around.
- Walking distance per leg: 32–63 frames × 0.5 = **16–32 px**, i.e. one to two tiles; a wall ends the leg early.
- The shooter variant fires once per stand, 10 frames before the stand ends, and only if its facing equals the
  direction toward the player (so it never fires diagonally). Projectile: spawned one half-tile ahead, **2 px/frame**
  (`$20`) in the facing direction; it dies on walls, on the shield, or on the player.
- Sprite animation flips on `inertia` bit 3 (every 8 frames). The same handler, with a different sprite table and
  the shot disabled, is two more enemy types.

## 2. Jumper (`Tektite`; hops in random directions)
```
  GROUND ──countdown (16..79) expired──▶ launch: vz = 1.0..1.44, (vx,vy) = (±1, ±1) random diagonal,
     ▲                                     50%: instead aim at the player with speed 1.25
     │                                   ▼
     └──────── z < 0 (land): speed = 0, countdown = 16..79 ──── AIR: z += vz; vz −= 1/16 each frame
```
- Walls while airborne: reflect the axis and **halve** it (`−v/2`), so it slides along corners instead of sticking.
- Idle animation on `inertia` bit 4 (every 16 frames). Airtime at `vz = 1`: 32 frames, 8 px of height; the hop
  covers ~32 px — two tiles — which is exactly one grid step beyond the player's sword reach.
- It is immune to nothing; the hop *is* the defence, because contact is only checked when the player's `z == 0`
  and the sword box is at ground level.

## 3. Stalker / pouncer (`StalfosAggressive`)
```
  WAIT ─countdown─▶ STALK ──|dx|<28 and |dy|<28──▶ LEAP ──vz < 2 (apex)──▶ HANG ──16 frames──▶ DROP ──z ≤ 0──▶ REST
                  (every 4th frame re-aim         (vz = 2.5; xy = 1.0        (vz forced to −4,     (32 frames,
                   toward the player at 0.5)       toward the player;         speed 0)              speed 0)
                                                   gravity 2/16)
```
- The stalk is a **homing walk**: the velocity vector is recomputed toward the player's current position every
  4 frames with fixed magnitude 0.5 (`GetVectorTowardsLink` with length 8). No pathfinding; walls stop it.
- The trigger window is a 56 × 56 box around the enemy. The leap aims where you *were* when it launched, so a
  sidestep dodges it — that is the intended counter.
- Landing from the drop (`vz` more negative than −3) spawns a landing effect.

## 4. Flyer (`Keese`)
```
  REST ──player inside 64×64──▶ FLY ──countdown (80..143) expired──▶ GLIDE (32 frames) ──▶ REST
         (heading = toward player)   (speed from a 16-step circle, radius 0.875 px/frame;
                                      heading index ±1 every 10 frames; random turn flips)
```
- Flight direction is an index into a **16-point circle table** of `(vx, vy)`; turning is `index ± 1` every 10
  frames, so the path is a wobbly arc, not a straight line. The sign of the turn flips at random.
- Flyers ignore pits and floor types (`physicsFlags`), and their hitbox is small; the player hits them with the
  upper (diagonal) sword box as they dip. They start the flight aimed at the player, then drift — "aimed then
  random" again, like the wanderer's 1-in-4.

## 5. The hit reaction everyone shares
`ignoreHits = 10` with recoil 3 px/frame away from the player; `flash = 24`; ground enemies drop into STAND for
64 frames; death at `health ≤ 0` runs a 47-frame countdown with collisions off, then the loot roll. Health groups
0–15 give **1, 2 or 4** hit points; that is the only difficulty knob most enemies have besides speed.

## Numbers
| | per frame | per second |
|---|---|---|
| wanderer walk | 0.5 px | 30 px/s |
| wanderer leg | 32–63 frames (16–32 px) | 0.5–1.05 s |
| wanderer stand | 16–31 frames | 0.27–0.52 s |
| post-hit stand | 64 frames | 1.07 s |
| face-the-player ratio | 1 in 4 decisions | |
| projectile | 2 px | 120 px/s |
| jumper launch vz | 1.0–1.44 px | 60–86 px/s |
| jumper gravity | 1/16 px/f² | 225 px/s² |
| jumper xy | 1.0 per axis (1.41) or 1.25 aimed | 60 / 75 px/s |
| jumper rest | 16–79 frames | |
| pouncer stalk | 0.5 px, re-aimed every 4 frames | 30 px/s |
| pouncer trigger | 56 × 56 px box | |
| pouncer leap | vz 2.5, xy 1.0, gravity 2/16 | 150 / 60 px/s, 450 px/s² |
| pouncer hang / drop / rest | 16 frames / −4 px/f / 32 frames | |
| flyer wake | 64 × 64 px box | |
| flyer speed | 0.875 px | 52 px/s |
| flyer turn | one 22.5° step per 10 frames | 135°/s |
| flyer flight / glide | 80–143 / 32 frames | |
| bounce | vz → −vz/2, stop under 7/16; vx, vy halve | |

Player walks 1 px/frame: the wanderer is half speed, the projectile double, the flyer 7/8 — the whole cast is
tuned as fractions of the player's speed. Keep that ratio when scaling.

## Edge cases to keep
- Re-roll direction on *wall contact*, not on being blocked for N frames; the `collisions` bits make it one test.
- The 1-in-4 "face the player" must use the current direction toward the player, snapped to 4 directions; a
  diagonal player position picks the larger axis.
- The homing re-aim every 4 frames is what keeps the stalker from jittering; every frame looks like vibration.
- A jumper's wall reflect halves speed; a pure reflect makes it ping-pong forever in a corridor.
- Shots are only fired when the enemy's facing matches the direction to the player — never from a diagonal, and
  never while walking.
- Entities ignore the player (and vice versa) while `z > 0` on either side; airborne things cannot be hit or hurt
  unless their handler says so.
- All timers in frames, all windows `[base, base + mask]`; a `dt` game should accumulate frames, not seconds, or
  the windows drift at 30 fps.
