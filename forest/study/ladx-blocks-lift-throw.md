# Study · Link's Awakening DX (Game Boy Color) · pushing blocks, lift and throw, and the verb table that gates the world

Learned from the Hysm25 `LADX-Decompile` C decompilation, commit `f94840f19fcd2f11947b0a4f1e9d0bf101524cfb`, files
`src/bank3/entities_pushed_block.c` (`EntityInitPushedBlock`, `PushedBlockEntityHandler`, `func_003_52D4`),
`src/bank3/entities_physics.c` (`BouncingEntityPhysics`, `func_003_6B7B`), `src/home/link.c`
(`CheckStaticSwordCollision`, `GetObjectUnderLink`), `include/constants/physics.h` (`OBJ_PHYSICS_*`), and the zladx
`LADX-Disassembly`, commit `2a5c2c0d6df93a54df81ae9e1fe28b5c2fd60d03`: `src/code/bank2.asm` (push counter and
`TryOpenKeyDoor`, 02:742D–02:7447 and 02:53B0), `src/code/bank14.asm` (throw launch tables at 14:5313–14:5342 and
`func_014_53A3`), `src/code/entities/bank3.asm` (`EntityLiftedHandler`, 03:5732, lift timing tables at 03:56EA),
`src/code/entities/03_liftable_rock.asm`. No code taken. 60 fps assumed; speeds are 4.4 fixed point.

## Why this one
Pushing a block, picking up a pot and throwing it are the three "touch the world" verbs every kid expects in a
top-down game, and they are also how a world gets *gated*: this bush needs a blade, this rock needs the bracelet,
this door needs a key, this gap needs the feather. The gate is never a lock screen; it is a tile class that only
some verbs act on.

## The verb table (item gating)
Every 16-px tile has a **physics class** (`OBJ_PHYSICS_*`), and the player's verbs act on classes, not on tile ids:

| class | what it is | verbs that act on it |
|---|---|---|
| none | floor | walk |
| solid | wall | sword clinks (16-frame lockout) |
| removable obstacle (`$30`) | bush, rock, cracked block, sword crystal | bush: cut (sword) or lift (bracelet); rock: lift; crystal: hit; cracked: bomb |
| ledge (`$D0`+dir / `$10`) | a drop | walk off it in the allowed direction → hop; the feather jumps it |
| pit (`$50`), pit-warp (`$51`) | hole | fall (½ heart, respawn at the room entry) unless `z > 0`; the warp variant changes room |
| deep water (`$07`) | water | swim with flippers, else sink and respawn |
| shallow water, grass, stairs, conveyor, spikes, lava | floor variants | walk (slow / hurt / pushed / enter) |
| door closed (`$90`) | key / boss / bombable door | key door: push with a small key; boss door: boss key; bombable: bomb |
| door open (`$70`) | passage | walk |
| hookshotable (`$60`) | post | hookshot pulls to it |
| pushable block | movable block | push for 64 frames (below) |

So "do I have the item" is asked once, at the verb; and "what does this tile do" is a one-byte lookup. Items
*add verbs*, they do not edit the map. A sword upgrade changes a damage level, not a gate (`ladx-sword-shield.md`).
Small keys are a per-dungeon counter: pushing into a key door with `keys > 0` decrements it, marks the room's
status bit, swaps the door tile for its open variant with a puff, and the open state persists via the room byte.

## Pushing a block
State: a per-player push counter (`wC191`), and, once it fires, a short-lived **block entity**.
1. Walking into a pushable block tile sets the pushing pose and increments the counter every frame of contact
   (a *continuous* push; letting go resets it). At **64 frames** (1.07 s) the counter fires and resets.
2. Fire: spawn a block entity on the tile with `(vx, vy) = 0.5 px/frame` in the push direction (the direction from
   the block to the player, reversed). Immediately run its background collision: if the destination is solid, the
   entity is removed on the same frame and nothing happens (the block just does not move; the counter restarts).
3. While moving, the block pushes other entities out of its way with a small recoil (0.5 px/frame), carries the
   player's position along (`wIsLinkPushing`), and blocks input (`hLinkInteractiveMotionBlocked = 2`).
4. The entity counts `inertia` each frame; at **33 frames** (≈16.5 px, snapped to the grid by the collision step)
   it writes the block tile into the map one cell over, restores the floor tile where it was, and unloads.
   Rumble sound on fire; the tile change is what "moves" the block for the rest of the room's life.
5. If the room has a "push the block(s)" trigger, finishing a push checks the trigger (single block: any push;
   several: the block must end on a target tile) and marks the room solved.

