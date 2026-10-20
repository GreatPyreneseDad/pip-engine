# Study · Link's Awakening DX (Game Boy Color) · rooms, edges, and the scroll between them

Learned from the Hysm25 `LADX-Decompile` C decompilation, commit `f94840f19fcd2f11947b0a4f1e9d0bf101524cfb`, files
`src/bank2/room_transition.c` (the transition state machine and its direction tables), `src/home/link.c`
(position update), and its source of truth, the zladx `LADX-Disassembly`, commit
`2a5c2c0d6df93a54df81ae9e1fe28b5c2fd60d03`, `src/code/bank2.asm` (`CheckPositionForMapTransition`, 02:6C75).
Cross-checked against the spannerisms `jpdasm` disassembly of A Link to the Past (SNES), commit
`4535f694752d1469ede65083e986ce2101945264`, `bank_02.asm` (`ScrollRoomDuringTransition`, `HandleUnderworldCamera`).
No code taken; the shape and the numbers are the subject. The Game Boy runs at 59.7 fps (treated as 60 below); the
SNES at 60. Positions are pixels; speeds in both games are 4.4 fixed point (1/16 px per frame), converted below.

## Why this one
A top-down adventure on the floor wants rooms: a screen the kid can read in one glance, a door on each edge, and a
slide to the next screen that says "you went somewhere" without a loading screen. The room-as-unit is also the
cheapest world structure to author (a grid of 10×8 tile screens), and the cheapest to put a camera on: there is
no camera, just a scroll from one fixed frame to the next.

## The shapes
- A **room** is 10 × 8 tiles of 16 px = **160 × 128 px**, the whole visible playfield (the HUD takes the remaining
  16 px). Entity positions are screen coordinates inside the room; nothing lives outside it.
- A **map** is a grid of rooms addressed by one byte: moving right/left changes the index by ±1, up/down by ±16
  outdoors (a 16-wide grid) or ±8 indoors (`OverworldRoomIncrement`, `IndoorRoomIncrement`). World position is
  `(roomIndex, x, y)`, never a big flat coordinate.
- Two kinds of exit: an **edge** (walk off the side → slide to the neighbouring room) and a **portal** (stairs,
  door, hole → fade out, teleport, fade in). Portals carry a destination `(map, room, x, y)`; edges carry nothing.

## State the system keeps
`roomIndex`, `transitionState` (none → prepare → load tiles → set scroll targets → first half → second half),
`transitionDirection`, `scrollX/Y` and `targetScrollX/Y`, the player's `entryPosition` (where they came in; this is
also the respawn point after a pit or drowning), and per-room status bits (chest opened, enemies cleared, block
pushed) saved into a per-room byte so the room comes back the way it was left.

## When an edge fires (`CheckPositionForMapTransition`)
Checked every frame the player moved, unless a dialog or the inventory is open. Thresholds on the player's
position (sprite top-left; the body is 16 × 16):

| edge | condition | direction |
|---|---|---|
| top | `y < 12` | up |
| bottom | `y ≥ 132` | down |
| left | `x < 4` | left |
| right | `x ≥ 156` | right |

Vertical is tested first. The thresholds sit *inside* the room (4 px from the side walls, 12 px from the top): the
player has to push a few pixels into the edge, so brushing a side wall never flips rooms. Rooms with no neighbour
simply have a solid tile row at that edge so the threshold is unreachable.

## The slide (`ApplyRoomTransition`), each frame once the room is prepared
1. **Prepare** (one frame): compute the new `roomIndex`, load its tiles and entities, draw the player, pick the
   music track. Everything about the next room exists before a single pixel scrolls.
2. **Scroll**: `scroll += 4 px/frame` toward the target (`RoomTransitionXIncrement/YIncrement` = ±4). Target is
   one full room away: 160 px horizontally (**40 frames**), 128 px vertically (**32 frames**).
