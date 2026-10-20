# Study · Ocarina of Time (N64) · the fishing pond: bite, hook, fight, size

Learned from the zeldaret `oot` decompilation, commit `14759abf9abb4295de142cdc1452998630ea70fb`, file
`src/overlays/actors/ovl_Fishing/z_fishing.c` (fish brain in `Fishing_UpdateFish`, lure and reel in
`Fishing_UpdateLure`, the notice test in `func_80B70ED4`, the line in `Fishing_UpdateLine`, size roll in
`Fishing_Init`, weight in `Fishing_UpdateOwner`). No code taken; the mechanism and its constants are the subject.
The original runs at 20 fps; per-frame speeds below are also given per second (×20). Distances are world units;
the pond is a disc of radius ~920 u, the player about 100 u tall, fish lengths are in **cm** and are also the
scale of the model.

## Why this one
"Fishing game" is one of the first things a kid asks for, and the naive version — tap, wait a random time, fish —
is dead in ten seconds. The pond in Ocarina is the reference for why fishing can be *played*: the fish has a mind
(notice, approach, lose interest, decide), the bite is a short reaction window sized by the fish, the fight is a
rhythm of runs and rests where the player's job is to keep tension without pulling the hook, and size is rolled
once and shown off. All of it is 2D-ready: the pond is already a top-down plane with a depth number.

## State kept

**Each fish** (15–17 of them, placed around the pond):
- `fishState` (the brain), `fishStateNext` (where to return after an episode), a 4-slot `timerArray`, and two
  long timers: *wary* (ignores the home routine; set 1000 after a scare) and *lure-blind* (will not notice the
  lure; set 200 after a scare, 100 after a lost fight).
- `fishLength` cm, `isLoach`, `perception` (0–0.2 base; **the big ones have 0**), `speedTarget`, `rotationStep`
  (turn rate), `fishTargetPos` (where it is swimming to), `bumpTimer` (hit a wall; swerve), tail-wag phase and
  magnitude (animation driven by speed), mouth position (the hook point).

**The rod / lure** (global, one):
- `rodCastState`: 0 holding, 1 flying, 2 settling, 3 fishing, 4 fish on, 5 landed.
- `lurePos`, `lureVel`, `lureRot`, a 200-segment line with `lineSpooled` ∈ [0, 200] (200 = all on the reel;
  1 spool unit ≈ 5 u of line), `reelSpeed` (spool units/frame), `lureEquipped` (stock floats; sinking lure sinks).
- Bite/fight: `hookedFish`, `lureBitTimer` (the reaction window), `lineHooked`, `rodPullback` ∈ [0, 100]
  (tension credit), `fightTime` (frames since the bite), `wiggleAttraction` (0/1/2 from the last stick flick),
  `splashSpook` (10 frames after splashdown), `rumbleDelay`, `rodHitTimer` (rod bends when the hook sets).

**Context**: time of day, fog/storm (from how many games have been bought), the record length, and the
"fish on hand" (the one you keep until you talk to the owner).

## Update order, each frame
1. Lure (`Fishing_UpdateLure`): advance rod state; integrate the cast; read the stick for wiggles; reel in on A;
   move the lure toward the line's end; spool bookkeeping.
2. Line (`Fishing_UpdateLine`): the first `lineSpooled` segments sit at the rod tip; the rest hang between tip and
   lure with a gravity sag; while a fish is on, every 32 frames the spool is recomputed from the real tip-to-fish
   distance ×0.97, so a running fish *pays out* line.
3. Each fish (`Fishing_UpdateFish`): timers down; compute direction and distance to `fishTargetPos`; swerve if
   bumped; run the state; turn toward the target at `rotationStep`, pitch toward it at half that; approach
   `speedTarget`; integrate; collide with pond floor and walls; splash/leap effects at the surface.
4. Owner/dialog, camera, and the catch cinematic are separate states that freeze the rest.

## The fish's mind (states)
```
   10 swim home ──near home──▶ 11 hover (speed→0)
     ▲    │                       │  dusk/dawn minute ──▶ 7 jump with the school (200–350 f) ──▶ 10
     │    │ player too close      │
     │    ▼                       ▼
     0 wary idle ◀──────────▶ 1 dart to a random spot (3–33 f) ──(loach: −1/−2/−25 bottom-dweller loop)
     │   (wary timer runs 1000 f; when it ends → 10)
     │
     │  notice test (any of 0,1,7,10,11; see below)
     ▼
     2 interested: hover near the lure, roll for a bite each frame (interest lasts 100–200 f)
     │ bite roll succeeds
     ▼
     3 swing out beside/behind the lure (0–10 f or within 30 u) ──▶ 4 charge the lure (≤20 f)
                                                                     │ within 10 u
                                                                     ▼
     5 ON THE LINE: reaction window → hooked → runs and rests ── escape ──▶ 0 (wary 10000, blind 500)
                                                                     │ within 50 u of the player
                                                                     ▼
     6 caught: hoist, weigh, keep/release ──▶ 0
```

