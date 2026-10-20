# Study · Wave Race 64 (N64) · the buoy course, the miss rule, and things that float

Learned from the LLONSIT decompilation, `github.com/LLONSIT/Wave-Race-64` at commit
`e00a55f87cb410d6b431807bd2d08594b10e550e`. Sources: `src/game/code_4C750.c` (race setup: wave level,
misses, laps — `func_8009345C`, `func_800948DC`, the tables `D_800DA988`, `D_800EABEC`),
`src/game/code_2FB10.c` (`func_80078264`, the gap between two riders along the buoy chain),
`src/game/code_24B00.c` (the next-buoy arrow and the chain walk), `src/game/code_383C0.c`
(`func_8007DBC0`, floating-object physics), `include/structs.h` (the buoy record `UnkStruct_801AEE20`,
`RiderStruct`). The decomp is at 65 % and **the rider's own physics (throttle, waves under the hull,
the lean) are not decompiled at this commit** — the water-height function `func_8004D30C` is only
declared — so this note stops at the course rules and the float model. 30 Hz game logic. No code taken.

## Why this one
The buoy course is the cleanest "do the thing in order" rule in racing: a chain of gates, each with a
side you must pass on, a count of allowed misses, and a reward meter for passing them cleanly. It works
on a boat, a bike, a bird, a kid on a scooter. The float model is a five-line spring that makes anything
bob on water convincingly.

## State
Per course: an array of **buoy records** (position `x, y, z`; anchor `homeX, homeZ`; velocities; `kind`
(0 = pass on one side, 1 = pass on the other, 3 = finish line); `skip` (a non-gate marker when
nonzero); `active`; `next` (index of the next buoy); `distToNext` (metres along the course)) and
`buoyCount`. Per rider: `lapCount`, `racePosition`, `nextBuoy` (index), the gap to the rival
(`unk330`), misses left (`gBuoyMisses`, starting at `powerMisses`), a power level.
Per race: `waveLevel`, `lapCount` (3), `powerMisses` (5).

## The course knobs (`func_8009345C`, `func_800948DC`)
| knob | value | where |
|---|---|---|
| allowed misses | 5 (normal, hard, and the fixed stunt/2P value) | `D_800DA988[*][1]`, `D_800EABEC` branch |
| laps | 3 (stunt mode 1) | `D_800DA988[*][2]` |
| wave level, per-course default (1P) | `20, 20, 20, 40, 10, 30, 20, 25, 25` for the nine courses (a second table for 2P) | `D_800EABEC` |
| wave option | 0 = course default, 1 = calm **10**, 2 = rough **40**, 3 = random `10 + rand % 31` | `func_800948DC` |

The wave level is a single integer the water model scales by; it is chosen once per race, so a kid's
"make it stormy" is one slider from 10 to 40.

## The chain and the gap
Buoys form a **singly linked ring** (`next`), each knowing `distToNext`. The rider's progress is
(`lapCount`, `nextBuoy`). The gap between two riders (`func_80078264`) is computed by **walking the
chain** from the trailing rider's next buoy to the leader's, summing `distToNext`, bumping the lap
counter each time a `kind == 3` (finish) buoy is passed, and stopping when both the lap and the index
match. The leader gets `+gap`, the trailer `−gap`. Walk bounded by `buoyCount`. This is also how a
"distance to the player" for a rubber band or a camera split is found without any geometry.

The HUD arrow (`code_24B00.c`) walks the same chain to the **next real gate**, skipping `skip != 0` and
inactive buoys, and draws the gate's side colour (`kind` 0 or 1) with a left/right texture; it goes dim
when the next buoy is the finish on the last lap (`lapCount ≥ laps` and index = finish).

```
   rider.nextBuoy ──▶ [buoy k] ──next──▶ [k+1] ──▶ … ──▶ [finish, kind 3] ──▶ [0] …
                        side 0             side 1              lap++
```

## The rule as the game states it
Pass each gate on its side: the power level rises a step; miss a gate (wrong side or around it): lose
one of your 5 misses and drop the power level; miss them all and the race is lost. (The pass/miss
detection itself is in the undecompiled rider code; the counts and the chain above are what the repo
shows.)

## Things that float (`func_8007DBC0`), per 30 Hz frame
For every buoy on the water:
```
vx = vx · 0.9 + 0.01 · (homeX − x)         ; a soft spring back to the anchor
vz = vz · 0.9 + 0.01 · (homeZ − z)
vy = vy · 0.9 − 3.0                        ; damped gravity, 3 units/frame²
depth = waterHeight(x, z) + 40 − y         ; how far under the surface the float point is
if depth > 0: vy += 0.3 · min(depth, 30)   ; buoyancy, capped so a swamped buoy does not launch
x += vx ; y += vy ; z += vz
```
A second object class (course decorations, `unk58 == 4`) uses `0.001` for the spring, `0.8` and `−4.0`
for the vertical, no `+40` offset. The constants matter together: `0.9` damping with `0.3 · depth`
buoyancy settles in about a second and overshoots once — the bob. `waterHeight(x, z)` is the wave
field; on a flat canvas it is any `A · sin(kx − ωt)` the floor already has.

## Translating to a 2D kids' game
- A **gate list** with `side` per gate, `next` pointers, a `misses` counter and a `power` meter: pass =
  `power = min(power + 1, max)`, miss = `misses −= 1, power = max(power − 1, 0)`, `misses < 0` = out.
- The gap between racers = walk the gate list summing `distToNext`; use it for rank, a rubber band, or
  the "how far behind" indicator.
- Float = spring to anchor + damped gravity + capped buoyancy; apply it to anything on the water layer,
  including the player's boat with the water height sampled under it.
- Wave level as one number 10–40; calm / rough / random presets.

## Edge cases to keep
- Skip and inactive markers must be walked over by every chain walk, and the walk must be bounded by
  the buoy count or a broken ring hangs the frame.
- The finish buoy is a gate too (`kind 3`): passing it is the lap, so there is no separate finish line.
- Buoyancy is capped (30 here) so a float pushed deep by a wave does not fire into the sky.
- The spring is to the anchor, not to the last position, so a hit buoy drifts back on its own.
