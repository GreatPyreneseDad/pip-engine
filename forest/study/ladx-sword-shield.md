# Study · Link's Awakening DX (Game Boy Color) · the sword swing, the shield, and what a hit does to an enemy

Learned from the Hysm25 `LADX-Decompile` C decompilation, commit `f94840f19fcd2f11947b0a4f1e9d0bf101524cfb`, files
`src/bank3/entities_collision.c` (`func_003_6E2B` weapon-vs-entity test, `EnemyCollidedWithSword`,
`ApplySwordDamagesToEnemy`, `label_003_71C0`, the two damage tables `Data_003_43EC` / `Data_003_473C`),
`src/bank3/entities_physics.c` (`ConfigureEntityRecoil`, `ApplyRecoilIfNeeded_03`, `func_003_6F93` shield bump),
`src/home/link.c` (`CheckStaticSwordCollision`, sword vs tiles), `include/constants/gameplay.h`
(`SWORD_RECOIL_DEFAULT`), and the zladx `LADX-Disassembly`, commit `2a5c2c0d6df93a54df81ae9e1fe28b5c2fd60d03`,
`src/code/bank2.asm` (sword animation states 02:47EE–02:48C4 and the per-direction hitbox tables at 02:45BE–02:46AD,
charge at 02:4302), `src/constants/gameplay.asm` (`SWORD_ANIMATION_STATE_*`, `DAMAGE_TYPE_*`). Cross-checked
against spannerisms `jpdasm` (A Link to the Past), commit `4535f694752d1469ede65083e986ce2101945264`, `bank_06.asm`
(`CheckSwordDamageToSprite`, `TestSwordDamage`, `HandleSpriteDamageApplication`) and `bank_0D.asm`
(`DamageSubclassValue`). No code taken. 60 fps assumed; speeds are 4.4 fixed point (`$10` = 1 px/frame).

## Why this one
"Give him a sword" is the first request after "make him walk". What makes a 2D sword feel like it connects is
not the sprite: it is a hitbox that moves through the swing in two or three steps, a short lockout so one swing
is one hit, a *push* on the enemy, a flash, and a damage number that comes from a table a designer can read.
The shield is the same machine with the sign flipped. `sotn-hit-detection.md` covers the side-view version; this
is the top-down one, and it is simpler.

## State kept
Player: `swordState` (none, draw, swing-start, swing-middle, swing-end, holding), `swordFrames` (countdown in the
current state), `swordCharge` (0–40), `spin` (0 or a 32-step counter), `weaponBox` = `(cx, cy, halfW, halfH)` or
"none", `shieldUp`, `clinkLock` (frames the sword is dead after hitting a wall), `lastHitEntity`.
Per enemy: `health`, `healthGroup`, `hitbox` = `(offX, halfW, offY, halfH)`, `ignoreHits` (frames), `flash`
(frames), `recoilVx, recoilVy`, `status` (active, dying, stunned, burning...), `isBoss`, `clinkOff` (sword bounces
off this one).

## The swing, frame by frame (`wSwordAnimationState`)
Pressing the button from idle starts a four-state swing; the player cannot walk during it (unless dashing).

| state | frames | hitbox (facing right; relative to the body centre) |
|---|---|---|
| draw | 3 | none |
| swing-start | 3 | centre (+13, −13), 10 × 10 — the diagonal above the shoulder |
| swing-middle | 8 | centre (+17, 0), 20 × 16 — straight out in front |
| swing-end | 0 (exit) | none |
| holding (button kept down) | until release | centre (+9, 0), 20 × 16 — the sword held out, charging |

Fourteen frames of swing (0.23 s), of which eleven have a hitbox. The other three facings use the same two boxes
rotated: for *up*, start is the same upper-right diagonal and middle is a 16 × 16 box centred 16 px above the
body. The boxes are **stepped, not swept** — two rectangles are enough for the eye, because the sprite draws the
arc between them. Every frame the current box is published as `weaponBox`; every enemy tests itself against it.

