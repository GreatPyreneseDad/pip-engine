# Study · New Super Mario Bros. (DS) · what a modern 2D platformer adds: the velocity model, the power-up ladder, the verb bits, and star-coin gating

Learned from the NSMB-Decomp `nsmb` decompilation, commit `9c7c0b341ae87f860df090e1e35d720f06c70bfa`, files
`src/Bases/Actor.hpp` / `Actor.cpp` (the velocity model), `src/Bases/StageEntity.hpp` / `StageEntity.cpp` (collision
verb bits, entity defaults), `src/Bases/Coin.cpp` (a complete small physics object), `src/Bases/Player/PlayerBase.cpp`
(`checkAndApplyPowerup`, `applyPowerup`), `src/common.hpp` (`POWERUP_*`), `src/AAA.hpp` (`GameSave`),
`src/worldmap/scene.hpp` and `src/worldmap/controller.cpp` (node/path flags). No code taken. DS: 60 fps.
Numbers are **fx32**: 12 fractional bits, `0x1000` = 1.0 = one pixel; velocities are px/frame.

**Honesty first.** At this commit the decomp has the engine's base classes, items, coins, a few enemies and the
world map, but **not the player's own movement code** (`PlayerActor.cpp` is a 14-line stub). The constants for the
wall jump, wall slide, ground pound and triple jump are therefore *not* in the prey yet. Below, everything with a
number is cited; the four moves are described only as *shapes*, flagged `[shape, unverified]`, to be filled in
when the player overlay is decompiled. Do not build a plugin from the unverified parts.

## Why this one
The 1985 game (`smb-physics-scroll.md`) is one body, one jump, one way to hit things. Twenty years later the
same series had: a general velocity-toward-target model every object shares, six power-up states with a transition
table, a dozen *kinds* of hit (stomp, ground pound, slide, shell, mega, fireball, star…) that each enemy opts in
or out of with a bit, and a collectible that gates the map instead of a score that gates nothing. That is the
difference between "a Mario level" and "a Mario game", and all four are engine shapes, not content.

## 1. The velocity model (`Actor`)
State per actor: `position`, `lastPosition`, `velocity`, `minVelocity` (badly named: it is the **target** or
**limit** the velocity is pulled toward), `acceleration` (a per-frame impulse vector that decays), `accelH`,
`accelV` (the per-frame rates), `velocitylimit` (hard cap), `scale`, `direction`.
- **Approach, don't add.** `updateHorizontalVelocity`: move `velocity.x` toward `minVelocity.x` by `accelH` per
  frame, never overshooting. `updateVerticalVelocity`: `velocity.y += accelV`, floored at `minVelocity.y`. So
  "walk right" is `target.x = +speed`, "stop" is `target.x = 0`, "ice" is a smaller `accelH`; the same two lines
  do accelerate, brake and skid. The clamped variants (`StepVelocityXClamped/YClamped`) approach a target without
  crossing it in either direction, for things that must settle exactly.
- **Impulses decay.** `attenuateAcceleration` exponentially lerps the impulse vector toward 0 (rate `0x200`,
  threshold `0x4000`, floor `0x100`): a knockback or a bounce is an impulse that fades, added on top of the
  steady velocity, so a hit never overwrites the walk.
- **Hard cap**: `velocitylimit = 8 px/frame` on each axis (`0x8000`); applied after acceleration, before position.
- Order per frame: `applyAcceleration` (velocity + impulse, capped) → `applyVelocityToPosition` → the object's
  own update sets next frame's targets.

Entity defaults (`StageEntity` constructor): gravity `accelV = −0x300` (**0.1875 px/f²**), terminal
`minVelocity.y = −0x4000` (**4 px/f**), collision verbs `0x107` (entity, stomp, block, fireball…). A thrown or
bumped entity "hop" is `velocity.y = 0x2000` (2 px/f); item slide acceleration `accelH = 0x100` (1/16 px/f²).

A complete small object, the coin (`Coin.cpp`): popped from a block it launches at **3 px/f up** (`0x3000`) under
gravity 0.1875; a dropped coin launches at `(±1, 3.25)` px/f with gravity `−0x280` (0.156) and terminal 8; on each
landing `vy` is taken from a 4-entry bounce table and `vx` halves; after **3 bounces** it stops; a wall flips `vx`.
That is the same bounce idiom as the Game Boy pot (`ladx-blocks-lift-throw.md`) with one more table.

## 2. The collision verbs (`StageEntity::CollisionType`, `ObjectInfo::EntityProperties`)
Modern hits are a **bitfield of verbs**, not a stomp test. Each entity declares which it accepts
(`collisionType`) and which it is immune to (`properties`):

| verb | what the player did | immunity bit |
|---|---|---|
| Stomp | fell onto it | — |
| GroundPound | slammed down from a pound | `NoGroundPound` |
| Sliding | slid into it on a slope | `NoSliding` |
| BlueShell | shell-dashed into it | `NoBlueShell` |
| Mega | touched it while giant (`MegaKick` for kicks) | `NoMega`, `NoMegaKick` |
| MGP (ground / air, per player) | mega ground-pound shockwave | — |
| Starman | touched it while invincible | `NoStarman` |
| Fireball | hit by a fireball | `NoFireball` |
| SpinDrill / FenceSlam | spin-drill from above / slam through a fence | enable bits |
| Entity / Block / StageBeaten | hit by another entity / a bumped block / the level ended | `NoLevelBeaten` |
| Immune | ignores every collision | `Immune` |

The player side resolves *which* verb this contact is (falling → Stomp, pounding → GroundPound, …) and the enemy
side answers with its bits. Adding a move to the player means adding one bit, not touching forty enemies. This is
the single most reusable idea in the repo for a kids' engine: `kit.hit(verb)` with per-enemy accept/immune sets.

