# Study · Mega Man 2 (NES) · getting hit: the hitbox test, knockback, hit-stun, i-frames and the shield deflect

Learned from plasticsmoke's labelled ca65 disassembly of Mega Man 2 (github.com/plasticsmoke/megaman2-disassembly-ca65,
commit `e60e0ff403d5e6bd5b06911bdef4089c0d533194`). No code taken; the mechanism and its constants are the subject.
Units are pixels per frame at 60 fps in 8.8 fixed point; converted to per-second below. Screen-down is positive here
(the original stores vy positive-up).

## Why this one
"My guy got hit" is the moment a kids' game either feels fair or feels broken. Mega Man 2 has the plainest, most
copied answer: a short push backwards, a short freeze with no input, a long flicker where nothing can touch you,
and a hitbox test cheap enough to run for every enemy against every shot every frame. The companion SotN note has
the weapon-arc side; this is the NES side, and it is the one the kids will recognise in their bones.

## State it keeps
Player: `hp` (28 max), `state` (0 teleport-in, 1 null, 2 **hurt**, 3 airborne, 4 airborne-moving, 5 walk, 6 idle,
7–11 climb/etc., `player_state_ptr_lo/hi` bank0E 1107), `invincibility_timer` (one byte, zero page), `vx, vy`,
facing bit. Each enemy: `hitbox id` (`ent_screen_x` repurposed) selecting half-extents from two tables, `flags`
bit 3 = shielded, a per-type `contact damage` byte. Each projectile: `weapon_type` (its size class, 0–4) and a
per-enemy `hit_count` so one blade can't hit one enemy twice in a frame.

## The hitbox test (bank0F `check_player_collision` 4847–4905, `check_weapon_collision` 4932–4980)
Centre-distance on each axis against a half-extent, no rectangles:
```
 hit  ⇔  |ax − bx| < W[class][type]  and  |ay − by| < H[class][type]
```
`W` and `H` are tables indexed by the enemy's hitbox id (`contact_damage_range_x_tbl`, `_y_tbl`, 3021–3063), and
**the attacker's size is folded in by choosing a different row**: a weapon's class (0–4) adds an offset of 0, 32, 64,
96 or 128 to the index (`weapon_range_offset_tbl` 3020), so the table already holds `enemyHalf + weaponHalf` for every
pair. It is a precomputed Minkowski sum. On a canvas we just add the two half-extents at run time; the lesson is
that the test is on **centres**, which is why it tolerates sprites of different shapes without anyone drawing a box.

Representative half-widths from the class-0 row: 14, 18, 18, 18, 10, 22, 46, 14 px; half-heights 24, 20, 16, 12, 12,
16, 40, 16 px. Player-vs-enemy contact uses class 0 with the enemy's own row.

### Load balancing
Weapon-vs-enemy checks are split across frames: odd frames test shot slots 9, 7, 5, 3 and even frames 8, 6, 4, 2
(4932–4940). A fast shot might be one frame late; nobody notices. The player contact test is never skipped.

## What a contact hit does (4876–4904 → `player_damage_knockback`, 2852–2904)
Order:
1. If the enemy's type is a pickup (types ≥ $76) it is collected instead (4908–4922).
2. If `invincibility_timer > 0`, nothing happens. I-frames gate *damage*, not detection.
3. `hp −= contactDamage[type]`. Bosses do 8 of 28 on touch (`boss_contact_damage_table`, bank0B 5127).
   If hp ≤ 0 → death sequence.
4. **Face away from the enemy**: the player's facing bit becomes the *inverse* of the enemy's facing bit (4895–4902).
   Not "away from the enemy's position" — away from where the enemy is *looking*. Cheaper and almost always right.
5. `player_damage_knockback`: state := 2 (hurt), sound, fire-direction cleared, `invincibility_timer := 111`,
   `vy := 1.25 px/f up`, `vx := 0.5625 px/f` (direction = the new facing, i.e. backwards), sprint flag cleared, and a
   small spark entity is spawned at the player with a tiny upward drift (0.03 px/f).

