# Study · Tetris Attack (Game Boy) · the panel field: swap, match scan, falls and the chain flag, combos, stop timer, rising stack and level curve

Learned from tobiasvl's mgbdis listing, `github.com/tobiasvl/tetris-attack-disassembly` at commit
`d21b29a694d906db1f7fc46751ed88d8720cf1a6`. The listing has no symbol names, so routines are cited by bank and
ROM address (the listing prints them as `Call_001_xxxx` / `jr_001_xxxx`). Field logic is in `bank_001.asm`:
level-table readers `$4000`/`$400D`, next-row copy `$401A`, special-panel seeding `$403A`, the per-cell state
dispatch `$40B2`–`$413C`, the post-match tally and level-up `$431B`, chain-flag marking `$43B6`, gravity `$43D7`,
input/cursor/swap `$44AF`–`$466D`, the match scanners `$470E` (vertical) and `$4757`/`$478F` (horizontal) with
the marker `$47BF`, the chain bookkeeping `$47D9`–`$48BD`, and the rise `$49B2`–`$4A59`. Set-up and data are in
`bank_002.asm`: the rise-speed table copy `$75FB` (table at `$761E`), the panels-per-level copy `$768C` (table at
`$769B`), stage records `$7905`/`$7996`, the stop-time tables `$79CE` (data at `$7A04`), the rising-row generator
`$76FF` (colour weights at `$7746`) and the starting-stack generator `$7756` (height profiles at `$780B`). The
code is SM83; nothing is transcribed, the mechanism and its numbers are the subject.

Units. One update per frame at 59.7 Hz (call it 60). Panels are 16 px; the field is 6 wide × 9 visible rows
(144 px, the whole screen) plus one hidden row below. All timers count frames.

## Why this one
Columns and Tetris drop a piece *into* a stack; this is the other great grid loop, the one behind every
"match-3 with a cursor" a kid asks for: the stack **rises**, you **swap** two neighbours, three-in-a-line
**clears**, what was above **falls**, and a fall that lands in a new match is a **chain**. The two hard parts —
how a chain is counted honestly across falls, and how the stop timer rewards it — are small once you see the
flag bit that does it.

## The field (three parallel byte arrays, stride 8, column = low 3 bits)
- `colour[row][col]` at `$C200`: `0` empty, `1..5` the five colours, `6` a special panel; **bit 7 set = not
  matchable right now** (it is swapping or falling). Rows 0..8 are visible (`$C200` is the top row, `$C240` the
  bottom), row 9 (`$C248`) is the hidden incoming row.
- `state[row][col]` at `$C300`: bit 6 = normal panel, bit 7 = garbage cell, bit 5 = **chain flag**, bit 4 =
  matched (clearing), bit 3 = just landed, bit 2 = mid-swap, bits 1/0 = sub-states of the clear and swap.
  `$40` is a plain settled panel; `0` is empty.
- `timer[row][col]` at `$C400` (a per-cell countdown) and `clearT[row][col]` at `$C500` (the clear countdown).
- `queue[32][8]` at `$C700`: a ring of 32 pre-generated incoming rows, read by an index that steps 8 per row.
Two 100-entry per-level tables are copied into the unused tails of the colour and state arrays at game start
(`$C280`, `$C380`): `framesPerPixel[level]` and `panelsToNextLevel[level]`.

## State the game keeps
`cursor (x 0..4, y 1..8)` — the top row is never selectable; `das` (`$C0C2`); `swapTimer` (`$C0CF`);
`scrollY` (`$FFA1`, the pixel offset the stack has risen), `riseTimer` (`$C0CA`), `raising` (`$C0C9`),
`raiseHold` (`$C0CC`); `stop` (16-bit frames, `$C182:$C183`); `level` (`$C0BA`, 1..99), `panelsLeft`
(`$C0CB`); `chain` (`$C0D4`, 0..10), `matchedNow` (`$C0D0`), `clearing` (`$C0D1`, panels mid-clear),
`inFlight` (`$C0D2`, a flagged panel is still falling), `chainHit` (`$C0D3`, a flagged panel just matched);
`comboSize`/`comboPopup` (`$C0DA`/`$C0DB`), `chainPopup` (`$C0DC`/`$C0DD`); `topRow` (`$C171`, highest occupied
row) and `panelCount` (`$C170`).

## Update order, each frame
1. **Input** (`$44AF`): A on a new press → swap (step 2). B held → manual raise (step 7). D-pad: a new press
   moves the cursor at once and zeroes `das`; while held, `das` counts up to 8, then the cursor moves every
   2nd frame. Cursor x clamps to 0..4, y to 1..8. Nothing else about input is buffered.
2. **Swap** (`$45F1`–`$466C`): look at the two cells `(x, y)` and `(x+1, y)`. Refuse if either is garbage
   (bit 7) or is swapping/clearing (bits 4, 1, 0), or if both are empty. An empty cell whose cell *above* is
   mid-swap also refuses (you cannot swap into the hole under a panel that is still sliding). Otherwise exchange
   the two colour bytes (with bit 7 set — unmatchable while sliding) and the two state bytes with bit 2 set and
   timers zeroed, and start `swapTimer = 3`. A swap can be started every 3 frames. **A panel can be swapped
   while things above it are falling, and a panel can be swapped into an empty cell** — that is what makes
   chains plannable.
