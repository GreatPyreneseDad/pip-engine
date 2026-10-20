# Study · EarthBound (SNES) · damage and odds, the instant win, running away, and the chase on the map

Learned from Herringway's `ebsrc` disassembly, commit `68aec5c39e67f3ef4f0be138ee58c1ba0cc33d62`.
Files: `src/battle/actions/bash.asm`, `level_1_attack.asm` … `level_4_attack.asm`, `src/battle/smaaaash.asm`,
`src/battle/miss_calc.asm`, `src/battle/determine_dodge.asm`, `src/battle/25_percent_variance.asm`,
`src/battle/calc_damage_reduction.asm`, `src/battle/success_500.asm`, `src/battle/instant_win_check.asm`,
`src/battle/main_battle_routine.asm` (the flee roll), `src/unknown/C0/C0C363.asm`, `C0C48F.asm`, `C0C524.asm`,
`C0D19B.asm` and `src/data/events/scripts/019.asm` (overworld chase, fear, initiative), `src/data/map/movement_speeds.asm`,
`include/config.asm`. No code taken. ~60 fps.

## Why this one
`pokered-damage.md` is the level-and-multiplier school. This is the **flat stats** school with one idea per rule, each
of them kid-legible: "big guy hits twice as hard as his strength", "sometimes a SMASH", "if you are way stronger the
fight just doesn't happen", "you can run if you're faster". And the fight *starts on the map*, with who-touched-whom
deciding who goes first. Those three — instant win, run-away, back-attack — are what make random encounters tolerable
for an eight-year-old.

## A normal attack, in order
```
 miss? ──no──► SMAAAASH? ──no──► dodged? ──no──► damage = k·offense − defense, ±25%, min 1 ──► reductions ──► apply
  │yes            │yes              │yes
 "missed"    4·off − def, no variance, shields set to 1   "dodged"
```
1. **Miss**: party member `weaponMiss / 16` (unarmed `1/16`); crying or nauseous adds `8/16`. Enemy: its own
   `missRate / 16`.
2. **SMAAAASH** (crit): chance `guts / 500`, with party guts treated as at least **25** (so 5% minimum).
   Damage `4·offense − defense`, no variance, and it knocks a shield down to its last hit.
3. **Dodge**: chance `(2·targetSpeed − attackerSpeed) / 500`, none if the target is paralysed, asleep, immobilised
   or solidified. A speed-20 target vs a speed-20 attacker dodges 4%; a speed-60 target vs speed-20 dodges 20%.
4. **Base damage**: `k·offense − defense` where `k` is the attack level: 1 (weak), **2 (the standard bash)**, 3, 4.
   If positive, apply ±25% variance; then floor at 1.
5. **Reductions** (`calc_damage_reduction`): halve if the target is *guarding* against a physical hit; halve again
   if the target has a shield (physical shield vs physical, psychic vs psychic); never below 1. A *power* shield
   also reflects half back at the attacker. Each hit on a shield spends one of its charges.
6. **Apply**: see `eb-rolling-hp.md` for the rolling meter and the guts save at 0. A sleeping target wakes on a hit
   with chance 128/255.

Rolls are `rand(500) < x` ("success-500"), `rand(255) < x` ("success-255") and `rand(16) < x` for misses.

## The variance (25% and 50%)
Draw two bytes `r₁, r₂` in 0..255, take the one whose `|r − 128|` is **smaller** (so the distribution peaks at zero
deviation and tails off), `d = |r − 128| ∈ 0..128`. Then `value ± value·d/512` (25% version) or `value·d/256`
(50% version), minus if `r < 128`, plus if `r > 128`. Taking the better of two is the cheap way to get a bell curve
without a table.

## The instant win (weak enemies don't get a fight)
Checked when the battle begins, never if the enemy got the first move. Let `P` = the healthy party members (no
status), `S_min` = slowest party speed, `O_min` = weakest party offense.
- No instant win if the enemies outnumber `P`.
- **Normal start**: win if `S_min ≥ fastest enemy speed` **and** for *every* enemy `2·O_min ≥ enemyHP + enemyDef`
  (one standard bash from your weakest kills it).
- **Green swirl (you surprised them)**: sort party offense descending and enemies by HP descending, then simulate
  one free round: each member in turn bashes the current enemy for `2·off − def`; if that is `≥ hp` the enemy drops
  and the next member starts on the next enemy, otherwise `hp −= (2·off − def)` and the next member continues on it.
  Win if the enemies run out before the members do.
The text says "you won" with no battle screen at all, exp is paid, and the kid keeps walking. This is the single
best anti-grind device for a kids' RPG: it never asks you to click through a fight you cannot lose.

## Running away
Chosen as an action; resolved when the round plays. Let `E` = fastest *able* enemy speed (asleep/paralysed etc.
excluded), `A` = fastest party speed, `t` = round number (1 on the first round).
- A boss present → always fails. No able enemy → always succeeds. Surprised them (green swirl) → always succeeds.
- Otherwise `score = 10·t + A`. If `score < E` → fail. Else succeed with probability `(score − E) %`.
So a party of speed 30 against a speed-40 enemy has 0% on round 1, 10% on round 2, 20% on round 3 … Every round you
stay the odds climb by ten points. Kids learn "try again" is not a lie here.

## On the map: chase, fear, and who goes first
Overworld enemies run a tiny script every 8 frames:
1. If the player **moved this frame**, or Manhattan distance to the player `> 128 px`, the enemy acts; otherwise
   (player standing still and close) it stands and faces down. (Yes: hold still and a nearby monster idles.)
2. Acting = store the player's position, take the angle to it, set velocity `speed·(cos, sin)` toward it (speed
   index 2 = 1.375 px/frame ≈ 82 px/s; diagonal speeds are pre-scaled so the path length matches), face that way.
3. **Fear**: if the party's summed level `L` vs the enemy's level `l` has `L > 10·l`, or `L > 8·l` with a 75% per-enemy
   roll, or `L > 6·l` with a 50% roll (the roll is a byte fixed at spawn, so a given monster is consistently brave or
   cowardly), the angle is flipped 180°: it **runs away** instead. Scripted flags can force this.
4. **Contact** sets initiative from facings: let `θ` = direction from enemy to player, in eight steps.
   - enemy faces within one step of `θ` → "enemy saw you"
   - player faces within one step of `θ` → player is looking *away* from the enemy
   - player facing the enemy and enemy not facing player → **green** (party first; instant win possible)
   - enemy facing player and player facing away → **red** (enemies first; no instant win, flee auto-fails round 1)
   - otherwise normal. A standing-still enemy never gets the red.

## Edge cases to keep
- Instant win uses the *weakest* member's offense and the *slowest* speed: one straggler in the party switches it
  off, which is exactly what makes a new recruit feel like a liability for a while.
- The flee score uses the fastest member, the instant win the slowest — different questions, different stats.
- Fear is decided every tick from the live party level sum; walking into an area under-levelled flips every
  monster to chase at once, which is a loud, readable difficulty signal.
- Smash checks guts of the *attacker*; the guts floor only applies to the party. Enemies with 0 guts never smash.
