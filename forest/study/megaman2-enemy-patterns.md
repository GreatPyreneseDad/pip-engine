# Study · Mega Man 2 (NES) · the enemy pattern vocabulary

Learned from plasticsmoke's labelled ca65 disassembly of Mega Man 2 (github.com/plasticsmoke/megaman2-disassembly-ca65,
commit `e60e0ff403d5e6bd5b06911bdef4089c0d533194`). No code taken; the mechanisms and their constants are the subject.
This is the prey the earlier `megaman2-object-pool-gravity.md` note said it wanted: every enemy behaviour here is a
named routine in `src/bank0E_game_engine.asm`, dispatched by type through a 128-entry pointer table
(`entity_ai_ptr_lo/hi`, bank0E lines 2661–2692), with the shared helpers in `src/bank0F_fixed.asm`. Units in the
original are pixels per frame at 60 fps in 8.8 fixed point (one byte whole, one byte 1/256ths); below they are
converted to pixels per second. Positive vy is **up** in the original; the kit uses screen-down positive, so
signs below are already in our convention.

## Why this one
Every "make me a game with bad guys" on the floor needs enemies that *do something* without being smart: a thing
that paces a ledge, a thing that hops at you, a thing that hides and peeks, a turret that leads the shot. Mega Man 2
is the canonical vocabulary. Each enemy is about 60 lines of state machine on top of the same mover, and the whole
cast is maybe fifteen verbs combined with different numbers. Learn the verbs, expose the numbers, and the line can
build a hundred enemies that feel right.

## State every enemy keeps (`include/ram.inc`, the parallel arrays)
Beyond the pool fields from the earlier note (`x, y` in 8.8, `vx, vy` in 8.8, `flags` with facing in bit 6,
gravity in bit 2, contact/weapon collision in bits 0–1, shield in bit 3, `hp`, `anim`), each behaviour borrows three
bytes it uses as it likes:

| byte | what the behaviours use it for |
|---|---|
| `state` ($04E0) | a countdown timer, almost always; "0 means do the next thing" |
| `parent_slot` ($01xx) | the **phase** of the pattern (0 = walking, 1 = airborne, 2 = shooting …) or a child count |
| `hitbox_w/h` (spawn-side alias) | the launch velocity handed to a freshly spawned child, read once at its first frame |

Spawned children get the parent's position and facing copied in (`spawn_entity_from_parent`, bank0F 6071–6098) and
their type's default flags from the init table. The facing bit is the only "direction" an enemy has: `vx` is always
positive and the mover adds or subtracts it (bank0F 5755–5800). To turn around you flip one bit.

## The shared verbs (bank0F)
- **face the player** (`entity_face_player`, 5874–5889): sets the facing bit from the sign of (enemy x − player x),
  and leaves `|dx|` in a scratch byte that most patterns then read for their range checks.
- **aim at the player** (`calc_entity_velocity`, 6122–6221): given a speed `s`, the **dominant axis gets the full
  speed** and the other axis gets `s · minor/major`. This is Chebyshev aiming, not Euclidean: a 45° shot travels
  √2 faster than a straight one. It is cheap and it is what the whole NES generation feels like. The kit should
  offer both (`aim: "chebyshev" | "euclid"`).
- **probe the tiles** (`check_vert_tile_collision` 5915–5995, `check_horiz_tile_collision` 6000–6060): a point a
  given x-offset ahead of the facing side and a y-offset above/below is looked up in the tile map; solid snaps the
  entity to the 16-px tile edge and, for gravity objects, resets `vy` to a quarter pixel per frame downward so the
  next frame still reads "grounded". Walkers use two probes: one at their own height (wall ahead?) and one a body
  below the front foot (floor ahead?).
- **the mover** (`entity_physics_core`, 5729–5803): position += velocity, gravity if flagged, cull 8 px beyond the
  screen edge in the direction of travel. Every pattern ends by calling it.

## The vocabulary
Each entry: the pattern as a state diagram, the numbers, and where it came from.

### 1. Ledge-aware walker (Tanishi `tanishi_ai_main` 3099–3181; Springer `springer_ai` 5816–5916)
```
 [walk] --wall tile 12px ahead at own height---------> flip facing
 [walk] --no floor tile 12px ahead, 4..12px below----> flip facing
```
Probe distance 12 px ahead (Springer 8 px, 9 px down). Walk speeds: bare snail 1.28 px/f = **77 px/s**; Springer
0.25 px/f = **15 px/s**. Taking damage changes the walker: at any HP below 20 the snail sheds its shell, drops
8 px, and the bare form runs at 77 px/s. Springer adds a **hunt**: when the player is within 5 px of its height it
runs at 2 px/f = 120 px/s, and within 17 px horizontally it leaps (y −8, 112-frame = 1.9 s attack phase, shield off
during it, then back down 8 px and resume walking).