```
  contact ──64 frames held──▶ spawn block entity ──destination solid?──yes──▶ unload (no move)
                                      │ no
                                      ▼
                            move 0.5 px/f for 33 frames, shove entities, drag player ──▶ write tile, unload, check trigger
```

## Lifting
Pressing the item button on a liftable tile (bush, rock, pot, sign) with the bracelet spawns a liftable entity at
the tile and runs the **lift animation in four stages**: `1, 8, 8, 16` frames (33 frames, 0.55 s) with a basic
bracelet, `1, 4, 4` (9 frames) with the upgraded one or a strength power-up. During each stage the object sits at
a per-direction offset from the player (behind → side → over the head); the player cannot move until the last
stage. Lifting a bush also removes its tile (the floor under it is revealed) and rolls the same **1/8 drop
chance** as cutting it. The carried object follows the player at the head offset; walking speed is unchanged
(walking with a *heavy* live thing on the head is the half-speed frame mask).

## Throwing
Pressing the button while carrying: the entity's status becomes *thrown*, its `thrownDirection` is the player's
facing, and speeds are set from a table:

| object | horizontal | vertical (vz) |
|---|---|---|
| pot / rock / most things | **3 px/frame** in the facing direction | 0.25 px/frame up |
| bomb | 1.5 px/frame | 1 px/frame up |

Then `BouncingEntityPhysics` each frame: move, gravity `vz −= 2/16`, background collision. A thrown pot or rock
**smashes** on the first of: `z` reaching the floor, or any wall contact (`collisions != 0`) — a 31-frame break
animation (15 for pots), physics switched to pass-through, loot roll. A bomb instead *bounces*: `vz → −vz/2`
(stop under 7/16), `vx, vy` halved per bounce, and it explodes on its own 160-frame fuse. While thrown, the object
is a weapon: `damageType = thrown`, and it tests the same hitbox machine as the sword against every enemy
(`ladx-sword-shield.md`); most enemies take 2–4 damage from it, which is why "throw the pot" is the first puzzle.
Thrown objects also trigger room events (a pot into a chest, a rock on a switch) via `EntityCheckThrowAtTriggers`.

```
  LIFT (33 f) ──▶ CARRY (follows head) ──button──▶ THROWN: v = 3, vz = 0.25, g = 2/16 ──floor or wall──▶ SMASH (31 f) ──▶ gone (+loot)
                                                     │ bomb: v = 1.5, vz = 1 ──floor──▶ bounce ×½ ──fuse──▶ explode
```

A pot leaves the hands at head height (the carry offset is a sprite constant, roughly a body) and travels
3 px/frame for the 18–24 frames it takes to fall that far at 2/16 px/frame² from a 0.25 start, i.e. **about
55–72 px, three to four tiles**. A wall anywhere on that line ends it early. That range is the design: longer
than the sword, shorter than the room.

## Numbers
| | frames / px | seconds / px·s⁻¹ |
|---|---|---|
| push to fire | 64 frames | 1.07 s |
| block speed / travel | 0.5 px/f × 33 frames = 16 px | 30 px/s |
| lift (basic / strong) | 1+8+8+16 = 33 / 1+4+4 = 9 frames | 0.55 / 0.15 s |
| throw speed | 3 px/f | 180 px/s |
| throw vz / gravity | 0.25 up / 2/16 per frame² | 15 px/s / 450 px/s² |
| throw range (from head height) | ≈ 55–72 px | |
| smash animation | 31 frames (pot 15) | 0.52 s |
| bounce | vz → −vz/2, stop < 7/16; vx, vy halve | |
| bomb throw | 1.5 px/f, vz 1 | 90 / 60 px/s |
| bush drop chance | 1/8, half hearts half rupees | |
| key door | 1 small key, persists in the room byte | |

Knobs: `pushFrames` (64 is deliberate friction — a kid must *mean* it; 20 feels like a slide), `blockSpeed`,
`liftFrames`, `throwSpeed`, `smashOnWall` (true for pots, false for bombs), the verb table itself.

## Edge cases to keep
- A push into a blocked destination must fail silently *and* restart the counter; do not move the tile, do not
  play the rumble.
- Write the tile change once, at the end of the slide; drawing the moving block is the entity's job.
- The pushed block shoves entities (recoil), including the player, so a monster cannot be trapped under it.
- The carried object's hitbox is off while carried (it is "lifted" status), on again the frame it is thrown.
- Thrown objects collide with walls from the *inside* of the room boundary too: a throw at the screen edge smashes
  on the edge, it does not leave the room.
- Only one carried object at a time; the bracelet level changes timing, never what can be lifted *here*
  (that lives in the tile's class).
- Lifting a bush rolls the drop; cutting it rolls the drop; the bush cannot be made to roll twice.
