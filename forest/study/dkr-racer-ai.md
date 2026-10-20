# Study · Diddy Kong Racing (N64) · AI racers: following the track, the rubber band, and item pacing

Learned from the DavidSM64 decompilation, `github.com/DavidSM64/Diddy-Kong-Racing` at commit
`a5eb080fa8f91b97d6f6495e0549ef7121ae7496`. Sources: `src/racer.c` (`update_AI_racer`,
`racer_AI_pathing_inputs`, `func_80045C48` = path following, `func_80042D20` = race brain,
`func_8005B818` = off-screen update, `handle_racer_top_speed`, `increment_ai_behaviour_chances`,
`roll_percent_chance`), `src/object_functions.c` (`obj_loop_weaponballoon`), the `CheckpointNode`
struct in `src/objects.h` and `AIBehaviourTable` in `src/racer.h`. The per-level AI table and the
per-character timing table are ROM assets, so they appear as named knobs. No code taken.

Units as in `dkr-kart-handling.md`: ticks at 30 Hz carrying `updateRate` 60 Hz frames (normally 2),
speeds in world units per 60 Hz frame, forward positive here (negative in the original), angles with
65536 = 360°.

## Why this one
Opponents that drive the track, stay in a pack around the player, and use pickups with some restraint are
what turn a "car on a canvas" into a race. DKR's AI is a *fake player*: it writes stick and button values
into the same input slots the human uses, then the kart code from `dkr-kart-handling.md` runs
unchanged. That is the pattern to copy. The rubber band is a speed bonus in the same units as the
player's banana pickups, not a cheat on position.

## The track representation the AI reads
A loop of **checkpoint nodes**, each with position, a forward direction (`rotationXFrac`,
`rotationZFrac` give the node's sideways axis), a `scale`, and for each of **four lanes** (`unk2E[lane]`
sideways offset, `unk32[lane]` height offset, `unk36[lane]` a per-lane flag: 2 = take the alternate route
from here, 4 = brake zone, 5 = water/alt behaviour, 6 = finish). Each racer keeps `nextCheckpoint`, a
`checkpointDistance` fraction (1 at the previous node, 0 at the next), `lane` (0..3), and `onAltRoute`.
Race position is `courseCheckpoint` (checkpoints passed this race) plus that fraction. Progress is checked
every tick by a plane test against the next node; AI are not allowed to move *backwards* in the fraction.

## Two update modes
- **On screen** (within 400 units of a human, 400² = 160000, or in any special mode): synthesise inputs,
  then run the full kart physics. A 30-tick hysteresis keeps a racer "on screen" after it leaves.
- **Off screen** (`func_8005B818`): no physics. Target speed `vT = √((bonus · 0.025 + 0.595) / 0.004)`
  (× 1.3 while boosting), `velocity += (vT − velocity) · 0.25` per tick (hovercraft eases at 0.125 and
  slows by `(|Δheading| − 200) / 150` in bends). The racer slides along the lane spline by a parameter
  speed that is re-fit each tick so the spatial speed matches `velocity`, is capped at 35 units of lateral
  correction per frame, keeps its heading tangent to the spline, and writes its position directly. Drift,
  yaw, bob and crash state are zeroed. This is what lets 8 racers fit the budget, and it is also why
  off-screen racers never crash.

## Path following (on screen), each tick
1. Build a 4-node window `nextCheckpoint − 2 .. +1` with the lane offsets applied
   (`x += scale · sideAxis · laneSide`, `y += scale · laneHeight`).
2. `t = clamp(1 − checkpointDistance, 0, 1)`. Take the **Catmull-Rom derivative** at `t`, normalise to
   length 100, get its yaw; the change in that yaw since last tick, `>> 3`, is the base stick (anticipates
   the bend). If the racer's heading is more than 0x3000 (67°) off the path tangent, set `t = 1` (aim at
   the next node, not the local tangent).
3. Evaluate the **cubic spline point** at `t`, add 500 units along the normalised tangent: that is the
   look-ahead target. Yaw error to it, divided by 32 (`>> 5`; 16 for the plane, 32→16 for the heavier
   bosses), is added to the stick; pitch error likewise for flying vehicles.
4. Clamp both stick axes to ±75 (the human's is ±~80). Accelerate is held unless the brain below says
   otherwise.
5. **Stuck recovery**: if speed < 1 on the ground with no reverse in progress, count up; after 60 frames
   enter reverse for 60 frames (stick mirrored, brake + stick down), with a 120-frame cooldown before it
   can trigger again, and **switch lane** (`lane = (lane + 1) & 3`). The lane change is the real fix; the
   reverse just gives it room.
6. Per-lane node flags: a brake-zone node (`4`) multiplies speed by 0.9 per tick while faster than 4.

## The brain (`func_80042D20`), each tick
Inputs: race order (`racersAhead`, the number of *AI* racers ahead of this one, 0..7), `firstHumanPos`
(position of the best human), nearest opponent ahead and behind with distances, skill (`AI_MASTER 0 ..
AI_EASY 4`, from the level header per character, or random Master..Hard in small fields), the behaviour
table `T` with two floats `T.lo, T.hi` (target speed bonus for the leading / trailing AI) and
`T.pct[4]` rows of `{min, max, minStep, maxStep}` percentages.

**Rubber band.** The AI's `bonus` is in banana units (each +2.5 % top speed, clamped ±20 so ±50 %;
humans are capped at 10):
- `vLo = √((T.lo · 0.025 + 0.561) / 0.004)`, `vHi = √((T.hi · 0.025 + 0.561) / 0.004)` — the table
  speaks in bonus units, the blend happens in *speed* so it is linear in what the player sees.
