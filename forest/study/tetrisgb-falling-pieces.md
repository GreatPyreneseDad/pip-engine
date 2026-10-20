# Study · Tetris (Game Boy) · the falling tetromino: randomizer, rotation, gravity table, soft drop, lock, line clear, scoring, levels, Type B

Learned from DanielBenGD's mgbdis listing, `github.com/DanielBenGD/Tetris-Gameboy-Decompilation` at commit
`1eac6dbe059ae01e36bcbddc17986d6c33f4d057`. Everything below is in `bank_000.asm` (the listing has no symbol
names; routines are cited by their ROM address, which the listing prints as `Call_000_xxxx` / `jr_000_xxxx`):
spawn + randomizer `$2007`, the per-frame piece step `$209C`, rotation `$24BB`, horizontal move `$2515`,
collision test `$2573`, lock write `$25A1`, full-row scan `$213E`, clear animation `$21E0`, row collapse
`$224D`, line scoring `$1F91`, level-up `$244B`, speed table loader `$1AE8` with the table at `$1B06`,
Type B garbage `$1B1B`/`$1B68`, game init `$1A3F`–`$1AE0`, and the main-loop timer tick at `$02D8`. The code is
SM83 (Game Boy Z80); nothing is transcribed, the mechanism and its numbers are the subject.

Units. One update per video frame at 59.7 Hz (call it 60). A cell is 8 px; the piece's screen position moves in
8-px steps. Two one-byte countdowns (`$FFA6`, `$FFA7`) are decremented once per frame in the main loop *before*
the game routines run, and "act when zero" — so a timer set to N acts N frames later.

## Why this one
Columns (see `columns-falling-jewels.md`) gave the floor its grid, lock, scan, collapse and chain machine. This
is the other half of every "make me a Tetris": a **piece with a shape and four orientations**, a randomizer
that avoids droughts, a gravity table that is the whole difficulty curve, DAS (the auto-repeat that makes
holding Left feel right), soft drop points, line-count scoring and the level-up rule. Nothing here is the game's
art; it is 40 lines of knobs.

## The board and the piece
`board[18][10]` bytes at a stride of 32 (`$C802` is row 0, col 0): `$2F` is empty, anything else is a block
tile. There is **no wall column**; bounds are checked by converting the piece's screen x/y to a cell and reading
the board (`$2573` → `$29E3`), so a position off the board reads as a wall. The piece is 4 cells, each stored as
an (x, y) pair in a scratch list (`$C010`), rebuilt from the piece id every frame it is drawn. The id is
`kind·4 + orientation`: ids `0,4,8,…,24` are the seven kinds, the low two bits the rotation. The piece spawns at
screen (`$3F`, `$18`) — horizontally centred, top of the field.

## State the game keeps
`piece` (id, x, y), `next` (shown) and `hidden` (one more ahead, `$FFAE`), `fallTimer $FF99` and its reload
`$FF9A`, `level $FFA9` (0..20), `lines $FF9E/9F` (BCD, 4 digits), `score $C0A0` (BCD, 6 digits), `pieceState
$FF98` (0 falling, 1 landed, 2 written, 3 lines found), `clearStep $FF9C`, `phase $FFE3` (0 play, 1 collapse,
2..17 redraw rows), `das $FFAA`, `softTimer $FFA7`, `softRows $FFE5`, `downLatch $C0C7`, the four line
counters (`$C0AC` singles, `$C0B1` doubles, `$C0B6` triples, `$C0BB` tetrises), `topOut $FFFB`, `mode $FFC0`
(`$37` = Type A, `$77` = Type B), `hard $FFF4` (the hidden +10 speed mode), `heightSetting $FFC4` (Type B).

## Update order, each frame (the Type A game state, `$1C0D` chain)
1. Pause/transition checks, then **rotate** (`$24BB`): on a *new* press only — B steps the orientation one way,
   A the other (`±1 mod 4`); redraw, test collision, revert on hit. No wall kicks, no auto-repeat.
2. **Horizontal move** (`$2515`): on a new press of Left/Right, `das = 23` and move one cell. While held,
   `das -= 1`; at 0, `das = 9` and move. If the move collides, undo it and set `das = 1`, so a held direction
   retries every frame against a wall and slides the instant it is free. Right is tested before Left; only
   one acts.
