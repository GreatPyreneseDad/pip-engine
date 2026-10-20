# Study · Super Bomberman (SNES) · the bomb grid: cell flags, fuse, flame propagation and chaining, soft blocks and hidden pickups, player speed

Learned from LIJI32's disassembly, `github.com/LIJI32/superbomberman` at commit
`6b9d0721952a3dff6eb145ba11b8e81b07782e33`. Sources: `bank4.asm` — `drop_bomb` (`$C44BA4`), `bomb_handler`
(`$C44DA2`, with the blast-mask pass at `$C44E11`–`$C44EFA` and the fuse at `$C44F2D`), `explode_bomb`
(`$C4579E`) with the per-phase flame painter `sub_C458B0`, the flame cell test `sub_C45BDA`,
`force_detonate_bomb_at_tile` (`$C45BA2`), `update_effective_speed` (`$C431A4`), `try_drop_bomb` (`$C440E6`);
`bank6.asm` — `handle_player_tile`, `generate_soft_blocks`, `generate_hard_blocks_and_exit`,
`generate_random_position`, `count_level_bonuses`, `shuffle_and_divide_bonuses`, the `*_reserved_free_tiles`
lists; `bank3.asm` — `explosion_animation` (phase lengths), `speed_table`; `enums.asm` — the cell bit layout;
`structs.asm` — the bomb object fields. The code is 65816; nothing is transcribed, the mechanism and its numbers
are the subject.

Units. 60 Hz. The arena is 13 × 11 cells of 16 px, origin at pixel (40, 24). A cell index is `0x44 + 2x + 0x40y`
into a 16-bit-per-cell `collision_map` (one 32-entry row per 0x40 bytes), and the same index addresses the
background tile map — so "the grid" is one array of flags and one array of tiles, read with the same index.

## Why this one
"Bomb game" is the first multiplayer thing kids ask for after "race". The whole feel is in four mechanics:
a bomb that is a cell flag with a fuse, a flame that is **re-rasterised every frame of its life** from the bomb
cell outward until it hits something, a chain that is nothing more than "a flame touching a bomb sets that
bomb's fuse to 8", and soft blocks that hide a shuffled list of pickups. The AI and the shrinking arena are in
`superbomberman-cpu-and-arena.md`.

## The cell word
Low 16 bits per cell, from `enums.asm`:

| bits | meaning |
|---|---|
| `0x001F` | pickup id hidden here (0 = none); `0x1F` = "burning", `0x10` = the exit |
| `0x0020` | bomb |
| `0x0040` | soft block (destructible) |
| `0x0080` | hard block |
| `0x0100` | flame (with the low byte `0x1B` centre, `0x1C`/`0x1D` vertical arms, `0x1E`/`0x1F` horizontal arms) |
| `0x0200` | a kicked/punched bomb in motion |
| `0x0800` | **potential blast**: this cell is inside some live bomb's range (for the AI) |
| high byte of a flame cell | which bomb/owner made it (for kills and combos) |

The sudden-death block is `hard | 0x500`, a distinct tag the flame test treats as "skip this cell, keep going".

## State a bomb keeps (one small object each, in a linked list)
`tile_index`, `countdown` (frames), `range_and_flags` (low nibble = range in cells; `0x10` force-detonating,
`0x40` remote, `0x80` red/piercing), `association` (owner player, combo id), `phase` (0..10 once exploded),
a copy of the range for the explosion, and the owner's running bomb count.

## Placing a bomb (`drop_bomb`)
Refused if the cell already has a flame or a bomb, or the player's bomb count is at their limit. Otherwise:
`collision = bomb | potentialBlast`, the bomb tile is drawn, the bomb is snapped to the cell centre
(`x & 0xF0 | 8`), `countdown = 120` (2.0 s), `range = fireUps + 1` (the full-fire pickup forces 10; a poison that
says "minimum fire" forces 1), the red and remote flags are copied from the player, the owner's count goes up and
the owner's combo counter is reset.

## Each frame while the fuse burns (`bomb_handler`)
1. Animate (the tile index cycles on the low 6 bits of the countdown).
2. **Paint the danger mask**: set `potentialBlast` on the bomb cell and on up to `range` cells in each of the
   four directions, stopping after a cell that holds a bomb, soft block, hard block or kicked bomb (that cell is
   still marked), and stopping before a flame arm that lies along the same axis. This runs every frame for every
   bomb, so the AI's "is this cell safe" is a single bit test and is never stale.
3. **Fuse**: remote bombs wait for the owner's detonate press (a flag the owner sets) instead of counting; the
   rest do `countdown −= 1` and explode at 0. A bomb flagged force-detonate explodes when its (short) countdown
   runs out. During the level-end freeze non-forced bombs keep counting but do not explode.

## The explosion (`explode_bomb` → `sub_C458B0` per phase → `sub_C45BDA` per cell)
On detonation: any older flame arms lying in this bomb's four lines are wiped back to background (so a new blast
redraws cleanly over an old one), the explosion sound plays, `phase = 0`, and the object becomes a flame.
The flame lives **11 phases of 2, 3, 4, 4, 5, 4, 4, 3, 1, 1, 1 frames = 32 frames** (0.53 s), from
`explosion_animation`. On the first frame of every phase the flame is **re-rasterised from scratch**: the centre
cell is set to `flame | 0x1B`, then for each direction up to `range` cells the cell test decides:

