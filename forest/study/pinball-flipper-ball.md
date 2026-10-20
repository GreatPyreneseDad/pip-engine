# Study · 3D Pinball: Space Cadet (Windows, 1995) · the ball step, the bounce formula, the flipper, bumpers, the plunger, and the mission ladder

Learned from k4zmu2a's decompilation of the Windows pinball (github.com/k4zmu2a/SpaceCadetPinball, commit
`cb9b7b886244a27773f66b0b19fdc2998392565e`). No code taken; the mechanisms and their constants are the subject.
Physics: `SpaceCadetPinball/pb.cpp` (`timed_frame` 336–480), `maths.cpp` (`basic_collision` 251–286),
`TFlipperEdge.cpp` and `TFlipper.cpp`, `TBumper.cpp`, `TPlunger.cpp`, `TBall.cpp`, `TTableLayer.cpp` (gravity
56–65, 111–116), `TCollisionComponent.cpp` (`DefaultCollision` 57–74). Table constants come from the game's data
file as dumped in `Doc/.dat dump.txt` (attribute codes decoded by `loader.cpp` 301–400, 434–480). The table is
simulated in its own units: the playfield is 16 wide × 29 tall (x −8..8, y −14..15), the ball radius is 0.3; one
unit is therefore roughly 2.5 ball diameters — scale to pixels by `px = unit · (canvasWidth / 16)`.

## Why this one
Pinball is the physics toy every kid recognises and the one most engines get wrong by using a general rigid-body
library. This game has no library: a ball, a direction, a speed, raycasts against lines and circles, and one
nine-line bounce formula with two material knobs. The flipper is the only hard part and it is worth copying exactly,
because a flipper that doesn't *throw* is the difference between pinball and a marble run. The mission ladder is a
bonus: how a table turns hits into a story with timers and lights.

## State it keeps
Ball: position, **unit direction**, scalar **speed** (not a velocity vector — this matters for the formula), radius,
a list of the last 16 edges hit (to avoid re-hitting the same edge in one step), a stuck counter. Table: gravity
vector, drag multiplier, max speed, a spatial grid of edges (lines, circles, flipper edges, each with an owner
component and a collision-group mask). Flipper: pivot, two arm endpoints, current angle, target angle, angular speed,
a motion flag (extending / retracting / still). Each component: `elasticity`, `smoothness`, `threshold`, `boost`.

## The frame (`pb::timed_frame` 336–480)
`dt` is the real frame time, capped at 100 ms. For each ball:
1. **Field forces.** `a = G − dir·speed·drag`, with a little random jitter on x (`FieldEffect` 111–116). G is the
   table incline: magnitude 25 × sin(0.5 rad) = **12.0 units/s²** down the table; drag 0.2/s. The terminal speed
   `G/drag = 60` is exactly the hard cap `BallMaxSpeed = 200 × radius = 60 units/s`. A slow ball (< 0.8 u/s) is
   stepped with `dt` clamped to 10 ms so it settles smoothly.
2. `v = dir·speed + a·dt`; `speed = |v|` (capped), `dir = v/|v|`.
3. **Substeps.** The distance to travel this frame is split into chunks of **half a ball radius**
   (`ceil(dist / 0.15)` steps, 395). Each chunk is a **raycast** from the ball along `dir` for at most that length
   against every edge in the grid (continuous collision; the ball can never tunnel). The nearest hit returns the
   edge and distance; the ball is moved to the contact point and the edge's response runs; the leftover distance is
   re-cast. A ball-vs-ball test runs on the same ray (441).
4. **Flippers move in the same substep loop.** A moving flipper's angular step is split into up to 3 substeps so
   the arm sweeps rather than teleports (`GetFlipperStepAngle` 128–145), and in each substep it tests every ball by
   casting the ball *backwards through the arm's rotation* (the ball is rotated by −Δθ about the pivot and the ray from
   its real position to that rotated position is tested against the arm, `FlipperCollision` 147–203). That is how a
   stationary ball gets hit by a moving flipper without the flipper having a velocity field.

