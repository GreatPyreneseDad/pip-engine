# Study · WarioWare, Inc. (GBA) · the microgame loop: pick, play on a beat clock, win or lose, lives, score, tempo

Learned from ShaffySwitcher's decompilation, `github.com/ShaffySwitcher/wariowareinc` at commit
`cac3fa3d0e8b427e5fb731d9d5b36ff937035b59`. Sources: `src/scenes/gameplay.c` (`gameplay_stage_init`,
`gameplay_select_next_microgame`, `gameplay_run_script`), `src/scenes/gameplay.h` (`GameplayData`, the set and
entry structs, `MAX_LIVES`, `MAX_SCORE`), `asm/scenes/gameplay/asm_08008b50.s` (the order shuffle),
`src/beatscript.c` (`set_beatscript_tempo`, the thread scheduler, `ticks_to_frames`, `func_0800A098`),
`asm/beatscript/asm_0800a0c4.s` and `asm_0800a128.s` (the result latch), `data/microgames.c`
(`gMicrogameTable`), and one microgame engine under `src/engines/` for how a game reads difficulty, tempo and
reports a loss. The code is C and Thumb; nothing is transcribed. The stage *scripts* that drive this loop are
the sibling note, `warioware-stage-script.md`.

Units. 59.7 Hz (call it 60). Time inside a microgame is counted in **ticks** on a beat clock: 24 ticks per beat,
so `ticksPerFrame = BPM / 150` and `framesPerBeat = 3600 / BPM` (140 BPM → 25.7 frames = 0.43 s a beat).

## Why this one
"Lots of tiny games, faster and faster, four lives" is a whole genre a kid can finish in an afternoon, and it is
the natural home for the factory's one-mechanic games: each is a *microgame*, the loop is the product. The
hard-won parts are small: a **beat clock** that makes "faster" mean "same script, higher tempo"; a **result
latch** so a game can lose exactly once; a **set** structure (pool + count + shuffle + win-only) for the
picker; and a quadratic tempo ramp across a set.

## State the loop keeps (`GameplayData`)
`currentLives` / `maxLives = 4`, `currentScore` (0..999) and `previousScore` (to animate the counter),
`currentDifficulty` (0..2) and `difficultyOffset` (added by the stage), `currentMicrogameID`, `minTempo` /
`maxTempo` / `tempoLimit` (300 by default, scripts set 250) and `pitchLimit` (music pitch, `0xC00`), the active
**set** pointer with `progress` (`unk70`, how many of the set are done) and the shuffled `order[]` (`unk71`),
the **result** word (`unk178`: 0 won, 1 lost) and its **latch** (`unk17a`), `inputGate` (`unk173`: the
microgame may read input only after its script says "go"), `livesRestoreMode` (`unk270`), and the script
cursor / current opcode of the stage script.

## A set
`{count, shuffle, winOnly, entries[]}` where each entry is `{difficulty (8 bits), microgameID (10 bits), song
or sublist}` and the list ends with `difficulty == 0xFF`. Two magic values: `microgameID == 0xFB` means "pick
one at random from the sublist this entry points at", and `difficulty == 0xFE` means "take the difficulty of
whatever the random pick says". `count` may be smaller than the pool (play 6 of these 9) or larger (loop the
pool).

## Picking the next microgame (`gameplay_select_next_microgame`)
1. **Tempo for this slot**: with `n = count`, `p = progress`:
   `tempo = min + (max − min) · p² / (n − 1)²` (or `min` when `n ≤ 1`). The ramp is quadratic — the first games
   of a set are nearly flat, the last jump. Clamped to `tempoLimit` where the script sets it.
2. **Entry**: `entries[order[p]]`; if it is a random slot, count the sublist and take `rand(count)`.
3. **Difficulty**: `entry.difficulty + difficultyOffset`, capped at 2. Three levels, period: every microgame
   has three variant tables (`table[difficulty][16]` of random variants is the common shape).
4. **Music**: the entry's song, or by `songMode` a track from the stage's category lists, or a random category.
5. **Intro**: the microgame's table row names an intro type 1..6, which picks the stage's "get ready" scene;
   type 6 is the non-scoring *rest* interstitial (below).
