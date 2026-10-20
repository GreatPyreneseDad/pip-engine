# Study · Super Mario Bros. (NES) · walkers, shells, the stomp rule, power-up states, and the timer/score/1-up economy

Learned from the nukep `SMB-Vanilla` C decompilation, commit `20f4e02614412f9dbd407dd4e4fab4ade5eb79da`, file
`src/smbcore/common.c`: `MoveNormalEnemy`, `EnemyToBGCollisionDet`, `ChkForRedKoopa`, `DoEnemySideCheck`,
`ChkForBump_HammerBroJ`, `EnemyTurnAround`, `MoveD_EnemyVertically` (enemy gravity), `PlayerEnemyCollision`
(stomp vs injury), `InjurePlayer` / `ForceInjury`, `ShellOrBlockDefeat`, `SetStun2`, `HandlePowerUpCollision`,
`PowerUpObjHandler`, `PwrUpJmp`, `RunGameTimer`, `GiveOneCoin`, `FloateyNumbersRoutine` (the score ladder), the
timer tick at the top of the frame (`IntervalTimerControl`); `src/smbcore/vars.h` for which timers are which.
No code taken. NES 60 fps; enemy horizontal speed is in 1/16 px per frame, vertical in px per frame with a fraction.
**Interval timers** (injury, star, enemy wake) tick once every **21 frames**; frame timers tick every frame.

## Why this one
The bestiary of the most-copied platformer is three behaviours (walk, turn-at-edge, shell) and one rule (fall on
it to kill it, touch it any other way to get hurt). Its power-ups are a three-state ladder with one demotion.
Its economy is a countdown that costs a life and a coin counter that buys one. Each is small enough to be a
preset, and together they are "a Mario level" without a single Mario asset.

## Walkers (`MoveNormalEnemy`, `EnemyToBGCollisionDet`)
State per enemy: `x, y` (24-bit), `vx` (1/16 px/f), `vy`, `movingDir`, `state` (normal, falling, stunned/shell,
stomped, kicked, defeated, upside-down), `intervalTimer`, `touchedPlayer` flag.
- Speed **0.5 px/f** (`8`; `12` in the hard second loop). Gravity `$3D` ≈ **0.24 px/f²**, fall cap **3 px/f**.
- Each frame: fall if nothing solid under the feet, move horizontally, then:
  - **Wall ahead** (`DoEnemySideCheck`: a solid tile at the side, only when `y ≥ 32`) → `vx = −vx`,
    `movingDir ^= 3` (turn around). A kicked shell also plays a bump.
  - **Nothing under the feet** (`ChkForRedKoopa`): the *edge-turner* type turns around; everyone else sets
    `state = falling` and walks off (the plain walker and the plain shelled walker fall; the red-shelled one turns).
    That one flag is the whole difference between the two most famous enemies.
  - Landing restores `state = normal`.
- An enemy defeated by a shell, star or block-bump flips `defeated`: it keeps falling and moving but has no
  collision, and is erased off-screen.
- Enemies are updated only within a window around the camera; crossing the left edge deletes them for good
  (`smb-physics-scroll.md`).

## The stomp rule (`PlayerEnemyCollision`)
Checked on **odd frames only**, when the player is not in a pipe/climb, the enemy is on screen and not defeated,
and their boxes overlap. Then:
1. A power-up object → collect (below). The star timer is live → defeat the enemy outright (shell-style, points).
2. `touchedPlayer` already set → nothing (one contact = one event; the flag clears when the boxes separate).
3. Always-hurt types (fire, plant) → injure.
4. A **shell lying still** (stunned, not kicked) → **kick** it: `vx = ±3 px/f` away from the player, points by how
   long it had been resting.
5. Otherwise decide **stomp vs hurt**:
   - It counts as a stomp if the player is **falling** (`vy > 0`) — for the standard walkers that is the only
     condition; for others the enemy's top must also be below `playerY + 12`.
   - Not falling → **injure** (and if the enemy was walking away it turns to face the player first).
   - Falling → stomp: `vy = −4` (bounce; `−3` for non-squishable types), chain counter +1, points from the
     chain ladder, the enemy becomes **squished** (plain walker: erased after ~2 interval ticks) or a **shell**
     (`stunned`, `intervalTimer = 16` ticks ≈ 5.6 s; on expiry it walks again at 0.5 in a random direction).
     Flying variants are *demoted* to their walking variant instead of killed.

```
            overlap, odd frame, not yet touched
                         │
      power-up ──collect │        star active ──▶ defeat (shell style)
                         ▼
             resting shell? ──yes──▶ KICK (vx = ±3, points by rest time)
                         │ no
                 player falling?
                 no ─────┴───── yes
                 ▼               ▼
              INJURE          STOMP: vy = −4, chain++, points = ladder[chain]
          (hurt timer 8 ticks)  walker → squished; shelled → SHELL (wakes in 16 ticks); flyer → walker
```
The chain resets when the player lands. A kicked shell is a projectile: it turns at walls, defeats every enemy it
touches (fixed points), and hurts the player on contact unless they are falling onto it (which stops it).

