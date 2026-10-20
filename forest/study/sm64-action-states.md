# Study · Super Mario 64 (N64) · the player's action state machine and what a hit does

Learned from the n64decomp `sm64` decompilation, commit `9921382a68bb0c865e5e45eb594d9c64db59b1af`, files
`src/game/mario.c` (set/execute action), `src/game/mario_actions_airborne.c` and `mario_actions_moving.c`
(knockback actions), `src/game/mario_step.c` (gravity, bonk), `src/game/interaction.c` (damage and knockback
selection), action encoding in `include/sm64.h`. No code taken; the shape is the subject, at the level of a
diagram. The original runs at 30 fps; per-frame speeds below are also given per second (×30, ×30² for
accelerations). The player is about 160 units tall.

## Why this one
Every character on the floor ends up with a tangle of booleans: `jumping`, `hurt`, `sliding`, `canJump`. Mario 64
has ~180 actions and no tangle, because an action is one word that says *which group it belongs to*, *what it is
immune to*, and *which function runs it*. The part a kids' game needs is not the 180 actions, it is the four
rules that keep them from fighting each other, and the one chain that makes a hit feel like a hit.

## The word
An action is a 32-bit id. Reading from the bottom:
- bits 0–5: index within its group;
- bits 6–8: **group** — stationary, moving, airborne, submerged, cutscene, automatic (poles, ledges, hanging),
  object (holding, throwing);
- bits 9–31: **flags** that say what is true while this action runs: `air`, `moving`, `stationary`, `swimming`,
  `intangible` (no interactions at all), `invulnerable` (no damage), `attacking`, `diving`, `hanging`, `on pole`,
  `idle`, `control jump height` (releasing jump cuts the rise), `allow vertical wind`, `short hitbox`, `throwing`.

So "is the player in the air?" is a flag test on the action word, not a separate variable that can drift out of
sync. In JS: `action = { group, flags }` where flags is a small set; the test is `has(action, 'air')`.

## State the player keeps
- `action`, `prevAction`, `actionArg` (a parameter the entry passes, e.g. damage taken), `actionState` (a sub-step
  inside the action), `actionTimer` (frames in this action).
- `pos`, `vel.y`, `forwardVel` (speed along facing; can be negative = moving backwards), `faceAngle`,
  `intendedYaw`/`intendedMag` from the stick.
- Timers: `doubleJumpTimer` (jump-chain window), `wallKickTimer` (5 frames after touching a wall in the air),
  `invincTimer` (post-hit mercy), `hurtCounter` and `healCounter` (health drains/refills over time, not at once),
  `squishTimer`, `peakHeight` (for fall damage).
- `health`: 0x880 max = 8 wedges of 0x100; below 0x100 is dead.
- Geometry inputs computed before any action runs: `floor`, `floorHeight`, `wall`, `ceilHeight`, `waterLevel`,
  and an `input` bitfield (A pressed, off floor, nonzero stick, above slide, squished, in poison gas…).

## Update order, each frame (`execute_mario_action`)
1. Reset body state; read inputs (buttons, stick → intendedYaw/Mag, geometry → input bits).
2. Special floors (lava, death plane, quicksand, wind).
3. **Interactions** (`mario_process_interactions`): for every object touched this frame, in a fixed priority
   order, run that interaction type's handler (coin, star, door, damage, bounce, grab…). The first one that
   changes the action wins. Damage is one of these handlers; it sets the new action *before* the action runs.
   `invulnerable` or an active `invincTimer` skips damage; `intangible` skips every interaction.
4. **The action loop**: dispatch on group → the group's executor runs common cancels (e.g. airborne: fell into
   water → water plunge; squished; vertical wind), then the action's own function. If the function reports that
   it *changed* the action, the loop runs again *in the same frame*. A frame can therefore pass through several
   actions (land → jump-land → jump) with no visible one-frame hiccup. There is no loop guard; the actions are
   written so it terminates.
5. Post: quicksand sink, squish, camera preset, **health tick** (−0x40 per frame while hurtCounter > 0, +0x40
   while healCounter > 0; then clamp), hitbox update.

## Entering an action (`set_mario_action`)
Setting an action is where momentum is *shaped*, so each action's physics is set once, at the door, not every
frame. The per-group entry hooks:

| group | what the door does |
|---|---|
| airborne | sets `vel.y` from a table and scales `forwardVel` (see below); records `peakHeight` |
| moving | walking from rest takes the stick magnitude (capped 8) as initial speed; "begin sliding" picks butt- or stomach-slide by facing vs slope |
| submerged | the metal-cap water jump sets vel.y = 32 |
| cutscene | a few canned launches (pipe exit 52, special exits 64) |
| any | clears sound-played flags, sets `prevAction`, `actionArg`, `actionState = 0`, `actionTimer = 0` |

