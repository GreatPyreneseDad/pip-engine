# Study · Columns (Master System) · the falling three-jewel column: gravity, lock, matches, chains, levels

Learned from lhsazevedo's disassembly, `github.com/lhsazevedo/columns` at commit
`ec5ff6b219b11aa2e89d0f6ccc9fa748591d4027`. Sources: `src/entities.asm` (the game entity's handler
chain from `entities.game_LABEL_3599_` through `updateFallingBlock_LABEL_36F9_`, the lock-delay handler
at `37A0`, the clear sequence `37F7 → 3816 → … → 39E9`, piece generation `_LABEL_43D3_`/`_LABEL_43B4_`,
the gravity table `_DATA_4520_`, the music-tempo table `songSpeeds`), `src/columns.asm` (line scan
`_LABEL_2A27_`, magic-jewel mark `_LABEL_2A6E_`, score `_LABEL_2A91_`, collapse `_LABEL_2AF6_`, count
`_LABEL_2B2A_`, versus attack `_LABEL_2B3E_`, board init `_LABEL_136D_`), `src/updaters.asm`
(`state.gameplay.update`, `initGameplayVars_LABEL_1317_`). The code is Z80; nothing is transcribed, the
mechanism and its numbers are the subject.

Units. The entity updates once per video frame: 60 Hz on NTSC, 50 on PAL; the per-second figures below
use 60. Timers are "set N, decrement each frame, act when it goes negative", so a timer of N fires on
the (N + 1)th frame.

## Why this one
Every "make me a Tetris / Candy Crush / Puyo" from the floor is this machine: a piece falls on a grid
by a timer, locks with a little grace, matches are found by scanning lines, the board collapses, and
the scan runs again for chains. Columns is the smallest complete version: one piece shape (a vertical
column of three), one move (cycle the colours), matches in four directions. Start here; Tetris adds
shapes and rotation, Puyo adds flood-fill matching, both reuse the rest.

## The board
Cells are bytes: `0` empty, `1..6` jewel colours, `$0D` the magic jewel, `$FF` wall. The buffer is 8
wide by 22 rows with a stride of 8: column 0 and column 7 are walls, columns 1–6 play; the bottom row is
all wall (the floor). Because every row ends in a wall, "move left" only has to test one cell, and a
scan along any direction stops at the first `$FF`. Thirteen rows are visible (the top visible row is the
one the "danger" music watches); the piece spawns in column 3 with its bottom jewel three rows above the
visible top and becomes visible as it falls. A second grid of the same shape holds **marks** (which cells
are about to be cleared, by colour).

## State the game keeps
`board[22][8]`, `marks[22][8]`, `piece` (three colours top→bottom, as a pointer to its top cell in the
board: it is written into the board while falling and erased before every move), `next` (three colours,
shown in a preview), `fallTimer`, `level` (0..9), `jewels` (total cleared, drives the level),
`jewelsAtLastMagic`, `score` (24-bit), `chain` (0 on the first clear after a lock, +1 per cascade),
`clearedThisTurn` (sum over the cascade, for the versus attack), `softDropLatch` (blocks soft drop after a
level-up until Down is released), `handler` (which phase we are in).

## Phases, in order
1. **Ready**: 60 frames with the board drawn and no piece.
2. **Spawn**: `piece = next`, generate a new `next`. If the cell the piece's *bottom* jewel would occupy is
   already filled → **game over**. Otherwise `fallTimer = gravity[level]`, re-check the level (below), set
   the music tempo for the level, and fall.
3. **Fall** (`36F9`), each frame:
   - Erase the piece from the board (so collision tests see only the stack).
   - Read input. **Soft drop**: Down held, no Left/Right, and `softDropLatch` clear → drop one row *this
     frame* (the timer is skipped). Down together with Left/Right cancels both. If Down is held when the
     latch is set (we just levelled up), nothing happens until it is released.
   - Else `fallTimer −= 1`; when it goes negative, reload it from `gravity[level]` and try to drop a row.
   - **Drop a row**: if the cell under the bottom jewel is empty, move down; if the cell under the new
     position is filled, play the land sound. If it was *not* empty, we have **landed** → write the piece
     back, `fallTimer = 20`, go to Lock delay.
   - Then handle the frame's buttons: either button cycles the three colours (button 1 rolls them down,
     button 2 rolls them up, with a sound); Left/Right move one column if the cell beside the *bottom* jewel
     is empty (a wall byte counts as filled). Only one of Left/Right acts per frame; movement is on the
     debounced input, so it is tap-to-move, not auto-repeat.
   - Write the piece back into the board.
4. **Lock delay** (`37A0`): 20 frames (⅓ s). Each frame: if Down is the *only* direction held → lock now.
   Else `timer −= 1`; when negative → lock. Otherwise rotation and Left/Right still work exactly as while
   falling, and after a move, if the cell under the bottom jewel is now empty (we slid off a ledge) → back
   to Fall with `fallTimer = 0` (drops next frame, no fresh gravity wait).
5. **Lock** (`37F7`): clear `marks`, `chain = 0`, `clearedThisTurn = 0`. Then **scan** (`37FF` re-enters
   here without resetting those two, for cascades).
6. **Scan** four directions over the whole board (`3816 → 3831 → 384F → 386D`), each a call to the same
   line scanner with (start cell, step along the line, step between lines):
   vertical (down 8, next column 1), horizontal (right 1, next row 8), diagonal down-left (7, next row 8),
   diagonal down-right (9, next row 8). The scanner walks each line, counts a run of equal non-zero
   colours, and for every run of length `L ≥ 3` marks all `L` cells and adds `L − 2` to `matchWeight`.
   A cell in two runs is marked once but weighted twice (a cross scores more than a line).