3. **Fall / soft drop** (`$209C`):
   - If Down is held *alone* (no Left/Right): if `downLatch` is set (the previous piece locked while Down was
     held) nothing happens until Down is released and re-pressed. Otherwise, when `softTimer == 0` and the piece
     is falling and no clear is in progress: `softTimer = 3`, `softRows += 1`, and drop one row now. So soft drop
     is **one row every 3 frames** (20 rows/s), timed independently of gravity.
   - Else `softRows = 0` (release Down and the bonus is gone), and gravity runs: `fallTimer -= 1`; when it is 0,
     `fallTimer = reload` and drop one row.
   - **Drop**: `y += 8`, test collision; if clear, done. If it hits: restore `y`, `pieceState = 1`,
     `downLatch = 1`, and if `softRows > 0` add `softRows − 1` to the score (the increment that happened on the
     failed drop is taken back; net: one point per row actually dropped). Then the **top-out** test: if the piece
     is still at its spawn position, bump `topOut`; the second time this happens the game is over (`$2103`). A
     piece that never moved locking at the spawn is forgiven once.
   There is **no lock delay**: landing is only detected when a gravity (or soft-drop) step fails, so the piece
   gets the rest of the current gravity period to slide and rotate on the floor, then locks on the next tick.
4. **Full-row scan** (`$213E`, runs when `pieceState == 2`, i.e. the frame after the lock write): rows 2..17 are
   scanned (the two spawn rows are never checked); a row with no `$2F` is full; its address goes in a list
   (max 4), `pieceState = 3`, `wait = 2`. With lines: `lines += n` (BCD, capped 9999; Type B instead does
   `lines −= n`, floored at 0 = stage clear), and `singles/doubles/triples/tetrises[n] += 1`; the sound and
   flash type are picked by `n`.
5. **Lock write** (`$25A1`, when `pieceState == 1`): the four cells are written into the board, the sprite
   hidden, `pieceState = 2`. Note it runs *after* step 3 in the same frame, so land and write are one frame.
6. **Collapse** (`$224D`, when `phase == 1`): for each cleared row, from the top of the list, copy every row
   above it down one row, then blank row 0. `phase = 2` and the 16 play rows are redrawn to the screen one per
   frame (`phase` 2..17), bottom row first.
7. **Line score** (`$1F91`, Type A only, during the redraw): for each non-zero counter in turn, add
   `base × (level + 1)` where `base = 40 / 100 / 300 / 1200` for 1/2/3/4 lines, then zero the counter.
8. On `phase == 17` (`$239E`): **level-up check** (below), then spawn the next piece (`$2007`).

The **clear animation** (`$21E0`, from the VBlank side) runs while `pieceState == 3` and `wait == 0`:
`clearStep` 0..6 at 10 frames each — steps 0/2/4 paint the rows with the flash tile, 1/3/5 restore them, 6 blanks
them — then `wait = 13` and `phase = 1`. Without lines, `wait = 2` elapses and the next piece spawns at once, so
the entry delay is 2–3 frames and a line clear costs 2 + 70 + 13 + 16 ≈ 101 frames (1.7 s).

## Spawn and the randomizer (`$2007`)
The pipe is three deep: `current ← next; next ← hidden; hidden ← roll()`. `roll()` reads the Game Boy's free
running divider and reduces it mod 7 (by counting in steps of 4 and wrapping at 28), giving one of the seven
kind ids. The anti-repeat test is run up to **three** times: with `c = current`, `n = next`, `r = roll`, the
roll is rejected when `(c | n | r) & $FC == c`. Because kind ids are `0,4,8,12,16,20,24`, the OR test only
rejects when both `n` and `r` are bit-subsets of `c` — it refuses some true repeats, lets others through
(`c=4, n=8, r=4` is accepted), and refuses some non-repeats (`c=12, n=4, r=8`). After three tries the roll is
taken as is. The design intent was "not the same as the last two"; the effect is a mild, lopsided bias. For
the kit: implement the *intent* (reject `r == c || r == n`, three tries) and keep the three-try cap, which is
what prevents a long drought without making the sequence predictable. Demo and two-player modes replay a
scripted list (`$C300`) instead of rolling. `fallTimer = reload` on every spawn.

