# Study · Ocarina of Time (N64) · Z-targeting: picking, holding and dropping a lock-on

Learned from the zeldaret `oot` decompilation, commit `14759abf9abb4295de142cdc1452998630ea70fb`, files
`src/code/z_actor.c` (the Attention system: candidate search, ranges, reticle), `include/actor.h` (range table),
and `src/overlays/actors/ovl_player_actor/z_player.c` (the press/hold/release logic and the turn toward the
target). No code taken; the mechanism and its constants are the subject. The original runs at 20 fps. Angles are
16-bit turns; below in degrees. Distances are in world units; the player is about 100–110 units tall (child ≈ 70).

## Why this one
On a touch screen there is no aiming. A kid taps "attack" and the game has to decide *which* thing they meant.
Z-targeting is the canonical answer to "pick the thing the player is probably looking at, keep it until it
stops making sense, and show them what you picked". The 3D cone becomes a 2D cone or a facing-side arc; the
rest — ranges, leash, priority, the 10-frame grace, hold vs toggle, the "next target" arrow — carries straight
across. It is also the foundation for lock-on cameras, auto-aim, auto-talk and "who does the fireball hit".

## Vocabulary
- **Attention actor**: anything that has opted in (an `attention enabled` flag), with a *range type* and an optional
  *priority*. Hostile ones also carry a `hostile` flag; friendly things (people, signs) do not.
- **Nearest / prioritized candidate**: computed every frame by a scan; the one the arrow hovers over.
- **Focus actor**: the one actually locked on. Reticle drawn, player turns to face it, camera frames it.
- **Parallel**: the fallback when Z is pressed with no candidate — face and camera lock to the current heading.
- **Leash**: the distance beyond which a held lock-on lets go. Separate from, and larger than, the acquire range.

## State kept
- Per attention actor: `attentionRangeType` (index into the range table), `attentionPriority` (0 = none; lower
  wins), `isLockedOn`, cached `xyzDistToPlayerSq` and `yawTowardsPlayer` (computed once per frame by the actor
  update loop, so the scan is cheap).
- Global attention: `arrowHoverActor` (next candidate), `naviHoverActor` (where the fairy/cursor is heading, with a
  0→1 move progress), `reticleActor`, `reticleRadius`, `reticleSpinCounter`, `forcedLockOnActor` (an override, unused
  in practice), `bgmEnemy` (nearest hostile within 500 — drives battle music).
- Player: `focusActor`, `autoLockOnActor` (scripted), `zTargetActiveTimer`, `parallelYaw`, flags
  `Z_TARGETING`, `HOSTILE_LOCK_ON`, `FRIENDLY_ACTOR_FOCUS`, `PARALLEL`, `LOCK_ON_WITH_SWITCH`,
  `LOCK_ON_FORCED_TO_RELEASE`; the saved setting *hold vs switch targeting*.

## Update order, each frame
1. **Actor loop** (`Actor_UpdateAll`): for every live actor, cache distance-to-player (xz, y, and squared xyz)
   and yaw-toward-player; set `isLockedOn` if it is the focus actor; clear any stale priority when nothing is
   locked. After the loop: if the focus actor died (no update function) → release. If there is no focus actor,
   or the Z timer has dropped below 5, the reticle is turned off (with the "lock off" sound).
2. **Attention update**: run the **candidate scan** (below) to find the arrow-hover actor — unless the player is
   holding the stick *backward* while locked, which suppresses the arrow (so switch-targeting cannot get stuck in a
   two-target loop). Decide what the cursor hovers: forced > current focus > candidate > player. Move the cursor
   toward it (progress steps 0.25/frame; 4 frames = 200 ms). If the focus actor projects off screen, the
   *reticle* releases but the lock stays (a known quirk). Then animate the reticle (below).
