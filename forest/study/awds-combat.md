# Study · Advance Wars: Dual Strike (DS) · damage, luck, counter-fire, fog, and the power meter

Learned from sturmds's `advance-wars-dual-strike-decomp`, commit `47864817dc01b491422fe6e9f02c8be6752efa7e`.
Battle resolution: `src/game/main/combat/` (`combat_simulate_battle.c`, `combatant_pick_weapon.c`,
`combatant_calc_damage.c`, `combat_strike_and_counter.c`, `combatant_take_hit.c`, `combat_clamp_hp.c`,
`unit_get_chart_damage.c`, `scale_chart_damage.c`, `unit_get_defense.c`). Luck: `src/game/main/co_stats/
player_get_good_luck.c`, `player_get_bad_luck.c`. Terrain stars: `src/game/main/skills/double_terrain_stars.c`.
Power meter: `src/game/main/combat/acting_unit_start_attack.c`, `src/game/main/copowers/player_add_power_charge.c`,
`power_star_charge.c`, `co_power_cost.c`, `power_default_bonus.c`, `player_end_power.c`. Fog:
`src/game/main/map/map_rebuild_vision.c`, `unit_add_vision.c`, `vision_grid_add_area.c`,
`unit_is_visible_to_active_players.c`, `src/game/main/units/player_get_unit_vision.c`. The per-unit stats struct
(cost, vision, range, charge-per-HP, the 2×32 damage chart) is described in `include/game/unit_stats.h`; the
table's values are ROM data not present in the repo, so only the values the header itself notes are quoted.
No code taken; the arithmetic, the order, and the constants are the subject. All division floors.

## Why this one
Turn-based tactics for kids lives or dies on one feeling: "my tank at half health should hit for about half".
This series' formula is the cleanest expression of that — damage scales with the attacker's *shown* HP, defence
is a flat percentage from the ground you stand on, and a small luck roll keeps results from being a spreadsheet.
Fog of war is the second lesson: vision is a *count* per tile, not a boolean, so it adds and removes cleanly.
The power meter is the third: a comeback resource that fills from damage *taken* faster than from damage dealt.

## State
Per unit: `hp` 0–100 (shown as 1–10: `shownHp = floor((hp − 1) / 10) + 1`, 0 when dead), `ammo`, `type`,
`x, y`, flags (dived / hidden). Per unit type: a damage chart `chart[weapon][targetColumn]` in percent (0 = cannot
hit), `minRange`/`maxRange` (0 = direct; artillery 2–3, rockets 3–5), `vision`, `chargePerHp` (2 for infantry,
11 for the heaviest tank), move group (air gets no terrain defence). Per terrain: `defenseStars` 0–4. Per player:
`firepowerBonus`, `defenseBonus`, `goodLuck`, `badLuck` for the current power state, `charge`, `powerUses`.

## One attack, in order
1. **Distance** = Manhattan distance between attacker and defender tiles.
2. **Weapon pick** for each side (`combatant_pick_weapon.c`). At distance 1 the secondary weapon and (if the unit is
   direct-fire and has ammo) the primary compete; the primary is used only when it does *more* chart damage, and
   then costs 1 ammo. At distance > 1 only the attacker's primary may fire, only within `[minRange, maxRange]`,
   never on a counter. A unit with no usable weapon has `baseDamage = 0`.
3. **Firepower.** `baseDamage = max(1, floor(chart · firepower / 100))` where
   `firepower = 100 + CO bonus + tag bonus + flat power bonus + terrain/stealth bonus`. Chart 0 stays 0.
4. **Defence.** `defense = 100 + CO/skill bonuses`, then `defense += floor(terrainDefense · shownHp / 10)` with
   `terrainDefense = stars · 10` (+ player adjustment; doubled by one super power; 0 for air), capped at 200.
   So a 3-star forest gives +30 at full HP, +9 at 3 HP: terrain protects the healthy.
5. **Counter bonus.** For the counter-attacker only, `damage = floor(baseDamage · (100 + counterBonus) / 100)`.
6. **Luck.** `damage += rand(0 .. goodLuck − 1) − rand(0 .. badLuck − 1)`, floored at 0. Default `goodLuck` = 10
   (so +0..9), `badLuck` = 0; CO powers change both. With CO effects off the game forces 10 / 0. The pre-luck value
   is kept separately for the preview number the player sees.
7. **Strike.** `dealt = floor(damage · shownHp_attacker / 10)`, then
   `hpLost = floor((200 − defense_defender) · dealt / 100)`; `defender.hp −= hpLost`.
   (The preview number also scales by shown HP and by `(200 − defense)`, capped at 999.)