### Scare
In any ordinary state a fish flees when the player's horizontal distance is under
`250 · (0.25 + 0.15 · playerSpeed)` (loach: 0.30 · speed). Standing still that is 62 u — about half a body — but
running (speed ≈ 8) it is ~370 u. **Walking the bank quietly matters.** A scare sets wary = 1000 f (50 s), lure-blind =
200 f (10 s), and 50 f (2.5 s) of fast darting at 4.2 u/f (84 u/s). Interest (state 2) breaks at `100 · mod` instead.
Separately, for 10 frames after a stock lure splashes down, any fish over 60 cm within 30 u is scared off: big fish
hate a lure landing on their head; cast *past* them.

### Notice (`func_80B70ED4`)
Only while the lure is in the water (rod state 3), the fish is not lure-blind, and the hat is not on the hook.
The lure must be in the **front half** of the fish (ahead of its sideways axis) — unless the fish is under 40 cm,
which notice everything around them. Then:
- within **120 u** and the lure is *moving* (A held = reeling, or a wiggle hop > 1) → interested;
- within **70 u** and the fish has not recently been darting → interested regardless of motion;
- a dusk/dawn jumper (state 7) within **200 u** → skips interest and charges straight in.
Interest resets `perception` to the fish's base value and gives it 100–200 f (5–10 s) to be convinced.

### Interested (state 2): hover and roll
The fish swims to a point 10 u beside the lure (side fixed per fish per cast) and 15 u below it (5 for a loach,
0 for the sinking lure), at 3 u/f, backing off at −0.2 u/f when closer than `length/2 + 20`. Each frame:
- **perception grows** with the player's actions: A press +0.005, B press (a jerk) +0.008, a weak wiggle +0.01, a
  strong wiggle +0.05. A fish with base 0 can only be *talked into* biting.
- a **size multiplier**: ≥ 60 cm → 0.3; ≥ 45 → 0.6; else 1.0;
- a **conditions multiplier** on top: 17:00–19:00 ×1.75; 05:00–07:00 ×1.5; foggy ×1.5; storming ×3.0;
- `chance = 0.03 · mult` (×5 with the sinking lure).
- **Bite roll**: *(the back-off timer just expired, or rand < chance)* **and** *rand < perception · mult*.
  The back-off timer is 2–12 f and re-arms every time the fish bumps its hover distance, so while the fish sits
  by the lure a roll happens roughly every 7 frames; the gate that actually matters is `perception · mult`.
  Example: a 71 cm fish at dusk, base perception 0, after four strong wiggles: `0.2 · 0.3 · 1.75 = 0.105` per roll,
  ~ one bite per 10 rolls ≈ 3.5 s of hovering. A 35 cm fish, base 0.2, noon: `0.2 · 1.0 = 0.2` per roll.
- Interest ends if the lure leaves the water, the interest timer runs out, or the fish strays > 800 u from centre;
  the fish returns to `fishStateNext` and for 50–80 f will not take a *still* lure (a moving one within 120 u still
  works).

### Commit (3 → 4) and the bite (→ 5)
On a successful roll: `speedTarget` = 4.5–6 u/f (90–120 u/s; 3–4.5 with the sinking lure). State 3 swings to a
point 30 u beside and 30 u behind the lure, 10 u under, at 0.8 × speedTarget, for 0–10 f or until within 30 u.
State 4 charges the lure at full speed for up to 20 f; within 10 u → **bite**: splash by size, `rodCastState = 4`,
the mouth offset is randomised (so the hook sits differently each catch), and the **reaction window** opens:

| fish length | stock lure window | sinking lure window |
|---|---|---|
| < 50 cm | 25–30 f (1.25–1.5 s) | 40–80 f (2–4 s) |
| 50–60 | 17–22 f | 30–60 f |
| 60–70 | 15–20 f | 20–50 f |
| > 70 | 10–15 f (0.5–0.75 s) | 10–30 f |

Loaches: a fixed 30 f. The controller rumbles for the window's length (soft with the sinking lure, hard with the
stock one — the *feel* of the bite tells you the lure). Tension credit `rodPullback` starts at 100, `fightTime` at 0.

### Set the hook
Within the window the player must **flick the stick down** (from above −40 to below −50 in one frame) or press
A. That sets `lineHooked`, bends the rod (10 f), plays the hit, starts the battle music, and makes the fish thrash
(tail magnitude 7000, phase step 1.7). Small fish thrash longer on the set: `40 − (length − 30) · 1.33` frames
(30 cm → 40 f; 60 cm → none). If the window closes unhooked the fish spits the lure: "it got away".