3. **Player Z logic** (`Player_UpdateZTargeting`), in the player's own update:
   1. Timer: in a cutscene/dead/hookshot → 0. If Z is held, or a switch-lock is active, or a scripted auto-lock
      exists → hold the timer at ≥ 5 (decrement toward 5). Else if Parallel → 0. Else decrement toward 0.
   2. `ignoreLeash = timer ≥ 6`. On acquire the timer is set to 15 and counts down to 5: **10 frames (500 ms) of
      infinite leash**, so the reticle can settle even if the player is already backing away.
   3. **On Z press** (not while the boomerang is out, nor while a fishing line is cast): the next target is the
      cursor's actor; if that is already the focus, use the arrow actor instead (cycle). If a next target exists
      and is not lock-disabled: if it differs from the focus → set focus, timer = 15 (switch mode also sets
      `LOCK_ON_WITH_SWITCH`); if it is the same → in switch mode, release (toggle off); in hold mode, nothing.
      If no target → enter Parallel (face-lock), unless already in it or just forced to release.
   4. **Hold check**: if there is a focus actor and it `ShouldReleaseLockOn` (dead, opted out, or past the
      leash unless `ignoreLeash`) → release and set `FORCED_TO_RELEASE` (which blocks Parallel from starting
      until Z is let go, so losing a target does not snap the camera). Otherwise stamp the focus actor with
      priority 40 — it will keep winning the scan over anything without a priority.
   5. Classify: hostile focus → `HOSTILE_LOCK_ON` (battle stance, strafing); friendly or while carrying something
      → `FRIENDLY_ACTOR_FOCUS` (camera frames both, movement free).
4. **Facing** (`Player_UpdateShapeYaw`): while locked and the reticle has finished zooming, turn toward the focus
   at up to 22°/frame (440°/s); in Parallel toward `parallelYaw` at the same rate; otherwise toward the movement
   direction at 11°/frame. With no stick input while locked, the *movement* yaw target is the focus too.

## The candidate scan (`Attention_FindActor`, `Attention_FindActorInCategory`)
Categories are scanned in a fixed order: **boss, enemy, background** first; only if none of those produced a
nearest candidate are the rest scanned (explosives, NPCs, item-actions, chests, switches, props, misc, doors).
An actor qualifies if it: is alive, is not the player, has `attention enabled`, is not the current focus, has a
weighted distance smaller than the best so far, is **in range** for its range type, is **roughly on screen**
(320×240 with 20 px of leeway sideways and 160 px vertically — very forgiving vertically), and passes a
**line-of-sight** test from the player's focus point to the actor's focus point (walls block; surfaces that
projectiles ignore do not).

If the actor has a non-zero priority, it competes in a separate "prioritized" slot where the *lowest* value wins
regardless of distance. The result is the nearest candidate if any, else the prioritized one.

**Weighted distance** (`Attention_WeightedDistToPlayerSq`), where `θ` is the angle between the player's facing
and the direction to the actor:
- Not locked on anything: `θ > 60°` → excluded; else plain squared distance. **A 120° cone in front.**
- Already locked on something (choosing the *next* target): `θ > 90°` or lock-disabled → excluded; else
  `distSq · (1 − 0.8 · (90° − θ)/180°)`, i.e. an actor dead ahead counts as 60% of its distance, one at 90° counts
  full. **A 180° half-plane, biased toward straight ahead.**

## Ranges (`sAttentionRanges`, in units; default type 3)
The leash is stored as a scale: the lock holds while `dist · (range / leash) < range`, i.e. `dist < leash`.

| type | acquire range | leash | leash/acquire | who uses it (count in actors/) |
|---|---|---|---|---|
| 0 | 70 | 140 | 2.0 | 14 — small, close things |
| 1 | 170 | 255 | 1.5 | 14 |
| 2 | 280 | 5600 | 20 | 17 — "once locked, never let go" (bosses, flying) |
| **3** | **350** | **525** | **1.5** | 14 — the default |
| 4 | 700 | 1050 | 1.5 | 5 |
| 5 | 1000 | 1500 | 1.5 | 16 — far things (the fishing pond fish use this) |
| 6 | 100 | 105 | 1.05 | 42 — most common; **ordinary enemies**: lock only when close, drop almost at once |
| 7 | 140 | 163 | 1.17 | 1 |
| 8 | 240 | 576 | 2.4 | — |
| 9 | 280 | 280000 | 1000 | — |

Two readings matter. First, the leash is a *property of the target*, not the player — a boss keeps the lock across
the arena, a keese does not. Second, the most used type (6) has almost no leash: ordinary enemies are *re-acquired*
every time you approach rather than held, which is what makes combat feel like it follows you.

Scaled to a 40 px player (≈ 100 u → 40 px, factor 0.4): default acquire 140 px, leash 210 px; common enemy 40 px /
42 px; far things 400 px / 600 px. On a 390 px phone the default is "a third of the screen".

