# Study · Fire Emblem: The Sacred Stones (GBA) · hit, crit, the weapon triangle, and the round of combat

Learned from the FireEmblemUniverse `fireemblem8u` decompilation, commit `f2e1f060dbe5b0cc35285df5a0f6659860644a04`.
Files: `src/bmbattle.c` (stat derivation, round structure, the hit), `src/rng.c` (the two-roll hit check),
`src/data_terrains.c` (terrain avoid/defense/heal tables). No code taken; the formulas and constants are the subject.
Combat here is turn-based and resolves in one go, so there is no frame rate to convert; everything is integers.

## Why this one
Advance Wars (see `awds-combat.md`) is the kids' tactics note for *armies*: percentage health, luck, counter-fire.
This is the note for *characters*: a handful of named stats, a weapon that matters, a hit that can miss, a crit that
triples, and a double-attack for the fast one. Pokémon Red's damage (`pokered-damage.md`) is level-scaled and
multiplicative; this one is flat subtraction (attack − defense) with every bonus a small additive integer, which is
far easier for a kid to read off a screen and predict. It is also where "forest gives +20 avoid" lives.

## State the fight keeps
Two **battle units**, each a copy of the real unit so nothing is written back until the end: `hp, str, skl, spd, def,
res, lck, con`, the equipped weapon (`might, hit, crit, weight, type, range`), the terrain stood on, plus the derived
`attack, defense, attackSpeed, hitRate, avoidRate, critRate, dodgeRate`. A **range** (Manhattan distance between the
two) decides who may strike at all. A **hit list** (max 8 entries) is filled first and then played back by the
animation, so the whole exchange is decided before anything moves.

## Setup order (once per fight)
1. Snapshot both units; range = |dx| + |dy|.
2. Pick weapons. A weapon that does not cover `range` is dropped → that side cannot counter. Asleep or petrified → cannot counter.
3. **Weapon triangle.** Two triangles, physical and magical: sword beats axe beats lance beats sword; anima beats
   light beats dark beats anima. The winner gets **+15 hit, +1 damage**; the loser the negative of both. A "reaver"
   weapon multiplies both sides' triangle bonuses by −2 (so ±30 hit, ±2 damage, reversed); two reavers cancel back.
4. Terrain bonuses for each side from the class's terrain tables (flyers get zeros everywhere).
5. Derive stats (below), then unwind the round.

## Derived stats
| stat | formula |
|---|---|
| attack | `(might + triDmg) × eff + str`, where `eff` = 3 if the weapon or class is "effective" against the target's class (a few legendary weapons use 2), else 1 |
| defense | `def + terrainDef` against physical; `res + terrainRes` against magic |
| attack speed (AS) | `spd − max(0, weight − con)`, floored at 0 |
| hit | `2·skl + weaponHit + lck/2 + triHit` (+5 at the top weapon rank) |
| avoid | `2·AS + terrainAvoid + lck`, floored at 0 |
| crit | `weaponCrit + skl/2` (+15 for crit-bonus classes, +5 at top rank) |
| dodge | `lck` |
| effective hit | `clamp(hit − avoid, 0, 100)` |
| effective crit | `max(0, crit − dodge)`; forced to 0 if the defender carries a crit-negating item |

Support partners nearby add small flat bonuses to attack/defense/hit/avoid/crit/dodge (see `fe8-growth-exp-support.md`).
A status buff adds +10 to one of attack, defense, crit, avoid. A petrified or sleeping defender is hit at 100 and
crit at +30.

## The round
```
 attacker strikes ──(×2 if brave weapon)──► defender alive and can counter?
        │                                        │ yes
        │ kill ends everything                   ▼
        │                               defender strikes (×2 if brave)
        │                                        │
        ▼                                        ▼
      done ◄──────────── follow-up: whoever has AS ≥ other + 4 strikes once more (×2 if brave)
```
The follow-up threshold is **4**. Any strike that drops someone to 0 HP ends the list. A unit whose weapon is
"uncounterable" (bows at range, some tomes) strikes without reply.

## One strike
1. **Sure Shot** (sniper class skill): `level %` chance to skip the hit roll entirely.
2. **Hit roll**: average of two uniform rolls in 0..99 must be `< effectiveHit`. This is the famous "2RN": a displayed
   50 is a true 50, but a displayed 80 lands about 92% of the time and a displayed 20 only about 8%. The curve is
   roughly `P ≈ 2·(h/100)²` below 50 and `1 − 2·((100−h)/100)²` above. Kids read "80%" as "nearly always" — this makes
   the number honest to that reading. (One roll `< threshold` is used for everything else.)
3. **Great Shield** (general class skill, defender): `attackerLevel %` chance the hit does 0.
4. **Pierce** (wyvern knight class skill): `level %` chance `defense = 0`.
5. `damage = attack − defense`.
6. **Crit roll** (one roll `< effectiveCrit`): damage ×3. An assassin's crit has a further 50% (25% vs a boss) to be a
   **Silencer**: damage set to the cap.
7. Clamp to `[0, 127]`, then to the defender's remaining HP. A "devil" weapon has a `(31 − lck) %` chance to deal the
   damage to its own wielder instead. HP-steal weapons heal the attacker by the damage dealt.
8. Weapon durability −1 on a hit (always for magic/uncounterable).

Any strike with nonzero damage marks the attacker as having "done damage", which is what the exp formula later
checks: a fight of all misses still pays 1 exp.

## Terrain (common foot table; flyers get 0 everywhere)
| terrain | avoid | def | res | heal/turn |
|---|---|---|---|---|
| plain, road, floor, bridge | 0 | 0 | 0 | — |
| forest | 20 | 1 | 0 | — |
| thicket | 30 | 2 | 0 | — |
| pillar | 20 | 1 | 0 | — |
| mountain | 30 | 1 | 0 | — |
| peak | 40 | 2 | 0 | — |
| fort | 20 | 2 | 0 | 20% |
| gate | 20 | 3 | 0 | 10% |
| throne | 30 | 3 | 5 | 10% |
| village, sea (for those who can stand there) | 10 | 0 | 0 | — |
| desert | 5 | 0 | 0 | — |

## Edge cases to keep
- Resolve the whole exchange into a list first, play it back second. It makes the forecast ("you will hit twice for
  12, they hit back for 7") trivially correct and lets the kid skip the animation.
- Hit and crit chances are clamped *after* subtraction; a 0% crit must truly never happen (crit-negating items set it
  to 0, not −something).
- The follow-up checks `|AS₁ − AS₂| ≥ 4` on *attack* speed, so a heavy weapon on a fast unit loses the double.
- A weapon that cannot reach (`range` outside `[min, max]`) means *no counter*, not a miss. That is the whole reason
  bows are scary to a kid's flyer and safe at distance.
- Damage is capped to remaining HP before it is recorded, so the hit list's totals are exact for the HP bar.
