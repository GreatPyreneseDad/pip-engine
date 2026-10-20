# Study · Kirby's Dream Land (Game Boy) · the jump table, floating and the puff, inhale and swallow, and six bars of health

Learned from ElectroDeoxys' `kirbydreamland` disassembly, commit `dba74416a66e4641204073276c0330f07b30cf12`.
Files: `src/engine/bank01.asm` (player control, jump/float tables, knock-back table), `src/home/home1.asm`
(velocity integration, default constants), `src/engine/start_stage.asm`, `src/engine/bank05.asm` (inhale range,
pull, swallow, contact damage), `src/constants/misc_constants.asm`, `src/constants/kirby_constants.asm`,
`src/constants/item_constants.asm`, `src/data/scripts/motion_common.asm` (puff and star projectiles). No code taken.
Game Boy runs at ~60 fps; velocities are 8.8 fixed point in px/frame, converted below.

## Why this one
This is the kindest platformer ever shipped and the one small kids ask for by shape: a round thing that can **always
fly** (no pit can kill you), eats enemies instead of fighting them, and has a health bar of **six fat blocks** that
you can count. Sonic (`sonic-movement.md`) is about speed; this is about never being stuck. The inhale is a
vacuum-with-a-cone, the float is a second gravity with a tap-to-rise, and the whole thing fits in a dozen constants.

## State
`x, y, vx, vy` (8.8), `maxVx, maxVy, accX, decX, accY` (swapped wholesale when the mode changes), flags for
`grounded, airborne, jumpRising, hover, inhale, mouthful, spit, duck, faceLeft`, a `jumpFrame` index into the jump
table, `inhaleTime`, `hp (0..6), maxHp`, `blinkTimer`, `invincibleTimer`, `knockbackIndex`.

## Walking and gravity (defaults set at stage start)
| | per frame | per second |
|---|---|---|
| x acceleration | 0.125 px/f² | 450 px/s² |
| x deceleration | 0.055 px/f² | 198 px/s² |
| max run speed | 1.2 px/f | 72 px/s |
| gravity | 0.082 px/f² | 295 px/s² |
| max fall | 2.0 px/f | 120 px/s |
Each frame: `vy += accY`, clamp to `maxVy` (and to −1.3 px/f when rising under the float), then move.

## The jump is a table, not a launch
On A while grounded: `jumpFrame = 0`, and for the next 22 frames `vy` is **read from a table** instead of
integrated: 6 frames at −4.0, 6 at −3.0, 5 at −2.0, 5 at −0.5 px/f, then gravity takes over from a small −0.156
nudge. Full height ≈ 54 px. **Releasing A early jumps the index to 17** (the −0.5 phase), so a tap gives ~7 px and a
mid-release lands in between. This is variable height without any "cut velocity" rule: the designer draws the arc.

## Floating
Press Up when not inhaling or holding something → **hover** (the traced path; the shipped game also lets a
second A press in mid-air enter it). Mode swap: `maxVy = 0.797` (48 px/s
fall), `maxVx = 0.75` (45 px/s), `accX = 0.085`, `decX = 0.035`. Every frame while hovering:
- Up or A held → `accY = 0.313` upward, rise capped at **1.3 px/f (78 px/s)** — the puff
- otherwise → `accY = 0.08` downward, capped at 0.797
So the float is just gravity ×1 with a soft ceiling on fall speed, plus a strong upward acceleration on demand. It
is unlimited in time; the only exit is B.

**Exit (B while hovering)**: spit the air as a projectile — 16 frames at 3.0 px/f, 8 at 0.75, 8 at 0.125 (~55 px
reach) — and restore walking constants with `vy = 0`. The puff is Kirby's only attack while flying and it is weak:
bosses here take many puffs.

## Inhale
Press B (nothing in mouth, grounded or airborne, not hovering) → `inhale` on, `inhaleTime = 0`. Every frame, for
every active object on screen that is *not* immune and not already being pulled:
```
 |objY − kirbyY| < 20 px   and   0 ≤ (objX − kirbyX)·facing < 42 px     → start pulling it
```
So the mouth is a **42 × 40 box in front**, not a cone. Items that are "persistent" (doors, warp stars, goal items)
are excluded by id. The three nearest blocks ahead (16 px each) are also scanned; a breakable block type is
converted into a sucked-in star.

**The pull** (per pulled object, per frame): `vx += 0.117 px/f²` toward Kirby; `vy = (kirbyY − objY − 1) / 8` (a
pure proportional term, so it homes vertically in a few frames). Within **10 px** horizontally it is swallowed:
destroyed, `mouthful` on, score paid as `score × n` where `n` counts how many things this one inhale has eaten so far
(the second enemy in one breath pays double). If an inhale has run **31+ frames** with nothing caught and B is
released, Kirby just closes his mouth; if something was caught he keeps it.

Mouthful: can't float or inhale; B spits a **star** at 3.0 px/f (180 px/s) in the facing direction, which is the
real attack and hits anything vulnerable once. Down swallows for nothing (no copy abilities in this game).

## Health, hits, and the two rules
- `maxHp = 6` blocks by default (menu lets 1..?); refilled on stage start and by food.
- Contact with an enemy: Kirby takes `objDamage` (usually 1), `blinkTimer = 90` frames (1.5 s) of mercy, and a
  **knock-back** away from the object read from a table: 4, 3, 3, 2, 2, 2, 1, 1, 1, 1 px/f over 10 frames (~20 px).
  Enemies with the "vulnerable" bit *also* lose 1 HP on contact — nearly every walker has 1 HP, so **touching a weak
  enemy kills it but costs a block**. That trade is the whole beginner-friendliness of the game.
- Spikes are the exception: `hp = floor(hp / 2)` and a fixed 1.5 px/f bounce. Half, never zero from full.
- Invincibility item: 900 frames (15 s); a star particle every 8 frames while it lasts.
- `hp = 0` → lose a life (5 by default, 99 max); no fall-death because there is no floor you cannot float over.

## Edge cases to keep
- The jump table must be interruptible but never *reversible*: once at index 17 you cannot un-release.
- Swap the whole constant set on mode change (walk ↔ hover ↔ mouthful) rather than scaling: it keeps every mode a
  readable row in a table.
- Inhale range is in *screen* pixels relative to the facing direction; flip the sign, not the box.
- The swallow radius (10 px) is smaller than the pull box, so a pulled thing visibly travels before it vanishes.
- Contact damage and contact kill are the same event; resolve Kirby's hit first (mercy timer), then the enemy's.
- Mercy windows: 90 f after a hit, nothing during the hit-flash can hurt you — spikes included.