### 2. Hopper (Robbit `robbit_ai` 3846–3925; Petit Kerog `kerog_child_collision_check` 3234–3268)
```
 [rest N] --timer--> face player, launch (vx, vy) --> [air] --falling & floor hit--> stop x, [rest N]
```
| | vx | vy (launch, up) | rest |
|---|---|---|---|
| Robbit | 0.75 px/f = 45 px/s | 4.75 px/f = 285 px/s | 62 f = 1.03 s |
| Petit Kerog | 1.90 px/f = 114 px/s | 4.0 px/f = 240 px/s | 62 f |

Gravity is the stage's 0.25 px/f² (900 px/s²), so Robbit's hop lasts 38 frames and covers 28 px; the little frog's
lasts 32 frames and covers 61 px. The "falling" test is the sign of `vy` — a hopper only lands on the way down, so it
can't stick to the ceiling it launched through. Robbit's cycle is four phases: hop, land, then **three aimed shots
62 frames apart** (speed 2.05 px/f = 123 px/s, Chebyshev-aimed), then hop again (`parent_slot` counts 0→4).

### 3. Hop that lands on you (Fly Boy `fly_boy_ai` 4771–4842; Scworm `scworm_worm_ai` 6371–6438)
The hopper's vx is not a constant. It is **the horizontal distance to the player divided by 32**, with a fixed launch
vy, so the flight time is fixed and the landing point is the player:
```
 vy = 3.46 px/f (208 px/s)  →  airtime = 2·vy/g = 27.7 f  →  travel = 27.7 · dx/32 = 0.87 · dx
 vy = 4.00 px/f (240 px/s)  →  airtime = 32 f             →  travel = dx − rand(0..31)   (Scworm)
```
The division by 32 is a three-bit shift on the 6502; on a canvas, write `vx = dx / airtime` and the hop lands exactly.
Scworm subtracts a random 0–31 px first so a cluster of worms doesn't all land on the same spot. Fly Boy rests
71 frames (1.2 s) on the ground between hops with gravity turned off so it doesn't jitter.

### 4. Lunger (Shrink `shrink_lunge_start` 2723–2782)
```
 [sink: vy = 0.77 px/f down, 25 or 74 f] --> [lunge: toward player at 2.05 px/f for 20 f] --> sink
```
Three times in four the lunge is aimed (Chebyshev, 123 px/s); one time in four it uses a fixed table velocity. The
sink time alternates between 25 f (0.42 s) and 74 f (1.23 s) on a coin flip. That one-bit randomness is the whole
reason the pattern isn't learnable.

### 5. Sine swimmer (M-445 `m445_ai_entry` 2886–2938)
A 16-step cycle, each step **11 frames**, velocity taken from an 8-entry quarter-circle table (0.09, 0.37, 0.68,
0.89, 0.89, 0.68, 0.37, 0.09 px/f for x; the same numbers reversed for y). Steps 4–11 negate the vertical, so over
176 frames (2.9 s) it draws one period of a wave while drifting in its facing direction. It re-faces the player only
at the cycle start, and only if the player is within 3 px of its height. For the kit: `kind: "sine"` with
`period: 2.9, amplitude from the table, drift: 20 px/s`.

### 6. Hanger-and-swooper (Batton `batton_ai` 3767–3844)
```
 [hang: shielded, 62 or 156 f] --> [swoop: aimed 0.51 px/f] --passed player--> [rise: 2 px/f up until ceiling] --> hang 62 f
```
Shield bit 3 is set while hanging, so the basic shot bounces off and only a swooping bat can be hurt. Swoop speed is
slow (31 px/s); the threat is the aim. The rise is 120 px/s straight up to the first ceiling tile.

### 7. Homing drifter (Telly `telly_ai` 4472–4484)
Re-aims at the player **every 16 frames** at 0.26 px/f (15.5 px/s). Between re-aims it goes straight, so a moving
player makes it draw a polygon. Spawned by an invisible spawner every 218 frames (3.6 s) with at most 3 alive
(`telly_spawn_ai` 4453–4469).

### 8. Hide / peek / shoot / walk (Neo Metall `blocky_phase2_*` 5148–5245 — mislabelled in the source; Sniper Joe `sniper_joe_ai` 6288–6340)
```
 Metall:  [hidden, shield on, face player] --player within 64 px & timer--> [open 62 f] --> fire 3-way spread
          --> [wait] --> [walk at 2 px/f for 20 f toward player] --> [hidden for 31|62|155|31 f]
 Joe:     [shield up 126 f] --> [open 31 f] --> shot --31 f--> shot --31 f--> shot --> shield up
```
The spread is three children with velocities (2, 0), (1.64, ±1.14) px/f — 120 px/s straight, 98/68 px/s on the
diagonals. Joe's shots are 2 px/f straight. The shield is `flags` bit 3; the buster handler checks it before
damage and deflects instead (see the player-hit note). Everything about these two is **timing**: the open window is
the whole game.

