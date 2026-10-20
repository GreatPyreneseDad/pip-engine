# Study · Fire Emblem: The Sacred Stones (GBA) · growth rolls, experience, and the support bond

Learned from the FireEmblemUniverse `fireemblem8u` decompilation, commit `f2e1f060dbe5b0cc35285df5a0f6659860644a04`.
Files: `src/bmbattle.c` (level-up rolls, exp gain), `src/bmreliance.c` and `src/bmreliance-data.c` (supports),
`include/bmreliance.h` (support thresholds). No code taken.

## Why this one
`pokered-experience.md` and `sotn-stat-growth.md` already cover *curves*: exp needed per level and deterministic stat
gains. This game does the opposite and it is the version kids talk about: every level-up is a **set of coin flips**,
one per stat, and the whole party is a collection of differently weighted coins. It also has the gentlest
**friendship** mechanic in the genre — stand next to someone, get a little stronger — which is exactly the shape of
"my cat helps my dog" requests from the floor.

## State
Per unit: `level, exp (0..99)`, seven stats with per-character **growth rates** (percent, may exceed 100), stat caps
from the class, and `supports[]` — one exp counter (0..240) per possible partner. Per pair, a growth rate per turn
and a "level gained" bit so the same tier is not awarded twice.

## Level-up roll
On `exp ≥ 100`: `exp −= 100`, `level += 1`, then for each stat in order HP, Str, Skl, Spd, Def, Res, Lck:
```
gain = floor(growth / 100)            (growth over 100 guarantees whole points)
if roll(0..99) < growth mod 100: gain += 1
```
A growth-boost state adds +5 to every rate. **The empty level fix:** if all seven rolls fail, the game tries up to
two more passes, re-rolling each stat *in order* and stopping at the first success. So a level with nothing on it
has probability about `Π(1 − gᵢ)³` instead of `Π(1 − gᵢ)` — rare enough that kids never see it. Caps are applied
after. Level 20 (10 for a trainee class) disables further exp.

Auto-levelled enemies use one roll of `growth × levels` with ±1/8 noise instead of rolling each level; that is the
cheap way to make a level-12 goblin without simulating twelve level-ups.

## Experience per fight
Only the side that is allowed to level earns any. Let `L = level (+20 if promoted)` and `P = level × classPower`
(classPower is 3 for nearly every class, 1–2 for weak/trainee classes, 5 for the final boss class; promoted units
add `20 × promotedClassPower`).

| when | exp |
|---|---|
| fought, dealt 0 damage all round (or missed) | 1 |
| fought, dealt damage, no kill | `max(0, 31 − (L_me − L_them)) / classPower_me` |
| kill | the above + `20 + P_them − P_me` + class bonus (thief +20, boss +40), ×2 for an assassin's instant kill |
| healed with a staff | `10 + staffCost/20` (halved if promoted), 1 on a miss |
| danced / misc action | 20 / 10 |

Total per fight clamped to `[1, 100]`. Against a same-level peer that is `31/3 ≈ 10` for a hit and `≈ 30` for a kill
— about three kills per level at parity, and a level-20 unit hitting a level-1 gets `(31−19)/3 = 4`. That is the
whole anti-grinding device: no table, just the subtraction.

## The support bond
```
 each turn (from turn 2) ──► for every unit, for every partner
                               │ adjacent (dist 1, neither rescued) or carrying (dist 0)?
                               ▼
                 supports[pair] += pairGrowth   (clamped to next tier − 1)
                               │
      tier gates:  C at 81   B at 161   A at 241   ─── the last point comes from a talk, not a turn
```
Each unit may hold at most **5 tiers total** across all partners (an A is 3, so A + B fills it).

In battle, for each partner within **3 tiles** (alive, not being carried): add `tier_partner × bonus(partner's
affinity)` and `tier_mine × bonus(my affinity)`, then **halve the sum**. The affinity table:

| affinity | atk | def | hit | avoid | crit | dodge |
|---|---|---|---|---|---|---|
| fire | 1 | 0 | 5 | 5 | 5 | 0 |
| thunder | 0 | 1 | 0 | 5 | 5 | 5 |
| wind | 1 | 0 | 5 | 0 | 5 | 5 |
| ice | 0 | 1 | 5 | 5 | 0 | 5 |
| dark | 0 | 0 | 5 | 5 | 5 | 5 |
| light | 1 | 1 | 5 | 0 | 5 | 0 |
| anima | 1 | 1 | 0 | 5 | 0 | 5 |

So a fire/wind A-rank pair standing together gives each `(3·(1,0,5,5,5,0) + 3·(1,0,5,0,5,5)) / 2 = (3, 0, 15, 7, 15, 7)`:
+3 damage, +15 hit, +15 crit. Small numbers; a kid feels them because crit is loud.

## Knobs for the kit
`growth[]` per character (the whole personality of a unit is this array), `rerollPasses` (2), `followDistance` for
the bond (3), `tierGates` (81/161/241 of a 0..240 bar), `maxTiers` (5), the affinity table (rename, re-colour, keep
the shape: two 1-point stats, four 5-point stats).

## Edge cases to keep
- Exp is computed from the *pre-fight* copies, so a kill that also levels does not inflate its own payout.
- The 1-exp floor keeps "I attacked but missed" from feeling like nothing; the 100 cap keeps a lucky boss kill from
  skipping two levels.
- Support exp is per *pair* and stored on both sides; the tier a unit sees is `max` of its own counter, so the two
  copies must be kept in step.
- The bond bonus checks distance from the *current* positions each time stats are derived — moving away mid-turn
  really does drop the bonus.
