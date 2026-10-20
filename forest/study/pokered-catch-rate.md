# Study · Pokémon Red/Blue (Game Boy) · the catch roll

Learned from pret's `pokered` disassembly, commit `af519899719f0754965776faac0e836a3b906e6d`. The whole mechanism
lives in `engine/items/item_effects.asm` (the ball-throw routine, lines 104–418), with the per-creature base
catch rate stored in each entry of `data/pokemon/base_stats/*.asm`. No code taken; the arithmetic and its
constants are the subject. All division is integer division, floored.

## Why this one
"Catch the thing" is the oldest kids' game loop there is, and this is the version that taught a generation what a
fair catch feels like: better tools help, wearing the target down helps, a lucky throw can land anyway, and the
*shakes* before the result tell the player how close they came. The shake count is the genius part — it is a
separate calculation that exists only to communicate.

## State it reads
- `catchRate` of the target, 0–255, a per-species constant. In the original the distribution is: 255 for the
  common floor (15 species), 190 and 120 for middling things, 45 for most of the rest (52 species, including
  every starter and every evolved form), 3 for the four legendaries.
- `hp`, `maxHp` of the target.
- `status` of the target: none / light (burn, paralysis, poison) / heavy (sleep, freeze).
- `ball` tier: 0 basic, 1 great, 2 ultra (a 3rd "master" tier always succeeds, no roll).

## The roll, in order
1. **Ball roll.** Draw `rand1` uniformly from `[0, ballMax]` where `ballMax` = 255 / 200 / 150 for tiers 0 / 1 / 2.
   (The original draws 0–255 and redraws until it fits; same distribution.)
2. **Status bonus.** Subtract `statusBonus` from `rand1`: 0 / 12 / 25 for none / light / heavy.
   If the result goes negative the catch succeeds immediately. Otherwise `rand1 -= statusBonus`.
3. **Rate gate.** If `rand1 > catchRate`, the ball fails. A 255-rate creature never fails here; a 45-rate one
   with no status fails here about `1 − 46/ballMax` of the time (82% with a basic ball, 69% with an ultra) before
   HP is even looked at. This gate is where rarity lives.
4. **HP factor.** `f = floor( floor(maxHp · 255 / ballFactor) / max(floor(hp / 4), 1) )`, with `ballFactor` = 8 for
   the great ball and 12 for every other tier. If `f > 255` the catch succeeds. Otherwise draw `rand2` in
   `[0, 255]`; succeed if `rand2 ≤ f`, fail if `rand2 > f`.

Reading the HP factor at full health: `f ≈ (255/12) · (maxHp / (maxHp/4)) = 85`, i.e. a third of the 0–255 range
no matter the size of the creature. At a quarter health it is ~255 (near-certain, given the rate gate passed).
The great ball's 8 instead of 12 lifts full-health `f` to ~127. The ultra ball gets no HP help at all; its
whole advantage is the tighter `ballMax` in step 1 — a surprise that is faithful to the original.

## The shake count (fail case only)
Computed only to animate how close it was. Let `x = min(f, 255)` from step 4.
- `y = floor(catchRate · 100 / ballMax2)` with `ballMax2` = 255 / 200 / 150 (same as `ballMax`). Max possible is 170.
- `z = floor(x · y / 255) + statusBonus2`, where `statusBonus2` = 0 / 5 / 10.
- shakes: `z < 10` → 0 (the ball misses outright), `10 ≤ z < 30` → 1, `30 ≤ z < 70` → 2, `z ≥ 70` → 3.

A 3-shake failure needs `x · y ≥ 70 · 255 ≈ 17850`, roughly a near-full HP factor against a common creature.
Against a rate-45 creature with a basic ball, `y = 17`, so even `x = 255` gives `z = 17` — a single shake, forever.
The animation is telling the truth about the odds.

## Constants, in one table
| knob | values |
|---|---|
| `ballMax` by tier | 255, 200, 150 |
| `ballFactor` (HP divisor) | 12, except 8 for tier 1 |
| `statusBonus` (roll) | 0 / 12 / 25 |
| `statusBonus2` (shakes) | 0 / 5 / 10 |
| shake thresholds on `z` | 10, 30, 70 |
| HP quarter floor | `max(hp/4, 1)` |

## Edge cases to keep
- `hp / 4` floors to 0 for tiny creatures; the original clamps to 1 so the divide never explodes. Keep the clamp.
- The status bonus can make `rand1` negative — that is the "always catch a sleeping thing with a lucky roll" path,
  and it is intentional. Do not clamp it to 0 before the compare.
- The master tier skips every roll. If a kit exposes "always succeeds", make it a flag, not a 999 catch rate.
- The original forbids throwing when the party/box is full and refuses in trainer battles; those are game rules,
  not catch rules. The kit function should return `{caught, shakes}` and nothing else.

## For a kids' game
Expose three knobs to the line: `rate` (255 "easy", 120 "medium", 45 "hard", 3 "legendary"), `ballTier`, and a
`weakness` 0–1 that replaces `hp/maxHp`. The shake count is the feedback the kid actually watches; a kit function
that only returned true/false would throw away the best part.
