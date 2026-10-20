# Study · Contra (NES) · the spawn director: placed enemies per screen, the random soldier generator, and a wall boss that deploys on timers

Learned from vermiceli's annotated Contra (US) disassembly (github.com/vermiceli/nes-contra-us, commit
`687d651c021fd7020f10d05b970ccb62663c94bd`). No code taken; the mechanisms and their constants are the subject.
The generator is `exe_soldier_generation` and its three sub-routines in `src/bank2.asm` (1697–2188) with the
per-level tables right after (2190–2246); the per-screen placed enemies are described in `docs/Enemy Routines.md`
and `docs/Level Headers.md`; the soldier itself is `soldier_routine_00..05` in `src/bank0.asm` (1217–1700); the
first boss wall is `wall_turret_routine_*` and `wall_core_routine_*` in `src/bank0.asm` (3036–3285). Frames are
60 fps; velocities are 8.8 fixed point converted to pixels per second.

## Why this one
A run-and-gun lives on *flow*: things should keep coming, from the right places, at a pace that reads as pressure
but never as a wall. Contra does it with two layers — a hand-placed list per screen (the set pieces) and a random
generator that fills the gaps with the one cheap enemy (the runner) — and a handful of rules that stop the generator
being unfair. Every kid's "endless" game needs exactly this director, and the rules are the whole trick.

## Layer 1 — placed enemies (bank2 `level_enemy_screen_ptr_ptr_tbl` 1687+; docs/Enemy Routines.md §Level Enemies)
Each screen of a level (a 256-px page; screen 0 never has any) owns a list of records:
```
 outdoor:  X byte | RR TTTTTT | YYYYY AAA   (+ one YYYYYAAA byte per repeat)
           X position, Repeat count (0–3), Type (0–63), Y in 8-px rows, 3 attribute bits the type interprets
 indoor:   XXXX YYYY | C D TTTTTT | AAAAAAAA  (nibble grid, half-tile nudges, 8 attribute bits)
```
The list is loaded when the screen scrolls into range, so an enemy appears **when its screen does**, never earlier.
Attributes are the type's own knobs: for a runner, bit 0 = start direction, bit 2 = shoots, bits 4–5 = an
initial delay of 1 / 16 / 32 / 48 frames before it moves (`soldier_initial_anim_delay_tbl` bank0 1230), so a group
of three placed at one X staggers itself. Repeats share X and type but each has its own Y and attributes — one
record is a column of enemies.

## Layer 2 — the random generator (bank2 1697–2081)
```
 [00 arm]  timer := level base − 40·min(completions,3) − 5·weaponStrength ; if base = 0 → never (indoor levels)
 [01 tick] timer −= 2 per frame (−1 on odd frames while the screen is scrolling); on wrap →
           re-arm the timer, pick an edge, scan for a floor row, record the spot
 [02 spawn] run the fairness checks; if any fails → back to 00 with nothing spawned
           else create a runner with randomised attributes; count it; back to 00
```
**Base timers** (`level_soldier_generation_timer` 1778): 144 / none / 216 / none / 208 / 200 / 192 / none per level.
At −2 per frame that is a runner every **72 frames (1.2 s)** on the first level and every ~100 frames (1.7 s)
on the later outdoor ones; scrolling slows the clock by a quarter. A better gun (strength 0–3) shaves up to 15
ticks; each finished loop of the game shaves 40 (max 120) — the famous second-loop difficulty is this one line.

**Where** (1803–1946): the X is the left edge (10) or right edge (250), from a 16-entry parity table indexed by
frame counter + rng; on the first level only the right edge until 30 runners have been made on that screen. The Y
is found by scanning 16-px rows for a floor under the point — one of three sweeps chosen by `frame & 3`: top-down,
bottom-up, or from the player's row upward. Three sweeps so that successive runners don't all pick the same ledge.
The spot is stored one row above the floor it found.

**Fairness checks** (1948–2030), any one vetoes the spawn:
- not in the top quarter of the screen (y < 64) unless the level scrolls vertically;
- not below y = 224;
- not while `ENEMY_ATTACK_FLAG` is clear (the player is mid-respawn, see the lives note);
- not if the tile at the spot or 8 px toward the centre is solid (it would be inside a wall);
- not if a live player stands in the outer quarter (64 px) of the side it would come from — **until the game has
  been beaten once**;
- the per-screen attribute byte: `FF` = no runners on this screen; bit 7 = 50 % veto per attempt; bit 6 = 25 %
  veto; low six bits pick the behaviour row.

**What** (2044–2076): `behaviourRow·4 + (frame & 3)` indexes a 28-entry attribute table so the same screen yields
"doesn't shoot / shoots" in a ratio the designer chose per screen (e.g. row 1 is 3:1 silent:shooting, row 2 is
1:1, row 4 all shooting). A random bit sets "turns at ledges" vs "jumps off". Direction is simply "run toward the
middle" from whichever edge it came from. While scrolling, one time in four the generator instead makes a **pair** —
one runner per live player (`create_default_soldiers` 2092).

