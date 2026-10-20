# Study · A Link to the Past (SNES) · the dash, eight-direction speed rows, and what differs from the Game Boy

Learned from the spannerisms `jpdasm` disassembly (JP 1.0), commit `4535f694752d1469ede65083e986ce2101945264`,
file `bank_07.asm`: `PerformDash` (07B26A), `LinkState_Dashing` (078F80), `LinkState_ExitingDash` (079158),
`CancelDash`, `RepelDash` and `RepelBonkSpeedX/Y` (0791B7), `SubVelocityValues` (07E210), `HandleLinkVelocity`
(07E22E), damage application at 078096; `bank_06.asm`: `AttemptDamageToLinkPlusRecoil` (06F3E1), `BumpDamageGroups`
(06F42D). The Game Boy side is the zladx `LADX-Disassembly`, commit `2a5c2c0d6df93a54df81ae9e1fe28b5c2fd60d03`, and
the Hysm25 `LADX-Decompile`, commit `f94840f19fcd2f11947b0a4f1e9d0bf101524cfb`, `src/home/link.c`
(`UsePegasusBoots`), `include/constants/link.h`, `src/bank2/link_motion.c` (`label_002_74AD`, the wall bonk).
No code taken. Both machines run at 60 fps; speeds in both are 4.4 fixed point (`$10` = 1 px/frame).

## Why this one
The dash is the first "power move" a kid wants in a top-down game, and the two Zeldas agree on its grammar
while disagreeing on every number. The grammar is: **hold to charge, release nothing — it launches on its own;
run straight at a fixed speed; a wall ends it with a bonk that throws you back and shakes the screen.** That is a
three-state machine with four constants, and the kit should ship it as one.

## The machine (SNES)
```
  IDLE ──A held──▶ CHARGING (dust; timer = 29 frames counting down; A released → cancel)
                        │ timer expires with A still held
                        ▼
                    DASHING (speed row "dashing": 4 px/frame in facing; input ignored; sword out)
                        │ wall ────────────▶ BONK: recoil 1.5 px/frame backwards, tremor, then RECOIL state
                        │ A released or d-pad pressed
                        ▼
                    EXITING (up to 16 frames of wind-down, then IDLE)
```
- `PerformDash` sets `dashTimer = 29` (`$1D`), the dashing flag, a "charging" value `$40`, and the Link state to
  *dashing*. While the timer counts down the player stands still kicking up dust; letting go of A cancels
  everything (`CancelDash` clears timer, speed row, flag). When it hits zero the run starts.
- Speed comes from a **speed row table** (`SubVelocityValues`), one byte per situation, indexed by what Link is
  doing; the dash is row `$10 = 4 px/frame`, diagonal dash `$2A = 2.625`, dash in shallow water `$30 = 3`, dash on
  ice `$20 = 2` (with a separate slide acceleration). Movement code never knows *why* the speed is 4; it reads a
  row.
- **Bonk**: `RepelDash` → `RepelBonkSpeed` = **1.5 px/frame** (`$18`) opposite to facing, a screen tremor, and the
  *recoil* state (the same state a hit puts you in). Hitting certain tiles while dashing also breaks them or drops
  items from them; that check is on the dashing flag, not on speed.
- **Exiting**: on release (or any d-pad press) `ExitingDash` counts up to 16 frames before giving control back,
  then clears the row and the flag. Short, but it is why the dash feels like it has weight.

## The speed rows (what "eight directions" costs)
| row | px/frame | px/s |
|---|---|---|
| walking | **1.5** | 90 |
| walking diagonally (per axis) | **1.0** (ratio 0.667; true 1/√2 = 0.707) | 60 |
| stairs | 0.625 | 37.5 |
| soft slip / hard slip | 1.0 / 0.5 | |
| carrying or sword out | 1.25 (diag 0.8125) | 75 |
| pushing a block | 1.0 (diag 0.5) | 60 |
| pulling | 0.25 | 15 |
| dashing | **4.0** (diag 2.625) | 240 |
| dashing on ice | 2.0 (diag 1.3) | 120 |
| dashing in shallow water | 3.0 (diag 1.5) | 180 |

Every situation gets its own cardinal and diagonal entry, and the diagonal is hand-tuned (not `× 0.707`): the
designers rounded diagonals *down* so the eight directions feel evenly fast on a 16-px grid. Speed is set each
frame from the row — like the Game Boy, there is **no acceleration on foot**; only ice and the dash add dynamics.

## Cross-check against the Game Boy
| | ALttP (SNES) | LADX (GBC) |
|---|---|---|
| charge | hold **29 frames**, auto-launch | hold **32 frames** (`MAX_PEGASUS_BOOTS_CHARGE`), auto-launch |
| dash speed | **4 px/f** (2.67× walk) | **2 px/f** (2× walk) |
| steering | none; d-pad press ends the dash | none; direction change ends the dash |
| wall bonk | recoil **1.5 px/f** back, tremor, recoil state | speeds reversed and **÷4** (0.5 px/f back), launched with `vz = 1.5`, **32-frame** screen shake, strong-bump jingle |
| what it breaks | specific tiles, drops items from trees | bushes/crystals as a sword hit with +1 damage level |
| exit lag | up to 16 frames | none beyond landing from the bonk hop |
| walk | 1.5 px/f, diag 1.0 | 1.0 px/f, diag 0.75 |
| hit damage | subtracted at once; groups × armour (e.g. 8/4/2 eighths) | drained 1/8 per 2 frames; groups × tunic (halve) |
| mercy | 58 frames | 80 frames |
| contact knockback | 1.5 px/f × 19 frames ≈ 28 px | 1.25 px/f × 16 frames ≈ 20 px |

The ratios hold across both: dash ≈ 2–2.7× walk, bonk ≈ 1–1.5× walk backwards, charge ≈ half a second. The
Game Boy's bonk *hops* (it puts you in the air so you can't be hit while flying back); the SNES's bonk uses the
hit-recoil state for the same effect. Either is fine; the kit's version should pick one and keep the shake.

## Numbers for the kit (take the SNES grammar, scale to the body)
| | per frame | per second |
|---|---|---|
| charge | 29–32 frames | ≈ 0.5 s |
| dash speed | 2–2.7 × walk | |
| bonk recoil | 1–1.5 × walk, 16–19 frames | |
| screen shake | 32 frames | 0.53 s |
| exit lag | 0–16 frames | |
| diagonal factor | 0.667 (SNES), 0.75 (GBC), 0.707 (honest) | |

Knobs: `chargeFrames`, `dashFactor`, `bonkFactor`, `shakeFrames`, `breaks` (which tile classes the dash treats as a
hit), `cancelOnTurn` (both games: yes).

## Edge cases to keep
- Charging holds the player *still*; a kid who taps the button must get nothing (cancel), not a stutter-step.
- The dash ends on a d-pad change, not a d-pad release; holding forward through the whole run is the normal case.
- Bonk only on a full wall collision in the dash axis (both games test the collision bits for *that* axis), never
  on brushing a corner.
- The dash is a sword hit at +1 level in the Game Boy and a tile-breaker in the SNES — in both it uses the weapon
  path, so enemies in the way take damage and clink-off enemies throw you back.
- Speed rows, not speed arithmetic: each situation names a cardinal and a diagonal speed. That table *is* the feel.