## 3. The power-up ladder (`checkAndApplyPowerup`)
Six states: `SMALL 0, SUPER 1, FIRE 2, MEGA 3, MINI 4, SHELL 5`. A pickup proposes a new state; the table decides:

| pickup → | accepted from |
|---|---|
| SUPER (mushroom) | SMALL, MINI only (a big player gets points, not a change) |
| FIRE | SMALL, SUPER, MINI |
| SHELL | anything but SHELL |
| MINI | anything but MINI |
| MEGA | anything |
| SMALL (a hit / demotion) | always |
| *anything* while MEGA | **refused** |

`applyPowerup` is a two-step: it writes `runtimePowerup` (the pending state) and returns whether it differs from
`powerup`; the visible change happens later in the player's own update (the grow animation), and is refused while a
particular animation (`_7a9 == 5`) is running. The save file carries both the current `powerup` and an
`inventoryPowerup` (one stored item) — the modern "reserve slot".

```
   SMALL ──mushroom──▶ SUPER ──flower──▶ FIRE          any ──mega──▶ MEGA (nothing else accepted while it lasts)
     ▲        ▲          │  ▲             │            any ──mini──▶ MINI ──mushroom/flower──▶ SUPER/FIRE
     │        └──shell───┼──┘             │            any ──shell──▶ SHELL
     └──────hit──────────┴────────────────┘  (hit: one step down; the kit's choice whether FIRE → SUPER or → SMALL)
```

## 4. Star coins and the gated map (`GameSave`, world-map flags)
- The save holds `starCoinsCollected` and `starCoinsSpent` as counters, plus per-level bits
  (`NS_StarCoin1/2/3` on each node's state byte). Three per level; collected ones persist even if the level is
  failed afterwards (the bits are on the node, not the run).
- World-map **paths** carry flags; `canEntityTransitLink` refuses a path whose unlock flag is unset, and
  `canEntityStopAtNode` only stops on nodes flagged as a course with star coins (castles are pass-through). The
  save's `starCoinsSpent` is the other half: the wallet is `collected − spent`, and unlocking a flagged path is a
  spend that sets the path flag. (The map object that charges the price is not in the decomp yet; the two halves
  it joins are.) That is the whole gating economy: a collectible that is also a currency, spent on the map, never
  in the level.
- Also in the save: `lives`, `coins`, `score`, `tempScore` (the running level score before it is banked),
  `powerup`, `inventoryPowerup`, per-world `worldStates`, per-node `nodeStates[8][25]`, per-path `pathStates[8][30]`,
  and `miniMushroomUnlocked`. A kids' game needs a fraction of this; the shape (counters + per-node bits + per-path
  bits) is the part to copy.

## 5. The four moves `[shape, unverified at this commit]`
What the engine's bits and the velocity model imply, with no numbers claimed:
- **Wall slide**: while airborne and pressing into a wall, cap the fall (a smaller `minVelocity.y`) and play the
  slide pose; **wall jump**: a jump input during the slide sets `velocity = (away × speed, up)` as a fresh launch
  and briefly ignores the stick, so the kid cannot cancel it back into the wall. A jump-buffer and a short
  "stick to wall" grace make it forgiving.
- **Ground pound**: a down input in the air stops horizontal motion, hangs for a few frames (an upward impulse
  that decays), then falls at a fixed fast speed; landing resolves a `GroundPound` verb against enemies and blocks
  under the body and a brief landing lag.
- **Triple jump**: consecutive jumps landed within a short window while running step through launch strengths
  (the SM64 landing-window idea in `sm64-action-states.md`), the third with a flip and no steering.
- **Ground pound / mega ground pound** have per-player bits in the verb set (`MGPGroundP0/P1`, air variants), which
  tells us the shockwave is resolved as a *collision type* sent to every entity in range, not as a special case.

## Numbers that are in the prey (DS, 60 fps)
| | per frame | per second |
|---|---|---|
| entity gravity | 0.1875 px/f² | 675 px/s² |
| entity terminal fall | 4 px | 240 px/s |
| hard velocity cap | 8 px | 480 px/s |
| entity hop | 2 px | 120 px/s |
| item slide acceleration | 1/16 px/f² | 225 px/s² |
| block coin pop | 3 px up | 180 px/s |
| dropped coin | (±1, 3.25) px, gravity 0.156, 3 bounces, vx halves | |
| impulse decay | exp-lerp rate 0x200/0x1000 per frame | ≈ 12%/frame |
| fixed point | 0x1000 = 1 px | |

Entity gravity 675 px/s² for a 16-px body sits between Mario-NES held (450) and released (1575): modern platformers
run one medium gravity and get the snap from the velocity-approach model instead of two gravities. Knobs:
`accelH` (walk vs ice), `targetSpeed`, `gravity`, `terminal`, `impulseDecay`, the verb bits per enemy, the
power-up table, `starCoinsPerLevel` (3) and `pathCost`.

## Edge cases to keep
- Velocity approaches a target; impulses are separate and decay. Never let a hit overwrite the steady velocity.
- The hard cap applies after acceleration and impulses, before the position step.
- Power-up proposals are *pending* until the animation can run; refuse while another is playing.
- Immunity bits are per enemy, verbs are per contact; resolve the verb on the player side once per frame.
- Star coins are bits on the node, banked on collection, spent only on the map; the wallet is `collected − spent`.
- Everything above about the player's moves is shape only until the player overlay lands in the decomp; re-check
  `src/Bases/Player/` at a later commit before writing `kit.platform` presets from it.
