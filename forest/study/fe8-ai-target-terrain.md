# Study · Fire Emblem: The Sacred Stones (GBA) · movement cost by terrain, the danger map, and how the AI picks a target

Learned from the FireEmblemUniverse `fireemblem8u` decompilation, commit `f2e1f060dbe5b0cc35285df5a0f6659860644a04`.
Files: `src/bmidoten.c` (movement flood fill), `src/bmunit.c` (which cost table a unit uses), `src/data_terrains.c`
(the cost tables), `src/cp_battle.c` (target and position scoring), `src/cp_data.c` (score weights),
`src/cp_0803E2F4.c` (danger map), `src/cp_utility.c` (move-towards). No code taken.

## Why this one
`dkr-racer-ai.md` is an opponent that drives. This is an opponent that *decides*: given a grid, a move budget and a
list of enemies, where do I stand and whom do I hit. The scoring is a sum of eight small terms with integer weights,
which is the simplest honest "AI" a kid can be told about ("it likes hurting you, it likes being on a hill, it
dislikes standing next to three of you") and still produces enemies that feel like they are thinking.

## Movement cost
Each class has a cost table indexed by terrain id, `−1` meaning impassable, selected by weather (clear / rain /
snow). The move budget is the unit's `mov`. The reachable set is a flood fill: a tile is reached at
`cost = cost(previous) + table[terrain]`, kept only if it is lower than any cost already recorded there and
`≤ mov`; a tile holding an *enemy* unit blocks, a tile holding an ally is passed through but cannot be a stop.
Costs stored per tile double as the pathfinding distance; a path is rebuilt by walking the gradient back.

| terrain | foot | armour | horse | fighter/axe | pirate | flyer |
|---|---|---|---|---|---|---|
| plain, road, floor, bridge, sand | 1 | 1 | 1 | 1 | 1 | 1 |
| forest | 2 | 2 | 3 | 2 | 2 | 1 |
| pillar | 2 | 2 | 3 | 2 | 2 | 1 |
| desert | 2 | 3 | 4 | 3 | 2 | 1 |
| fort | 2 | 2 | 2 | 2 | 2 | 1 |
| mountain | 4 | — | — | 3 | 3 | 1 |
| peak, thicket, cliff | — | — | — | — | — | 1 |
| river | — | — | — | — | 2 | 1 |
| sea / lake | — | — | — | — | 2 / 3 | 1 |
| wall | — | — | — | — | — | — |

Weather: rain and snow make **plains cost 2** for foot units (3 for horses in snow), mountains 5, forests 4 for
horses. Flyers ignore weather. The whole feel of "the cavalry is useless in the woods" is this table.

## The danger map (once per enemy phase)
For every unit hostile to the active side, take its strongest usable weapon and flood its move + range; every tile in
that reach gets `+ (str + might) / 2`. The result is a per-tile "how hard I would be hit standing here" number used by
the position score and by the "move toward safety" behaviours. It is filled lazily, once, and reused for every unit
that turn.

## Choosing whom to attack
```
 for each weapon I can use
   for each enemy within bird's-eye reach (mov + max range)
     mark every tile from which this weapon reaches that enemy
     ┌─ pick the best standing tile among those I can reach (position score, below)
     └─ simulate the full exchange from there (the real battle code, no dice) → combat score
     keep the (weapon, enemy, tile) with the highest combat score (ties → later wins)
```

**Position score** for a candidate tile (higher is better):
- `+50` if the target's own weapon *cannot* reach this tile back (stand at 2 when they hold a sword)
- `+ terrainAvoid + terrainDef + terrainRes` for my class on that tile
- `+5` per ally / `−5` per enemy within 3 tiles (a diamond)
- `− movementCostToGetThere` (prefer not to walk)
- `− danger / 8`

**Combat score**, each term capped, weights from one of several personality tables (default weights in brackets):
| term | value | cap |
|---|---|---|
| damage dealt | `(myAtk − theirDef) × myHit% / 100 × w[2]`; a kill is a flat 50 | 40 |
| they are low | `(20 − theirHP) × w[1]`, floored at 0 | — |
| friends around me | `Σ (4 − distance)` over allies within 3 of where I stand, `× w[1]` | 10 |
| target class bonus | class-rank table (empty in this game, so 0) `× w[1]` | 20 |
| turn number | `turn × w[1]` (the AI gets bolder as the map drags on) | — |
| **−** damage taken | `(theirAtk − myDef) × theirHit% / 100 × w[1]`; `−10` if they cannot counter at all (i.e. +10 to the score) | 40 |
| **−** danger | `dangerAt(tile) / 8 × w[1]` | 20 |
| **−** I am low | `(20 − myHP) × w[1]`, floored at 0 | — |

Sum, floor at 0, then `× 40`; if the sum is exactly 0 the raw damage-dealt term is used instead so a hopeless poke
still beats doing nothing. A second personality table zeroes every defensive term (berserk: only damage and low-HP
targets count); a third doubles damage-taken and the turn term (cautious that gets impatient).

## When no one is in reach
"Move toward" takes a goal tile, floods *from the goal* with my own cost table to get a distance field, then among
my reachable tiles picks the one with the smallest goal-distance, skipping tiles whose danger exceeds the behaviour's
allowed `maxDanger`, and (for slow units) skipping any dangerous tile at all. Ties resolve toward the bottom-right
of the map because the scan runs backwards. Goals are: nearest enemy, a scripted point, a specific character, the
safest tile, a treasure, or "flee the map".

## Edge cases to keep
- The danger map is a sum, so three weak archers covering one tile read as one strong archer. Good; that is what a
  kid expects a "dangerous square" to mean.
- The `+50` for being out of counter range dominates everything else in the position score. A kid will notice enemies
  "being cheap"; make it a knob (`spiteBonus`).
- Scores use the *simulated* battle, so every rule in `fe8-hit-crit-damage.md` (triangle, terrain, effectiveness)
  automatically shapes the AI. Build the simulator once, call it from both the forecast UI and the AI.
- A unit that attacks *always* also moves (the chosen tile); a unit set to "stay" has its reachable set reduced to its
  own tile and the same scoring still applies. One code path.
