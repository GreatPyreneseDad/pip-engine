# Study · Super Mario 64 (N64) · the follow camera

Learned from the n64decomp `sm64` decompilation, commit `9921382a68bb0c865e5e45eb594d9c64db59b1af`, file
`src/game/camera.c` (with mode and flag names from `src/game/camera.h`). No code taken; the mechanism and its
constants are the subject. The original runs at 30 fps. Angles are 16-bit turns (65536 = 360°); below they are
given in degrees. Distances are in world units; the player is about 160 units tall, so 125 units is roughly
"shoulder height" and 800 units is "five bodies away".

## Why this one
Every scrolling game on the floor has a camera, and nearly all of them are wrong in the same way: glued to the
player, so the screen jitters with every hop. Mario 64's camera is the one players remember as "the camera
that had a personality" — it is a *second mover* that chases a goal, leads the player, refuses to sit inside
walls, and only ever cuts when the game changes what kind of place you are in. Everything it does in 3D has a
flat twin: yaw-around-the-player becomes "which side of the player the camera prefers", pitch becomes vertical
offset, "distance" becomes zoom. The ideas carry; the numbers calibrate.

## The shape: a camera is two points, and both are chased
The camera is not one position. It is a **goal** (where the current mode says the camera should be this frame)
and a **current** (where the camera actually is). Each frame the mode computes the goal from scratch; then a
second stage moves current toward goal. The same split applies to the **focus** (the point looked at). Four
points: goalPos, goalFocus, curPos, curFocus. The renderer uses only the current pair.

That split is the entire feel. A mode can be as twitchy as it likes because the smoothing stage between it and
the screen hides the twitch. And a cut is just "copy goal into current without smoothing".

## State the camera keeps
- `goalPos`, `goalFocus`, `curPos`, `curFocus` (2D: `gx, gy, fx, fy` plus `cx, cy`).
- `mode` and `defMode` (the mode this area returns to), plus a transition record: frames left, and the
  start pose expressed in polar coordinates around the focus (distance, pitch, yaw).
- Smoothing rates: `posHSpeed`, `posVSpeed`, `focHSpeed`, `focVSpeed` — fractions of the gap closed per frame.
  Defaults 0.3 / 0.3 / 0.8 / 0.3. They are *state*, not constants, because hits set them to 0 and they recover.
