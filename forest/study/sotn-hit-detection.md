# Study · Castlevania: Symphony of the Night (PS1) · weapon arcs, hit detection, hit-stun and invulnerability

Learned from the `sotn-decomp` project (Xeeynamo, github.com/Xeeynamo/sotn-decomp, commit
`66a337e30f839a9c724ae008190d3dc60a6b5392`). No code taken; the mechanism and its constants are the subject.
Sources: the stage hit-detection pass (`src/st/collision.h`), the entity update loop that spends stun and flash
frames (`src/st/st_update.h`), the hand-weapon entity and its hitbox table (`src/weapon/w_000.c`,
`src/dra/alu_anim.c`, `src/dra/7879C.c`), the sub-weapon table (`src/config_us.h`), and the player's hit
reaction (`src/dra/71830.c`, `src/dra/692E8.c`, `src/dra/6DF70.c`). All frame counts are at 60 fps; velocities
are 16.16 fixed point in px/frame in the original, converted to px/s here.

## Why this one
A sword swing that *feels* like it connects is three things: a hitbox that moves through the arc frame by frame,
a target that flashes and freezes for a beat, and a rule that stops one swing from hitting ten times. SotN's
version is a flat table per weapon and two small counters per enemy. The player side adds the other half every
kids' game needs — "how do I get knocked back and why can't they hit me again right away" — with three sizes of hit
chosen by how much of your health just went away.

## State it keeps
Every entity: `hitboxOffX/Y` (centre offset from the sprite origin, mirrored by facing), `hitboxWidth/Height`
(**half**-extents), `hitboxState` (bit mask: which classes of hit this box gives or takes), `attack`,
`attackElement`, `hitEffect` (what kind of contact it causes), `hitFlags` (result of this frame's hit: 1 light /
2 medium / 3 heavy), `hitParams` (incoming element/kind for this frame), `stunFrames`, a 15-frame flash counter
in the low bits of `flags`, and an 11-slot array of **per-attacker cooldowns** indexed by the attacking source's id.
Attack sources additionally carry `nFramesInvincibility` (the cooldown they grant on contact) and `stunFrames`
(the freeze they inflict). The player keeps 16 timers, two of which are "invincible" and "invincible from
consumable".

## Weapon arcs as a frame table
A melee weapon is its own entity, position-locked to the player and mirrored by facing, alive only while the
player's attack animation is within its 7-pose window. Each animation pose is one 16-bit word: the low 9 bits pick
the sprite, the top 7 bits pick a row in a **hitbox table** of four signed bytes `{offX, offY, halfW, halfH}`.
Every frame the weapon copies its row into its hitbox fields, so the box walks the arc at the same cadence as the
sprite; pose durations come from the player's attack animation. The plain sword's table has 25 rows; the three
rows one swing visits are a raised box (`{4, −23, 8, 5}`), a wide extended box (`{30, −17, 35, 8}` — 70 px across,
16 tall) and a thinner follow-through (`{30, −14, 18, 4}`). Rows with zero width are "no hitbox this frame". A
dive kick has one fixed small box (`{9, 21, 4, 5}`).
On spawn the weapon copies from the equipment record: `attack`, `element`, `hitType` (its hitboxState class),
`enemyInvincibilityFrames` (cooldown granted), `stunFrames`, `hitEffect`, `criticalRate`.

### Sub-weapon rows (`g_SubwpnDefs`, `src/config_us.h`) — the two timing columns
| sub-weapon row | attack | chain limit | cooldown granted (f) | stun inflicted (f) |
|---|---|---|---|---|
| thrown knife | 5 | 3 | 4 | 4 |
| thrown axe | 10 | 2 | 32 | 4 |
| splash flask | 1 | 3 | 32 | 8 |
| boomerang | 8 | 1 | 24 | 4 |
| slow field | 0 | 1 | 50 | 4 |
| others | 8–40 | 1–3 | 10–32 | 4–8 |

Reading: a weak lingering hazard (the flask, attack 1) hits every 32 frames; a fast projectile (knife) can land
every 4 frames. Chain limit caps live copies on screen. Stun is 4 frames for almost everything, 8 for heavy.

## Update order, each frame (stage hit pass, `src/st/collision.h`)
1. **Gather sources.** Slots 0–47 are the player's side (player, weapons, sub-weapons, familiars). For each with a
   live hitbox, cache centre and half-extents; drop any whose centre is more than 32 px off the 256×224 screen.
2. **For each enemy** (slots 64–191, live, not dead, non-zero box): decrement all 11 cooldown slots. Skip if the
   box centre is off screen.