Holding after the swing keeps the "holding" box live and increments `swordCharge` each frame to a cap of **40**
(a jingle at full). Releasing at full charge starts a **spin**: a 32-step counter ticked every 4 frames, during
which the sword direction walks the 8 compass points with the holding box re-aimed each step, and damage is one
sword level higher. Releasing early just lowers the sword.

## Weapon vs enemy (`func_003_6E2B`), each frame per enemy
1. No `weaponBox` → nothing.
2. **Enemy gates**: `flash` in 1..23 → skip (it was just hit); `ignoreHits > 0` → skip; this is the entity the
   current swing already hit (`lastHitEntity`) → skip. So one swing hits an enemy **once**, and nothing hits it
   again for ~24 frames.
3. **Box test**: `|enemyX + offX − weaponCx| < halfW_weapon + halfW_enemy` and the same in y. Half-sizes add;
   there is no corner math.
4. If the enemy is **grabbable** (a pickup) → collect it (the sword picks up hearts and rupees).
5. If the sword is live (`swordCollisionEnabled`) → `EnemyCollidedWithSword`; otherwise the box is the **shield**
   → bump (below).

`EnemyCollidedWithSword`, the common path:
- `clinkOff` enemies (armoured): no damage; a "clink" spark at the enemy; `ignoreHits = 16`; **the player** is
  pushed back instead (the same knockback as being hit — 1.25 px/frame away for 16 frames — but no damage and no
  mercy timer) and dash is cancelled.
- Otherwise: `lastHitEntity = this`, `swordCharge = 0`, **recoil** the enemy at **3 px/frame** (`$30`) along the
  vector from the player to the enemy (`ConfigureEntityRecoil`), `ignoreHits = 10`, bump sound, then apply damage.
  A power hit (red tunic / power-up) uses `ignoreHits = 32` and a stronger sound.

## The damage lookup (two tables, `label_003_71C0`)
`damageType` is the weapon: sword L1 = 0, L2 = 1, "L3" = 2 (each of spin, dash, power-up/red tunic adds one level,
capped), then bow, hookshot, bomb, boomerang, powder, rod, thrown object...

1. `class = Table1[healthGroup][damageType]` — a 16-wide row per enemy group saying how this enemy *reacts* to
   each weapon: 0 immune, 1 weak hit, 2 strong hit, 3 special (kill), 6 stun, etc.
2. `amount = Table2[damageType][class]` — an 8-wide row per weapon. Sword L1: class 1 → **1**, class 2 → **2**,
   class 3 → **64** (dead); L2: 2 / 1 / 64; "L3": 4 / 2 / 64. Values ≥ `$F0` are effects, not numbers:
   `$FF` stun, `$FE` burn, `$FD` turn into a fairy.
3. `amount == 0` → nothing (no sound, no flash: the hit simply did not happen).
4. `health > amount` → `health −= amount`, `flash = 24`, `ignoreHits = 10` (hit sound; bosses add a roar).
   Else → `health = 0`, `status = dying` with a **47-frame** death countdown (`$2F`), collisions off, `flash = 0`;
   a boss also runs the room-clear logic if it was the last boss standing.

Typical enemy `health`: 1, 2 or 4 (groups 0–15 in `health.asm`), mid-bosses 8–12, big bosses 20–63. So a weak
enemy takes 1–4 L1 hits, and upgrading the sword halves the count — the whole progression curve is two rows.

## Enemy recoil (`ApplyRecoilIfNeeded_03`), each frame while `ignoreHits > 0`
Decrement; **swap** the enemy's speed for `(recoilVx, recoilVy)`, move, run its background collision (a wall
stops the recoil), swap the speed back. So recoil does not disturb the enemy's own velocity or its AI state; it
is a 10-frame override of position only. 3 px/frame × 10 = **30 px** of shove, about two tiles. Most enemy
handlers also force a 64-frame "standing" state when `ignoreHits > 0` (see `ladx-enemy-archetypes.md`), which is
the stun the player sees.

