# Study · Castlevania: Symphony of the Night (PS1) · experience, level-ups and the damage formula

Learned from the `sotn-decomp` project (Xeeynamo, github.com/Xeeynamo/sotn-decomp, commit
`66a337e30f839a9c724ae008190d3dc60a6b5392`). No code taken; the mechanism and its constants are the subject.
Sources: the experience curve and starting stats (`src/config_us.h`, `src/dra/5F60C.c`), the level-up and
experience-award routines and the two damage formulas (`src/dra/5D5BC.c`), and the attack/defence composition
(`src/dra/menu.c`). Frame-count buffs are at 60 fps.

## Why this one
"Make my guy level up" is the second thing a kid asks for after "make him jump". SotN's growth is four stats,
coin flips, and one table — simple enough to show on a card, and the damage formula on top of it is a handful of
integer steps (subtract defence, floor at 1, double on weakness, halve on resistance). It also solves the problem
every RPG-lite hits on the floor: grinding weak monsters, by scaling experience with the level gap.

## State it keeps
Player: `level` (1–99), `exp`, `hp/hpMax`, `mp/mpMax`, `hearts/heartsMax`, four base stats `STR CON INT LCK`
(each 0–99), equipment bonuses per stat, derived `attack` (per hand) and `defense`, and four element sets:
weak-to, resist, immune, absorb. Enemy kind: `hitPoints, attack, defense, level, exp`, and the same four element
sets plus `attackElement`.

## Experience and levelling (`CheckAndDoLevelUp`, `func_800FE044`)
1. **Award.** On a kill, start from the enemy's `exp`. If the player is *above* the enemy's level, multiply by
   2/3 once per level of difference (integer, floor 1). If *below*, add a quarter once per level of difference,
   capped at 5 steps (×1.25⁵ ≈ ×3.05). Add to `exp`, cap at the level-99 total.
   A 10-level gap downward leaves 1.7% of the exp — grinding stops paying by itself.
2. **Check.** If `exp ≥ expNext[level+1]` and `level < 99`: level up, then re-check (two levels in one kill are
   allowed).
3. **Per level gained:** `mpMax += 4 + coin` (4 or 5); `hpMax += hpStep[level/10]` and current hp by the same;
   `heartsMax += 2`. Each of the four stats: flip a coin, +1 on heads, clamp 99. If fewer than two stats went up,
   a mercy point goes to one random stat (which may be one that already rose, so +2 is possible).

`hpStep` by decade of level: 1, 3, 6, 10, 20, 30, 40, 50, 100, 200 — so HP growth is slow early and brutal late,
while stats stay a coin a level the whole way.

### The experience curve (`g_ExpNext`, totals to reach each level)
| level | total exp | step |
|---|---|---|
| 2 | 100 | 100 |
| 5 | 450 | 200 |
| 10 | 2 200 | 450 |
| 20 | 10 450 | 950 |
| 25 | 17 500 | 2 400 |
| 30 | 35 000 | 4 100 |
| 40 | 101 500 | 9 000 |
| 50 | 200 000 | 10 000 |
| 60 | 318 000 | 12 000 |
| 70 | 456 000 | 14 000 |
| 80 | 614 000 | 16 000 |
| 90 | 792 000 | 18 000 |
| 99 | 999 999 | — |

Shape: steps grow by +50 per level up to level 20 (a quadratic curve), kink upward in the 20s, then become flat
+10 000 per level from 40 and rise by 2 000 per decade after that. A kids' version is "step = 50 · level" for the
first stretch and a constant after.

### Starting values (`src/dra/5F60C.c`)
Main hero: hpMax 70, hearts 10, mpMax 20, all stats 6, with a +1 to each stat if the prologue was finished at
full HP (+1 STR if over half, +1 CON if under). The prologue hero: hp 50, hearts 30, mp 20, all stats 10.

