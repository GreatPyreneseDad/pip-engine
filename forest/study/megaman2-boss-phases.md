# Study · Mega Man 2 (NES) · a boss's phase state machine: entrance, attack loop, hit reaction, charge, recovery

Learned from plasticsmoke's labelled ca65 disassembly of Mega Man 2 (github.com/plasticsmoke/megaman2-disassembly-ca65,
commit `e60e0ff403d5e6bd5b06911bdef4089c0d533194`). No code taken; the mechanisms and their constants are the subject.
All bosses live in `src/bank0B_boss_ai.asm`; the frame entry is `boss_ai_frame` (63–75), the shared entrance is
`boss_entrance_ai` (157–207), and the worked example below is the first boss in the dispatch table (`heatman_ai` and its five
phase routines, 149–397). The shared boss mover and hit tests are at 4034–4160 and 4553–4709. Units converted from
8.8 pixels per frame at 60 fps.

## Why this one
A boss is the first place a kid's game needs a real state machine: it must enter, pose, loop an attack, *react* to
being hurt, punish you for it, and die with ceremony. Mega Man 2's bosses are all the same skeleton with a different
attack verb plugged in, and the skeleton is small enough to hold in one hand. The one studied here is the one every
player remembers: it only charges after you hit it.

## State the boss keeps
Slot 1 of the pool (position, velocity, flags, hp = 28, anim) plus zero-page: `boss_phase` (the machine), `boss_ai_state`
(sub-step within a phase), `boss_action_timer` (one countdown), `boss_hit_timer` (flash), `boss_hit_flag` (one hit
per frame), `boss_id`. Nothing else. Attack children are ordinary pool entities spawned with a velocity.

## The frame (`boss_ai_frame` 63–75 → `<boss>_ai` 149–154)
Each boss routine subtracts one from `boss_phase` and jumps through a per-boss table of phase handlers
(`heatman_phase_lo/hi`, 396–397). Phase 1 is shared by all eight stage bosses. Every phase handler ends by calling
either the mover (`boss_apply_movement_physics` 4076–4153: velocity, gravity if flagged, clamp to 8..248 px on
screen and 240 on y) or the mover-plus-hit-test (`boss_check_weapon_hit` 4067–4070 → `weapon_boss_collision_check`
4608–4647). The hit test is the same centre-distance table lookup as for enemies, with the odd/even slot split.

## Phase 1 — the entrance (shared, 157–207)
```
 [drop] gravity on, fall until the floor probe hits → vy = 0, anim = landing
 [pose] play the intro animation until it reaches the boss's own "ready" frame (enemy_state_transition, 211)
 [fill] every 4th frame: hp += 1 with a tick sound, until 28     (28 × 4 = 112 f ≈ 1.9 s)
 → phase 2, timers zeroed, battle sprite set
```
The HP bar filling is literally the HP going up; the boss is invulnerable during it because the frame routine is
in phase 1 and never calls the hit test. The player can move and shoot the whole time — the shots simply don't
land. That is the "ceremony" and it costs nothing.

## Phases 2–5 — the fire boss, as a worked example
```
                ┌────────────────────────────────────────────────────────────┐
                ▼                                                            │
  [2 ATTACK] stand, face player.                                             │
     when no fireballs alive and the throw frame comes up:                   │
       spawn 3 mortar shells aimed at dx+32, dx, dx−64 (see below)           │
     ── hit by any weapon ──▶ [4 FLINCH] hurt sprite, flash 18 f             │
                                 when anim done: face the player's side,     │
                                 random wait 31 | 62 | 93 f, phase := 3      │
  [3 CHARGE] state 0: count the wait down, then anim "charge",               │
                       action_timer := |dx|/4 + 10                           │
             state 1: once anim ≥ frame 6, vx := 4 px/f (240 px/s) toward    │
                       the player; run until action_timer hits 0             │
             state 2: vx := 0, anim "reform"; when it ends → phase 5         │
  [5 RECOVER] wait for the stand-up frame → back to phase 2 ─────────────────┘
```
Numbers: charge speed 4 px/f = 240 px/s; charge duration |dx|/4 + 10 frames, i.e. it runs **the distance to where you
were plus 40 px** — it is aimed at your position at the moment it started, so moving after the wind-up is the
answer. Flinch flash 18 f (0.3 s). Random wait 31/62/93 f (0.5/1.0/1.5 s), chosen by `rng mod 3`.