## The bounce (`maths::basic_collision` 251–286)
Inputs: contact point `P`, surface normal `n` (unit, pointing out of the surface), ball `dir`, `speed`, and the
component's `elasticity e`, `smoothness s`, `threshold T`, `boost B`.
```
 ball.pos = P + 0.0005·n                              (lift off the surface)
 p = −(n · dir)                                       (how head-on: 1 = straight in, 0 = grazing)
 if p > 0:
     dir' = normalize( (dir + p·n)·s  +  p·n·e )      (tangential part × smoothness + normal part × elasticity)
 reboundSpeed = p · speed
 speed −= (1 − e) · reboundSpeed                      (lose the inelastic share of the normal speed)
 if reboundSpeed ≥ T:
     v = speed·dir' + B·n ;  speed = |v| ; dir' = v/|v|   (the kick)
```
Two knobs make every surface: `s` near 1 keeps the slide, `e` near 1 keeps the bounce. Walls: s 0.8, e 0.5.
Default (anything unlabelled): s 0.95, e 0.6. Flipper rubber: s 0.5, e 0.75. The kick is a third knob pair: a
bumper has T 2.5, B 17 — any hit with more than 2.5 u/s of approach gets **+17 u/s along the normal** regardless of
how fast it arrived; a plain wall has T = 9×10¹⁰ (never). On a canvas with pixels the same formula works in px/s.

## The flipper (`TFlipperEdge.cpp`, `TFlipper.cpp`)
Geometry: a pivot circle (radius 0.31 + ball radius) and a tip circle (0.19 + ball radius) joined by two lines; the
arm sweeps between the two endpoint vectors. From the table data: pivot (2.49, 12.06), tip (0.96, 13.13) → arm
length 1.86 u, sweep **AngleMax ≈ 69.6° (1.215 rad)**. Timing in the data is "seconds for the full sweep":
**extend 0.04 s, retract 0.08 s**, so ω_extend = 30.4 rad/s, ω_retract = 15.2 rad/s, and the tip (at 2.36 u from
the pivot including the rubber) moves at **72 u/s** — faster than the ball's cap.

Hit response (`EdgeCollision` 121–192), after the raycast finds the contact:
- Arm still → plain `basic_collision` with the rubber's e, s, no kick.
- Arm moving, ball on the **front** face (the side being swept): the kick is
  `B = collMult · (n_perp · hitDir) · |ω| · r / r_tip`, i.e. proportional to the arm's angular speed and to how far
  out along the arm the ball sits (r = distance from pivot), scaled by how squarely the arm face meets the ball;
  `collMult` = 0.9. Threshold is set to −1 so the kick always applies. At the tip that is up to 0.9 × 72 ≈ 64 u/s —
  one flip can take a dead ball to the table's max speed.
- Arm moving, ball on the **back** face: no kick, and elasticity is scaled by `(1 − r/r_tip)` so the ball dies
  against the back of a flipper near the tip (trapping behaviour).
- If the sweep hit a ball, the arm is **pushed back** by `Δθ / (5·|ω|)` and its remaining travel is increased
  (`FlipperCollision` 184–189) — a tiny recoil that stops a flipper driving through a ball.
Motion is a three-state flag: extend to AngleMax, retract to 0, still; input press = extend, release = retract,
any non-input event (pause, tilt, game over) = retract. The sprite frame is `round(angle / AngleMax × frames)`.

## Bumpers, kickers, plunger
- **Bumper** (`TBumper.cpp`, data group a_bump*): a circle edge with T 2.5, B 17; on a kick it lights for
  0.1 s, during which T is set to infinity (no double-kick), and the score depends on the bumper's **level**
  (`BmpIndex`, raised by table events and used as an index into its score list, `BumperControl` control.cpp 1257).
- **Slingshot/kicker walls** (`TKickback.cpp`): a wall whose T toggles between 0 (armed: every touch kicks with B)
  and infinity (disarmed) on a timer — a bumper in line form.
- **Plunger** (`TPlunger.cpp`): holding the key raises `Boost` from 0 toward 100 in fixed steps of `100 / (spriteFrames·8)`
  every 25 ms (a full pull takes on the order of two seconds); release sets T = 0 so the next contact kicks with `Boost·(1 + 0.1·rand)`; a
  short timer then restores T = ∞ and Boost = 0. Auto-launch (after a timeout or tilt) uses the full 100. 100 u/s
  is above the cap, so a full plunge is clamped to 60 next frame — "full power" is a saturating knob by design.
- **Ball–ball** (`TBall::EdgeCollision` 150–176): equal masses, exchange the normal components along the line of
  centres; tangential parts untouched.
- **Nudge/tilt** (`pb.cpp` 311–333): nudges add 4 × dt to a meter that decays 1/s; above 0.5 warn, above 1.0 tilt.
  Tilt sets a lock that makes every collision plain (no kicks) and retracts the flippers.
- **Stuck ball** (`timed_frame` 338–362): a slow ball that hasn't moved half a radius in 500 ticks gets a counter
  and an unstick nudge.

