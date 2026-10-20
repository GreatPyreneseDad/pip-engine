# Study · Star Fox (SNES) · the rail-shooter frame: a level tape unrolled by distance, enemy path scripts, the boost meter

Learned from the kandowontu2 port, `github.com/kandowontu2/starfox-enhanced` at commit
`5495071479685ae9b376622b1716198891711e1e`. The port keeps the original 65C816 game code running on an
emulated core and re-implements the surrounding systems in C++; the parts read here are the C++
re-implementations and the port's own notes: `docs/ARCHITECTURE.md` (the 20 Hz loop),
`src/simulation/map_vm.cpp` (the level stream, `spawn_table_object`, `execute_ready_records`,
`advance_distance`), `src/simulation/path_vm.cpp` (the per-enemy PATH bytecode, `move`,
`generate_vectors`, `chase_byte`), `include/starfox/simulation/object_pool.hpp` (the 70-slot object
record), `src/simulation/game_simulation.cpp` (`calculate_meters`, the boost meter). The player ship's
own flight (its lane bounds, brake and boost speeds, the lock-on) still runs inside the original 65816
code at this commit and is not re-expressed in the port, so this note does not cover it. No code taken.

## Why this one
"Make me a space shooter" on the floor is a rail shooter: the world comes at you, enemies arrive in
formations, you dodge and fire. Three mechanisms here carry the genre on any canvas, top-down or
side-on: the **level as a tape measured in distance, not time**; **enemies as tiny scripts** that move
relative to the player and branch on where the player is; a **boost meter** that refills.

## The clock
The game logic runs at **20 Hz**: one `gameframe` per three 60 Hz video frames; strategies (object
scripts) run once per game frame, movement in 16-bit fixed point, angles in bytes (256 = a turn). The
port renders at any rate by interpolating transforms between two 20 Hz snapshots; input edges are latched
until the next tick so a tap between ticks is not lost. For a canvas: run the shooter's logic at a fixed
step (20 or 30 Hz), draw at `requestAnimationFrame` with interpolation, latch taps.

## The object pool
70 records of 56 bytes on two linked lists (active, free). A record: `shape`, `attached` (the formation
partner or parent), `flags`, `type`, two counters, `x y z` (16-bit), `rotX rotY rotZ` (bytes),
`velocity` (a signed byte scalar), a strategy pointer, `immune` and `collision` partners, four strategy
flags, six scratch bytes and two scratch words for the script, `health`, `attackPower`, `weaponType`,
collision counters, the velocity vector `vx vy vz` (16-bit), hit and colour and animation frames,
sounds, `fire` (its current shot), a strategy state byte. The player is one record in the same pool.
Compare `megaman2-object-pool-gravity.md`: same shape, 70 instead of 16.

## The level tape (`MapVm`)
The level is a byte stream read by a cursor with a **countdown in Z units**. Every tick:
```
distance  = playerZ − lastPlayerZ
countdown −= distance
while countdown < 0: execute the record at the cursor; a record may set a new countdown
```
A record that spawns an enemy carries `(countdown, x, y, dz, shape, strategy)`: the enemy appears at
`(x, y, playerZ + dz)` — **ahead of the player by `dz`**, wherever the player is — and the next record
waits `countdown` more units of travel. Compact records store `countdown · 16` and `x · 4, y · 4,
dz · 16` in bytes (7 bytes per enemy); a strategy id doubles as a default shape. Other records: `end`;
`loop (target, count)` — a counted jump, so a formation of five is one record and a loop; `wait n`
(16-bit or byte·16); `music n`; `remove every object with shape S` (clears a wave); `background n`;
`stage counter = 50`; `scroll offsets on/off`; a spawn with an initial Z rotation; a full 14-byte record
with explicit shape and strategy pointers.

Because the tape is read by *distance*, boosting through a level compresses it in time and braking
stretches it, but every enemy still meets the player in the same place. The tape never knows the frame
rate. For a 2D scroller: scroll position is the tape head; every "spawn" line is `(scrollDistance,
x, y, kind, script)`; loops make waves.