- `yaw` and `nextYaw`: the preferred side; yaw is pulled toward nextYaw at a capped turn speed.
- `panDistance`: the look-ahead offset, smoothed separately.
- Zoom: `zoomDist` (mode's preferred distance) and a zoom-in-progress amount.
- Flags: smoothMovement, blockSmoothMovement (snap this frame), collidedWithWall, nearWall, startTransition.
- Shake: per axis (pitch, yaw, roll, fov) a magnitude, a phase, a phase speed and a linear decay.
- Previous-frame geometry of the player: floor height, ceiling height, floor type (for "did we just step onto a
  camera-trigger floor" edges).

## Update order, each frame
1. **Read the player's geometry** (floor under them, ceiling over them). Keep last frame's copy.
2. **Load goal into working pose**: `pos = goalPos, focus = goalFocus`. The mode edits these.
3. **Area processing**: trigger volumes and floor types can request a mode change. A mode change does not
   teleport anything; it starts a *transition* (see "Cuts and transitions").
4. **Run the mode** (see "Modes"). The default mode's own order is:
   1. input (C-buttons rotate yaw by ±28° chunks; zoom toggles distance),
   2. compute distance, pitch, yaw from the player to the current pos,
   3. shrink distance toward the preferred one (only ever *in* unless zooming out: −50 u/frame = −1500 u/s),
   4. pick a yaw turn speed (see "Lag and lead"),
   5. if a wall covers the player, override: turn toward the "avoid yaw" asymptotically (10%/frame),
   6. place pos at (distance, pitch, yaw) around the player, lift it 125 u plus a floor-following term,
   7. push pos out of any wall within 80 u (slide along the wall normal),
   8. set focus to the player + 125 u (+ floor term),
   9. resolve height: never below the floor under the camera + 125, never below the player's floor + 125 unless
      a surface between them says otherwise, never above the ceiling − 150, above water, above poison gas;
      then *approach* the height goal at 20 u/frame (600 u/s), never snap,
   10. clamp how far the new pos may move from the old goal in one frame (50 u = 1500 u/s), and clamp
       pos-to-focus distance to the zoom distance,
   11. add the look-ahead pan to focus.
5. **Mode transition** (if one is running): blend from the start pose to the mode's pose in polar coordinates.
6. **Smooth**: `cur += (goal − cur) · speed` per axis (H speeds for x/z, V speeds for y) — unless
   blockSmoothMovement, in which case `cur = goal`. Speeds relax back toward defaults at 5%/frame.
7. **Shake**: add `magnitude · sin(phase)` to pitch/yaw/roll, advance phase, decay magnitude linearly, zero the
   phase when the magnitude reaches zero. Handheld sway is a separate low-frequency sum.
8. **Floor the camera**: if the final pos is within 100 u of a floor, lift to floor + 100.
9. **Clamp pitch** to ±87°.

## Lag and lead

**Lag** is the asymptotic smoothing in step 6. A per-frame fraction `k` at 30 fps is a continuous rate
`λ = −ln(1 − k) · 30` per second; on a canvas with `dt` the update is `cur += (goal − cur) · (1 − e^(−λ·dt))`.

| what | per frame (30 fps) | rate λ /s | half-life |
|---|---|---|---|
| position, horizontal (`posHSpeed`) | 0.30 | 10.7 | 65 ms |
| position, vertical (`posVSpeed`) | 0.30 | 10.7 | 65 ms |
| focus, horizontal (`focHSpeed`) | 0.80 | 48 | 14 ms |
| focus, vertical (`focVSpeed`) | 0.30 | 10.7 | 65 ms |
| speeds recover toward default | 0.05 | 1.5 | 450 ms |
| distance toward preferred zoom | 0.05 | 1.5 | 450 ms |
| yaw toward wall-avoid yaw | 0.10 | 3.2 | 220 ms |
| pan (look-ahead) toward its goal | 0.025 | 0.76 | 910 ms |

The focus turns much faster than the body moves: the camera's *eye* snaps to the player, its *feet* trail.
That is why a jump reads as "the camera looked up" rather than "the camera lurched up".

The **yaw turn** toward the preferred side (behind the player's facing) is linear, not asymptotic, with a speed
chosen by situation:

| situation | per frame | per second |
|---|---|---|
| player standing still, close mode | 1.41° | 42°/s |
| player standing still, free-roam mode | 1.05° | 32°/s |
| stick is being pushed (player moving) | 0.18° | 5.3°/s |
| camera within 250 u of the player | 22.5° | 675°/s (whips round) |
| wall near the camera | ×2 | |
| a C-button nudge | 28° step, then the turn speed is 0 | |
| the hard cap on any yaw change (`sYawSpeed`) | 5.6° | 169°/s |

So while the player runs, the camera barely swings behind them (5°/s); when they stop, it drifts round at 30–40°/s.
Moving players get a stable screen; stopped players get a camera that quietly re-centres.

**Lead** (`pan_ahead_of_player`): the focus is offset sideways in the direction the player faces by
`sin(16.9°) · dist ≈ 0.29 · dist`, projected onto the camera's left-right axis, then smoothed at 2.5%/frame.
The player is drawn off-centre toward where they are going by up to 29% of the camera distance. The sign
flips during a long jump and while climbing a pole (look back, not ahead). While the player sleeps, the pan
decays to zero. In 2D this is exactly the "look-ahead" of a side-scroller: `fx = px + facing · lead`, smoothed.

**Height following** (`calc_y_to_curr_floor`): the camera does not follow the player's y; it follows the
*floor under the player* (or water, if higher). pos gets 1.0 × (floor − playerY) and focus gets 0.9 ×, each
clamped to ±200 u. A jump therefore barely moves the camera; a fall to a lower floor does. For a platformer
this is the single most useful rule in the file: **track the ground, not the body**, and let the body move
within the frame.

## Distance and height
- Preferred distance by mode: close/free-roam 800; "Mario cam" 350; radial/8-direction 1000 (+400 when zoomed
  out, with a pitch lift of 12.7° reached over 13 frames). Zoom-out adds 400 (Lakitu) or 1050 (Mario cam).
- Hanging or riding the owl: distance ×0.8 and a handheld sway.
- Default pitch in radial modes: 8.0°, plus the slope's angle of declination when the floor 40 u toward the
  camera is lower than the player (the camera looks *down* slopes so you can see where you are going).
- Position height = floor + 125 + mode bonus (free-roam 100, zoomed-out 375, Mario-cam zoomed-out 610; halved in
  two tight areas). Focus height = player + 125 (−25 in Mario cam).
- In 2D: `dist` → zoom, `pitch` → vertical offset. Keep the two heights distinct: where the camera *is* and what
  it *looks at* are different offsets from the player.

## Avoiding walls (`rotate_camera_around_walls`, `collide_with_walls`)
Eight probes are stepped from the player to the camera (12.5% each). At each, a coarse sphere (radius 150 growing
30/step to 250) looks for walls. If one is found, a fine sphere (100 growing 20/step to 200) rechecks; if the wall
actually stands between the player and the camera, is facing the right way, and is taller than 150 u, the camera
gets an **avoid yaw** — the direction parallel to the wall, on the side nearer the current yaw — and status 3
("covered"). If the wall is found only in the last three probes (more than 62% of the way to the camera) it is
status 1 ("near"), which just doubles turn speed. Status 3 overrides the normal yaw logic and turns toward the
avoid yaw at 10%/frame; zooming back out is suppressed while a wall collision flag is set.

Separately, after placement, the camera is pushed out of any wall within 80 u along the wall's normal, and a
"collided" flag is remembered so the camera does not immediately drift back in.

In 2D the equivalent is cheaper and worth having: cast a ray from player to camera against the solid tiles; if it
hits, slide the camera's preferred side toward the open side, and never let the viewport rest with its edge
inside a wall (clamp the camera rect to the level bounds, which SM64 also does with per-area x/z clamps).

## Cuts and transitions
There are three ways the camera changes place abruptly, and only one is a true cut.
1. **Mode transition** (`transition_to_camera_mode`, 30/60/90 frames = 1/2/3 s): the start pose is recorded
   *relative to the focus* in polar form (distance, pitch, yaw) and stepped linearly to the new mode's pose,
   with the per-frame step recomputed as `remaining / framesLeft` so it always lands exactly on time. The
   blend happens in polar coordinates, so the camera *orbits* to the new side rather than cutting through the
   player. During the blend the pos is still kept 125 above floors and out of walls.
2. **Action-driven mode set** (`set_camera_mode`, 1 frame): entering water, taking flight, being shot from a
   cannon, exiting a door. The transition is one frame — effectively a cut, but on an event the player caused.
3. **Warp** (`warp_camera`): when the player is displaced by a warp, the camera is displaced by the same vector,
   so relative to the player nothing cut.

And one anti-cut: `CAM_FLAG_BLOCK_SMOOTH_MOVEMENT` is set when the smoothing would produce nonsense (e.g. the
camera was just placed behind the player after a door) — the current pose snaps to the goal for one frame, then
smoothing resumes two frames later.

Rule to keep: **the camera cuts when the kind of place changes (room, water, cutscene), never because the player
moved fast.** Fast movement is handled by the 50 u/frame lag clamp (step 4.10), which lets the camera fall behind
by at most 50 units and then drags it.

## Modes (the diagram)
```
                 ┌──────────── area triggers / floor types ───────────┐
                 ▼                                                     │
   RADIAL ──── 8_DIRECTIONS ──── FREE_ROAM / CLOSE ──── FIXED ── PARALLEL_TRACKING
 (orbit the      (8 fixed       (default: behind      (tripod)   (slide along a
  area centre)    angles)        the player)                      path of points)
                 │                   │
     action events (1-frame set):    ├─ C_UP (first person, 16-frame move in / out)
                 │                   ├─ WATER_SURFACE / BEHIND_MARIO (swim, fly, cannon)
                 ▼                   └─ INSIDE_CANNON, BOSS_FIGHT (frames two things), SPIRAL_STAIRS
```
Radial modes compute yaw from the *area centre* to the player (plus a bounded offset of ±60°, ±105° on a second
nudge, hard cap ±120°), so the camera orbits the level rather than the player. 8-direction snaps that yaw to 45°
steps. Boss-fight mode looks at the midpoint of player and boss, which is the 2D "frame two targets" camera.
Fixed and parallel-tracking modes are tripods: pos is pinned (or slid along a polyline), only focus follows.

## Shake (`set_camera_shake_from_hit`)
Shake is `magnitude · sin(phase)` added to an angle, with the phase advancing by a fixed step and the magnitude
decaying linearly to zero per frame.

| event | axis | magnitude | decay/frame | phase step | note |
|---|---|---|---|---|---|
| fall damage | pitch, roll | 0.53° | 0.016° | 180° (flips sign every frame) | ~33 frames |
| ground pound | pitch | 0.53° | 0.066° | 180° | ~8 frames |
| small damage | yaw, roll | 0.70° | 0.044° | 90° | and fov 1.4° |
| medium damage | yaw, roll | 1.41° | 0.088° | 90° | fov 2.1° |
| large damage | yaw, roll | 2.11° | 0.18° | 90° | fov 2.8° |
| in water | same events | ×4 magnitude, ×2 decay | | 22.5° | slower, bigger |
| any damage / an attack landing | — | sets pos & focus H speeds to 0 for the frame | | | the "hitch" |
| hit from below | — | speeds to 0.07 | | | a soft hitch |

That last row is the part people miss: on a hit the camera does not just shake, it **stops following** for a
frame and then recovers at 5%/frame. The world lurches because the camera held still while the player moved.
In 2D: on a hit, zero the lag rates for one frame and let them recover; add a small decaying sine to the offset.

## Constants worth keeping (converted)
| | original | per second / 2D reading |
|---|---|---|
| frame rate | 30 fps | |
| position follow rate | 0.3/frame | λ = 10.7/s |
| focus follow rate (horizontal) | 0.8/frame | λ = 48/s |
| rate recovery after a hit | 0.05/frame | λ = 1.5/s |
| look-ahead | 29% of camera distance | in 2D: ~0.15–0.3 of the half-width |
| look-ahead smoothing | 0.025/frame | λ = 0.76/s |
| floor-follow clamp | ±200 u | ~1.25 bodies |
| height approach | 20 u/frame | 600 u/s, linear |
| max camera lag per frame | 50 u | 1500 u/s |
| yaw turn while player moves | 0.18°/frame | 5.3°/s |
| yaw turn while player still | 1.05–1.41°/frame | 32–42°/s |
| yaw turn cap | 5.6°/frame | 169°/s |
| camera-above-floor margin | 125 u (100 for final pos) | ~0.75 body |
| wall push-out radius | 80 u | ~0.5 body |
| wall probe count | 8 along player→camera | |
| mode transition | 30 / 60 / 90 frames | 1 / 2 / 3 s |
| invulnerable-to-cut rule | cut only on place change | |

Knobs the line will turn: `lag` (λ, 3–12/s; small = floaty), `lead` (0–0.3), `deadzone` (SM64 has none; the
floor-follow clamp plays that role vertically), `groundFollow` (true = track floor, not body), `bounds`.

## Things learned that are not built yet
- **Floor tracking** needs to know "the floor under the player", which the 2D collide layer can give (last
  grounded y). Until then, track the body with a vertical deadzone.
- **Two-target framing** (boss-fight mode): focus the midpoint, distance from the separation.
- **Trigger volumes that change mode** are a level-data feature; the first version has one mode per game.
- **C-up / first person** and cannon modes have no 2D meaning.

## Edge cases to keep
- When the player is within 250 u, the camera is shoved back out to 250 and whips (675°/s): a camera *inside* the
  player is worse than a fast camera.
- Never move the camera through a floor while descending; approach height, do not set it.
- If the player is stuck in the ground and the goal is >1000 u away, teleport the height (the one case of a snap).
- When a transition and a wall push disagree, the wall wins for position but the transition keeps its timer.
- Zoom only ever *decreases* on its own; increases happen only when nothing is in the way and no wall flag is set.
