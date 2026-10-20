# Study · Mario Party (N64) · the party board as data: spaces, chains, event hooks, the star rotation, turn-tiered events, and the computer player's decision tree

Learned from the mariopartyrd decompilation, `github.com/mariopartyrd/marioparty` at commit
`26dca4f3cf2dab1839bc1de3579b7227b65b9ee6`. Sources: `include/common_structs.h` (`GW_PLAYER`, `GW_SYSTEM`,
`GWCOMMON`, `DecisionTreeNonLeafNode`), `include/spaces.h` and `src/engine/spaces.c` (space types, chains,
event lists, `LoadBoardSpaces`, `ExecuteEventForSpace`, `BoardGetRandomSpaceOfType`), `src/4D770.c`
(`SetPlayerLandedSpaceType`, `GetSumOfPlayerStars`, `RNGPercentChance`, `GetTurnsElapsed`, `SetPlayerOntoChain`,
`SetNextChainAndSpace`), `src/53680.c` (`AdjustPlayerCoins`, `PlayerHasCoins`, `PlayerIsCPU`, the difficulty
setter), `src/3F5B0.c` (`RunDecisionTree`), one board overlay's star-cycle code (`src/overlays/ovl_36_*/2418D0.c`),
the turn-tiered events in `src/overlays/ovl_46_*/282820.c` and `src/overlays/ovl_65_*/2B74A0.c`, and the results
scene `src/overlays/ovl_40_*/259EB0.c`. The code is C; nothing is transcribed. **What this commit does not
have in C**: the dice roll, the minigame picker, and the end-of-game bonus awards are still `INCLUDE_ASM` stubs
(and the repo ships no `asm/` tree), so those are described only as far as the data they read is visible.

Units. Turn-based; frame rate is irrelevant except for the dice animation. Coins and stars are small integers.

## Why this one
"A board game with minigames" is a design shape, and the shape is what the floor needs: a **board that is data**
(points in space, typed, strung into paths, with event hooks), a **turn loop** that reads it, a **per-player
record** of what happened this turn (so the minigame picker can group players), a **star that moves around a
fixed set of spots**, events that **scale with the turn number**, and a computer player that is a **data-driven
coin flip** rather than a planner. None of that is a character.

## The board as data (`spaces.c`)
A board file is three lists:
- **Spaces**: `{type, pos (x,y,z) × 5, scale, eventList}`. Types: 0 invisible (junctions and path bends),
  1 blue, 2 red, 3 minigame, 4 happening, 5 star, 6 chance, 7 start, 8 item-shop, 9 the boss space. A type can be
  changed at runtime (`BoardSpaceTypeSet`), which is how the star spot moves and how a whole chain is recoloured
  (`BoardSetSpaceTypeInChain`: every space of type A on chain C becomes type B).
- **Chains**: ordered lists of space indices — the paths. A player's position is `(chain, indexOnChain)`, with a
  `next` pair queued for the move in progress (`SetPlayerOntoChain`, `SetNextChainAndSpace`). Junction choices
  are "which chain next".
- **Events**: each space has a list of `{activationType, executionType, fn}`; activation 1 = landed, 2 = passed
  (others are board-specific); execution 1 = call now, 2 = run as a child process and wait. Four pseudo-spaces
  (`-2` new turn, `-4` player turn, `-5` player dice) let a board hook the turn loop without special cases:
  the loop simply "executes the event for space −4" at the right moment.
`BoardGetRandomSpaceOfType(mask)` walks the space list from a random start, wrapping, and returns the N-th
space whose type is in the mask; `GetRandomChanceSpace` is this with the chance type.