7. **Magic jewel** (`388B → 38D3`): if the locked piece is the magic column (all three `$0D`): look at the
   cell directly under it; if it is a colour (not empty, not wall), mark **every** cell of that colour on
   the board. The vertical scan already marked the three magic cells themselves (they are three equal
   values), so they vanish too. `matchWeight = 0`: the magic clear scores nothing, but the jewels count and
   the cascade that follows score normally with `chain ≥ 1`. On an empty floor the magic column just
   disappears.
8. **No match** (`matchWeight = 0`): if `clearedThisTurn > 0` and this is a versus game, send the attack
   (below). Wait 5 frames, back to Spawn.
9. **Match**: `clearedThisTurn += matchWeight`; `points = matchWeight · 3 · (level + 1) · (chain + 1)`
   (in versus/flash mode the opponent's level stands in for `level`). The stored score is in tens: the HUD
   appends a literal 0, so a lone three at level 0 shows as 30. Then the clear animation:
   - **Flash** 47 frames: the marked cells blink, visible for 8 frames, blank for 8 (bit 3 of the timer).
   - `jewels += count of marked cells`; play the clear sound (pitch rises with the count, capped).
   - **Shrink** 11 frames: marked cells show the four shrinking tiles for 2 frames each, then blank.
   - **Pause** 16 frames, then `score += points`, **collapse**, `chain += 1`, back to Scan (step 6).
10. **Collapse** (`2AF6`): for each of the 6 columns, from the bottom row up over 17 rows: find the lowest
    empty cell, then pull every non-empty cell above it down into the gap, one at a time, so the column
    packs without holes. Instant, no falling animation.

Total time for one clear is 47 + 11 + 16 = 74 frames (1.2 s) plus 5 before the next piece; a cascade
repeats the 74.

## Gravity
`gravity[level]` is the reload for `fallTimer`; the drop happens when the timer goes negative, so one row
takes `gravity + 1` frames.

| level | timer | frames / row | rows / s (60 Hz) | seconds for 13 rows |
|---|---|---|---|---|
| 0 | 32 | 33 | 1.8 | 7.2 |
| 1 | 24 | 25 | 2.4 | 5.4 |
| 2 | 20 | 21 | 2.9 | 4.6 |
| 3 | 16 | 17 | 3.5 | 3.7 |
| 4 | 12 | 13 | 4.6 | 2.8 |
| 5 | 9 | 10 | 6.0 | 2.2 |
| 6 | 6 | 7 | 8.6 | 1.5 |
| 7 | 3 | 4 | 15 | 0.9 |
| 8 | 1 | 2 | 30 | 0.4 |
| 9 | 0 | 1 | 60 | 0.2 |

Soft drop is always one row per frame (level-9 speed). Music tempo by level: `4, 5, 6, 7, 9, 12, 16, 32,
96` (then `$FF` = max), so the song speeds up with the board.

## Level progression
After every spawn: `level = max(level, min(9, floor(jewels / 50)))`. The level never falls, starts at the
option-menu level, and the first threshold is 50 jewels. On a level-up: fanfare, palette change, and
`softDropLatch` set (a held Down must be released before it drops again, so the faster gravity does not
slam the piece the player was already dropping).

## Pieces
`next` is three independent draws of `rand() & 7`, rejected and redrawn when `≥ colours`, then `+1`, so
colours are uniform over `1..colours` with `colours = difficulty + 4` (4, 5 or 6 colours for Easy /
Normal / Hard). The **magic jewel** appears when `jewels − jewelsAtLastMagic ≥ 300`; then
`jewelsAtLastMagic += 300` and the whole next piece is the magic column. In two-player, player 2's colour
ids are offset by 6 (separate tile set); the attract demo replays a fixed 11-piece list.

## Versus (two boards)
On the end of a cascade with `n = clearedThisTurn > 0`: `rows = ((n − 2) & 7) + 1` is subtracted from
one garbage counter (floored at 0) and added to another; a non-zero incoming counter diverts the next
spawn into a "rows arriving" handler, and a board's own garbage count lowers its spawn row. Which counter
is whose was not traced to the end; the shape is "clears cancel incoming, surplus goes across". Out of
scope for the first plugin.

## Translating to pip-engine
A `kit.grid` falling-piece mode: a `cols × rows` byte board with a wall border, a piece as an array of
`(dx, dy, colour)` cells with the bottom-cell test for moves, a gravity table indexed by level, a
20-frame lock delay that resets to an immediate drop when the piece slides off a ledge, a line scanner
parameterised by (start, along, between) for the four directions, a mark grid, `L − 2` weighting, score
`weight · base · (level + 1) · (chain + 1)`, instant column collapse, re-scan until quiet. Tetris mode
swaps the piece shapes and replaces the scanner with full-row detection; the rest stays.

## Edge cases to keep
- Erase the piece before testing collision, write it back after. Otherwise it collides with itself.
- Only the bottom cell needs a side test *because* the board is always packed; keep collapse instant or
  test every cell.
- Lock delay must let the piece slide off and fall again with no new gravity wait.
- Down + sideways cancels both; a held Down after a level-up does nothing until released.
- A cell can be in several runs; mark once, weight each run. Diagonals count.
- The magic jewel's three cells are a run of three of the same value; let the normal scan clear them, do
  not special-case their removal.
- Game over is decided at spawn, from the cell the bottom jewel wants; the piece is never placed on top of
  the stack.
- Chains are counted per lock, not per piece colour; a magic clear is a chain step that scores zero and
  then multiplies what falls into place.