## Being hurt (`ForceInjury`)
`InjuryTimer == 0` required (8 interval ticks ≈ **168 frames** of mercy; the sprite flickers). Big or fire →
**small** (fire does not step down to big in this game), hurt sound, `InjuryTimer = 8`, the game **freezes**
(`TimerControl = $FF`) for the shrink animation. Small → death: `vy = −4` pop, `vx = 0`, death music, the level
ends. Time running out does the same as a fatal hit.

## Power-ups (`HandlePowerUpCollision`, `PowerUpObjHandler`)
```
   SMALL ──mushroom──▶ BIG ──flower──▶ FIRE ──(mushroom or flower)──▶ FIRE (+1000, nothing else)
     ▲                   │                │
     └──────hit──────────┴────────hit─────┘        any ──star──▶ invincible 35 ticks (≈12 s), same size
```
- One power-up slot per level in the object pool; the block decides *which* item from the player's size: small
  → mushroom, otherwise → flower (`PwrUpJmp`). So the same block is a mushroom block and a flower block.
- **Emergence**: the item rises 1 px every 4 frames for 16 px (**64 frames**), untouchable, then becomes solid
  and (mushroom, 1-up) slides right at **1 px/f**, falling and turning at walls like a walker; (flower) stays;
  (star) bounces with its own `vy = −3` re-launch each landing.
- Collecting: +1000 points; grow or get fire with a **freeze** (`TimerControl`) for the animation; the 1-up adds
  a life; the star starts the 35-tick palette cycle, slowing to a warning flash in the last 8 ticks.

## The economy (`RunGameTimer`, `GiveOneCoin`, the score ladder)
- **Timer**: a 3-digit count that loses 1 every **24 frames** (0.4 s) while playing; at 100 remaining the music
  speeds up; at 0 the player dies as if hit while small. Pipes and cutscenes pause it (`GameTimerCtrlTimer`).
  A 400 start is 160 s of real time. The end-of-level bonus pays per remaining unit.
- **Coins**: each = **+200** points, `coins += 1`; at **100** coins → `coins = 0`, `lives += 1`, 1-up sound.
- **Score ladder** (shared by stomps, kicks, shell kills, block kills): index 1–10 →
  **100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000**; index 11 → **1-up**. Stomp chains walk up the ladder
  one step per stomp without landing; a shell kill is a fixed step (walker 100, shelled 200, hammer type 1000);
  kicking a shell pays 400–8000 depending on how close it was to waking; a power-up is 1000.
- Digits are decimal arrays; the score is drawn from them (no binary score), which is why everything is a
  multiple of 100 and the ladder is a small table of "which digit, add how much".

## Numbers (NES, 60 fps)
| | per frame | per second |
|---|---|---|
| walker speed | 0.5 px (0.75 hard) | 30 (45) px/s |
| walker gravity / cap | 0.24 px/f² / 3 px | 860 px/s² / 180 px/s |
| kicked shell | 3 px | 180 px/s |
| stomp bounce | −4 px (−3) | −240 px/s |
| shell rest before waking | 16 ticks ≈ 336 frames | 5.6 s |
| squished walker lingers | ≈ 2 ticks | 0.35–0.7 s |
| mercy after a hit | 8 ticks ≈ 168 frames | 2.8 s |
| star | 35 ticks ≈ 735 frames | 12.25 s |
| item emergence | 1 px per 4 frames, 16 px | 1.07 s |
| item slide | 1 px | 60 px/s |
| timer unit | 24 frames | 0.4 s |
| coin | 200 pts; 100 coins = 1 life | |
| score ladder | 100 200 400 500 800 1000 2000 4000 5000 8000 1-up | |

Walker = ⅓ of walk speed, shell = 2× walk speed: as in the Zelda notes the cast is tuned as fractions of the
player. Knobs: `walkerSpeed`, `turnAtEdge` (the red/green flag), `shellSpeed`, `shellWake`, `mercyTicks`,
`starTicks`, `timerUnit`, `coinsPerLife`, the ladder, `demoteOnHit` (big → small vs fire → big).

## Edge cases to keep
- Odd-frame collision plus a per-enemy `touched` flag: one contact is one event, and two enemies in one frame
  cannot both hurt.
- "Falling" means `vy > 0`, not "above the enemy": a head-first jump into a walker from below hurts.
- The stomp bounce overwrites `vy` (no addition) so chains stay the same height.
- A shell's wake timer is an interval timer (21-frame ticks); converting to seconds, round to the tick.
- Freeze the world (`TimerControl`) during grow/shrink; it is a hit-stop, and the kid reads it as fairness.
- Fire → small, not fire → big, in this game; make it a knob, later games changed it.
- The timer never runs during a pipe, a flagpole, or the growth freeze; it is game time, not wall time.
- The score ladder index is clamped at 11; past the 1-up the chain just keeps paying 1-ups.