## The shield
Holding the shield button publishes the *holding* box (every other frame) with the sword marked not live.
- **Enemy touches it** → `func_003_6F93`: bump sound, dash cancelled, player pushed **1.125 px/frame** (`$12`)
  away from the enemy for **12 frames**, enemy recoiled **2 px/frame** (`$20`) for 10 frames (0.5 if the player
  was standing still — `$08`). Nobody takes damage. A few enemies reverse their movement axis instead.
- **Projectile** → handled on the player side (`ladx-hearts-knockback.md`): if the player faces opposite to its
  travel, deflected; the level-2 shield also reflects beams.
- Level 1 shield blocks; level 2 reflects. That is the whole upgrade.

## Sword vs tiles (`CheckStaticSwordCollision`)
Every swing frame, probe the tile one step ahead of the body in the facing direction (16-px grid). Solid or door
or ledge → "clink", and `clinkLock = 16` frames so one swing clinks once. A cuttable tile (bush, grass) is replaced
by its floor tile, debris is spawned at the tile centre, and with probability **1/8** a drop appears (50/50 heart or
rupee) popping up at `vz = 1 px/frame`. The spin attack cuts in all eight directions as it sweeps.

## Cross-check: A Link to the Past (SNES)
- **Same two-table shape.** `DamageSubclassValue` is 16 weapons × 8 classes; each sprite carries a per-weapon
  class (0–7). Sword rows: L1 → **2**, L2 → **4**, L3 → **8**, L4 → **16** in class 1, **64** in class 2 (kill),
  and a smaller value in class 3. Enemy health there is 2–32, so the hit count per enemy stays 1–4 while the
  numbers are 2× LADX's. `$F9–$FF` are effects there too (fairy, freeze, stun, burn).
- Spin and dash use "same as slash" with a +class flag (`.spinning` sets bit 2, poke bit 3).
- **Recoil is stronger**: the sprite is launched **5 px/frame** away (`$50`; `$40` for a charged swing), the sword
  is dead for **16 frames** (`$47 = $10`) after any hit, and armoured (clink-off) enemies bounce the player back
  at **2 px/frame** (`$20`) — the same "the wall hits you back" rule as the Game Boy's. Death state runs
  **31 frames** (`$1F`) vs LADX's 47.
- Freeze/stun carry explicit timers (32, 128, 255 frames) in a small table; LADX uses an entity "stunned" status.

## Numbers (LADX)
| | per frame | per second |
|---|---|---|
| swing total | 14 frames | 0.23 s |
| hitbox live | 11 frames | 0.18 s |
| enemy re-hit lockout | 24 frames (flash) | 0.4 s |
| enemy recoil | 3 px × 10 frames = 30 px | 180 px/s |
| shield bump (player) | 1.125 px × 12 frames | 68 px/s |
| shield bump (enemy) | 2 px × 10 frames | 120 px/s |
| charge to spin | 40 frames | 0.67 s |
| clink lockout | 16 frames | |
| death animation | 47 frames | 0.78 s |
| bush drop chance | 1/8 | |

Knobs: `swingFrames` (3/3/8), the two boxes, `swordLevel` (1–3), per-enemy `healthGroup` row, `recoilSpeed`,
`flashFrames`. The hitbox sizes are for a 16-px body; scale with the sprite.

## Edge cases to keep
- Half-sizes add; keep the enemy's hitbox separate from its sprite so a big sprite can have a small weak spot.
- Mark `lastHitEntity` per swing, and clear it when the swing ends — a slow enemy must not eat two hits from
  one swipe, but must be hittable by the very next one.
- Recoil overrides position, not velocity: restore the enemy's own speed after the recoil step.
- `amount == 0` is silent. The kid learns "this one needs something else" from the silence plus the clink.
- A dying enemy has no collision and cannot be hit again, but still drops its loot at the end of the countdown.
- The sword picks up hearts and rupees; the shield picks up nothing.
- The sword box is published *before* the enemies update, so a hit lands on the same frame the box appears.
