# Study · Mega Man 2 (NES) · nine weapons: what makes each shot type distinct, and the ammo economy

Learned from plasticsmoke's labelled ca65 disassembly of Mega Man 2 (github.com/plasticsmoke/megaman2-disassembly-ca65,
commit `e60e0ff403d5e6bd5b06911bdef4089c0d533194`). No code taken; the mechanisms and their constants are the subject.
Everything here lives in `src/bank0F_fixed.asm`: the firing handlers (`fire_weapon_*` 3462–3793), the one spawn
routine and its tables (`weapon_spawn_projectile` 2944–3019), and the per-type flight behaviours (3847–4390).
Units are pixels per frame at 60 fps in 8.8 fixed point; converted to per-second below; screen-down positive.

## Why this one
A kid asking for "different guns" wants the same thing every time: shots that *behave* differently, not shots with
different colours. Mega Man 2 is the cleanest catalogue of what a 2D projectile can do: go straight, arc, roll on
the floor, orbit, come back, climb, stick and explode, stop time. Nine kinds from one spawner and one mover, each
distinct in three or four numbers and one rule.

## State a weapon keeps
Globally: `current_weapon`, an ammo byte per weapon (28 max, same scale as HP), two small counters
(`weapon_counter_1/2`) that implement fractional ammo costs and hold-to-fire, a 15-frame `general_timer` for the
firing pose. Per projectile (a pool slot, 2–9): type, flags, 8.8 position and velocity, `state` (phase), `hp`
reused as a fuse or radius, `weapon_type` (size class for the hitbox table). Shot slots are **fixed ranges**: the
basic shot may use 2–4, so at most three are on screen; the boomerang 2–5 (four); the leaves 2–5; the charge shot
owns slot 2 alone.

## The one spawner (`weapon_spawn_projectile` 2944–2990)
Given a table index: set type and flags, place at the player ± an x offset (16 or 32 px toward the facing side),
copy a velocity pair, set the size class, zero the counters. Direction is the player's facing bit copied in; `vx` is
stored unsigned and the mover adds or subtracts. The spawner knows nothing about weapons — the **table row** is the
weapon. That is the design: `kit.shot.define(kind, {speed, arc, gravity, size, ...})`.

## The catalogue
| weapon | on screen | launch (px/f → px/s) | cost (of 28) | the one rule that makes it itself |
|---|---|---|---|---|
| basic shot | 3 | 4 → 240 straight | free | despawns on first hit; deflected by shields |
| charge shot | 1 | 4 → 240 straight | 1 / 6 / 10 by level | hold B: ≥125 f = mid, ≥187 f = full; damage ×1 / ×3 / own table |
| three tornadoes | 3 at once | x 1.10 / 1.60 / 2.20 → 66 / 96 / 132; y accelerates **up** 0.0625 px/f² (225 px/s²) | 2 | fan of three with rising arcs; needs all three slots free |
| orbiting leaves | 4 → 1 | radius grows 2 px/f to 12 px, then follows player | 3 to form, 3 to throw | thrown at 4 px/f (240) in the pressed d-pad direction |
| floor bubble | 2 | lob: 1 fwd, 2 up, gravity on | ½ (1 per 2 shots) | on landing: gravity off, crawl 2 px/f hugging the floor (0.25 down), fall ledges at 2 px/f, die on a wall |
| boomerang | 4 | (4.44, 2.66 up) → (266, 160) | ⅛ | vy −0.29 px/f² for 18 f, **flip x** at 18, +0.29 to 35 f, gone; auto-fires while held every ~12 f |
| time stop | — | — | 1 per 15 f, drains to 0 | freezes every enemy and the scroll for up to 7 s |
| spinning blade | 3 | 4 → 240 in 8 directions (diagonals 2.83, 2.83) | ¼ | **pierces**: never despawns on hit; aim from d-pad at fire time |
| wall bomb | 1 | 4 → 240 | 4 | sticks to the first solid tile, fuse 126 f (2.1 s), then 56 f of blast spawning scatter explosions every 8 f |

Details worth having right:
- **Charge** (`atomic_fire_ai` 3850–3979): the charge entity rides the player, flashes the palette on alternating
  4-frame beats, plays a rising sound every 8 frames, and refuses to grow past a level the ammo can't pay for. On
  release it becomes a shot whose `state` is the level; the hit handler multiplies damage by level (bank0F 5042).