### The fight (state 5)
The fish alternates **runs** and **rests** on a timer (`timerArray[1]`, set to 150 at the bite so the first
120 f are a run):

*Run phase* (timer > 30): every 3–13 f pick a new target 200 u away in a ±67° cone *away from the player*
(retry up to 100 times to stay inside radius 750). Swim at 5 u/f (100 u/s) toward it; `reelSpeed = 1.0 − 0.00899 · length`
(loach: ×1.4 on the length term). With 10% chance per pick, if the leap cooldown (100–120 f) is clear, the fish
**leaps**: target height 300, 20 f of burst at 7.5 u/f (150 u/s) during which `reelSpeed = 0` (reeling does
nothing), the camera shakes, and **tension credit is slashed to 20–50** — the player has 1–2.5 s to re-engage or
the line goes slack.

*Rest phase* (the last 30 f of the timer, so always 1.5 s): the fish drifts at 2 u/f, `reelSpeed = 1.3 − 0.00899 · length`,
and if the player holds A it thrashes every 16 f for 15–45 f — but a fish ≥ 60 cm will not do that until
`fightTime ≥ 2000` (100 s): big fish do not tire early. When the timer hits 0 it is re-armed: 50–100 f early in the
fight, 30–50 after 2000 f, 25–35 after 3000 f. Since the rest is always the final 30 f, the **runs** are what shrink:
20–70 f at first, 0–20 f after 100 s, 0–5 f after 150 s. The fish tires; the player's clock is the random escape
roll and the hard cap below.

| fish | reel speed, run | reel speed, rest | line gained per second (×5 u) |
|---|---|---|---|
| 40 cm | 0.64 | 0.94 | 64 / 94 u/s |
| 55 cm | 0.51 | 0.81 | 51 / 81 u/s |
| 70 cm | 0.37 | 0.67 | 37 / 67 u/s |
| loach 45 | 0.43 | 0.73 | |

The fish is dragged toward the end of the line whenever it is more than 20 u from it (20%/frame, capped at
3 × speed) — the line is a leash, the fish fights the leash.

**Tension credit** (`rodPullback`): +1/frame while A is held or the stick is pulled back, −1/frame otherwise,
clamped 0–100. At 0 the line is slack and the fish is gone. From full that is **5 s of neglect**; after a leap,
1–2.5 s. This is the whole "keep tension" rule: hold A (reel) or hold back (fight), and the fish stays on.

**Escape** happens when any of: credit 0; the fish was never hooked and the window closed; `fightTime ≥ 6000`
(5 min hard cap); every 128 f a 5% roll with the stock lure (expected ~2 min; the sinking lure never randomly
escapes — that is why it is banned for records); the rod was put away. An escaped fish goes wary 10000 f, lure-blind
500 f, and the reel speed resets to 0.5.

**Catch**: the fish's horizontal distance to the player < 50 u. Cinematic, weigh, keep/release. Length is
truncated to whole cm for comparison; a loach's length is doubled for the scoreboard.

## Size and weight (`Fishing_Init`, `Fishing_UpdateOwner`)
Each of the 15 ordinary fish has a fixed home spot, a **base length** and a base perception:

| base cm | 33 | 34 | 35 | 36 | 38 | 39 | 40 | 41 | 42 | 44 | 47 | 54 | 57 | 63 | 71 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| perception | .2 | .2 | .2 | .1 | .1 | .1 | .1 | .05 | .06 | .05 | .05 | .01 | 0 | 0 | 0 |

