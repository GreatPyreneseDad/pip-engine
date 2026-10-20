# Study · Link's Awakening DX (Game Boy Color) · the walk, hearts, damage and the knockback rule

Learned from the Hysm25 `LADX-Decompile` C decompilation, commit `f94840f19fcd2f11947b0a4f1e9d0bf101524cfb`, files
`src/bank2/link_motion.c` (walking, airborne control, slow ground), `src/home/link.c` (fixed-point position update),
`src/bank3/entities_collision.c` (`CheckLinkCollisionWithEnemy`, `ApplyLinkCollisionWithEnemy`),
`src/bank3/entities_physics.c` (knockback vector), and the zladx `LADX-Disassembly`, commit
`2a5c2c0d6df93a54df81ae9e1fe28b5c2fd60d03`: `src/code/bank2.asm` (speed tables at 02:48C5, health drain at 02:6342,
map-transition thresholds), `src/code/bank0.asm` (`UseRocsFeather`, 00:14CB), `src/data/entities/damages.asm`,
`src/data/entities/health.asm`, `src/constants/memory/wram.asm`. Cross-checked against spannerisms `jpdasm`
(A Link to the Past, SNES), commit `4535f694752d1469ede65083e986ce2101945264`, `bank_07.asm` (`SubVelocityValues`
at 07E210, damage application at 078096) and `bank_06.asm` (`AttemptDamageToLinkPlusRecoil`, `BumpDamageGroups`).
No code taken. 60 fps assumed (the Game Boy is 59.7). Speeds in both games are 4.4 fixed point: `$10` = 1 px/frame.

## Why this one
Every top-down game on the floor is "a guy who walks, gets hit, and has hearts". Three things make the hit
legible and fair: the walk has no momentum (so the kid is never fighting inertia in a corridor), the hearts drain
visibly rather than vanish, and a hit is a *push* with a *mercy window*, not a number.

## State the player keeps
`x, y` (sprite top-left; the body is 16 × 16, collisions use an 8 × 8 core), `vx, vy` (4.4 fixed), `z` and `vz`
(height above the floor; used for jumps and ledges), `facing` (4 directions), `inAir`, `health` (in eighths of a
heart), `maxHearts`, `subtractBuffer` and `addBuffer` (damage and healing waiting to be applied), `mercy`
(invincibility frames), `knockback` (frames of forced movement left), `groundKind` (normal, slow, pit, water...).

## The walk (`OverheadWalkPhysics`)
- On the ground, speed is **set directly from a table** indexed by the held D-pad bits; there is no acceleration.
  Release → instant stop. Cardinal **1 px/frame**; diagonal **0.75 px/frame per axis** (magnitude 1.06, i.e. the
  classic "diagonal is a touch faster" with the 12/16 ≈ 1/√2 approximation). A speed power-up uses 1.25 / 0.9375.
- Facing changes to the pressed direction; with two directions pressed the table resolves it (horizontal wins).
- **Slow ground is a frame mask, not a speed.** The position update is skipped on frames where
  `frameCounter & mask != 0`: mask 1 → half speed (slow walking, carrying a bird), mask 3 → quarter speed (a jelly
  stuck to you), mask 7 → eighth speed (slipping into a pit); "slow" tiles use `groundKind = 3` and move on 3 of
  4 frames. Cheap, deterministic, and it looks like trudging because the sprite steps in bursts.
- Sub-pixel position: each axis keeps an 8-bit accumulator; the integer part of the speed moves the sprite, the
  fraction accumulates and carries. Our `dt` version is just `x += vx·dt`.

## In the air (`ApplyLinkGroundMotion`)
A jump (feather) sets **`vz = 2 px/frame`**; gravity is **`−2/16 = −0.125 px/frame²`** every frame; land when
`z` goes negative. That is 16 frames up, 16 down, **16 px** of height (one tile) and 32 frames of air. In the air
the horizontal speed does not snap: each axis **approaches** the D-pad target by **1/16 px/frame per frame** (16
frames from standstill to full walk), which is the only acceleration in the whole mover. Pits and enemies are
ignored while `z > 0` (you can jump over both).

## Hearts
`health` counts **eighths of a heart** (`$08` = one heart); `maxHearts` starts at 3 and caps at 14. Damage and
healing never touch `health` directly: they go into `subtractBuffer` / `addBuffer`, and once per **2 frames** one
eighth moves from the buffer to `health` (the meter visibly ticks; a full heart drains in 16 frames ≈ 0.27 s).
Healing is the same tick upward and stops at the cap. Pickups: small heart +1 heart, fairy +6, heart container
+8 and `maxHearts += 1`, "full heal" = a large buffer. Death when `health` hits 0 *after* the drain, so a fatal
hit still plays its knockback.

## Damage to the player (`ApplyLinkCollisionWithEnemy`)
1. **Collision gate.** Enemy contact is tested only on alternate frames per entity (`frame ^ index` parity), only
   when `z == 0`, and only when the player is interactive (not in a dialog, not transitioning). Box test: the
   enemy's hitbox (per-entity offset and half-size) against the player's **8 × 8 core** (half-size 4 around the
   sprite centre). Harmless entities and a player mid-fall are skipped.