3. **Per-cell state machine** (`$40B2`): one pass over the 54 cells, counting panels and the top row, and
   stepping each cell's swap / land / clear sub-state by its timer. The clear timing is per-stage data: the
   matched cells hold a countdown seeded with 36 / 32 / 28 frames by stage tier and a second constant 10 / 9 / 7
   that reads as the stagger between individual pops (not traced to the end).
4. **Match scan**, horizontal (`$4757`): for each of the 9 rows, from each column 0..3, skip empty cells and
   cells whose colour has bit 7 set, then count the run of equal colours (low nibble) rightwards; a run of
   ≥ 3 is **marked**: `state = (state & $E8) | $10`, `timer = 3`, `matchedNow = true`; scanning resumes after
   the run. Vertical (`$470E`): the same from each column's rows 0..6 downward (a run cannot start below
   row 6). A cell in both a row run and a column run is marked twice and counted once.
5. **Tally** (`$431B`): `count` = marked cells. If `count ≥ 4` it is a **combo**: `comboSize = count`,
   `comboPopup = 120` frames, and `stop = max(stop, comboStop[count − 4])`. Then in the single-player modes
   `panelsLeft −= count`; when it goes negative, `level += 1` (cap 99) and `panelsLeft` reloads from the table.
   Every marked cell gets its clear countdown and is checked for the chain flag (step 6).
6. **Chain bookkeeping** (`$43A1`, `$43AD`, `$47D9`): a marked cell with bit 5 (the chain flag) and bit 3 (it
   just landed) sets `chainHit`. Each frame: if `chainHit`, `chain += 1` (max 10), `chainPopup = chain` for 128
   frames, the match sound rises a step (cap at the 4th), and the stage counter advances once. Else if nothing
   flagged is still in flight (`inFlight == 0`) and `chain > 0`, the chain **ends**: `stop = max(stop,
   chainStop[chain])`, a fanfare tier is chosen (`chain ≥ 3 / 4 / 5`), and `chain = 0`.
   The flag itself: when a group clears, `$43B6` walks **upward** from each cleared cell over the panels
   stacked on it (stopping at a garbage cell) and sets bit 5 on every normal panel that is not itself clearing.
   Gravity (step 7) preserves bits 7–5 when it moves a panel down and sets bit 3 + `timer = 2` when it lands.
   So "a chain is counted across falls" is exactly: *flag everything that was sitting on the cleared group;
   if a flagged panel lands and is part of a match, that is the next link; the chain is over when no flagged
   panel is still falling and nothing flagged matched this frame.* A flagged panel that lands in no match
   loses its flag when it settles. Swapping a flagged panel does not clear the flag.
7. **Gravity** (`$43D7`): scan from the bottom-right corner upward and leftward. A normal panel (bit 6) with
   none of bits 4/2/1 set, whose cell below is empty (no bit 6/7 and not mid-swap), moves down one row *this
   frame*: colour copied with bit 7 set (unmatchable while falling), state keeps only bits 7..5, source cleared.
   Falls are one row per frame with no acceleration. A panel whose cell below is a panel settles: colour bit 7
   cleared, state becomes `settled | landed` with `timer = 2`, which is the window in which step 6 reads bit 3.
8. **Rise** (`$49B2`): skipped entirely while anything is mid-swap, clearing, matched this frame, or a flagged
   panel is in flight — a clear always holds the stack. Then: if `stop > 0`, `stop −= 1` and return. Else if
   `raising`, rise 1 px; else `riseTimer −= 1` and rise 1 px when it reaches 0, reloading
   `riseTimer = framesPerPixel[level]`. Rising 1 px is `scrollY += 1`; when `scrollY & 15 == 0` a whole row has
   come up: shift all three arrays up one row (`$4A8A`), copy the next ring row into the hidden row with state
   `$40` (`$401A`), in the versus modes seed special panels into it (`$403A`), and in the manual case count the
   row for score and drop `raising`.
   **Manual raise**: hold B for 4 frames (blocked while anything is clearing or shaking) → `raising = true`,
   1 px per frame (a row in 16 frames), **and the stop timer is cancelled** — raising while you have stop time
   forfeits it.
9. **Danger / game over**: `topRow` is tracked every frame; the single-player "all clear" check is the bottom
   row being empty for 32 consecutive frames (`$4B73`). The top-out rule itself was not traced.

```
            swap(3f)            match ≥3            clear (36f, pops every 10f)
 settled ─────────► sliding ──────────► marked ──────────────────────────► empty
   ▲                   │ (unmatchable)      │ flag bit5 on every panel above
   │ land (bit3, 2f)   ▼                    ▼
 falling ◄────────── hole under it     panels above start falling, flag kept
   │ (1 row/frame, unmatchable)
   └─ lands in a match AND has bit5 ───► chain += 1 ; chain ends when no bit5 panel is in flight
```

