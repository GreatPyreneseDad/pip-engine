# Study · WarioWare, Inc. (GBA) · the stage script: how a stage escalates — sets, speed-ups, the boss cadence, difficulty passes, and the endless loop

Learned from ShaffySwitcher's decompilation, `github.com/ShaffySwitcher/wariowareinc` at commit
`cac3fa3d0e8b427e5fb731d9d5b36ff937035b59`. Sources: the opcode interpreter in `src/scenes/gameplay.c`
(`gameplay_run_script`, `func_080091B0` for labels, `func_0800912C` for the result screen), the stage table and
scripts themselves, which are binary data in `bin/data_083A9C14.bin` (the stage table at ROM `0x083AA0C4`,
each entry pointing at `{baseTempo, stageInfo, script}`; note this blob's true base is `0x083A9CE0`, 0xCC past
its filename) and in the `bin/data_083A4494.bin` / `bin/data_080F*.bin` blobs where the scripts and sets live.
Decoded with a 60-line walker written for this note (not kept). The microgame loop the script drives is the
sibling note, `warioware-microgame-loop.md`. Nothing is transcribed; no microgame is named — they are ids.

Units. Tempo in BPM; see the sibling note for beats → frames. Music pitch in the engine's units, `0x100` per
step.

## Why this one
This is the *design shape* of a microgame collection, and it is data: a stage is a 60-line bytecode program
that says "three of these at 140, then three of those at 160, then the boss", with the first-time path, the
replay path, and an endless loop that adds 10 BPM a lap. Writing the factory's stages as the same little program
means a kid (or the line) can change a stage without touching the engine.

## The bytecode
Each command is `{opcode, arg}` (two 32-bit words). The ones that matter:

| op | name | effect |
|---|---|---|
| 1 | INTRO | play the stage's intro scene |
| 2 | RUN SET | `arg` → a set `{count, shuffle, winOnly, entries}`; run it to completion (the sibling note's loop); `minTempo` is the tempo at the time |
| 3 | INTERLUDE | play the between-sets scene; `arg` selects the variant (`0,1,2` plain speed-up cards, `0x1000000x` "level up", `0x20000000` "boss coming") |
| 5 | STAGE CLEAR | save the high score, mark the stage beaten, reset tempo to the stage base |
| 6 | GAME OVER scene | |
| 7 | DIFFICULTY OFFSET | `difficultyOffset = arg` (0..2) |
| 8 / 9 / 10 / 11 | music selection mode / category list / category / index | |
| 12 | TEMPO | `tempo = min(arg, tempoLimit)`; this becomes a set's `minTempo` |
| 13 | MAX TEMPO | `maxTempo = min(arg, tempoLimit)`; a set ramps from TEMPO to MAX TEMPO |
| 14 / 15 | CALL / RETURN | one level of subroutine (a saved cursor) |
| 17 / 18 | LABEL / JUMP | labels are searched by value from the current position |
| 19 | END | |
| 20 | LIVES-RESTORE MODE | `arg` = 1: winning the next set's game gives a life back |
| 21 | PITCH | set music pitch |
| 22 | BOSS RESULT scene | |
| 23 | JUMP IF BEATEN | branch when the save says this stage was cleared before |
| 24 | TEMPO LIMIT | default 300; every script sets 250 first |
| 25 / 26 | TEMPO += / MAX TEMPO += | relative to the stage base / the current max, clamped to the limit |
| 27 | UNPLAYED FIRST | order each set with never-played games first |
| 28–32 | pitch limit, pitch += , tempo/pitch ramps | |

After the set finishes, the interpreter also handles the **result screen** state (opcode 16): on "retry" it
resets lives and score, resets music speed and pitch, and jumps to label `0x8000` (first time) or `0x8001`
(replay), which every stage defines.

## The shape every stage shares (decoded from stage 0; stages 1 and 2 differ only in counts and pools)
```
TEMPO LIMIT 250
LABEL 0x8000
JUMP IF BEATEN → LABEL 0
CALL first_time            ; sets: 3 @140 → 3 @160 → 3 @170 → BOSS (winOnly) → STAGE CLEAR → BOSS RESULT
LABEL 0
CALL replay                ; three difficulty passes, then the endless loop
LABEL 0x8001
END
```
**first_time** (stage 0): `TEMPO 140; MAX 140; PITCH 0; SET{3 of 3, shuffle}` → `TEMPO 160; MAX 160;
INTERLUDE 0; PITCH +1 step; SET{3 of 5}` → `TEMPO 170; MAX 170; INTERLUDE 1; PITCH +2; SET{3 of 4}` → `TEMPO
140; PITCH 0; INTERLUDE boss; SET{1 boss, winOnly}` → `STAGE CLEAR; BOSS RESULT; END`. Stage 2's first run is
`6 @140 → 5 @165 → 3 @180 → boss`: the counts shrink as the tempo rises, so the fastest set is the shortest.

**replay**: `DIFFICULTY 0; CALL lap` → `INTERLUDE level-up; DIFFICULTY 1; CALL lap` → `INTERLUDE level-up;
DIFFICULTY 2; CALL lap` → `TEMPO 160; MAX 160; LABEL 1; TEMPO += 10; MAX += 10; INTERLUDE 2; PITCH += 1;
SET A; TEMPO += 10; …; SET B; …; SET C; CALL boss; JUMP 1`. Where **lap** = `TEMPO 140 → 165 → 180` over the
same three pools (now drawing 6 / 5 / 3 from pools of 8 / 9 / 6 — the pools grow on replay), then `CALL boss`
= `INTERLUDE boss; LIVES-RESTORE 1; SET{1 boss}; LIVES-RESTORE 0`, then `SET{1 rest}` (the non-scoring
interstitial). The boss on replay is **not** winOnly: lose it and the lap still ends, win it and a life comes
back.

So the escalation is three-layered:
1. **Within a set**: the quadratic ramp from TEMPO to MAX TEMPO (flat when they are equal, which the early
   stages use).
2. **Across sets**: +20 then +10–15 BPM per set, with an interlude card between, music pitch up a step each.
3. **Across laps**: three passes raising `difficultyOffset` 0 → 1 → 2 with a "level up" card, then an endless
   loop starting at 160 that adds **+10 BPM per set** (three sets a lap, so +30 a lap): stage 0 raises both the
   floor (`TEMPO +=`) and the ceiling (`MAX +=`), stage 2 raises only the ceiling so every set ramps from 160 up
   to an ever-higher max. Pitch +1 step per set. The 250 BPM limit is reached in three laps — a pure speed
   ceiling, since difficulty is already maxed.
The boss comes after the third set of every lap; it resets tempo to the stage base for its own run.

## The numbers
Base tempo 140 for the stages read (`baseTempo` field). Set tempos first time: 140 / 160 / 170 (stage 0),
140 / 165 / 180 (stage 2). Replay laps: 140 / 165 / 180. Endless: from 160, +10 per set, cap 250 (`TEMPO
LIMIT`). Pitch: +`0x100` per set, cap `0xC00` (12 steps). Lives 4, restored one per boss beaten on replay. Set
counts: 3 / 3 / 3 (stage 0), 6 / 5 / 3 (stage 2). Pools grow from 3 / 5 / 4 to 8 / 9 / 6 on replay. At 250
BPM a beat is 14.4 frames (0.24 s) — roughly 1.8× the speed of 140.

## Translating to pip-engine
`kit.microgames.stage(script)` where `script` is a small array of `{op, arg}` or an equivalent JSON:
`{sets: [...], firstTime: [...], replay: {laps: 3, difficulty: [0,1,2]}, endless: {tempoStepPerSet: 10,
limit: 250}}` compiled to the same six verbs (set, tempo, maxTempo, interlude, boss, loop). Keep labels `retryFirst`
/ `retryReplay`, `JUMP IF BEATEN`, `winOnly` on the first boss, and `livesRestore` around the replay boss. The
interlude variants (`speed up`, `level up`, `boss coming`) are the only three cards a stage needs.

## Edge cases to keep
- The boss resets tempo to base; a 250-BPM boss is unplayable.
- First-time bosses are win-only (replay on a loss); replay bosses are not, and pay a life back.
- The tempo limit is set first in every script, before any TEMPO; never let a relative `+=` exceed it.
- Pools grow and counts shrink with speed: fast sets are short sets.
- The result-screen retry jumps to a *different* label depending on whether the stage was ever beaten, so a
  player who has cleared the stage never sees the slow first-time path again.
- Blob addresses lie: check one known record (a `{140, ptr, ptr}` struct) before trusting a data pointer.