The mortar (248–292): three shells with launch vy 7.21 / 5.66 / 3.46 px/f (433 / 340 / 208 px/s); under 0.25 px/f²
gravity their flight times are 58 / 45 / 28 frames, which are exactly the divisors in the speed table, and each gets
`vx = aimOffset / flightTime`. They land behind, on, and in front of the player — a bracket. Shells are only thrown
when none are alive (`find_entity_by_type`), which is the attack's natural rate limit.

### What "hit" means here (4653–4709)
The hit routine checks `boss_hit_flag` (one hit per frame), the shield flag (deflect), the damage table (0 = deflect,
sign bit = **heal to full**, else damage, doubled on Normal), subtracts, removes the shot, sets `boss_hit_timer` for
the flash. The *phase change* on hit is the boss's own business: this one goes to phase 4 whenever the hit test
reports a hit (277–286). Other bosses ignore hits entirely and just flash.

## Other bosses, the same skeleton (labels only, not read in depth)
- `airman_ai` (400–616): a volley phase that spawns tornado children from a count table with per-shot delays, then a
  hop phase with a 3-entry velocity table (596–599); a shield window while the volley is out.
- `woodman_ai` (619–782): form 4 orbiting children at fixed offsets, toss, jump — a timer per step.
- `bubbleman_ai` (785–938): track the player while jumping, shoot on a distance check (812–888).
- `quickman_ai` (941–1154): three jump arcs from a vy table (7, 8, 4 px/f) with x speed derived from a distance
  divisor (1064–1065), a projectile volley on landing.
- `metalman_ai` (1379–1578): jump heights from a table, a blade fired with velocity chosen by `|dx|` bucket (1442–1447).
- Fortress bosses (1745–3880): multi-entity controllers with turret children and screen-drawn bodies.
Every one is `phase → sub-state → one timer`, and every attack is "spawn children with table velocities".

## Shared constants
| | value |
|---|---|
| boss hp | 28 |
| HP bar fill | +1 per 4 f → 1.9 s |
| hit flash | 18 f (0.3 s) |
| contact damage to player | 8 of 28 |
| basic shot damage | 2 (1 for the tough ones) |
| weakness damage | 4–14 |
| own weapon | heals to full |
| gravity (hops, shells) | 0.25 px/f² = 900 px/s² |
| screen clamp | x 8..248, y ≤ 240 |
| fire boss: charge | 240 px/s for |dx|/4 + 10 f |
| fire boss: post-hit wait | 31 / 62 / 93 f |
| fire boss: mortar airtimes | 58 / 45 / 28 f |

## Design shapes seen
- **Phase table + sub-state + one timer.** No boss needs more. The phase index is also the HUD state (bar filling
  = phase 1).
- **Attacks are children.** The boss body never has a hitbox for its attack; it spawns a thing with a velocity.
  Hit detection for the player stays uniform.
- **Hit reaction is a phase, chosen per boss.** Flinch-then-punish is one line in the hit path.
- **Rate-limit by "none alive"**, not by a cooldown. The next volley starts the moment the last shell lands, which
  feels responsive and self-balances with the player's position.
- **Aim at where you were.** The charge length is computed at wind-up; the tell is honest.

## Things learned that are not built yet
- The death sequence (bank0E `boss_ai_init_entry` 3271–3348): debris entities from a position table in bursts of 5
  with a sound each, palette flash, then the explosion grows — a `kit.burst` preset.
- Boss doors and scroll lock around the arena are in the stage engine.
- Difficulty doubling is a global on the damage path; our kit's `difficulty` knob can be exactly that.

## Edge cases to keep
- Never run the hit test during the entrance or the death; the cleanest way is to not call it from those phases.
- One hit per frame per boss (the flag) or a fan weapon lands three.
- Clamp the body to the arena in the mover, not the phase code; a charge into the wall must stop cleanly.
- Compute the charge distance once at wind-up and store it; recomputing per frame makes the boss track, which
  reads as cheating.
- Random waits from a short table (3 values), not a continuous range — the player can learn the rhythm's bounds.
- A boss that heals from its own weapon should flash a *different* colour; the data is one sign bit, the feedback
  is the lesson.
