# Study · Pokémon Red/Blue (Game Boy) · experience curves, exp gain, and what a level buys

Learned from pret's `pokered` disassembly, commit `af519899719f0754965776faac0e836a3b906e6d`. Curve shapes:
`data/growth_rates.asm` and `engine/pokemon/experience.asm`. Exp awarded per fight: `engine/battle/experience.asm`
(lines 57–107, boost at 328–340). Stat from level: `home/move_mon.asm` (`CalcStat`, lines 54–220). Base exp
yields come from `data/pokemon/base_stats/*.asm`. No code taken; the shapes and constants are the subject.
All division floors.

## Why this one
"Level up" is the most requested reward in any kids' game and the easiest to get wrong: a curve that is linear
feels like nothing, one that is too steep stalls the game at level 30. These six cubics are the ones that shipped
and were copied for twenty-five years. The exp-per-win formula and the stat formula are the other two legs of the
stool; together they decide how fast the number goes up and how much it matters when it does.

## Exp needed to be level `n` (total, from 0)
Six curves, all cubic, `exp(n) = a/b · n³ + c · n² + d · n − e`:

| curve | a/b | c | d | e | exp(50) | exp(100) |
|---|---|---|---|---|---|---|
| medium-fast | 1 | 0 | 0 | 0 | 125,000 | 1,000,000 |
| slightly-fast | 3/4 | 10 | 0 | 30 | 118,720 | 849,970 |
| slightly-slow | 3/4 | 20 | 0 | 70 | 143,680 | 949,930 |
| medium-slow | 6/5 | −15 | 100 | 140 | 117,360 | 1,059,860 |
| fast | 4/5 | 0 | 0 | 0 | 100,000 | 800,000 |
| slow | 5/4 | 0 | 0 | 0 | 156,250 | 1,250,000 |

Only the four pure/near-pure cubics are used by the shipped roster (medium-fast, medium-slow, fast, slow); the two
"slightly" curves are defined and unused. Medium-slow is the interesting one: its negative square term makes early
levels *cheaper* than medium-fast (exp(10) = 560 vs 1000) and late levels dearer — a front-loaded curve that feels
generous for the first hour. At `n = 1` it is actually negative (−54), floored to 0 in practice.

Level from exp is found by scanning upward from level 2 until `exp(level) > currentExp`, then stepping back one.
Max level is 100; exp is capped at `exp(100)` on gain.

## Exp awarded for a win
```
gain = floor( baseExp · defeatedLevel / 7 )
```
with `baseExp` a per-species constant (shipped range 20–255), **divided first by the number of participants**
(each creature that fought gets the divided share), then:
- ×1.5 (`gain += floor(gain / 2)`) if the creature was traded in from another save;
- ×1.5 again if it was a trainer battle rather than a wild one.
A level-5 wild creature with base 55 gives `floor(55 · 5 / 7) = 39`; medium-slow needs 560 total to reach 10, so
about a dozen early wins per few levels — the opening pacing.

Each win also adds the defeated species' base stats (each of the five) to the winner's hidden "stat exp"
accumulators (capped at 65535 each) — grinding slowly fattens stats beyond what level alone gives.

## What a level buys (the stat formula)
```
stat  = floor( ( (base + iv) · 2 + floor(ceil(sqrt(statExp)) / 4) ) · level / 100 ) + 5
hp    = floor( ( (base + iv) · 2 + floor(ceil(sqrt(hpExp))   / 4) ) · level / 100 ) + level + 10
```
`iv` is a hidden 0–15 per stat rolled at creation (the HP one is assembled from the low bit of the other four), and
`ceil(sqrt(statExp)) / 4` tops out at `ceil(sqrt(65535)) / 4 = 64`. Stats are capped at 999. On level-up the HP
difference between old and new max is added to current HP, so levelling never leaves you hurt.

Linear in level, so a level-50 creature has roughly 5× the attack of a level-10 one; the damage formula then
multiplies by level *again*, which is why a 10-level gap is decisive.

## Design shape, for the line
- Pick one cubic. `n³` is the honest default; `0.8·n³` is "fast", `1.25·n³` is "slow". The medium-slow shape is
  a trick worth keeping as an option: cheap first ten levels, then catch-up.
- Exp per win `≈ k · enemyLevel`, with `k = baseExp / 7` in 3–36. Divide by party size if several fought.
- A level should buy a *linear* stat gain plus a flat floor (+5, or +10 and +level for HP) so level 1 is not zero.
- Show the bar: total needed to the next level minus current is the number the kid watches.

## Edge cases to keep
- Cap exp at `exp(maxLevel)` *before* recomputing level, or the scan runs past the table.
- A creature can gain several levels from one win; loop level-up handling until the scan stops.
- The participants list must be captured at the moment of the win, not after switches.