8. **Counter.** The defender fires back with its *remaining* HP: recompute `shownHp` from `hp − hpLost` (0 if
   dead — a dead unit deals 0), repeat step 7 in the other direction. Some COs counter *first*; then the order of
   7 and 8 swaps.
9. **Clamp.** No HP below 0. If both would die, the one whose HP went lower dies and the other survives at 1 HP;
   on a tie the attacker survives.

Written out, the headline number is
```
hpLost = floor( (200 − D) · floor( (B + L) · H / 10 ) / 100 )
```
with `B` chart×firepower, `L` luck, `H` attacker shown HP (1–10), `D` = 100 + bonuses + terrain·H_def/10.
With `D = 100` (no terrain, no bonuses) the `(200 − D)/100` factor is exactly 1: `hpLost = floor((B + L) · H / 10)`.
A full-HP unit with chart 55 and luck +4 deals 59 → 5 shown HP; the same unit at 4 shown HP deals 23 → 2.

## The power meter (pacing)
After every battle both owners gain charge (`acting_unit_start_attack.c`):
```
mine   = shownHpLost_mine · chargePerHp_mine
theirs = shownHpLost_theirs · chargePerHp_theirs
attackerCharge = mine + floor(theirs / 2);   defenderCharge = theirs + floor(mine / 2)
```
A second CO on the same side gets half of that. So you charge twice as fast from being hit as from hitting —
the comeback lean. Charge is capped at the super-power cost and is **not** added while a power is active.
- One star costs `floor(50 · percent / 100)` charge, `percent = 100 + 20 · powerUses` for the first 9 uses (50,
  60, … 140), then a flat 200 → 100 per star from the 10th use on (yes, it drops back; shipped quirk).
- A CO power costs `powerStars · starCost`; a super costs `superStars · starCost`.
- Activating any power gives +10 firepower and +10 defence for the turn (`power_default_bonus.c`); ending it
  zeroes both and returns the CO to the day-to-day state (`player_end_power.c`). Every power is a *one-turn* bonus
  plus its own special effect — the pacing is "save for one big turn".

## Fog of war (mechanism)
- Two vision grids of signed counts (one per local viewing side; each player's flags say which grid(s) its
  vision is added to, so allies share). Without fog (and not raining) every tile is set
  visible and nothing else runs. With fog, both grids start at 0, then each player **adds** its vision; a tile is
  visible when its count is > 0 (`map_rebuild_vision.c`).
- A unit adds +1 to every tile within Manhattan `range` of itself, where `range = max(1, typeVision + CO bonus
  − (raining ? 1 : 0))`. Foot soldiers on a mountain get +3. Every owned property lights its own tile (range 0).
  Map objects light their footprint for everyone.
- **Woods and reefs are opaque beyond distance 1**: a tile of that terrain more than one step away is *not* lit
  unless a plane/copter is standing on it (or the viewer has a piercing-vision skill). Adjacent cover is always
  seen — you have to walk up to the forest.
- Dived submarines/stealth planes are hidden even on a lit tile unless the viewer owns them, owns the tile under
  them, or has a unit on one of the four orthogonally adjacent tiles.
- Vision is rebuilt from scratch, not patched, whenever a unit moves or dies; a selected-but-not-committed unit
  contributes nothing (so you don't see with the ghost of a move you haven't made).

## Constants
| | |
|---|---|
| shown HP | `floor((hp−1)/10)+1`, 1–10 |
| terrain defence | 10 per star, scaled by defender shown HP /10, cap on total defence 200 |
| default luck | +0..9 good, 0 bad |
| minimum chart damage when hittable | 1 |
| damage preview cap | 999 |
| mutual kill tiebreak | attacker survives at 1 |
| star cost | 50 → 140 over 9 uses, 100 after |
| power turn bonus | +10 / +10 |
| charge split | own loss ×1, enemy loss ×½, back CO ×½ |
| rain | vision −1 (min 1) and fog on |
| mountain | +3 vision for foot units |
| opaque cover | woods, reefs, beyond 1 tile |

## Edge cases to keep
- A unit with 0 hp before firing has shown HP 0 and deals 0 — counter-fire from the dead is impossible by arithmetic,
  not by a check.
- Luck is rolled only when "luck on request" is clear or explicitly asked for; AI previews run the formula with luck
  off. Keep a `rollLuck` flag on the function.
- Firing a primary at distance 1 costs ammo even on a counter; the secondary never does.
- Terrain defence is read from the tile the unit stands on *after* the move (the simulation moves the attacker to
  its destination first, then puts it back).

## For a kids' game
A 6-unit, 4-terrain, one-weapon version keeps every feel-good property: shown-HP scaling, terrain stars, +0..9 luck,
counter with what's left, mutual-kill tiebreak. Fog as a count grid is a plugin on its own; the meter is a design
note (fill from hurt, spend for one big turn).