- **Tornadoes** (`air_shooter_ai` 3984–4003): the slot number picks which of three x speeds, so the fan is a side
  effect of pool order. Upward acceleration without a cap: by the time they leave the screen they are rising at
  ~4 px/f.
- **Leaves** (`leaf_shield_orbit_ai` 4009–4065, `leaf_shield_launch_ai` 4070–4131): four slots spiral out
  (±r on x for even/odd, ±r on y for pairs), at r = 12 three are dropped and one becomes "the shield" that copies the
  player's position every frame. Any d-pad press throws it (left/right at 4 px/f, up/down at 4 px/f) and charges
  the second 3.
- **Bubble** (`bubble_lead_ai` 4136–4178): a three-state crawler — airborne, rolling, dropping — driven by the same
  two tile probes the enemies use (7 px ahead, 7 px below).
- **Boomerang** (`quick_boomerang_ai` 4183–4214): the whole return is one accumulator: a constant 0.29 px/f²
  (1055 px/s²) applied to vy, first down then up, and a single facing flip at the midpoint. No homing.
- **Blade** (`fire_weapon_metal` 3658–3706): eight velocity pairs from the d-pad nibble; the diagonals are
  normalised (2.83² + 2.83² = 4²), which is the *opposite* of the enemies' Chebyshev aim — the player's weapon is
  honest, the enemies' are cheap.
- **Bomb** (`crash_bomber_ai` 4219–4359): probes the tile 6 px ahead at two heights every frame; on contact it clears
  its contact flag (so it stops hurting), sits for 126 f, then spawns up to four scatter explosions per 8-frame
  beat from an offset table.
- **Time stop** (`time_stopper_ai` 4364–4390): sets a global mode that skips every enemy's update and locks the
  scroll; one entity counts 15 frames per unit.

## Firing rules (3462–3507, 3721–3728)
- Fire on **press**, not hold, for everything except the boomerang (hold = autofire at ~5.5 shots/s) and the
  charge (hold = charge).
- No free slot → the press is swallowed (no queueing).
- Every fire sets a 15-frame "gun out" pose timer; the pose is a sprite offset, not a state.
- Ammo check happens before dispatch; empty ammo means the weapon simply doesn't fire (and the game lets you
  select it anyway — the kid learns by trying).
- Fractional costs are two counters: bubble decrements ammo every 2nd shot, boomerang every 8th, blade every 4th.
  So the "28 units" bar means 56 / 224 / 112 shots.

## Damage and weakness (bank0B 5085–5125, bank0F 4995+)
Damage is `table[weapon][target]`: basic shot does 2 to most bosses (1 to the tough ones); a weakness does 4–14 of
28; a 0 means immune and the shot deflects; **a value with the sign bit set means the boss absorbs its own weapon
and refills to full HP** (`boss_restore_full_hp`, 5077). Normal difficulty doubles every number (Difficult is the
authored table). That last trick — "shooting the fire boss with fire heals him" — is the single best teaching
device in the game and costs one byte per pair.

## Design shapes seen
- **One spawner, many rows.** Kind = table row + an AI stub. The AI stubs are tiny because the mover does the rest.
- **Slot ranges as caps.** "Three on screen" is enforced by which pool slots a weapon is allowed to scan, not by
  counting.
- **Reuse hp as a fuse / radius / level.** Projectiles don't have HP, so the byte is free.
- **Ammo as fractions via counters.** Keeps the bar in the same 28 units as health so the HUD is one widget.
- **Pose timer ≠ state.** Firing doesn't interrupt walking or jumping; it swaps the sprite for 15 frames.

## Things learned that are not built yet
- Items 1–3 (rideable platform, jet sled, wall climber) are weapons too (table rows 9–11); the platform rises for
  187 f then hovers. A `kit.summon` later.
- Weapon-energy pickups refill with the same timed drip as health (earlier note).
- The weapon menu pauses by setting a mode bit the AI dispatcher checks — the same bit time stop uses.

## Edge cases to keep
- A projectile must carry its own `size class`; the hitbox test adds it to the target's half-extent.
- Piercing shots need the per-target "already hit" mark described in the player-hit note.
- A shot that sticks to a wall must drop its contact flag or it is a landmine against the player too.
- Fan weapons that need N free slots should fail whole, not fire two of three.
- Boomerang-style returns: flip the *facing* at the apex, don't negate velocity — the mover already applies facing.
- Clamp charge level by affordable ammo *while charging*, not at release, so the player sees the cap.