Jump launches (`vel.y` is `base + forwardVel · k`, then forward speed is multiplied):

| action | vel.y base | + forwardVel × | forwardVel after | notes |
|---|---|---|---|---|
| jump | 42 (1260 u/s) | 0.25 | ×0.8 | |
| double jump | 52 | 0.25 | ×0.8 | |
| triple jump | 69 | 0 | ×0.8 | needs forwardVel > 20 |
| backflip | 62 | 0 | = −16 | |
| side flip | 62 | 0 | = 8, faces stick | |
| wall kick | 62 | 0 | min 24 | |
| long jump | 30 | 0 | ×1.5, cap 48 | lower gravity (2/frame) |
| dive | — | — | +15, cap 48 | |
| water jump | 42 | 0 | | |
| squished or in quicksand | halves any vel.y | | | double/triple become plain jump |

Gravity (`apply_gravity`): default **4 u/frame² (3600 u/s²)**, terminal −75 (−2250 u/s). Long jump and slide
kick 2/frame; lava boost 3.2 with terminal −65; while rising with `control jump height` and the button released,
vel.y is divided by 4 that frame (the variable-height cut). Metal cap under water 1.6, terminal −16.

A `vel.y` of 42 against gravity 4 gives a 10.5-frame rise and 220 u (1.4 bodies) of height; triple jump 69 → 17
frames, 595 u. Those ratios (jump ≈ 1.4 bodies, big jump ≈ 3.7 bodies) are what to copy, not the numbers.

## The chain (diagram)
```
                     A pressed            land (airStep = LANDED)
   IDLE ──stick──▶ WALKING ─────────▶ JUMP ───────────────────────▶ JUMP_LAND (4 frames; doubleJumpTimer = 5)
     ▲               │                 │                                  │ A within window
     │           off floor          hit wall ──▶ AIR_HIT_WALL ──A in 5f──▶ WALL_KICK_AIR
     │               ▼                 │                                  ▼
     └──────── FREEFALL ◀──────────────┘                            DOUBLE_JUMP ──land──▶ DOUBLE_JUMP_LAND
                     │                                                    │ A within window, forwardVel > 20
                 land                                                     ▼
                     ▼                                               TRIPLE_JUMP ──land──▶ TRIPLE_JUMP_LAND ──▶ IDLE
              FREEFALL_LAND ─A─▶ DOUBLE_JUMP  (a plain fall also counts toward the chain)

   any ───hit───▶ determine_knockback_action ──▶ {SOFT|normal|HARD} × {FORWARD|BACKWARD} × {GROUND|AIR|WATER}_KB
                                                     │ air KB lands ──▶ matching GROUND_KB
                                                     │ ground KB leaves ground ──▶ matching AIR_KB
                                                     │ air KB hits wall ──▶ speed negated, vel.y ≤ 0
                                                     ▼ animation ends
                                           IDLE (invincTimer = 30 if damage > 0)   or   DEATH if health < 1 wedge
```
Landing actions are data: each has a duration (jump-land 4 frames), the double-jump window it opens
(`doubleJumpTimer = 5` frames ≈ 167 ms), and the actions to go to on A, on falling off, on a slide floor, and on
a very steep floor. `set_jump_from_landing` then looks at `prevAction`: from a jump-land or freefall-land within
the window → double jump; from a double-jump-land with speed > 20 → triple jump (wing cap: flying triple jump);
otherwise a plain jump. The window is checked *before* the landing's own duration ends, so a buffered press
works — that is the whole "jump feels responsive" trick and it is the same coyote/buffer idea as Sonic's, done
with a per-landing timer.

Every action function also does a **step** — ground step or air step — and the step's result is the other
source of transitions: `NONE`, `LANDED`, `HIT_WALL`, `GRABBED_LEDGE`, `GRABBED_CEILING`, `HIT_LAVA_WALL` in the
air; `NONE`, `LEFT_GROUND`, `HIT_WALL` on the ground. Actions do not test geometry themselves; they ask the step.

## What a hit does to momentum (`take_damage_and_knock_back`, `determine_knockback_action`)
1. **Gate**: not if `invulnerable` flag, `invincTimer > 0`, vanish cap, or the object delays invincibility.
2. **Damage**: object's damage value (1–4). Without a cap on the head, +50% (rounded up). Metal cap → 0.
   `hurtCounter += 4 · damage`, so each damage point costs 4 frames × 0x40 = one wedge, *drained over 4 frames*
   rather than subtracted at once (the health meter visibly spins down).
