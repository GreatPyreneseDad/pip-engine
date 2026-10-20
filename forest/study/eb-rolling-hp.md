# Study · EarthBound (SNES) · the rolling HP meter

Learned from Herringway's `ebsrc` disassembly, commit `68aec5c39e67f3ef4f0be138ee58c1ba0cc33d62`.
Files: `src/misc/hp_pp_roller.asm` (the per-frame roll), `src/data/hp_meter_speeds.asm` and
`src/unknown/C2/C20F58.asm` (speed selection), `src/misc/enable_half_hp_meter_speed.asm`, `src/misc/stop_hp_pp_rolling.asm`,
`src/misc/reset_hppp_rolling.asm`, `src/battle/reduce_hp.asm`, `src/battle/set_hp.asm`, `src/battle/check_dead_players.asm`,
`src/battle/calc_damage.asm` (the guts save), `include/config.asm`. No code taken. The SNES runs at ~60 fps.

## Why this one
Every health bar on the floor drops instantly. This one is an **odometer**: damage sets a *target*, and the number
rolls toward it over a second or two. Two kid-sized consequences fall out for free: a hit never feels like a cheap
jump-cut, and **you can heal while the number is still falling** — if the heal lands before the counter reaches zero,
nobody falls down. It turns "I got hit" into a tiny race the kid can win, and it is the single most remembered
mechanic of the game.

## State per character
```
hpTarget        where the number is going (set instantly by damage and healing)
hp              what the meter shows, an integer
hpFraction      the sub-point part of hp, 16 bits (hp:hpFraction is one 16.16 fixed-point number)
rolling         1 while hp ≠ hpTarget and the roll is active (the game stores this in bit 0 of hpFraction)
```
The same four exist for the second resource (PP). Globals: `rollSpeed` (16.16, from the options menu), `halfSpeed`
flag, `fastest` flag, `disabled` flag.

## Update order, each frame
1. If rolling is disabled (text box is holding, a time-stop effect), do nothing.
2. Pick **one** character per frame: `frame mod 4` → party slot. So each character ticks every 4th frame (15 Hz).
3. If `rolling` is 0 and `hp ≠ hpTarget`, set `rolling = 1` and stop for this tick (one frame of latency).
4. If `hp < hpTarget` (healing): `hp:fraction += speed`; if that overshoots the target, snap to target.
5. If `hp > hpTarget` (draining): `hp:fraction −= speed`; if it undershoots (or wraps below zero), snap to target.
6. If `hp == hpTarget` and `rolling`: clear `rolling`.

Then the HP window tiles are redrawn from `hp` for the characters that changed.

## Speeds
| situation | per tick (16.16) | per second (×15) |
|---|---|---|
| text speed "fast" | 1 + 4/32 = 1.125 | ≈ 16.9 HP/s |
| text speed "medium" | 1 + 3/32 = 1.094 | ≈ 16.4 HP/s |
| text speed "slow" | 1 + 2/32 = 1.063 | ≈ 15.9 HP/s |
| while the command menu is open | half of the above | ≈ 8 HP/s |
| "finish now" (party wiped, menus that need final numbers) | 6.25 | ≈ 94 HP/s |
| PP (the second meter) | 1.5625 | ≈ 23 HP/s |

So a 60-point hit on the default setting takes about 3.7 s to fully land, and ~7 s if the kid sits in the menu
thinking. That is the window.

## Where damage goes and when death is checked
```
 hit lands ─► hpTarget = max(0, hpTarget − dmg)      (never touches hp)
                      │
                      ▼  (every 4 frames)
             hp rolls toward hpTarget ───────────────────► hp reaches 0?
                                                              │
 battle loop, at fixed check points (after each action,       ▼
 end of round): copy hp → battler.hp; if 0 → KO      "falls down" only here
```
Enemies do not roll: their `hp` and `hpTarget` are written together. Healing an ally sets `hpTarget` upward, so a
heal during a drain simply reverses the roll from wherever the number is.

Two mercies sit on top:
- **Guts save.** If a hit would take `hpTarget` from above 1 to exactly 0, roll `guts / 500` (attacker's guts as
  written — a known quirk — floored at 25 for the party): on success the target is set to **1** instead. The same
  1-HP floor applies when an enemy's "final attack" would wipe the last standing member.
- **Mortal damage text.** The game prints "mortal damage" when `hpTarget` hits 0 and shakes longer, so the kid knows
  the race is on.

## Edge cases to keep
- Snap, don't bounce: overshoot in either direction lands exactly on the target. Check both `hp < target` and the
  wraparound case (the original tests `hp > 1000` as "went negative").
- Decide death only at defined check points, never inside the roller. The roller is presentation; the check point
  is rules.
- Pausing text or a cutscene must freeze the roll (`disabled`), otherwise a character dies during a speech.
- When the battle ends with a drain in flight, finish it fast (6.25/tick) rather than snapping — the kid still sees
  the number arrive.
- Keep one meter per resource with the same code; the only difference between HP and PP here is the speed constant.
- Per-second knobs for a canvas: `rollSpeed ≈ 16 HP/s`, `menuFactor 0.5`, `finishSpeed ≈ 94 HP/s`, `tickHz 15`.
  For a kid's game with 20-HP characters the roll can be slower (≈ 6 HP/s) so the race is visible.
