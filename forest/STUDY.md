# Study: taking the guts, leaving the characters

pip-engine learns from the recomp/decomp world the way an engineer learns from a competitor's car: open the hood,
understand the engine, build our own. Christopher's rule (2026-10-19): **we want the guts, not the characters.**

## What comes across

- **Mechanisms.** How a camera chooses where to be. How a lock-on picks its target. How a kart's drift charges a boost.
  How a fish decides to bite. The damage formula. The rubber band. The coyote time. The state machine behind an enemy.
- **Numbers that make it feel right.** Gravity per frame, acceleration curves, hit-stun lengths, drop rates, the catch-rate
  formula. Constants are engineering, not expression.
- **Design shapes.** The structure of a level, a round, an economy, a day cycle, a shop. The pattern, not the content.

## What does not

- No sprites, models, music, text, names, level layouts, or story. Nothing a player would recognise.
- No code lifted. The prey is MIPS, 6502, 68k, PowerPC and C; our floor is JavaScript on a canvas. Everything is
  rebuilt in our own parts against `api/kit.md`.
- No characters. Our own character sets come from our own hands (and from the kids on the floor).

## The two halves

1. **Note** — `forest/study/<game>-<mechanism>.md`: what the mechanism does, the state it keeps, the formulas and
   constants, the edge cases, and a diagram if it helps. Written from reading the decomp. Names the game and the repo
   it was learned from, with commit hash. Prose and maths only; no code from the prey.
2. **Plugin** — `src/kit/NN-name.js` + tests + a line in `api/kit.md`, written from the note alone, in the voice of the
   kit (one `kit.*` surface, junk-safe, child-proof). The plugin header names the note it was built from.

A note can exist without a plugin (a design pattern the line can be told about in a prompt). A plugin never exists
without a note.

## For CERATA

`/cerata consume` stays for permissively licensed original code (its own hunt and licence checks apply). For the
board's decomps and recomps, CERATA is asked to **study**, not consume: the consume brief says
`-- study: write forest/study/<name>.md only; touch nothing under src/`. Until the Action has a study mode, the notes
are written by the crew.

## Where the prey list lives

`forest/board/board.csv` — a snapshot of recomp.fyi's board (2,506 rows, 2026-10-19): game, system, work type,
toolchain, status, last commit, repository. `forest/board/targets.md` is the shortlist with what each one teaches us.

## Retrieval (the forest in the factory)

Every note is chunked by heading and embedded in the factory's Supabase project (`forest_notes`, pgvector, 384-dim
gte-small run inside the edge function; no outside embedding service). The factory's `build` op searches the forest with
the kid's brief and hands the line the top notes as "FROM THE FOREST": engineering to borrow, never names. Ops:
`forest_search {q, k}` (public) and `forest_ingest {}` (re-reads this folder from GitHub main; the `forest` workflow calls
it on every push that touches `forest/study/`). `forest/study/INDEX.md` is the human index (`node scripts/forest-index.mjs`).