| cell holds | result |
|---|---|
| nothing | paint an arm here (`flame | 0x1C..0x1F`, owner in the high byte), continue |
| a bomb | **`force_detonate`**: that bomb's `countdown = 8` and it is flagged; it also inherits this flame's owner unless the owners' team bits differ. The flame stops here. |
| soft block | after phase 0: mark it burning (`0x5F`) and spawn a burning-block object; stop — unless the bomb is **red**, in which case keep going |
| hard block | stop |
| an existing flame | stop if it is a centre or an arm on the same axis; otherwise (a crossing arm) overwrite it and continue |
| a pickup on the floor | after phase 0: mark it burning (`0x21F`), spawn a burning-pickup object; stop (red bombs continue). If it is the exit tile, the exit spawns an enemy instead (story mode) |
| a sudden-death block | skip the cell without painting, continue |

Soft blocks and pickups are only destroyed from phase 1 on (the second frame), never on the first paint. Every
re-paint re-asserts the flame bits, so a cell stays lethal for the whole 32 frames even if something else wrote
to the map. The last phase (`phase == 10`) **erases**: each cell the flame would reach is restored from the
background shadow and its word zeroed, in the same four-direction walk with the same stopping rules. Chaining is
therefore: bomb A's flame reaches bomb B → B's fuse becomes 8 frames → B explodes while A is still burning →
B's flame reaches C … A kicked bomb (`0x200`) that a flame reaches is handled by the kick code instead.

A player standing on a cell with the flame bit is hit (`handle_player_tile`); a player on a bomb cell is
handled by the bomb-pass logic; a player on a pickup cell runs that pickup's handler and clears it.

## Soft blocks, hard blocks, pickups (`bank6.asm`)
- **Reserved cells**: the two cells next to each spawn corner (and the corner itself) are never filled —
  `standard_reserved_free_tiles` lists them for the story-mode two corners and the battle-mode four.
- **Story hard blocks** (`generate_hard_blocks_and_exit`): place `count` hard blocks at random non-reserved,
  non-occupied cells; after each one run a flood fill (`is_map_non_continuous`); if the map split, remove it and
  retry. The last placement becomes the exit, hidden under a soft block. (Battle arenas use fixed patterns.)
- **Soft blocks** (`generate_soft_blocks`): place `softBlocks` of them at random free cells; the first `k` of
  them hide a pickup, taken in order from a **shuffled** copy of the stage's pickup list.
- **Pickup split** (`shuffle_and_divide_bonuses`): the stage lists its pickups; the list is shuffled by drawing
  without replacement; in story mode a random `softBlockShare` of the count goes under soft blocks and the rest
  is carried by enemies (re-rolled until the enemy share ≤ enemy count); in battle mode all go under blocks.
- `generate_random_position`: `x = rand(13)`, `y = rand(11)`, converted to pixels `((x+2)·16, (y+1)·16)`.

## Player speed (`update_effective_speed`, `speed_table`)
8.8 fixed point, pixels per frame, by speed-ups 0..7: `1.0, 1.25, 1.5, 1.75, 2.0, 3.0, 4.0, 4.0` (60, 75, 90,
105, 120, 180, 240, 240 px/s; a cell in 16 / 12.8 / 10.7 / 9.1 / 8 / 5.3 / 4 frames). Poison states clamp it to
`0.375` or `4.0`. Movement is grid-aware: the player's cell is written into the map each frame
(`mark_playerquare_in_collision_map` / `clear_…`), and the mover tests the cell ahead with
`test_collision_*` before stepping; the exact corner-rounding window was not traced.

## Translating to pip-engine
`kit.bombs` on a `kit.grid` arena: one `Uint16Array` of cell flags with the bit table above; `place(x, y,
{range, fuse: 120, red, remote})`; a bomb list; per frame: paint the danger mask, count fuses; on zero →
flame object with `phases = [2,3,4,4,5,4,4,3,1,1,1]`, re-rasterised each phase with the cell-test table, a
`force(cell)` that sets another bomb's fuse to 8, soft blocks and pickups destroyed from phase 1, erase on the
last phase. Soft-block generation with reserved spawn cells and a shuffled pickup list; the flood-fill
connectivity check for random hard blocks. Player speed table in px/s with `cell = 16`. The AI and shrink are
the sibling note.

## Edge cases to keep
- Re-rasterise the flame every phase; never "spawn flame sprites and forget". That is what makes crossing
  flames, newly placed bombs and chain timing all correct for free.
- A flame stops *at* a bomb and *at* a soft block; red bombs go through soft blocks and pickups but still stop at
  hard blocks and bombs.
- Soft blocks/pickups burn from the second frame, not the first — a bomb dropped as a block starts burning is
  still placed.
- Chain fuse is 8 frames, not 0: chains ripple, they do not pop at once.
- Wipe older arms along the new bomb's lines before painting, or two blasts crossing leave ghost arms.
- The danger mask must be painted even for remote bombs with no countdown; the AI reads it.
- Keep the two cells beside every spawn empty, and never let random hard blocks disconnect the arena.
