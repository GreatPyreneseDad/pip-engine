# Study · Mario Kart: Super Circuit (GBA) · the item roll, the object budget, and item behaviours

Learned from the jellees decompilation, `github.com/jellees/mksc` at commit
`3df8932105c91f8e9e1ad72801ea13ff74339fe1`. Sources in `asm/text08030774.s`: the table pick `sub_8043BB0`,
the roll `sub_8044028` and its caller `sub_80440C4`, the item rank `sub_803D6AC`, the use dispatcher
`sub_8037D6C`, the item inits `sub_8047368` / `sub_80473FC` / `sub_80474CC` / `sub_8047560` / `sub_8047630`
/ `sub_8048090` / `sub_8048204` / `sub_80485DC`, the held-behind state `sub_80471D8` → `sub_8046FF4`, the
throw `sub_804676C`, and the race LCG `sub_8043840`. Weight tables live in `asm/rodata080E645C.s` at
`0x080ECE1C`–`0x080ED0A8`. No code taken; no item is named — they are described by what they do. Units as
in `mksc-kart-physics.md` (u = 1/256 px/frame, 60 fps, angles 65536 = 360°). Compare `dkr-racer-ai.md`
§Item pacing: DKR's balloons have fixed colours per track and an AI that rolls to upgrade them; this game
rolls the item itself from a table chosen by how far behind you are.

## Why this one
Every "racing game" from the floor wants pickups, and the two things that make them fair are here in
full: **the roll depends on your distance behind the leader, not your rank**, and **the track has an
object budget** so eight racers cannot fill it with projectiles. Both are tables a kid can edit.

## State
Per racer: `heldItem` (a code; 0 = none; one bit marks the triple versions), `holding` (item button
held, the object trails behind), `trailCount` (how many trailing objects), `itemFlags`. Per race: the
on-track projectile count, the per-track `budget` (4–8), and a 32-bit LCG seed (`x = x · 0x41C64E6D +
0x3039`, return bits 1..15) separate from the game's general RNG so races replay.

## The roll (`sub_8043BB0`, `sub_8044028`)
1. Progress is `lap · nrSectors + sector` (`mksc-track-and-ai.md`). `d = leaderProgress − myProgress`,
   in sectors (a track has ~60–100).
2. Pick a weight table: the **leader** flips a coin between two tables; otherwise by `d`:
   `0–2, 3–6, 7–12, 13–18, 19–24, 25–36, 37–50, 51–60, > 60`. Battle mode has three tables of its own.
3. Each table is `(item, weight)` pairs, weights summing to 64. Roll `rng % 64`, walk the table.
4. **Budget check**: `cap = trackBudget − projectilesOnTrack − otherCounted`; `trackBudget` is 8 by
   default and 4–7 on some tracks. Items have a *cost* (`sub_803D6AC`): the four single throwables cost
   1, the two triples cost 3, everything else 0. If the rolled item costs more than `cap`, walk the
   table from the top for the first item that fits; if none fits, hand out the basic trap.

Item codes grouped by behaviour (letters are this note's, not the game's):

| | behaviour | cost |
|---|---|---|
| T | basic trap, dropped 8 px behind, static | 0 |
| T2 | small trap: trails behind while held, then dropped | 0 |
| S1 | single throwable, bouncing, forward or backward | 1 |
| S2 | single throwable, **homes on the racer one place ahead** | 1 |
| S3 | single throwable, third kind (strong) | 1 |
| X1 / X3 | three S1 / three S2 trailing in formation, thrown one at a time | 3 |
| B | self effect (two-stage, flag + 600-frame timer) | 0 |
| I | invincibility: 372 frames (6.2 s) for a human, 210 (3.5 s) for a CPU | 0 |
| L | hits every other racer at once | 0 |

Percent chance by distance behind the leader (both leader tables shown):

