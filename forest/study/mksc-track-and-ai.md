# Study · Mario Kart: Super Circuit (GBA) · the sector map, laps and rank, the collision buckets, and the CPU racers

Learned from the jellees decompilation, `github.com/jellees/mksc` at commit
`3df8932105c91f8e9e1ad72801ea13ff74339fe1`. The one piece in C is `src/collision.c` (the
checkpoint-bucketed broadphase) with `src/actor.h` / `src/scene.h`. The rest is Thumb in
`asm/text08030774.s`: map read and sector tracking `sub_803B98C`, the finish line `sub_803B7B8`, the rank
bubble `sub_804A774`, progress `sub_803DAA8`, the per-frame driver loop `sub_8049850`, the CPU control
`sub_803BD24` with steering `sub_803BC00` / `sub_803BB48` / `sub_803BC84`, the speed tier `sub_8042FFC` /
`sub_8041F18` / `sub_8041A10` / `sub_8041B78`, and skill setup `sub_8042DE0`. Tables in
`asm/rodata080E645C.s` (`0x080EC300` AI tables, `0x080ECCA8`–`0x080ECD00` thresholds). No code taken.
Units as in `mksc-kart-physics.md`. Compare `dkr-racer-ai.md`: DKR's AI follows a spline of checkpoint
nodes with four lanes and rubber-bands by rank among the AIs; this one reads a **per-tile flow field**
and rubber-bands by **distance to the best human**, in speed tiers.

## Why this one
A flat racer on a canvas has a track bitmap anyway. This game hangs everything off it: which sector
you are in (progress and rank), which way the track goes (the AI's steering), how fast the AI should
dare to go here (a 2-bit hint), what the ground does to the kart (the surface byte). One lookup per
racer per frame, no geometry.

## The map
Every 8 px tile carries: a **surface byte** (low nibble = surface case for the physics; two bits =
the AI speed hint 0..3, 3 = straight; bit 7 = finish strip), a **sector id** (0..N−1, N = `nrCheckpoints`
in the race header, typically 60–100; `0x7F` = not on the track), a **flow direction** (the heading
the AI should hold here, 16-bit angle), and an **out-of-bounds** flag. Sectors are painted bands across
the track in driving order; the finish strip is the tile row where sector N−1 meets sector 0.

```
 sector:   0 | 1 | 2 | 3 | … | N-1 | 0 …          flow:  →  →  ↗  ↑  ↑  ↖  ←  …
                                   ^ finish strip (bit 7)
```

## Progress, laps, rank
- Each frame (`sub_803B98C`): read the tile; if the sector id differs from the racer's, store it (also
  into the actor's `checkpointId` for the broadphase). Off-track or `0x7F` sets a flag instead.
- **Progress** = `lap · 256 + sector` (`sub_803DAA8`); for the item roll `lap · N + sector`.
- **Lap counting** (`sub_803B7B8`) runs only on finish-strip tiles. The strip is a line at a fixed
  coordinate; crossing it forward (previous position on one side, current on the other, moving in the
  track direction) does `lap += 1, sector = 0`; crossing it backward does `lap −= 1`. The lap byte starts
  at `0x80`, so backing over the line on lap 1 is harmless (floor at `0x75`).
- **Best-progress guard**: `bestLap` remembers the highest `lap << 8` reached; lap events (final-lap
  music, finish) fire only when a crossing *exceeds* it. Dancing on the line counts once.
- **Finish**: when `lap << 8 ≥ finishThreshold` (`0x8300` for 3 laps, `0x8500` for 5): set the finished
  flag and the CPU-driven flag (the kart drives itself home), zero lean and drift, show the result for a
  human. One lap short of that sets the final-lap flag.
- **Rank** (`sub_804A774`): a ranking array of racer pointers. When a racer changes sector, it bubbles
  up while its progress exceeds the one ahead's — **and never past a finished racer**. One bubble per
  change keeps the ordering stable under bumping; the rank byte on each racer is `2 · position`.
- Reverse driving: sector ids can go down; rank follows. Progress is never forced monotonic — the
  finish-strip rule and the backward lap decrement are what stop the shortcut.

## Collision buckets (`src/collision.c`)
Two lists per frame: up to 24 **active** actors (karts, thrown items) and 64 **passive** ones (traps,
coins, item boxes). Each list is selection-sorted by `checkpointId`, and a start-index table
`first[sector]` is built so `first[s]..first[s+1]` is the run of actors in sector `s`. An active actor
only tests actors in sectors `[mine − 2, mine + 3)`, wrapping around N; actors with id `0x7F` (off
track) skip the fast path. The pair test is three axis-aligned extents `|Δ| ≤ (sizeA + sizeB) · 2^14`
on 16.16 positions (sizes are in quarter pixels: a kart 30 → 7.5 px half-extent, a thrown item 9, a trap
4), then both actors' collide callbacks run. Battle mode (no sectors) falls back to all-pairs. With 8
karts and ~60 passive objects this turns ~600 pair tests into ~40.

## Who drives: one input word
`sub_8049850` loops the drivers each frame: a human-flagged driver's input word comes from the pad (or a
ghost recording in time trial); otherwise the CPU control writes the word. The physics never knows.
A finished human is flagged CPU-driven and the autopilot takes the pad: it aims at the flow direction
with a ±8° deadzone (`0x600` of 65536) and holds accelerate below 2 px/frame, brake above.