- `v = vLo + (vHi − vLo) · (7 − racersAhead) / 7` — the AI at the front gets `T.lo`, the one at the back
  `T.hi`; the pack spreads itself evenly whatever the player does.
- `v += 0.2 · (lane − 1)` when `lane > 1` — outer lanes are longer, so they get a touch more speed.
- `bonus = (v² · 0.004 − 0.595) / 0.025`, stored, and read by the top-speed code exactly like bananas.
- Challenge and boss modes override `bonus` from a per-mode table; a boss gets +5 for the first 6 s of the
  race, +10 if it is second or the player is within 200, and +2 if it falls 650 behind after that.
- At the start, Expert copies the human's start-boost length, Master always boosts. Throttle before the
  signal is released by skill: an AI of skill `s` holds accelerate once `4 · (s − 2) ≤ 300 − countdown`,
  so Master/Expert jump the gun and Easy dawdles.

**Lane choice.** `lane = table[racersAhead]` (`{1,1,1,2,3,2,3,2}`) re-rolled every 300 frames, minus 1
on a `T.pct[3]` roll; during the countdown it is `{0,0,0,1,1,2,2,2}[racePosition]`. If the AI ahead is
idle, in the same lane and within 100 units, move out one lane (max 3). If the racer ahead is more than
500 away and we are in lane 3, drop to lane 2. Lanes 0..3 are the designer's fast line to wide line; the
band keeps the AI from forming a train.

**Boost etiquette.** When a boost starts, roll `T.pct[0]` once: on success the AI *releases* the
throttle for the boost (slower, but the game's "empowered" flame) until speed drops under 12.

## Item pacing
**Pickups** (`obj_loop_weaponballoon`): a balloon is taken by any racer within 45 units. Taking the same
colour you already hold raises its level (0 → 1 → 2, three tiers); a different colour resets to level 0;
quantity per (colour, level) is a table. The balloon then **shrinks and regrows over 90 units**, scale
`= base · (1 − respawn / 90)`, invisible under 0.1, counting down `2 · updateRate` per tick (about 0.75 s
to full), **and the countdown does not start while a racer is still within 45 units** (no camping, no
immediate re-grab). Colours are fixed per balloon in the level, so item pacing is a track-design knob, not
a random roulette.

**AI use.** Each pickup sets a "think" flag. On the next tick the brain rolls the table:
- `pct[1]` (interpolated by `(7 − racersAhead) / 7`, so trailing AI roll higher): upgrade the balloon one
  level for free.
- If the best human leads and this AI is in the top 3 AI: `pct[3]` chance to force the balloon to the
  boost colour.
- Fire plan by weapon class: *forward* weapons when an AI (or on a `pct[2]` roll with the human in the top
  2, anyone) is ahead; *backward* weapons likewise behind; *boost* on a `pct[3]` roll when not already
  boosting. The fire itself is delayed by `reaction[character] · 60` frames and the plan is re-evaluated
  every 300 frames. A trap behind is also dropped when a human is within 200 behind, this AI is not last,
  the human is in the top 3, and a per-pair "grudge" table entry is under 5.
- Chances ratchet: each time the AI starts a boost, picks a higher-level balloon, or fires a forward
  weapon, the matching row's `min`/`max` grow by their steps, clamped 0..100. The AI gets bolder as the
  race goes on.

## Translating to a 2D kids' racer
- Track = polyline of nodes with a width; lanes = 3–4 fixed sideways offsets in units of width. A
  Catmull-Rom through the nodes gives the smooth line for free.
- The look-ahead target (`point + 500 · tangent`) scales with speed in our version: `lookAhead = v ·
  0.6 s` reads well on a phone-sized track.
- Rubber band: one number per AI in the same units as the player's speed pickup, interpolated by rank
  among the AI, never by distance to the player. Easy mode narrows `[T.lo, T.hi]`, it does not cheat.
- Off-screen racers may teleport along the spline; nobody will see it, and it is how eight racers fit.

## Edge cases to keep
- Never let an AI's progress fraction go backwards (keeps rank stable when it bumps).
- The stuck timer only counts on the ground and only when speed is really low (< 1); airborne racers
  are never "stuck".
- A lane flag of "brake here" is needed for hairpins; the look-ahead steering alone will overshoot.
- Camping prevention on pickups: the regrow timer must wait for the taker to leave the radius.
- The rubber band must have a hard cap (DKR ±50 %); without it a lapped AI becomes a missile.