6. Reset per-game state: `result = 0`, latch open, input gate closed, popup cleared; mark the microgame as seen
   in the save (for "new game" markers and the unplayed-first ordering).
7. `set_beatscript_tempo(tempo)` and start the microgame's scene after the intro.

**Order** (`asm_08008b50.s`): `order[i] = i mod poolLen` for `i < max(count, poolLen)`; if `shuffle`, each `i`
is swapped with a random index; if the stage asked for it, microgames whose "seen" flag is clear are moved to
the front, so a first-time player meets every new game before any repeat.

## Inside a microgame
- The beatscript (a per-microgame binary) runs on threads whose timers are decremented by `ticksPerFrame`
  each frame; its events call into the engine: open the **input gate** on the "go" beat, finish the game at the
  end beat. Game length is written in beats, so raising the tempo shortens every microgame identically.
- Engines read `gGameplayData.unk14` (the current BPM) to size motion to the clock: one engine converts "the
  car must cross 300 px in `param` ticks" as `frames = param · 150 / BPM`, `speed = 300 / frames` — an object
  that takes the same number of *beats* at any tempo.
- **Result latch** (`func_0800A0C4`): called with 1 ("lost") sets `result = 1` if the latch is open; called
  with 2 ("the game is over") closes the latch and schedules the win/lose banner from `result`. `func_0800A128(1)`
  is "lose now": lost *and* over. A game that does nothing until the end beat wins by default. Nothing can flip
  the result after the latch closes.
- The input gate (`unk173 == 1`) is what stops a mash on the intro from counting.

## After a microgame (`gameplay_run_script`, the "set step")
```
 result == lost ?  ── yes ──► lives -= 1 ── 0? ──► GAME OVER scene (tempo reset to base)
        │ no                      │ no
        ▼                         ▼
 intro type 6 (rest) ? ── yes ──► progress += 1 (no score)
        │ no
        ▼
 won, or set.winOnly == 0 ? ── yes ──► progress += 1 ; score += 1 (cap 999)
        │ (lost on a winOnly set: replay the same slot)
        ▼
 progress < set.count ? ── yes ──► pick next (tempo from the ramp)
        │ no
        ▼
 set_beatscript_tempo(maxTempo) ; continue the stage script
```
On a **win** with `livesRestoreMode` set (the script turns it on around a boss) `lives += 1` capped at 4.
`winOnly` is how a first-time boss works: lose → lose a life and play it again; win → the set ends. On replays
the script clears `winOnly` and instead restores a life for beating the boss.

## Pause / quit
Pausing dims the palettes and freezes the beat clock (`paused` stops the tick subtraction);
quitting from the pause menu resets the music speed and pitch, the lives and the score, and jumps the script
to its retry label.

## Translating to pip-engine
`kit.microgames`: `stage.run(sets)` with `set = {pool, count, shuffle, winOnly}`; a **beat clock**
`clock.bpm` with `ticksPerFrame = bpm / 150` (24 ticks a beat) that every microgame reads for its timing; a
microgame contract `{start(difficulty), update(dt, clock), lose()}` where the kit owns the end-of-game beat and
the **result latch** (`lose()` is idempotent and ignored after the end); `lives = 4`, `score ≤ 999`; the
quadratic ramp `min + (max−min)·p²/(n−1)²` per set; difficulty `0..2` with a stage-wide offset; the "unplayed
first" ordering; the rest interstitial as a non-scoring entry. Music pitch rising with tempo is a nicety the
same clock can drive.

## Edge cases to keep
- Win by default at the end beat; a game only ever *loses*. Latch the result at the end beat.
- Gate input on the "go" beat, or the instruction screen eats the first press.
- Shorten games by raising BPM, never by scaling the script; everything stays in beats.
- `winOnly` sets replay the same slot on a loss; the rest of the time a loss still advances the set.
- Rest interstitials advance progress but not score; bosses score like anything else.
- Cap the tempo (250) — above it the beat is shorter than a human reaction.
- Difficulty is `min(2, base + offset)`; design three variants, not a continuum.