3. **Camera**: shake by damage size (small / medium / large) and, in every case, the camera's follow speeds are
   set to 0 for the frame — the "hitch" (see `sm64-camera.md`).
4. **Direction**: face the object. If the player was facing within ±90° of it → *backward* knockback and
   forwardVel is negated (they fly away from what they faced). Otherwise → *forward* knockback and facing flips
   180° (they fly away, facing away).
5. **Speed floor**: forwardVel at least 16 (28 in water; in water also vel.y at least 20 if above the object,
   else vel.y ≤ 0). A "big knockback" object sets 40.
6. **Strength**: hard if remaining health (after the pending drain) is under one wedge or damage ≥ 4; normal if
   damage ≥ 2; soft otherwise. Terrain row: ground / air (also pole, hanging) / water.
7. **Drop** anything held and set the chosen knockback action with `actionArg = damage`.

Then the knockback action itself:
- **Air knockback**: every frame force forwardVel to ±16 (480 u/s; thrown variants keep their speed and decay
  ×0.98/frame), take an air step. Land → the matching ground knockback (hard if the fall was long). Hit a wall →
  bonk: facing reflects off the wall normal, speed negated, upward vel.y zeroed. A wall kick is still allowed if
  it was an air-hit-wall 5 frames ago.
- **Ground knockback**: speed clamped to ±32; while the animation plays, speed ×0.9 per frame; after the
  animation's "down" frame, speed is pinned to ±0.1 (a crawl so facing is preserved). Leaving ground → the matching
  air knockback. At the end: health < 1 wedge → death action; else → idle with **`invincTimer = 30` (1 s) when
  damage > 0**. The soft variants (bumping into a bully, a tripped punch) run 100 frames of animation and give no
  mercy timer.
- **Attack recoil** is the same idea in reverse: a landed punch sets forwardVel to −48 on the ground, −16 in the
  air, and hitches the camera.

The lesson for the kit: a hit is **four separate effects with four separate durations** — a drain (health over
4·damage frames), a launch (16 u/frame away, until landing), a lockout (the animation; no input), and a mercy
window (30 frames after). Most kids' games collapse these into one flash and one `hp -= 1`; separating them is
what makes the hit legible.

## Constants (converted, 30 fps)
| | per frame | per second |
|---|---|---|
| gravity | 4 u/f² | 3600 u/s² |
| terminal fall | 75 u/f | 2250 u/s |
| jump launch | 42 u/f | 1260 u/s |
| run speed contribution to jump | 0.25 × forwardVel | |
| forward speed kept on jump | 80% | |
| knockback speed (air) | 16 u/f | 480 u/s |
| knockback speed cap (ground) | 32 u/f | 960 u/s |
| ground knockback decay | ×0.9 | half-life 6.6 frames (220 ms) |
| double-jump window | 5 frames | 167 ms |
| jump-land duration | 4 frames | 133 ms |
| wall-kick window | 5 frames | 167 ms |
| post-hit mercy | 30 frames | 1.0 s |
| health drain | 1 wedge per 4 frames | 7.5 wedges/s |
| health | 8 wedges (0x880); <0x100 = dead | |
| water heal near surface | +0x1A/frame | about one wedge per 10 frames |

Scaled to a 40 px sprite (body 160 u → 40 px, factor 0.25): gravity 900 px/s², jump 315 px/s, knockback 120 px/s.
Those sit right next to Sonic's (788, 390) — the genre has converged.

## Things learned that are not built yet
- Steps as a service: `kit.platform` resolves collisions, but actions asking "what did the step return" is a
  cleaner contract than actions reading `onGround/hitWall` flags. Worth adopting when `kit.actor` exists.
- Landing actions as data (duration, window, exits) rather than code.
- Slopes: steep floors push the player off and redirect jumps (`set_steep_jump_action` rotates the launch).
- Holding/throwing is a whole parallel set of actions (`HOLD_*`), i.e. an orthogonal flag, not a copy.

## Edge cases to keep
- Several action changes per frame are normal; never render between them.
- Knockback must not re-trigger while in knockback (the KB actions carry `invulnerable`), and the mercy timer
  starts at the *end* of the knockback, not the start.
- A fall into water or onto a death plane cancels any action, before the action runs (common cancels first).
- `forwardVel` is signed: backward knockback is negative speed with unchanged facing, so the sprite still faces
  the enemy while flying away. Keep that; it reads correctly.
- Jump height is cut by dividing the rise by 4 on release, not by clamping — a softer cut than Sonic's.