## The numbers
**Rise speed** (`$761E`, frames per pixel; a row is 16 px). The copy starts 0 / 5 / 10 entries in for the three
difficulty settings, so difficulty is simply a level offset. Index by level:

| level | frames / px | seconds / row | level | frames / px | seconds / row |
|---|---|---|---|---|---|
| 1 | 48 | 12.8 | 30 | 19 | 5.1 |
| 5 | 44 | 11.7 | 40 | 9 | 2.4 |
| 10 | 39 | 10.4 | 44 | 5 | 1.3 |
| 20 | 29 | 7.7 | 45–49 | 4 | 1.07 |
| 25 | 24 | 6.4 | 50–99 | 3 | 0.8 |

i.e. `fpp = 49 − level` for 1..44, then 4, then 3. Manual raise is 16 frames per row at any level.

**Panels to the next level** (`$769B`), index by level: 9, 9, 12, 12, 12, then 14 ×5, 16 ×5, 20 ×5, 24 ×5,
28 ×5, 32 ×10, 36 ×10, 39 ×10, 45 for the rest. Clearing is what levels you up; time does not.

**Stop time** (`$7A04`, frames). Chain end, by chain length `c` (links beyond the first match), three stage
tiers: `240 + 30c`, `180 + 30c`, `120 + 30c` (so a 2-chain on the easy tier buys 4.5 s, a 5-chain 6 s; max
index 10). Combo of `n` panels, by tier: `30·(n − 2)`, `48 + 28·(n − 4)`, `40 + 24·(n − 4)`, all capped at
240 (4 s). Each mode takes the **max** of the current stop and the new value — stops do not add. The versus
modes use a flat chain stop of 64 frames, and one mode initialises every combo stop to 32 frames (`$78C1`).

**Clear timing** by tier: countdown 36 / 32 / 28, stagger 10 / 9 / 7. **Popups**: combo 120 frames, chain 128.
**Swap**: 3 frames. **Cursor DAS**: 8 frames, then every 2. **Fall**: 1 row per frame.

## Generating panels so nothing matches by itself
- **Incoming rows** (`$76FF`): 32 rows, left to right, each colour drawn from a 16-entry weight table
  `1,2,3,5,4,1,2,3,4,5,1,2,3,4,5,3` (colour 3 is 4/16, the others 3/16) and redrawn while it equals the cell
  **directly below** or the cell **to the left** — no two orthogonal neighbours are ever equal, so a row that
  rises into the field cannot complete a line by itself.
- **Starting stack** (`$7756`): pick one of 8 column-height profiles (six heights, 0..5, e.g. `4,1,5,5,5,4`),
  fill each column from the bottom up, and redraw a colour while it equals the cell **two below** or the cell
  **two to the left**. That is the cheapest rule that forbids a three-in-a-line while still allowing pairs,
  which is what gives the opening its ready-made moves.
- **Specials in versus** (`$403A`): a counter of pending specials puts one (or two, if ≥ 5 pending) `6`
  panels into random columns of the incoming row.

## Translating to pip-engine
A `kit.grid` **panel mode** next to the falling-piece modes: three parallel arrays (`colour`, `state`, `timer`)
over `cols × (rows + 1)`; a two-cell cursor with `(das 8, repeat 2)`; `swap(x, y)` with the refusal rules above
and a 3-frame slide during which both cells are unmatchable; a scan that marks row and column runs ≥ 3 in one
pass and counts marked cells once; `comboSize ≥ 4` → popup and `stop = max(stop, comboStop[n])`; the chain flag
as a bit set by walking up from each cleared cell, kept through falls, consumed on a landed match, with the
chain ending when no flagged panel is in flight; gravity one row per frame from the bottom corner; a rise with
`framesPerPixel[level]`, cell height 16, `stop` counted down only when nothing is clearing, manual raise at 1
px/frame that cancels `stop`; `level` from `panelsToNextLevel`; row generators with the "≠ below, ≠ left" and
"≠ 2-below, ≠ 2-left" rules. Garbage blocks (bit 7 cells) are a later addition: they fall as one, block the
flag walk, and are turned into panels by an adjacent clear.

## Edge cases to keep
- A clear holds the stack regardless of the stop timer; the stop timer only matters once the board is quiet.
- Stops take the max, never the sum; a combo during a chain does not extend it unless it is bigger.
- The chain flag must survive the fall (keep the high bits when moving a cell) and must only count when the
  panel *landed* (bit 3 window of 2 frames) *and* matched. A flagged panel swapped sideways keeps its flag;
  a flagged panel that settles without matching loses it.
- Swapping is allowed into a hole and under falling panels; refuse only on garbage, clearing, mid-swap, or a
  swapping panel directly above an empty target cell.
- The rising row must never complete a line on arrival: generate with "≠ below, ≠ left".
- Manual raise is a trade: faster play for the stop time you had.
- Vertical runs can start only in rows 0..6 and horizontal runs only in columns 0..3; start the scan there and
  resume after each run so a run of 4 is one run, not two.