Loaches (2, only every 4th game): 45 and 43, perception 0. Roll: `length = base + rand(0, 5)`; if the result is
≥ 65, a 5% chance of `+ rand(0, 8)` (the 71 can reach 84). As a child everything is ×0.73 ("come back when you're
older"). The perception column is the design: the small fish are easy and plentiful, the three trophy fish only
bite when worked.

Weight shown: `lbs = length² · 0.0036 + 0.5` → 40 cm = 6 lb (the default child record), 45 = 7 lb (adult), 60 = 13,
75 = 21. Quadratic, so the last few cm matter most — a good shape for any "how big" score.

Conditions by game count (how many times you have paid): every 8th game is foggy (bite ×1.5), game 6 of 8 may
storm (bite ×3, but you cannot see), every 4th game adds the loaches.

## The lure (what the player actually controls)
- **Cast**: 37 f animation; at frame 18 the lure leaves the tip with velocity 25 u/f forward, 15 up, gravity
  −1 u/f² (20 fps → 500 u/s forward, 300 up, 400 u/s²). Holding A during flight damps horizontal velocity ×0.9/frame
  (short cast). Max range ~1000 u; the spool reads `200 − dist/5`. Lands on water → 10 f settle (0 for sinking) →
  fishing. Lands on the bank → sits; B hops it 6 spool units toward you.
- **Float/sink**: the stock lure returns to the surface at 20% of its depth per frame (max 1.5 u/f). The sinking
  lure accelerates down 0.5 u/f² to 1 u/f until floor + 5, and *counts as a weak wiggle every frame it sinks*.
- **Wiggle**: stick delta per frame / 60; > 0.2 registers (5 f cooldown), > 0.8 is strong; B press = 0.5. A wiggle
  turns the lure's heading toward the player ± the wiggle (sign alternating → zigzag), hops it forward 6 × wiggle,
  and takes in 7.5 × wiggle spool units. So wiggling *is* slow reeling, and the zigzag is what fish within 120 u see.
- **Reel**: A held → spool += reelSpeed (0.5 with nothing on; R+A fast-reels at 1.5 with nothing on). Spool ≥ 195
  → lure back in hand.
- Ripples every 64 f at rest, every frame when moving; the fish respond to position, not ripples.

## Constants worth keeping (20 fps)
| | original | per second / note |
|---|---|---|
| scare radius, still / running | 62 u / ~370 u | half a body / 3.5 bodies |
| notice radius, moving lure / still lure / jumper | 120 / 70 / 200 u | |
| notice cone | front half (180°); < 40 cm: all round | |
| interest duration | 100–200 f | 5–10 s |
| bite roll cadence | every 2–12 f while hovering | |
| base trigger chance | 0.03 (×5 sinking) | |
| size multiplier | 1.0 / 0.6 / 0.3 (<45 / <60 / ≥60 cm) | |
| dusk / dawn / fog / storm | ×1.75 / ×1.5 / ×1.5 / ×3 | |
| perception per A / B / weak / strong wiggle | .005 / .008 / .01 / .05 | |
| charge speed | 4.5–6 u/f | 90–120 u/s |
| reaction window | 10–30 f by size (stock) | 0.5–1.5 s |
| run speed / leap burst / rest drift | 5 / 7.5 / 2 u/f | 100 / 150 / 40 u/s |
| run target | 200 u away, ±67° from away-from-player | |
| leap chance | 10% per pick, cooldown 100–120 f | |
| reel speed | 1.0 − 0.009·cm (run), 1.3 − 0.009·cm (rest), 0 during a leap | spool units/frame; ×5 for u |
| tension credit | 100 max, ±1/frame; leap → 20–50 | 5 s of slack to lose |
| run + rest cycle | 50–100 → 30–50 (after 100 s) → 25–35 (after 150 s) f; rest is always the last 30 f | runs shrink as the fish tires |
| random escape (stock lure) | 5% per 128 f | ~2 min expected |
| hard cap | 6000 f | 5 min |
| catch radius | 50 u | |
| size roll | base + U(0,5), 5%: + U(0,8) if ≥ 65; child ×0.73 | |
| weight | 0.0036·cm² + 0.5 lb | |

## Translating to a 2D kids' game
- Top-down pond: the depth axis becomes a number per fish and per lure (stock lure depth 0, sinking lure sinks).
  Side-view pond: depth is literal y and "front half" is facing.
- Keep the **three-step bite** (interested → commit → charge → bite). The swing-out in state 3 is what makes the
  strike visible; skipping to "bite" makes it feel random.
- Keep the **reaction window sized by the fish**, and show it (rumble → a shake or flash). Smaller fish, longer
  window: beginners catch small fish by accident and trophies by skill.
- Keep **runs/rests with runs that shrink as the fish tires**, reel speed by size, zero reel during a leap, and the **tension credit**
  as the only failure condition a kid has to understand: "hold the button or it gets away".
- Keep **perception that the player pumps** (taps/wiggles) and a per-fish base of 0 for trophies.
- Weight = quadratic in length; show the number.

## Things learned that are not built yet
- A persistent record and a "fish on hand" that must be carried to the owner to count.
- Weather/time multipliers want a day cycle (`kit.every` can fake it).
- Schools (60 decorative fish in three rings at radius 720) that the real fish join at dusk/dawn — the "the pond is
  alive" dressing; cheap with `kit.crowds`.

## Edge cases to keep
- A fish's interest must reset perception to base on each approach, or a fish that was nearly convinced last time
  bites instantly this time.
- While the lure is still flying or settling, no fish may notice it; splashdown scares big fish for 10 f.
- During a leap the reel does nothing; make that visible (rod bend, sound) or it reads as a bug.
- The off-pond check (> 800 u from centre) drops interest; fish must never leave the water volume chasing a lure
  that landed on the bank.
- Escape after an unhooked window is a different message from a snapped line; both set long wary/blind timers so
  the same fish does not re-bite at once.
- Truncate lengths to whole cm before comparing records, and let a tie keep the old fish.