## The hurt state (bank0E `player_state_hurt` 817–834)
```
 [hurt] : no input read.  vx stays 0.5625 backwards, gravity 0.25 px/f² applies to the 1.25 up launch.
         when the hurt animation reaches its end frame →  on ground ? [idle] : [airborne]
```
The hurt state lasts the length of the hurt animation (the animation table lives in the sprite bank and was not
extracted; the knockback arc itself is 10 frames up and 10 down). Horizontal movement during hurt uses the normal
mover with the direction forced to "behind", so a hit near a ledge **does** push you off — the classic Mega Man
death — and that is a design choice the kit should expose (`knockbackOffLedges: true|false`).

## I-frames (bank0F render path 2164–2173)
111 frames = **1.85 s**. The timer is decremented in the *renderer*, and on frames where `frame_counter & 2` is set
the player sprite is simply not drawn: 2 frames on, 2 off, a 15 Hz flicker. Enemies still collide (step 2 above
returns early), shots still fire, ladders still work. Only damage is suppressed. The boss has a parallel
`boss_hit_timer` (18 frames) that flickers the boss after a hit but does **not** grant it immunity — bosses take
every hit; what protects them is a one-hit-per-frame flag (bank0B 4653).

## The shield deflect (bank0F `weapon_hit_buster` 4995–5037; `weapon_hit_metal` 5360–5409)
Before damage, every weapon handler checks the enemy's `flags` bit 3. If set, or if the damage table says 0 for this
enemy, the shot is **deflected**:
- Basic shot: facing bit flipped, contact flag cleared (it can no longer hurt anything), `vx = vy = 5 px/f` — it
  pings off up and back at 300 px/s on each axis, a 45° ricochet, with a distinct sound.
- Blade: `vx = 1.53, vy = 3.70 px/f` up and back, all collision flags cleared.
Deflection is what makes a hidden enemy *read* as armoured without a word of text. The kit's `kit.shot` should have
a `deflect(vx, vy)` response that any `shielded` body triggers.

## Damage application (4999–5022 and the per-weapon copies)
`damage = table[weapon][enemyType]` (0 = immune → deflect), **doubled on Normal difficulty** (`apply_difficulty_modifier`
— Difficult mode is literally "enemies have twice the HP"), subtracted from `hp`, clamp at 0. The basic shot
despawns on hit; the blade does not (pierce) — it is prevented from hitting the same enemy twice by the enemy's
`hit_count`, which resets when no shot overlaps it (4976–4978). Kill → item-drop roll, type becomes "death
explosion", collision flags off.

## Constants
| | per frame | per second |
|---|---|---|
| knockback vx (backwards) | 0.5625 px/f | 34 px/s |
| knockback vy (up) | 1.25 px/f | 75 px/s (≈10 f up, 10 down, ~3 px high) |
| gravity during knockback | 0.25 px/f² | 900 px/s² |
| invincibility | 111 f | 1.85 s |
| flicker | 2 on / 2 off | 15 Hz |
| boss hit flash | 18 f | 0.3 s |
| deflected basic shot | (5, 5) px/f | (300, 300) px/s |
| deflected blade | (1.53, 3.70) px/f | (92, 222) px/s |
| boss contact damage | 8 of 28 | — |
| player hp / boss hp | 28 | — |

## Things learned that are not built yet
- The hurt-animation length (and so hit-stun length) is in the sprite tables, not extracted. SotN's note gives a
  stun of ~0.5 s; Mega Man's reads shorter, around 0.3–0.4 s.
- Pickups ride the same contact test with a type threshold; the kit's `kit.pickup` can reuse `kit.hitbox` unchanged.
- Per-weapon-per-enemy damage tables are content; the *shape* (0 = immune, sign bit = heals, else damage) is
  worth keeping, see the boss note.

## Edge cases to keep
- Check `invincible` *after* the overlap test, so pickups still collect and so a shielded enemy still rings.
- Knock the player away from the enemy's **facing**, not its centre; a wide enemy standing on you otherwise
  flips you at random every frame.
- Decrement i-frames once per rendered frame and flicker from the global frame counter, not from the timer — the
  flicker stays in phase when several things blink.
- Reset the "already hit" mark on an enemy only when **no** shot overlaps it; otherwise a slow piercing shot hits
  every frame.
- Clamp hp at 0 before the death check, and run the death check immediately — a second hit in the same frame must
  not double-kill or drop two items.
- A shot deflected off a shield must lose its contact flag or it will hit the thing behind the shield.