## Deriving attack and defence (`src/dra/menu.c`)
- `statTotal = base + equipBonus` (bonus clamped 99); CON's equipment bonus counts ×8, INT's ×4.
- **Attack (per hand)** `= weaponAttack + (STR if weaponAttack ≤ STR, else STR/2) + accessory bonuses`, clamp
  0–999. A weak weapon gets full STR, a strong weapon only half: the stat matters more when the gear is bad.
- **Defence** `= Σ hand/body defence + Σ accessory defence + √CON − 2`, clamp 0–999. Defence from CON is a square
  root — doubling CON adds about 40% more defence, not double.
- Temporary buffs are flat +20 to a stat/attack/defence for 4 096 frames (68 s).

## Damage: player hits enemy (`DealDamage`, `src/dra/5D5BC.c`)
Inputs: attacker's `attack` and `attackElement`; enemy's `defense` and four element sets.
1. No element → treat as plain "hit". Elements are a bit set; the test is "all of the attack's element bits are
   in the enemy's set".
2. **Immune** → 0 damage, flagged. **Absorb** → the enemy *heals* by the damage, flagged.
3. **Strength** (resist) → damage /2. **Weakness** → damage ×2 (any overlapping bit).
4. **Critical**: if `critRate > rand & 255`, draw four numbers `base[i] + rand 0–63` and take the highest stat:
   STR → ×2; CON → + defence/2 (or + damage/2 if damage already exceeds defence); INT → + √(rooms visited);
   LCK → + rand(1…LCK). Flagged as critical for the number popup.
5. `damage = max(damage − defense, 1)`, cap 9 999. One helmet halves enemy defence first.
The return packs the damage with flags (immune / absorb / critical) for the display path.

## Damage: enemy hits player (`HandleDamage`, `CalcPlayerDamage`, `src/dra/5D5BC.c`)
1. Element multipliers against the *player's* sets: weak ×2, resist /2, immune → 0 (early out), absorb → heal.
2. `taken = attack − defense`. Poisoned → ×2. A luck charm gives a dodge: `LCK · charms ≥ rand & 511` → no damage.
3. If `taken ≤ 0`: with defence ≥ 100 it is a true block (0, "clink"), otherwise it becomes **1** — chip damage
   always lands unless armour is heavy.
4. **Severity class** from the ratio to max HP, used for the knockback animation (see `sotn-hit-detection.md`):
   `taken·2 ≥ hpMax` → heavy launch; `attack·50 ≥ hpMax` (i.e. ≥ 2% of max) → medium; else light flinch.
   Petrification and some hazards deal a flat `hpMax/8`.
5. `hp −= taken`, die at 0. Certain armour converts damage into hearts or grants a 512-frame defence buff.

## Constants
| | value | per second |
|---|---|---|
| exp scale above enemy | ×2/3 per level | — |
| exp scale below enemy | ×5/4 per level, max 5 | — |
| mp per level | 4 or 5 | — |
| hearts max per level | +2 | — |
| stat gain per level | coin per stat, mercy if < 2 | — |
| buff length | 4 096 f | 68 s |
| defence buff on hit | 512 f | 8.5 s |
| chip damage floor | 1 | — |
| damage cap | 9 999 | — |
| light / medium / heavy hit | < 2% / ≥ 2% / ≥ 50% of hpMax | — |

## Things learned that are not built yet
- Familiars level on their own curve (exp/level → bit-length of the quotient); a pet system for later.
- Status ailment timers (poison, curse) scale with CON/INT; stone is a damage kind, not an element.
- A room counter feeds INT crits and one armour's defence — "how far you have explored" as a stat.

## Edge cases to keep
- Level-up is recursive: one big kill can skip levels; the stat coin-flips run once per level gained.
- Stats clamp at 99 *before* the mercy point is counted, so a maxed stat does not eat the mercy.
- Immune beats absorb beats strength/weakness, in that order; test them in that order.
- Zero or negative damage still becomes 1 unless defence ≥ 100 — the "always some damage" rule is what keeps
  bosses honest against a tank build. Expose it as a knob (`chipDamage`).
- Everything is integer division; `5/4` steps on exp 1 give 1, so tiny exp values never grow.