| | T | T2 | S1 | S2 | S3 | X1 | X3 | I | L | other |
|---|---|---|---|---|---|---|---|---|---|---|
| leader (a) | 14 | 39 | 27 | 8 | 0 | 6 | 0 | 0 | 0 | 6 |
| leader (b) | 8 | 27 | 39 | 14 | 0 | 6 | 0 | 0 | 0 | 6 |
| 0–2 behind | 23 | 0 | 0 | 36 | 0 | 23 | 8 | 9 | 0 | 0 |
| 3–6 | 19 | 0 | 0 | 33 | 0 | 14 | 9 | 20 | 0 | 5 |
| 7–12 | 11 | 0 | 0 | 34 | 0 | 0 | 20 | 25 | 0 | 9 |
| 13–18 | 14 | 0 | 0 | 14 | 6 | 0 | 22 | 28 | 6 | 11 |
| 19–24 | 11 | 0 | 0 | 6 | 9 | 0 | 25 | 22 | 17 | 9 |
| 25–36 | 8 | 0 | 0 | 11 | 9 | 0 | 25 | 16 | 22 | 9 |
| 37–50 | 6 | 0 | 0 | 6 | 14 | 0 | 23 | 18 | 33 | 0 |
| 51–60 | 6 | 0 | 0 | 6 | 14 | 0 | 20 | 21 | 33 | 0 |
| > 60 | 8 | 0 | 0 | 14 | 17 | 0 | 26 | 0 | 36 | 0 |

The shape to copy: the leader only gets things to drop or a weak single; the pack behind gets homing
singles and triples; the back third gets the whole-field item a third of the time, and the
invincibility fades out for the very last racer because it would not catch anyone.

## Using an item (`sub_8037D6C`)
On the item-tap bit, if an item is held, no spin or hit is in progress and the kart is not airborne: a
free object is taken from the pool (24 active, 64 passive slots), its owner set, and the item's init
runs. Triples spawn three objects at once and set `trailCount = 3`; each use throws one. A used item is
cleared unless it is one of the two-stage ones, which rewrite `heldItem` to their second stage.

### Trailing behind (`sub_80471D8`, `sub_8046FF4`)
A single or trap object sits **8 px behind** the owner at `facing + 180°`, recomputed every frame from
the owner's position (`sin` scale 32768, `sin · 16` on a 16.16 position = 8 px). While the item-hold
bit stays down it stays there — a shield. Releasing throws it: forward, or backward if **up** is held.
A CPU holds for at most 243 frames. Triples trail with per-object phase offsets `{0, 17, 34}` so they
fan out behind the kart.

### The throw (`sub_804676C`)
`throwSpeed = min(ownerSpeed + 3 px/f, 6.25 px/f)` quantised to 1/16 px/f, so a thrown object always
outruns the thrower by 3 px/frame (180 px/s). Direction is the owner's facing plus the drift angle
(you aim with the slide). The object's sector is read from the map so it takes part in the
checkpoint-bucketed collision like a racer. The homing kind (S2) picks its target at throw time: **the
racer one rank ahead of the thrower**; thrown backward it does not home. Sound volume comes from the
distance to the player.

### Hit reaction
A racer hit by a projectile gets its velocity scaled by a per-surface table and the hit flag set; the
kart physics then bleeds speed at 1/16 px/f per frame and spins (`mksc-kart-physics.md`). The
invincibility item sets a timer during which hits are ignored and CPU racers switch to their fastest
speed tier if a human is ahead.

## Translating to a 2D kids' racer
- One roll table per distance band, weights summing to 64, editable as a grid. Distance in checkpoints
  behind the leader; never rank.
- A projectile budget per track (6 is a good default for a phone screen); singles cost 1, triples 3;
  fall back down the table, then to the trap.
- Held items trail 8 px behind and double as a shield; release throws at `speed + 3 px/f`.
- Homing targets "one place ahead", decided at launch. Nothing retargets.

## Edge cases to keep
- Two racers cannot pick from the same table state in one frame: the LCG is advanced per roll.
- A thrown object inherits the owner's sector so the broadphase finds it.
- The leader's two tables are a coin flip, not a distance band: `d = 0` for the leader always.
- Budget counts objects *on the track now*, so a cleared track lets triples through again.
- Throwing backward disables homing; a kid who turns to fire should get a dumb shot.
