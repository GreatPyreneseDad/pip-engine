# Study · Castlevania: Symphony of the Night (PS1) · drop tables and the loot roll

Learned from the `sotn-decomp` project (Xeeynamo, github.com/Xeeynamo/sotn-decomp, commit
`66a337e30f839a9c724ae008190d3dc60a6b5392`). No code taken; the mechanism and its constants are the subject.
The roll lives in two places: the per-enemy definition and the kill path in the stage collision routine
(`src/st/collision.h`), and the item-class roll in the shared game library (`src/dra/5D5BC.c`). The prize
table and its odds are in `src/st/collision.h`; the enemy record layout is in `include/game.h`.

## Why this one
Every "monster drops stuff" on the floor wants the same three feelings: *usually* a little something (a heart,
a coin), *sometimes* the thing this monster is known for, and *rarely* the thing you tell your friends about.
SotN does it with two numbers per enemy and one shared prize table, plus a luck stat that nudges every stage of the
roll. The structure is small enough to hand a seven-year-old as "common / uncommon / rare" and still has room for a
designer to tune.

## State it keeps
Per enemy kind (a static record, `EnemyDef` in `include/game.h`): `rareItemId`, `uncommonItemId`,
`rareItemDropRate`, `uncommonItemDropRate` (rates are out of 256), `exp`, `level`, plus a drop *class* carried in
the entity's flag bits (two bits → class 0–3; class 0 never drops).
Per player: `LCK` (luck, 0–99 after bonuses), count of a "better drops" accessory worn (0–2).
Per kill: one spawned drop entity with an item id and an initial upward velocity.

## Update order, on a kill
1. **Does anything drop at all?** Only if the enemy's class is 1–3. Base chance by class, out of 256:
   class 1 → 64, class 2 → 32, class 3 → 16 (`g_testCollLuckCutoff` in `src/st/collision.h`).
   Luck scales it: `chance' = chance + chance · LCK / 128` (`func_800FF460`, `src/dra/5D5BC.c`). Roll
   `rand & 255 < chance'`. With LCK 99 a class-1 enemy drops about 44% of the time; with LCK 6, 26%.
2. **Which tier?** (`func_800FF494`, `src/dra/5D5BC.c`) Draw `r = rand & 255`, then shave off a luck tax:
   `r -= (LCK + (rand & 31)) / 20`. If the better-drops ring is worn, also `r -= rareRate · rings`.
   If `r < rareRate` → **rare**. Otherwise `r -= rareRate`, apply the ring and luck tax again, and if
   `r < uncommonRate` → **uncommon**. Otherwise → **common**, index `= rand % 28`, +1 if the enemy has no rare
   rate, +1 if no uncommon rate, + rings worn. The result is an index into a 32-entry prize table.
3. **Resolve the id.** Rare and uncommon are the enemy's own item ids. Common goes through the shared prize
   table. One special weapon replaces the whole step with its own threshold table (see below). One boss swaps its
   rare for a lesser gem until the game has been cleared once — a story gate on a drop.
4. **Spawn.** Ids ≥ 128 are equipment (a different pickup entity), below that are "prize" pickups (hearts, money,
   food). The pickup is given `vy = −3.5 px/frame` (−210 px/s at 60 fps) so it pops out of the corpse.
5. **Experience** is granted on the same path, before the drop roll (see `sotn-stat-growth.md`).

## The common prize table (`g_testCollPrizeTable`, `src/st/collision.h`)
32 slots; the base roll only reaches 0–27, the extra slots are reached only by the +1/+ring shifts.

| slots | prize | odds on a plain 0–27 roll |
|---|---|---|
| 1, 15–25 | small heart | 12/28 |
| 0, 3–8 | gold 2 ($25) | 7/28 |
| 9–12 | gold 3 ($50) | 4/28 |
| 13–14 | gold 4 ($100) | 2/28 |
| 26–27 | large heart | 2/28 |
| 2 | gold 1 ($1) | 1/28 |
| 28 | gold 1 ($1) | shift only |
| 29 | gold 5 ($250) | shift only |
| 30 | gold 6 ($400) | shift only |
| 31 | meal ticket (food) | shift only |

So the "nothing special" drop is ~43% heart, ~50% small money, ~7% a bigger coin; wearing the ring or killing an
enemy with no special drops slides the window toward the rich end of the table. The repo's own comment block
above the table lists the odds the designers intended (12/32 small heart, 7/32 $25, 4/32 $50 …); the shift
mechanism is how the tail entries become reachable.

## The threshold-table variant (jewel weapon, `g_jewelSwordDropTable`)
A second shape worth keeping: pairs of (threshold out of 4096, item). Roll `rand & 0xFFF`, walk the pairs, take the
first whose threshold ≥ roll. Odds are the gaps between thresholds: 3073, 768, 208, 32, 8, 5, 2 of 4096 — a
geometric tail with a 1-in-2048 top prize. Ascending thresholds are the whole data structure; no weights to
normalise.

## Constants that matter
| | value |
|---|---|
| drop class base chances | 64 / 32 / 16 of 256 (25%, 12.5%, 6.25%) |
| luck multiplier | × (1 + LCK/128) |
| luck tax per tier | (LCK + rand 0–31) / 20, taken off the 0–255 roll |
| common roll | rand % 28 into a 32-slot table |
| pickup pop | vy −3.5 px/f = −210 px/s |
| rate units | per-enemy rates out of 256 |

## Things learned that are not built yet
- Pickups in SotN are entities with their own gravity and a lifetime; coins bounce. We only have `kit.burst`.
- An "enemy seen" flag is set on first hit for the bestiary; a drop can be gated on a global clear flag.
- Equipment drops carry a "castle flag" so a unique drop can be made once-only per save.

## Edge cases to keep
- Two bits of class means **zero is "never drops"** — bosses and scenery share the code path harmlessly.
- The common index can exceed 27 by up to 4 (two missing rates + two rings); the table must have 32 entries or
  clamp. Make the table length the clamp.
- Luck taxes happen *twice* (once per tier check) and each draws its own random — a high-luck player sees rare
  and uncommon both become more likely, not just the first.
- The roll uses integer division throughout; with LCK below 20 and a low random the luck tax is often 0. That is
  the intended "luck barely matters until it does" curve; keep integers.