**Capacity**: runners take an enemy slot from 0–6 (`find_next_enemy_slot_6_to_0`); placed enemies fill from 15
downward. No slot, no spawn.

### The runner itself (bank0 1217–1700)
Runs at 1.0 px/f (60 px/s) leftward or **1.25 px/f (75 px/s) rightward** — asymmetric on purpose, because the player
scrolls right and a runner coming from behind has to catch up. It drops 4 px to sit on the ground, enables
collision only once a floor is confirmed under it (otherwise it is removed — a spot over a destroyed bridge), and
either turns or leaps at a ledge by the attribute bit. A shooting runner stops, fires 1–2 bullets from a count table,
then resumes. Killed → an 8-frame death routine from the type's "destroyed routine" index.

## Layer 3 — the wall boss as a deploying spawner (bank0 3036–3285)
```
 turret:  [closed, delay 80|128|176|240 f by attribute] → [open: 3 tiles × 8 f] → collision on, wait 128 f
          → [fire aimed every 80 f, 24-direction aim, bullet speed ×1.5] ... until hp 0 → destroyed tile
 core:    [plated/closed, delay 32|128|176|240 f] → [open 3 × 8 f] → fires every 40 f once ≥7 attack rounds have
          happened on this screen and it is high enough to hit (y < 112); hp 8 (plain) / 5 behind plating / 16 (big)
```
The boss is not an entity with a brain; it is four to six placed enemies with staggered deploy timers and an
`INDOOR_ENEMY_ATTACK_COUNT` the screen increments each soldier wave, so the core only joins in after the player
has survived a few rounds. Turret bullets use the shared 24-direction aim (docs/Aim Documentation.md): the
direction to the nearest player quantised to 15°, a unit vector from a 7-entry quarter table, then scaled by a
speed code (0.5, 0.75, 1, 1.25, 1.5, 1.62, 1.75, 1.87 px/f — bank7 10086–10194). Outdoor gun turrets only get 11
directions (30°); the 24-way table is for things that need to feel accurate.

## Constants
| | value |
|---|---|
| generator base (level 1 / later) | 144 / 192–216 ticks, −2 per frame → 1.2 / 1.6–1.8 s |
| scroll slowdown | −1 on odd frames while scrolling (¾ rate) |
| per completion | −40 ticks, max 3 |
| per weapon strength | −5 ticks, strength 0–3 |
| spawn edges | x = 10 or 250 |
| floor scan step | 16 px rows |
| safe zones | top 64 px; player within 64 px of the spawn edge |
| screen veto | 50 % (bit 7) / 25 % (bit 6) / always (FF) |
| runner speed | 60 px/s left, 75 px/s right |
| runner slots | 7 (0–6); placed enemies 9 (15 down) |
| pair spawn chance | 1 in 4, while scrolling |
| wall turret deploy | 80 / 128 / 176 / 240 f; fire every 80 f after a 128 f hold |
| wall core | fire every 40 f after 7 attack rounds; hp 8 / 5 / 16 |
| aim resolution | 24 directions (15°), 11 for cheap turrets (30°) |
| bullet speed codes | 0.5–1.87 px/f (30–112 px/s) |

## Design shapes seen
- **Two layers**: a per-screen list for authored moments, a generator for pressure. The generator only ever makes
  the cheapest enemy.
- **One timer, three states**: arm, tick, spawn-or-veto. All randomness is `frame & mask` plus one rng byte.
- **Vetoes, not rules**: the generator tries and is told no. Every fairness property is one more veto.
- **Per-screen behaviour byte**: the designer tunes density and aggression per screen with one byte.
- **Difficulty is subtraction** from the timer: better gun, more completions → faster spawns.
- **Edge-asymmetric speed** so pursuers catch up.
- **Bosses as deploy schedules**: stagger timers on placed pieces instead of scripting.

## Things learned that are not built yet
- Scroll-locked boss auto-scroll (`set_boss_auto_scroll`) and the "screen cleared" flag that ends a wall.
- Enemy-bullet lifetime and the solid-background bullet check flag in the level header (offset 25).
- The 16 aiming enemies and the rotating turret's graphic-per-direction (docs/Aim Documentation.md).

## Edge cases to keep
- Decrement the generator **before** the veto chain and re-arm on any veto; otherwise a vetoed frame fires again
  next frame and the pressure spikes.
- Confirm a floor under the spawn **after** the scroll has moved it, or you spawn into destroyed terrain.
- Never spawn from the edge the player is hugging (until they have proven they can take it).
- Count spawns per screen, and reset on screen change; several rules key off "how many so far".
- Pair spawns need two free slots; take none if you can't take both.
- Aim once at fire time; a bullet that re-aims is a different enemy.