3. **Weapon vs enemy.** For each source whose class bits overlap the enemy's accepted classes and whose cooldown
   slot on this enemy is 0: overlap test is centre distance ≤ sum of half-extents, x then y. On overlap: record
   the enemy as the source's victim, set the source's `hitFlags` (1, or 3 if the enemy's box is a "hard" kind),
   set the enemy's `hitParams`, stop looking.
4. **Enemy vs player** (only if nothing hit this enemy and its box has the "touches player" bit): same overlap test.
   If the enemy's `attack` exceeds the damage already pending on the player this frame, it becomes the pending
   hit (so the **strongest** of several touches wins, not the first). The enemy itself is marked "hit the
   player" (flag 0x80) so it can react.
5. **Resolve** on the enemy (or its parent, for multi-part bodies): compute damage (see `sotn-stat-growth.md`);
   `hitFlags` = 3 if `hp < 2·dmg`, 2 if `hp < 4·dmg`, else 1 — a "how hard did that look" size for the enemy's own
   reaction code; subtract hp; spawn blood if the attack is cutting and the enemy bleeds.
6. **If it survives:** for every body part, set `cooldown[sourceId] = source.nFramesInvincibility` (+1 on the
   second and later parts, so parts expire a frame apart and never double-report), copy `stunFrames` from the
   source unless the enemy suppresses stun, set the **flash**: remember the current palette, set flash counter to
   15, pick a flash colour by element.
7. **If it dies:** award exp, roll drops (see `sotn-loot-roll.md`), mark dead + explode, same 15-frame flash.
8. **Entity update loop** (`src/st/st_update.h`): while the flash counter > 0, alternate palette each frame from a
   pair chosen by the element index, restore the saved palette when it reaches 0. If `stunFrames > 0`, decrement
   and **skip the entity's update entirely** (it freezes mid-animation) unless it opts out. Clear `hitParams` and
   `hitFlags` after each update, so a hit is visible to the entity for exactly one frame.

### Flash colour by element (`g_testColliFrames`, index into palette pairs)
fire 2 · thunder 4 · ice 3 · holy 5 · dark 6 · stone 7 · curse 8 · poison 10 · water 2 · cut 1 · heal 9. The
number is which palette *pair* flickers, not a duration; duration is always 15 frames (0.25 s).

## The player's side (`src/dra/692E8.c`, `src/dra/71830.c`)
1. Each frame, if either invincibility timer is non-zero, pending damage is **ignored entirely** (the hit box
   stays on, so enemies still "touch", but nothing resolves).
2. Otherwise the pending hit goes through the player damage formula, which returns a code: nothing, blocked,
   dodged, hurt, killed, healed, stoned… "Hurt" enters the **Hit** state.
3. **While in the Hit state** the invincibility timer is topped up to at least 12 every frame; when the state
   ends, one more 12. So i-frames = stun length + 12 frames (0.2 s). Hit, grab, death and teleport states all do
   this; it is the single mechanism.
4. **Knockback direction** (`func_80113F7C`): compare hitbox centres. If they are within 16 px horizontally *and*
   the attacker is moving, push in the attacker's direction of travel; otherwise push away from the attacker's
   centre. The push direction is stored and velocities below are mirrored by it.
5. **Severity class** (from the damage formula: < 2% of max HP light, ≥ 2% medium, ≥ 50% heavy):

| class | vx away | vy | what happens |
|---|---|---|---|
| light, on ground | 2.5 px/f = 150 px/s | 0 | flinch animation, decelerate 1/8 px/f² = 450 px/s², back to control when the animation ends |
| light, in air | 1.25 px/f = 75 px/s | −2 px/f = −120 px/s | short hop back |
| medium | 5/3 px/f = 100 px/s | −4 px/f = −240 px/s (−3 from some states) | airborne until landing, then a get-up animation facing the other way |
| heavy | 8 px/f = 480 px/s | −0.5 px/f | long tumble; a wall halves vx and starts a 24–48 f stagger, ceiling zeroes vy |
| special armour | 1.25 px/f | −3 px/f | own state, no flinch |

6. **Hit flash on the player**: a palette swap for 6 frames (red); elemental hits lengthen it (holy 8, ice 12,
   fire/dark/cut 16, thunder 24) and spawn their own effect.
7. Status elements set long timers: poison and curse scale with CON/INT (see `sotn-stat-growth.md`).

## Constants
| | frames | seconds |
|---|---|---|
| enemy hit flash | 15 | 0.25 |
| enemy stun (typical / heavy) | 4 / 8 | 0.067 / 0.133 |
| cooldown granted by a fast projectile | 4 | 0.067 |
| cooldown granted by a lingering hazard | 32 | 0.53 |
| player hit flash | 6 (8–24 elemental) | 0.1 |
| player post-stun i-frames | 12 | 0.2 |
| off-screen cull margin for hitboxes | 32 px | — |
| knockback "same spot" threshold | 16 px | — |

## Things learned that are not built yet
- Multi-part enemies share one hp through `parent` and get staggered cooldowns; we have single bodies.
- `hitboxState` is a class mask (player-touch, weapon classes, "hard" surfaces that clink); we have one layer.
- Damage numbers pop as their own entity, coloured by critical/heal flags.
- The attack's `hitEffect` low bits name the contact kind (slash, blunt, pierce…) to pick a sound.

## Edge cases to keep
- Cooldowns are **per attacker, per victim**, not a global i-frame on the enemy: a sword and a thrown knife can
  both land in the same frame, but the same sword cannot hit twice until its own cooldown runs out.
- The strongest touch of the frame wins on the player; do not resolve on first contact.
- A frozen (stunned) enemy still flashes — flash runs before the stun skip.
- Hit information lives for exactly one update; anything that needs it must read it that frame.
- Half-extent boxes: width 35 means 70 px. Mirror `offX` by facing, never `width`.
- Skipping the whole damage path while invincible (rather than zeroing damage) also skips knockback — intentional;
  a kid who is flashing should not be shoved.