## The mission ladder (`control.cpp` `MissionControl` 2300–2442, `SelectMissionController` 4150–4366, `AddRankProgress` 1168–1201, `TLightBargraph.cpp`)
```
 state (one light's message field) : 0 waiting deployment → 1 select mission → 2..31 a mission → 1 …
 select: hit one of three targets → mission id = table[rank 1..9][target 1..3]  (harder missions unlock with rank)
         then confirm by riding the ramp → mission text, +10k / 20k / 30k by tier (mission_select_scores 809)
 mission: hit the named targets/sinks/kickout in order (each controller is ~40 lines of "if caller == target_n")
          within the fuel countdown; complete → 1,000,000 (×multiplier) + AddRankProgress(n)
 rank: outer ring of lights; n lights per mission; ring full → promotion (middle ring +1, up to 9), ring clears
 fuel: a 6-light bar run as 12 half-steps: each light flashes 3 s then holds 14, 12, 10, 8, 6, 4 s → 72 s from full
       (group 904 in the data); rollovers refill it, running dry ends the mission (TLightGroupCountdownEnded)
```
Scoring plumbing (`TPinballTable::AddScore` 249–270, `SpecialAddScore` 1143–1160): every award is multiplied by
`{1, 2, 3, 5, 10}[multiplierLevel]`; a jackpot accumulator and a bonus accumulator each grow with ordinary scores
while their flags are on (caps 5,000,000) and pay out on specific shots; mission rewards bypass the multiplier.
The hyperspace kickout is a ladder of its own: 0 = score, 1 = jackpot, 2 = drain blocker, 3 = extra ball, 4 =
multiplier up (2444–2502).

## Constants (table units; ×(canvasWidth/16) for pixels)
| | value |
|---|---|
| playfield | 16 × 29, ball radius 0.3 |
| gravity along table | 12.0 u/s² (25 × sin 0.5) |
| drag | 0.2 /s → terminal 60 u/s |
| max speed | 60 u/s |
| substep | 0.15 u (half radius); slow-ball dt 10 ms; frame dt ≤ 100 ms |
| walls | s 0.8, e 0.5 |
| default surface | s 0.95, e 0.6 |
| flipper rubber | s 0.5, e 0.75, collMult 0.9 |
| flipper sweep | 69.6°, extend 0.04 s (30 rad/s), retract 0.08 s |
| flipper tip speed | ~72 u/s; max kick ~64 u/s |
| flipper recoil on hit | Δθ/(5ω) |
| bumper | T 2.5, B 17, lit 0.1 s |
| plunger | 0 → 100 in ~2 s, +0–10 % random, then clamped to 60 |
| nudge → tilt | meter +4/s held, −1/s idle; warn 0.5, tilt 1.0 |
| multipliers | 1, 2, 3, 5, 10 |
| mission select / reward | 10–30k / 1,000,000 |
| fuel | 72 s full, 6 lights, 3 s flash + 14/12/10/8/6/4 s hold |
| jackpot / bonus caps | 5,000,000 |

## Design shapes seen
- **Direction + speed, not velocity.** The bounce formula is written in that form and it keeps the knobs
  intuitive (smoothness acts on the slide, elasticity on the bounce).
- **Threshold + boost on every surface.** A wall, a bumper, a slingshot and a plunger are the same object with
  different T and B.
- **Raycast substeps of half a radius.** No tunnelling, no penetration resolution, no rigid-body solver.
- **Flipper as a swept arm**, with a kick proportional to ω·r. Everything that feels like pinball is that line.
- **Missions as "hit these in order under a timer"**, selected by rank × target, paying a flat reward plus rank
  progress; the table's lights are the UI *and* the state.

## Things learned that are not built yet
- The edge grid (`TEdgeManager`) and the per-component collision masks (a ramp has an upper and lower layer).
- Ramps and one-way gates use a "field" on the ball while it is on them (`CollisionComp->FieldEffect`).
- The visual z of the ball (height on ramps) is a separate offset, not physics.

## Edge cases to keep
- Lift the ball 0.0005 off the surface after a hit and keep a short list of edges hit this step; otherwise a
  corner re-hits forever.
- The kick test uses the **normal** approach speed, so a grazing hit on a bumper doesn't fire it.
- Cap speed after the field step, not after the kick; the plunger and a tip flip legitimately exceed it for a frame.
- A moving flipper must test balls it is sweeping *into*, not just balls moving into it — hence the backwards
  rotation ray.
- Back-face flipper hits must deaden, or the ball bounces off a raised flipper's back onto the drain.
- Tilt = plain collisions + flippers down, not a frozen ball; the ball must drain honestly.
