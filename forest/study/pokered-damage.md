# Study · Pokémon Red/Blue (Game Boy) · the damage formula, crits, and the hit roll

Learned from pret's `pokered` disassembly, commit `af519899719f0754965776faac0e836a3b906e6d`. Everything is in
`engine/battle/core.asm`: the move pipeline (`ExecutePlayerMove`, ~line 3073), stat gathering (4030–4140), the core
formula (4299–4465), the critical-hit roll (4478–4542), type and same-type scaling (5075–5185), the hit roll
(5228–5417) and the random spread (5420–5454). Constants come from `constants/battle_constants.asm`, the
stat-stage ratios from `data/battle/stat_modifiers.asm`, the type chart from `data/types/type_matchups.asm`.
No code taken; the arithmetic and its constants are the subject. All division is integer division, floored.

## Why this one
Every "my guy hits your guy" game needs a number that feels right: bigger things hit harder, armour matters, a
level gap is decisive but not absurd, and there is just enough randomness that two identical hits differ. This is
the formula the genre converged on. It is also a textbook of **order**: the same multipliers in a different order
give a different (and worse-feeling) game.

## State it reads
Attacker: `level`, `attack` (or `special`), `types[2]`, `baseSpeed` (for crits), stat stages for accuracy.
Defender: `defense` (or `special`), `types[2]`, stat stages for evasion, two screen flags (double defense / double
special).
Move: `power` (0 means "no damage"), `type`, `accuracy` (0–255, where 255 is "as sure as it gets"), a
`highCrit` flag, and whether it is physical or special (in the original that is decided by the move's *type*, not
the move: types at or above a cut-off are special).

## The pipeline, in this order
1. **Critical roll** (before any stat is read, because a crit changes which stats are used).
2. **Gather stats.** Pick attack/defense or special/special. If the defender's matching screen is up, double the
   defensive stat. On a crit, *ignore* all stat stages and screens on both sides and use the raw stats, and
   double the attacker's `level`. If either stat is ≥ 256, divide both by 4 (a byte-width hack that also
   compresses extreme stat gaps; a defensive stat may floor to 0 and the original then divides by zero — guard it).
3. **Core formula.**
   ```
   base = floor( floor( floor( floor(2·level / 5) + 2 ) · power · attack / defense ) / 50 )
   damage = min(base, 997) + 2
   ```
   (The original caps the pre-+2 value at `MAX_NEUTRAL_DAMAGE − MIN_NEUTRAL_DAMAGE = 999 − 2 = 997`, then adds
   `MIN_NEUTRAL_DAMAGE = 2`.) The self-destruct family halves `defense` first (floor, min 1).
4. **Same-type bonus.** If the move's type equals either attacker type: `damage = damage + floor(damage / 2)`,
   i.e. ×1.5 floored.
5. **Type effectiveness.** Walk the type chart; for every (moveType, defenderType) pair that matches, multiply:
   `damage = floor(damage · m / 10)` with `m` ∈ {20, 10, 5, 0}. A dual-type defender can match twice (×4, ×¼,
   or 2 and ½ cancelling). If damage lands on 0 the move is flagged as a miss.
6. **Random spread.** If `damage ≥ 2`: draw `r` in `[217, 255]` (redraw until ≥ 217), `damage = floor(damage · r / 255)`.
   That is 85.1%–100%, 39 equally likely steps. Damage of 0 or 1 is left alone.
7. **Hit roll** (last, so a miss can zero everything and end a multi-turn move).

Yes — the random spread comes *after* type scaling, and the hit roll comes after damage is already computed.
The second part is a quirk; the first part is what keeps a ×4 hit from having a huge absolute variance.

## Critical hits
Chance is a byte `t` compared against a random byte: crit if `rand < t` (so `t/256`).
- Start with `t = floor(baseSpeed / 2)` of the attacker's *species*.
- Normal move: `t = floor(t / 2)` → `baseSpeed / 4`. A base speed of 100 crits 9.8% of the time; 45 → 4.3%.
- High-crit move: `t = min(t · 4, 255)` → `baseSpeed · 2`, capped. Base speed 100 → 78%; 128+ → 99.6%.
- The "pump up" status was meant to double `t` and instead halves it (famous bug; we are not keeping it).
The crit itself is applied in step 2: raw stats, doubled level. Not a flat ×2. Against a defender with boosted
defense a crit is worth more than ×2; against one with boosted attack... it is a *smaller* hit. That is a design
lesson, not a target.

## Hit chance
`accuracy` is a byte. Both sides' stages map through the same ratio table (stage −6..+6 →
0.25, 0.28, 0.33, 0.40, 0.50, 0.66, 1.00, 1.50, 2.00, 2.50, 3.00, 3.50, 4.00):
```
chance = accuracy · ratio[attackerAccuracyStage] · ratio[−defenderEvasionStage]
```
(the evasion stage is "reflected" so a raised evasion lowers the chance), floored at 1 after each multiply and
capped at 255. Then draw a byte; **miss if `rand ≥ chance`**. So even accuracy 255 misses 1 time in 256.

## Stat stages
The same 13-entry ratio table scales a raw stat for a stage from −6 to +6. Stage 0 is 1.00; each step is roughly
×1.5 up and ×0.66 down at first, then slower. A knob the line will like: "powered up" = +1 or +2 stages.

## Constants
| | |
|---|---|
| level term | `2·level/5 + 2` |
| divisor | 50 |
| minimum damage | 2 (added after cap) |
| cap | 999 |
| same-type bonus | ×1.5 |
| type multipliers | 2, 1, ½, 0 (as /10 integers 20, 10, 5, 0) |
| random spread | 217–255 of 255 (85–100%) |
| crit chance | speed/4 normal, speed·2 high-crit, cap 255/256 |
| crit effect | raw stats, level ×2 |
| accuracy miss floor | 1/256 even at "100%" |

## Edge cases to keep
- `power == 0` → skip the formula entirely (status moves).
- `defense == 0` after the /4 scaling → clamp to 1 before dividing.
- Zero damage after type scaling counts as a miss, with its own message. Immunity should *read* as immunity.
- Multi-hit moves run steps 1–7 once per hit in the original; a kit can choose per-volley or per-hit.
- Random spread skips damage < 2 so a 1-damage poke stays a 1-damage poke.

## For a kids' game
Level, power, attack, defense, one type chart, and the spread is enough for a whole creature-battler; crits and
stages are the second layer. The kit function should return `{damage, crit, effectiveness, missed}` so the game
can say "it's super effective!" — the words matter as much as the number.