## The reticle (feedback is part of the mechanism)
On acquire: play the lock sound (two variants: hostile vs friendly), set `reticleRadius = 500`, and each frame step
it toward 80 by `clamp((500 − r) · 3, 30, 100)` — fast at first, slowing to 30/frame near the end (about 7
frames). When it arrives, `reticleSpinCounter` becomes non-zero, the radius is pinned at 120 and the counter
advances 3/frame, which is multiplied by 512 angle units → a full turn every ~43 frames (2.1 s). The *spin counter
being non-zero* is also the gate for the player's turn-toward-target and for stick-less movement toward the target:
input does not snap until the reticle has landed. On release the radius expands 80/frame back to 500 (5 frames).

## Hold vs switch
Two player-chosen modes, same machine:
- **Hold**: lock lives while Z is held. Release Z → timer runs down → below 5 the reticle drops → at 0 everything
  clears. Pressing Z again while held does nothing to the same target, but pressing with a *different* cursor
  target cycles (the cursor is the arrow actor when the cursor already sits on the focus).
- **Switch**: Z toggles. Press on nothing → Parallel; press on a target → lock (flag keeps the timer alive without
  Z); press again on the same → release; press with a different arrow actor → cycle.

## Dropping the lock (summary)
A lock is released when any of: the target died or opted out; the target is beyond its leash (after the 10-frame
grace); the player toggled it off (switch) or let go of Z (hold); a cutscene/death/hookshot started; the target
is lock-disabled. It is *not* released by going off screen (only the reticle hides) nor by a wall coming between
(line-of-sight is checked at acquire time only).

## Constants (20 fps)
| | original | per second / note |
|---|---|---|
| acquire cone, unlocked | ±60° | |
| next-target cone, locked | ±90°, weighted 0.6 ahead → 1.0 at 90° | |
| default range / leash | 350 / 525 u | 1.5× |
| common enemy range / leash | 100 / 105 u | 1.05× |
| leash grace after acquire | 10 frames | 500 ms |
| reticle-off threshold | timer < 5 | |
| turn toward target | 22°/frame | 440°/s (≈ 180° in 0.4 s) |
| turn toward movement, not locked | 11°/frame | 220°/s |
| cursor move progress | 0.25/frame | 200 ms |
| reticle shrink | 500 → 80, step clamp(3·gap, 30, 100) | ~7 frames |
| reticle spin | 8.4°/frame | 169°/s |
| reticle release | 80/frame | 5 frames |
| on-screen leeway | 20 px x, 160 px y of 320×240 | |
| battle-music radius | 500 u | nearest hostile |
| focus actor priority stamp | 40 | lower wins |

## Translating to 2D for the kit
- **Cone → arc.** With a facing vector, the same 120°/180° cones work; for a top-down game use the facing, for a
  side-scroller use "the side the player faces" with a vertical tolerance. For a touch game with no facing, use
  the cursor/last-tap direction, or fall back to nearest-with-priority.
- **Two ranges per target**, acquire and leash, as properties on the thing. Default 1.5×; "sticky" bosses 20×;
  "nervous" small enemies 1.05×.
- **Grace**: 10 frames of infinite leash after acquire. Without it, backing away while locking feels like the
  lock refused.
- **Priority slot** beats distance; the current target stamps itself so a slightly nearer thing cannot steal the
  lock mid-fight. Clear stamps when nothing is locked.
- **On-screen test** is a cheap pre-filter; **line-of-sight** against the solid layer is the expensive one and is
  only needed at acquire.
- **Feedback first, control second**: the reticle lands (7 frames), *then* the player turns toward the target.

## Things learned that are not built yet
- A target that offers "talk" (NPCs set a `talk offer` within a cylinder) reuses the same focus slot: Z-target and
  auto-talk are one mechanism. Worth remembering when `kit.say` meets `kit.target`.
- Scripted auto-lock (`autoLockOnActor`) overrides the scan — a tutorial can force the target.
- Parallel (face-lock with no target) is a 3D camera idea; in 2D it is "hold facing while strafing".

## Edge cases to keep
- Holding the stick backward hides the "next" arrow so a two-enemy loop cannot trap switch-targeting.
- Losing a target by leash sets a flag that blocks Parallel until Z is released — otherwise the camera would snap
  to face-lock the instant the enemy fled.
- Off-screen target: hide the reticle, keep the lock (or decide explicitly; the original is ambivalent).
- The fairy/cursor moving to the target and the reticle shrinking are two separate animations with different
  rates (4 frames vs ~7); the lock sound plays on the reticle, not the cursor.
- Never lock onto something whose update function is gone; check every frame, not just on acquire.