## Gravity (`$1AE8`, table at `$1B06`)
`reload = table[level]`, with `level = min(20, level + 10)` in the hidden hard mode. A row takes `table + 1`
frames because the drop happens on the tick that finds the counter at zero.

| level | frames / row | rows / s | level | frames / row | rows / s |
|---|---|---|---|---|---|
| 0 | 53 | 1.1 | 11 | 10 | 6.0 |
| 1 | 49 | 1.2 | 12 | 9 | 6.7 |
| 2 | 45 | 1.3 | 13 | 8 | 7.5 |
| 3 | 41 | 1.5 | 14 | 7 | 8.6 |
| 4 | 37 | 1.6 | 15 | 6 | 10 |
| 5 | 33 | 1.8 | 16 | 6 | 10 |
| 6 | 28 | 2.1 | 17 | 5 | 12 |
| 7 | 22 | 2.7 | 18 | 5 | 12 |
| 8 | 17 | 3.5 | 19 | 4 | 15 |
| 9 | 11 | 5.5 | 20 | 4 | 15 |
| 10 | 11 | 5.5 | | | |

(The listing's byte for level 0 reads `$02` where the Type B initialiser seeds the first fall with `$34` and the
rest of the table counts down by one from `$30`; the level-0 row above uses 53, which is the value the game
plays at. Treat the one byte as a listing artefact.) Soft drop ignores this table: 3 frames per row always.

## Level-up (`$244B`, Type A only)
After every clear, if `level < 20` and `lines < 1000`: `if floor(lines / 10) > level: level += 1` and reload the
speed. One step per clear, never down, and a game started at level 9 needs 100 lines before it moves. The
first threshold from level 0 is 10 lines.

## Type B (`$1A8F`, `$1B1B`, `$1B68`)
`lines` starts at 25 and counts down; reaching 0 wins. `height` 0..5 fills the bottom `2·height` rows with
garbage: each cell is filled with probability ½ (a random one of 8 block tiles), except that a cell in the last
column is forced empty when the cell to its left was filled — so no generated row is ever complete. Soft-drop
rows accumulate in a separate counter instead of the score (the bonus is settled at the end). Speed uses the
same table and the same level 0..9 selection.

## Score
BCD, 6 digits. Line clears `40/100/300/1200 × (level+1)`; soft drop `+1` per row dropped under a held Down that
is still held at the lock. There is no hard drop in this game. The score and the lines counter are both capped
by their digit count.

## Translating to pip-engine
The Columns note's `kit.grid` falling-piece mode gains a **tetris mode**: pieces as `kind·4 + rot` with a
4-cell offset table per id; rotation as `±1 mod 4` with revert-on-collision (wall kicks are a knob, default
off); DAS as `(initial 23, repeat 9, retry 1)` frames → `(0.38 s, 0.15 s, 1 frame)`; gravity from the table
above as `framesPerRow[level]`; soft drop `3 frames/row` with `+1/row` scoring, cancelled by releasing Down,
latched across a lock; lock on the first failed drop (lock delay 0; expose `lockDelay` as a knob because the
Columns mode uses 20); full-row scan over the play rows only; row-list collapse; `base[n] × (level+1)`; level
= `max(level, floor(lines/10))` stepping once per clear; spawn pipe three deep with a three-try anti-repeat;
Type B as `{linesToClear: 25, garbageRows: 2·h, density: ½, noFullRows: true}`.

## Edge cases to keep
- The lock happens on the first failed drop; the slide window is "whatever is left of the gravity period".
  Fast levels therefore lock almost instantly — that is the intended difficulty, not a bug.
- Releasing Down before the lock forfeits the soft-drop points; the counter is reset every frame Down is not
  held alone. Down + Left/Right counts as "not Down".
- After a lock with Down held, Down must be released before it drops the next piece (the latch).
- A blocked DAS move sets the repeat timer to 1 so the piece slides the frame the gap appears.
- The three-try randomizer cap is what you want; the OR-test bias is what you do not.
- Only the play rows are scanned for lines; a full row in the two spawn rows would never clear.
- Game over is "a piece locked at its spawn position for the second time", checked at the lock, not at the
  spawn; the forgiveness of the first is what lets the final piece be drawn on top of the stack.
- Type B garbage must never contain a complete row; the one-rule generator above guarantees it cheaply.