## Enemy path scripts (`PathVm`)
Each enemy runs a bytecode program (its "path") one instruction stream per object, resuming each tick
where it stopped. The verbs, by what they do:

| verb | effect |
|---|---|
| set speed `s` | `velocity = s` (signed byte) and rebuild `(vx, vy, vz)` from yaw and pitch: `vx = s·sin(yaw)·cos(pitch)`, `vz = s·cos(yaw)·cos(pitch)`, `vy = s·sin(pitch)`; 256-step angles |
| move for `n` ticks | increment a counter, `move`, yield; repeat until `n` |
| loop `n` to label | counted jump with a stack, with "and move this tick" variants |
| chase `field → target` | `field += (target − field) / 8` (at least 1) — an ease; the "until" variant keeps moving and yielding until it arrives |
| relative-to-player on/off | while on, `z += viewVelocityZ` each tick: the object rides with the camera, so a formation **holds station ahead of the player** |
| spaceship mode | `yaw += roll / 4` each tick — bank to turn |
| helicopter mode | speed is taken from `rotX`, vectors in the ground plane |
| if player is left / right / above / below of me, jump | compare `player.x` or `player.y` with mine |
| if player has passed me, jump | `player.z ≥ z` |
| random jump | 50 % |
| if field == value / in range, jump | with an "if not" prefix |
| spawn child `(shape, path, Δrot, health, attack, Δx·4, Δy·4, Δz·4)` | the child starts its own path; variants link parent and child as `attached` (a two-ship pair) or hand the child a parameter |
| find partner by shape within 7000 Z | sets `attached` — join the nearest wingmate |
| link with the next object that asks | pairs two spawns |
| remove-when-behind on/off | mark for removal once past the player |
| health −= 10, kill self, smoke on/off, collision on/off, no-hit-affect, weapon type, animation frame, message | |

`move` each tick: ease the speed toward a target speed by a per-object step if one is set, apply the
mode (bank, helicopter), add the camera's Z if relative, rebuild vectors if asked, then `pos += vel`.
A formation is therefore a leader spawned by the tape whose script spawns wingmen at ±offsets with
their own copies of a path, all flagged relative-to-player so the wedge sits ahead of the ship, each
branching on "is the player left of me" to peel toward him. Compare `dkr-racer-ai.md` (a track-following
brain) — this is scripted choreography, cheap and authorable by a kid: a list of verbs.

## The boost meter (`calculate_meters`)
`meter` 0..40. Each 20 Hz tick: boosting (`boostCount ≠ 0`) → `meter −= 2`, and when it would go
below 0 the boost ends (`boostCount = 0`); not boosting and `meter < 40` → `meter += 1`. So a full boost
lasts **20 ticks = 1 s**, and it takes **40 ticks = 2 s** to refill. The damage meter is the player's
`health` byte read from its collision record; the shield flag is a byte.

## Translating to a 2D kids' shooter
- Tape: `[{at: scrollDistance, x, y, kind, script}]`, with `loop(n)` sugar. Advance by scroll
  distance; spawn `dz` ahead of the view.
- Script verbs: `speed, heading, moveFor(n), ease(field, target, 1/8), ifPlayerLeft/Right/Above/Below,
  ifPassed, random, spawn(child, offset), attach, dieWhenBehind, kill`. Ten verbs are enough.
- Relative-to-view flag for formations that hold station; turn it off when they attack.
- Boost: one integer meter, drain 2 / refill 1 per tick; brake can be the mirror (drain while held).
- Pool: 70 fixed records, free list, player is slot 0.

## Edge cases to keep
- A record that sets `countdown = 0` executes the next record in the same tick (several spawns at one
  distance); only a nonzero countdown yields. Cap the loop (the port caps at 65 536 operations).
- `remove-when-behind` must be a flag the object asks for; scenery you fly past should set it, a
  pursuing enemy should not.
- `chase` steps by at least 1 so it always arrives; eases stall at zero otherwise.
- Pairing verbs need a "pending partner" slot; if the partner never comes, the slot must not dangle
  past the tick.
- Interpolated drawing must not be sampled by the logic; only the fixed step reads positions.