## The CPU racer (`sub_803BD24`, `sub_803BC00`)
Per frame, after the kart's own physics have run:
1. **Target heading** (`sub_803BC84`): the tile's flow direction, with a per-racer variant byte selecting
   one of a few flow layers (different lines through the same corner). Off the track or in an invalid
   sector: aim at the centre of the current sector instead (`atan2` to the sector's stored centre).
2. **Turn toward it** in two eased stages (`sub_803BC00`, `sub_803BB48`):
   - the kart's *intended* heading steps toward the target by `turnRate[tier][errBucket] · 16` units per
     frame, `errBucket = min(|error|, 0x1FF) >> 6` (eight 0.35° buckets up to 2.8°); within `0x1FF`
     it snaps. Rows for 50cc: tier 0 `{4, 6, 8, 10, 12, 14, 16, 20}`, tier 1 `{8, 10, 12, 14, 16, 18, 20,
     24}`, tier 2 `{2, 4, 6, 8, 10, 12, 14, 18}`, tier 3 `{2, 3, 4, 6, 8, 10, 12, 16}`, tier 4 = tier 1
     (×16 → 32–384 units = 0.2–2.1°/frame). 100cc and 150cc rows are ~1.5× and ~2×.
   - the *movement* heading steps toward the intended one by at most `0x600` per frame (3.3°, 200°/s);
     differences under that snap.
   The CPU does not use the lean/steer system at all; it writes the heading. Its kart still runs the
   same speed integration, surfaces, hits and spins.
3. **Speed**: accelerate is always "held". On a normal surface:
   `target = T[char][tier][hint] · 16 + classOffset + 2 · min(coins, 16)` in u, where `hint` is the tile's
   2-bit speed hint. If `v < target`: `a = aiCurve[char][v in 0.25 px/f buckets] / 4096` px/f² (bytes
   are unsigned: `56, 64, 80, 80, 128, 192, 224, 240, 240, 224, 128, 128, 96, 72, 64, 32` for the first
   character at 50cc — a stronger launch than the player's curve). If `v > target`:
   `a = −{4, 8, 16, 24, 32, 48, 64, 80}[(v − target) / 64 u] / 256` px/f². Boost and spin surfaces behave
   as for the player.

   `T` for the first character, in u (×16 applied), `hint = 0..3` (tight corner … straight):

   | tier | 50cc | 100cc | 150cc | player top |
   |---|---|---|---|---|
   | 4 (fastest) | 736 816 864 1056 | 800 960 1008 1200 | 880 976 1040 1232 | 804 / 932 / 1092 |
   | 1 | 480 656 736 880 | 544 704 832 1040 | 784 864 976 1088 | |
   | 0 | 480 560 672 784 | 560 672 784 928 | 672 768 832 944 | |
   | 2 | 464 544 560 640 | 496 608 640 736 | 512 592 688 816 | |
   | 3 (slowest) | 432 480 528 576 | 400 496 528 640 | 496 528 576 736 | |

   Tier 4 on a straight is **30 % faster than a human can go** — the catch-up gear. Tier 3 is 55–70 %.
   The hint is what keeps the AI off the walls: a corner tile says "no faster than this".
4. **Tier** (`sub_8041F18`), re-evaluated for one racer per frame (`frame & 7`): finished → 3;
   invincible → 4 if any human is ahead, 0 if the racer behind shares my sector, else 2; under another
   item effect → 3; otherwise by rank, from `skill` and sector distances:
   - *leader*: if its lead over the best human (lap difference · N + sector difference) is at least
     `lead[class][lap]` sectors — 50cc `12 / 9 / 6` on laps 1/2/3, 100cc `15 / 10 / 8`, 150cc `16 / 10 / 8` —
     it drops to tier 2 (slow) ; otherwise its skill against a per-cup row of three thresholds (e.g.
     `{16, 11, 6}`, `{16, 8, 4}`, `{16, 5, 2}`) picks tier 1 / 0 / 3 / 2 from strongest to weakest.
   - *second*: looks at the gap to first and to third; a human just ahead by more than `catch[class]`
     sectors (`12 / 8 / 5`) → tier 4; human behind within 4 → tier 2 with a flag; else compares the two
     gaps and picks 3 / 0 / 1.
   - *third to seventh* and *last* have their own rules of the same shape (gaps to neighbours, skill).
   The upper bits of the tier byte carry flags (`0x40`, `0x80`) that other routines read; only the low
   nibble picks rows.
5. **Skill** (`sub_8042DE0`), set once at the start: humans 4; CPUs `8 − 2 · gridSlot` (+1 for the first
   four slots) plus `0 / 2 / 4 / 0` by game mode — the front of the grid is the "strong" racer, and the
   same numbers reappear as the rank-independent personality in the tier rules.
6. **Items**: a CPU uses the same item code; it holds for at most 243 frames and a per-driver flag
   byte decides forward/backward (`mksc-items.md`).

### Against DKR's AI
| | DKR | this game |
|---|---|---|
| track representation | checkpoint nodes + Catmull-Rom, 4 lanes | per-tile flow direction + 2-bit speed hint + sector id |
| steering | look-ahead point 500 units along the spline, stick = yaw error / 32 | heading eased toward the tile's direction, 0.2–2°/frame by tier, hard cap 3.3°/frame |
| speed | bonus in banana units, blended by rank among AIs | explicit target speed per (tier, hint), eased with a decel table |
| rubber band | `[T.lo, T.hi]` by rank among AIs, never by distance to the player | tier from sector distance to the best human, with per-class/per-lap lead allowances |
| off-screen | no physics, slide along spline | full physics always (8 karts fit a GBA) |

## Translating to a 2D kids' racer
- Paint three layers on the track image: surface (colour), sector (gradient band), flow (arrows). The
  flow layer can be derived from the sector centres (direction to the next sector's centre) and
  hand-painted only in corners.
- Lap = cross the strip forward with the best-progress guard; backward crossing subtracts. No "visited
  all checkpoints" bookkeeping needed when sectors are read from the map.
- Rank = bubble on sector change, frozen for finishers.
- Broadphase = sort by sector, test ±2 sectors. On a canvas with 8 karts this is overkill, but the
  *list of passives sorted by sector* is also the cheap way to spawn/despawn trackside objects.
- AI = heading eased to the flow, speed eased to `T[tier][hint]`; tiers from distance to the player.
  Easy mode: lower tier 4; never let tier 4 exceed the player's top by more than 30 %.

## Edge cases to keep
- A racer in sector `0x7F` (off track) must still be ranked (keep its last good sector) and must still
  collide (fast path skips it; add it to the slow path or clamp to the nearest sector).
- The finish strip must be wider than the fastest kart moves in a frame (7.9 px here, 8 px tiles).
- Never bubble past a finisher; never let a finisher's progress grow.
- The tier is a per-frame rotation over racers (one per frame), so a change in the pack takes up to 8
  frames to register — cheap and invisible.
- The autopilot deadzone (±8°) stops a finished kart from wagging.