2. **Already in knockback?** `knockback > 0` → ignore (except for two bosses that keep shoving).
3. **Mercy.** If `mercy > 0`, or immune, or playing music / receiving an item → ignore.
4. **Amount.** Each enemy has a *health group*; the group indexes a damage table in eighths: **4** (half heart),
   **8** (one), **12**, **16** (two), **24** (three), **32** (four hearts). Modifiers: defensive tunic halves it;
   a defensive power-up halves it and zeroes half-heart hits, and power-ups expire after **3 hits**.
   `subtractBuffer += amount`.
5. **`mercy = 80 frames`** (1.33 s). Flicker during mercy is drawn from this timer.
6. **Knockback.** Speeds are *set* (not added) to a vector pointing from the enemy to the player, length
   **1.25 px/frame** (`$14`; one boss uses 1.5), and `knockback = 16 frames`. While `knockback > 0` input is
   ignored, the speed is applied each frame, and a wall collision zeroes that axis (you slide along the wall, you
   do not stop dead). Total push ≈ **20 px**. Dash state is cancelled.
7. Hazards use the same buffer with **4** (half heart). Spikes (`HurtBySpikes`) *reverse* the current speed
   instead of aiming away, add a small hop (`vz = 1`, 16 frames of forced motion) and give a shorter mercy of
   **48 frames**; a pit fall takes 4 and returns the player to the room's entry point.

```
   contact ──gate──▶ knockback>0? ──no──▶ mercy>0? ──no──▶ damage→buffer, mercy=80, knockback=16, v=1.25 away
                        │ yes                │ yes
                        ▼                    ▼
                      ignore               ignore          each frame: buffer→health 1/8 per 2 frames
                                                                        knockback-- ; v applied, walls zero an axis
                                                                        mercy--
```

The lesson, same as `sm64-action-states.md`: a hit is **four effects with four clocks** — the drain (8 frames per
half heart), the push (16 frames), the input lock (same 16), and the mercy (80). They overlap but are separate.

## Projectiles vs the player (`CheckLinkCollisionWithProjectile`)
A 12 × 12 overlap test (±6 from both centres). If the shield is up and the player faces *opposite* to the
projectile's travel direction, it is deflected: no damage, a "ting", and the projectile is marked dead (arrows
and beams unload at once). Otherwise it is a normal hit (step 4 above) and the projectile dies.

## Cross-check: A Link to the Past (SNES)
| | LADX (GBC) | ALttP (SNES) |
|---|---|---|
| walk | 1.0 px/f, diag 0.75/axis | **1.5 px/f**, diag **1.0/axis** (`SubVelocityValues` $18/$10) |
| slow modes | frame mask (½, ¼, ⅛) | separate speed rows: stairs 0.625, carrying 1.25, pushing 0.25–1.0, ice slip |
| dash | boots: build-up, see `alttp-dash.md` | charge **29 frames**, then **4 px/f** (diag 2.625) |
| hearts | eighths, drained 1 per 2 frames | eighths, **subtracted at once**; 20 hearts max |
| contact damage | by enemy group, tunic halves | by enemy group × **armour level**: `BumpDamageGroups` rows e.g. 8/4/2, 16/8/4, 32/24/16 eighths for green/blue/red mail |
| mercy | 80 frames | **58 frames** (`$3A`) |
| knockback | 1.25 px/f for 16 frames | **1.5 px/f for 19 frames** (`$18`, recoil timer `$13`) |

What differs is the *resolution*: the SNES walks half again as fast and adds a per-situation speed row instead of
a frame mask; the Game Boy drains hearts for drama. Both keep the same four clocks.

## Numbers (LADX, converted)
| | per frame | per second |
|---|---|---|
| walk | 1 px | 60 px/s |
| walk, diagonal (per axis) | 0.75 px | 45 px/s |
| air control approach | 1/16 px/f² | 225 px/s² |
| jump launch (vz) | 2 px | 120 px/s |
| gravity | 0.125 px/f² | 450 px/s² |
| jump height / airtime | 16 px / 32 frames | 0.53 s |
| knockback speed | 1.25 px | 75 px/s |
| knockback duration | 16 frames | 0.27 s |
| mercy | 80 frames | 1.33 s |
| heart drain | 1/8 heart per 2 frames | 3.75 hearts/s |
| player core hitbox | 8 × 8 (sprite 16 × 16) | |
| projectile test box | 12 × 12 | |

Scaled ×2 for a phone (32-px sprite): walk 120 px/s, knockback 150 px/s, gravity 900 px/s² — again right next to
Sonic's 788 and SM64's 900. Knobs: `walkSpeed`, `diagonalFactor` (0.75; 0.707 for honest), `mercyFrames`,
`knockbackSpeed/Frames`, `drainRate` (0 = instant like the SNES).

## Edge cases to keep
- Set knockback speed, never add it: two enemies touching at once must not double the push.
- Zero one axis on a wall hit during knockback; stopping both axes pins the player against the wall for 16
  frames and reads as a freeze.
- Mercy starts at the hit, not at the end of the knockback (SM64 does the opposite; both work, pick one).
- The half-speed frame mask must skip the *position update*, not halve the speed, or diagonal rounding drifts.
- Contact checks only when `z == 0`: jumping over an enemy is a promise the kid will test immediately.
- Damage in the buffer still applies after the enemy is gone; death is decided when the drain finishes.
- Pit fall: damage 4, return to the room's entry position, and the fall animation is itself a no-hit window.