### 9. Mortar (Crazy Cannon `crazy_cannon_ai` 6049–6153)
Fires a gravity shell with vy = 4.9 px/f up (294 px/s) and **random vx = (24 + rand & 0x23) / 48 px/f**, i.e.
0.5–1.23 px/f (30–74 px/s), six shells 31 frames apart, then a pause. Range varies shot to shot, so the player
can't stand in the one safe spot.

### 10. Leading mortar (the fire boss's burst, bank0B `heatman_spawn_projectile_loop` 248–292)
Three shells with fixed launch vy of 7.21, 5.66, 3.46 px/f (433/340/208 px/s). Their flight times under 0.25 px/f²
gravity are 58, 45, 28 frames — exactly the divisors in the speed table — and each gets `vx = aimOffset / flightTime`
with aim offsets of dx+32, dx, dx−64. So the three land 32 px behind, on, and 64 px in front of where the player
stands. This is the general formula for any lob: **pick the airtime, then vx = horizontal target / airtime.**

### 11. Trap (Press `press_ai` 4862–4921; Appear blocks `appear_block_*_ai` 6451–6504)
Press: when the player is within 40 px horizontally, gravity on and drop; on landing wait 43 frames (0.7 s); retract
at 0.38 px/f (23 px/s) until the ceiling; rearm. Appear blocks: visible for 125 frames, then gone for 125/187/250
frames depending on the variant — three blocks with three periods make the famous staircase.

### 12. Spawner (Telly 4453, Fly Boy 4752, Scworm nest 6343, Kerog 3190)
The shape is always: `if timer == 0 and alive(child type) < cap: spawn; timer = period`.
| spawner | period | cap | extra condition |
|---|---|---|---|
| Telly | 218 f (3.6 s) | 3 | — |
| Fly Boy | 125 f (2.1 s) | 2 | — |
| Scworm nest | 32 f (0.53 s) | 3 | player within 72 px |
| Kerog (frog) | on its animation beat | 1 petit alive to start a volley | spawns 3 at once with vx 4.08 / 2.55 / 1.63 px/f — a fan |

Caps are enforced by counting live entities of the child type (`find_entity_count_check`, 3013–3026), not by the
spawner remembering what it made. That survives children dying off-screen.

### 13. Pusher (Matasaburo `matasaburo_wind_push` 5282–5297)
Not a projectile: while the player is on its facing side, a conveyor flag pushes the player at a fixed speed. A
"field" enemy — the kit's `kit.wind` would be this.

## Constants worth keeping as presets
| | per frame | per second |
|---|---|---|
| stage gravity (all enemies and shells) | 0.25 px/f² | 900 px/s² |
| slow walker | 0.25 px/f | 15 px/s |
| walker | 1.28 px/f | 77 px/s |
| runner / shot | 2.0 px/f | 120 px/s |
| aimed shot | 2.05 px/f | 123 px/s |
| homing drifter | 0.26 px/f | 15.5 px/s |
| swoop | 0.51 px/f | 31 px/s |
| hop launch | 4.0–4.75 px/f | 240–285 px/s |
| mortar launch | 4.9–7.2 px/f | 294–433 px/s |
| rest between hops / shots | 62 f | 1.03 s |
| shield cycle (Joe) | 126 up / 31 open | 2.1 s / 0.5 s |
| spawner period | 125–218 f | 2.1–3.6 s |
| aggro range | 40, 64, 72 px | — |

## Things learned that are not built yet
- Every enemy's HP defaults to 20 because the init routine writes 20 into a timer slot that aliases the HP array
  (ENGINE.md §7). Our pool should make `hp` explicit per kind.
- Off-screen enemies keep damage and respawn on re-entry (earlier note). Spawners that count live children make
  this cheap.
- Boss-class patterns (phase machines with hit reactions) are in `megaman2-boss-phases.md`.

## Edge cases to keep
- A hopper lands only when `vy` points down **and** a floor probe hits. Without the sign test it sticks to ceilings.
- Face-the-player is called once per cycle, not every frame. Enemies that re-face every frame jitter when the
  player stands over them; the 16-frame Telly re-aim is the fastest anything here turns.
- Probe one body-height below the *front* foot, not the centre, or the walker turns a full body late at a ledge.
- Spread shots are spawned on the enemy's facing side; copy the facing bit into the child or the diagonals go
  backwards.
- Shield state is a flag the *weapon* checks, not the enemy. Hiding enemies set it; the hit routine deflects. Keep
  it that way so any projectile kind can respect any shield.
- Spawner caps count live children by kind; never trust a counter on the spawner.