3. **Carry the player**: during the scroll the player's speed is *overwritten* every frame with a fixed value
   against the scroll — `−3.625 px/frame` horizontally (`$C6`), `+3.625` vertically (`$3A`) — so that in screen
   coordinates they travel from the far edge of the old room to the near edge of the new one (≈145 px in 40
   frames, ≈116 px in 32) while the world under them slides 160/128. Net effect in world space: they walk forward
   about **15 px** during the slide, which is the "stepped through the door" feeling. Input is ignored.
4. **Finish** when `scroll == target`: music change if queued, speeds and Z velocity zeroed, `transitionState = 0`,
   `entryPosition = player position` (respawn point updated), any queued jingle played, following NPC
   recreated. If the direction was *down*, nudge `vy = 1/16` and run ground collision once so a ledge directly
   under the door starts the ledge-hop rather than leaving the player stuck in it.

```
   NONE ──edge hit──▶ PREPARE ──▶ LOAD_TILES ──▶ SET_TARGETS ──▶ FIRST_HALF ──▶ SECOND_HALF ──scroll==target──▶ NONE
                     (1 frame, next room fully built)          (4 px/frame; player carried at 3.625 px/frame)
```
The two "halves" exist only because the Game Boy can redraw half a background map per frame; they are one
state for us.

## Portals (stairs, holes, doors)
Fade to black over a few frames, set `(map, room, x, y)` from the warp record, load, fade in. A pit or drowning
is the same portal with the destination = `entryPosition` of the current room and a half-heart of damage
(see `ladx-hearts-knockback.md`). The room's status byte is read on entry, so a chest stays open and a pushed
block stays pushed.

## Cross-check: A Link to the Past (SNES)
- **Same scroll speed.** Room-to-room scrolls move the camera **4 px/frame** (`ScrollRoomDuringTransition.camera_scroll`
  = ±4). Rooms there are 256 px wide, so a slide takes 64 frames vs. LADX's 40.
- **Player handling differs.** The SNES keeps the player *still* for the first part of the slide (52–59 frames by
  direction, `.boundaries`), then moves them with the camera. The Game Boy moves them the whole way. Both end with
  the player a few tiles inside the new room.
- **Bigger rooms get a camera.** SNES dungeon rooms are up to 512 × 512 (four quadrants). Inside one, the camera
  follows the player 1:1 once they cross a boundary (`HandleUnderworldCamera`, `AdjustQuadrantAndCamera_*`), and
  is clamped to the quadrant or room. That is the halfway house between fixed rooms and a free scroller: the
  fixed frame when the room fits, a follow camera clamped to the room when it does not.
- The overworld there is one continuous map with a follow camera, and a 4 px/frame slide only between its large
  areas. LADX's overworld is rooms all the way.

## Numbers
| | per frame | per second (60 fps) |
|---|---|---|
| scroll speed | 4 px | 240 px/s |
| player carried during slide | 3.625 px | 218 px/s |
| horizontal slide | 40 frames | 0.67 s |
| vertical slide | 32 frames | 0.53 s |
| edge thresholds | top 12, bottom 132, left 4, right 156 | |
| room | 160 × 128 px, 10 × 8 tiles of 16 | |

At a 390-px phone width a room drawn at 2× (320 × 256) still fits; the same 40-frame slide reads as 8 px/frame.
Knobs: `slideFrames` (short = snappy, long = cinematic), `carryPlayer` (LADX) vs `holdThenCarry` (SNES),
`edgeInset` (4/12 px here; bigger inset = harder to leave by accident).

## Edge cases to keep
- Build the destination room *before* scrolling. Spawning entities mid-slide produces pop-in.
- Ignore input and freeze every entity in the old room during the slide; entities of the new room do not
  update either until it finishes (nothing can hit the player while the screen moves).
- Reset Z (jump height) and speeds on arrival; a jump started into an edge must not continue in the new room.
- Save `entryPosition` only when the slide completes, never on the frame the edge fired.
- A down-exit onto a ledge: run one ground check so the ledge-hop starts; otherwise the player is embedded.
- Portal exits (holes, stairs) take priority over edge checks on the same frame.