## Per-player record (`GW_PLAYER`)
`coins` (0..999), `stars` (0..99), `coins_mg` (coins won this minigame, applied after it), `cur_chain /
cur_space / next_chain / next_space`, `turn_status` (the colour landed on this turn), per-type landing
counters (`happening_count`, `red_count`, `blue_count`, `minigame_count`, `chance_count`, `item_count`,
`boss_count` (the field names in the struct are the game's own) — the raw material for end-of-game awards), `coins_total` (net minigame coins, for the
"minigame star"), `coins_max` (peak coins, for the "coin star"), `cpu_difficulty` and the `CPU` flag.
`AdjustPlayerCoins` clamps to `0..999` and bumps `coins_max`; a star grant clamps at 99.

## Game record (`GW_SYSTEM`, `GWCOMMON`)
`maxTurns` (20 / 35 / 50 by play length), `currentTurn` **counting down**, so `turnsElapsed = maxTurns −
currentTurn + 1`; `curPlayerIndex`, `curSpaceIndex`; `starSpaces[7]` and `chosenStarSpaceIndex`; a 32-slot
`boardWork[]` scratch array that boards use for their own counters (e.g. "times the start was passed", the
current star-space index); the save-file side has per-minigame records and unlock flags.

## Landing colour → team shape (`SetPlayerLandedSpaceType`)
After a move, the landed type is folded to a **status**: blue/minigame/chance/start/item-shop → `1`, red/boss →
`2`, happening → `4`, star/invisible → `0` (no change). The HUD shows the four statuses, and the minigame
picker (asm at this commit) reads the four values: all equal → everyone plays; one odd one out → 1 vs 3; two
and two → 2 vs 2; a `4` → the one-player kind. The design is: *decide the minigame's player grouping from a
one-byte-per-player record of the turn, and make every space type collapse to one of three colours.*

## The star cycle (one board's version, `ovl_36_*/2418D0.c`)
Seven candidate spots in an order array, with a parallel **minimum-position** array. Shuffle: 30 times, pick two
random slots; skip if equal, skip if either spot would move to a position below its minimum; else swap both
arrays' entries. So far-away spots cannot come first. `chosenStarSpaceIndex` walks the order; when a star is
bought it advances; past the 7th it resets, reshuffles, and if the new first spot equals the old last, the two
are swapped so the same spot never repeats back-to-back. Rendering: all seven candidate spaces are set to blue,
the already-used ones to a "used" type, the active one to the star type; the board also flags the active one so
the "pass by the star spot" event knows which spot is live. Another board uses the same `++index mod 7`.

## Events that scale with the turn
`ovl_46_*`: an event's severity tier is `turn ≤ 5 → 10, ≤ 15 → 20, ≤ 30 → 30, ≤ 45 → 40, else 50` (coins at
stake). `ovl_65_*`: a theft event's tier is `turn < 10 → 0, < 20 → 1, < 40 → 2, else 3`. The pattern: *the same
event hurts more later*, keyed on the turn counter, not on player state.

## The computer player's decision tree (`RunDecisionTree`)
A board choice (take this fork / buy the star / pay the toll) is an array of nodes `{type, cond, result}`. The
evaluator walks the array; a node whose condition fails `continue`s to the next, a node that passes decides.
Conditions by type: 1 "I have ≥ N coins"; 2 "any of these board flags set"; 3 "player count mask"; 4 compare a
`boardWork[i]` against a constant (`==, !=, <, ≤, >, ≥`); 5 "my CPU difficulty is in mask"; 6 call a function;
7 "turns elapsed ≥ N"; 0 always. The `result` word is either a jump (negative: continue at another node list)
or a **leaf**: `{answerBit, pEasy, pOther}` — the CPU answers `answerBit` with probability `pEasy` % when its
difficulty is the lowest setting and `pOther` % otherwise, else the opposite. `RNGPercentChance(p)` is
`p > (rand8 · 99) >> 8`. Example leaves from one board: a fork is taken with 85 % / 65 % at one difficulty tier,
100 % / 80 % at the default. Difficulty itself is a 0..2 (or 1..3 with a board flag) index set from the menu.
In minigames the same byte feeds reaction odds like `rand8 < 56 + 8·difficulty`.

## End of game (`ovl_40_*/259EB0.c`, what is in C)
The results scene totals, for human players only, their coins and `stars + boardWork[player + 10]` — the
second term is where the bonus awards land before the scene runs. The award logic (most coins at any time,
most minigame coins, most happening spaces) is still asm here; the fields it reads (`coins_max`,
`coins_total`, `happening_count`) are in the player record above, which is the shape to copy.

```
 NEW TURN ─► for each player:  event(-4) ─► DICE event(-5) ─► walk chain, event(pass) per space
            ─► land: event(land), turn_status = colour  ─► next player
 all four moved ─► group by turn_status ─► minigame ─► coins_mg applied ─► currentTurn -= 1
 ─► turn 0: awards from the counters ─► results
```

## Translating to pip-engine
`kit.board`: `spaces[] = {type, x, y, events}`, `chains[][]`, `player = {chain, index, coins, stars, status,
counters}`; `move(player, n)` walks the chain firing pass events and a land event; `status = fold(type)`;
`groupByStatus()` → the minigame kind; `starCycle(spots, minimums)` with the 30-swap constrained shuffle and
the no-repeat rule; `tier(turn, thresholds)` for scaling events; `cpuDecide(tree)` with the condition table
and `{pEasy, pOther}` leaves; `coins = clamp(0, 999)`, `stars = clamp(0, 99)`, `maxTurns` 20/35/50; awards from
`coinsMax`, `coinsTotal`, `happeningCount`. Dice: `1..10` uniform is the known rule; it is not in this commit.

## Edge cases to keep
- Positions are `(chain, index)`, never `(x, y)`: junctions are "pick the next chain", and a space can appear
  in two chains.
- Keep `turn_status` separate from the space type: several types fold to one colour, and the star space folds
  to "no change".
- The star cycle's minimum-position array is what stops the first star being on the far side of the board;
  keep it, and keep the back-to-back repeat check.
- Clamp coins on every adjustment and record the peak there, or the coin award is wrong.
- Decision leaves hold *two* probabilities; difficulty only picks which one. Do not multiply.
- `turnsElapsed` is derived from a countdown; pick one direction and stick to it.
