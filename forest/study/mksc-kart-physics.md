# Study · Mario Kart: Super Circuit (GBA) · kart physics on a flat track

Learned from the jellees decompilation, `github.com/jellees/mksc` at commit
`3df8932105c91f8e9e1ad72801ea13ff74339fe1`. The race code at this commit is still raw Thumb in
`asm/text08030774.s`; the routines named below are its `sub_XXXXXXXX` labels (the per-driver update is
`sub_803C4C0`, input and coin cap `sub_8037FD8`, the drift/hop state machine `sub_8038E34`, acceleration
by surface `sub_8038298` / `sub_8038710` / `sub_8038640`, the cap-hold `sub_803DB4C`, steering `sub_8038AFC`
/ `sub_8038A08` / `sub_8039690`, integration `sub_8038200`, driver setup `sub_803C1BC`). Several of them
are jump-table bodies the disassembler left as `.byte` blobs; those were read with a Thumb disassembler.
Stat tables are in `asm/rodata080E645C.s` at the ROM addresses given. No code taken; the mechanism and
its constants are the subject. Compare `dkr-kart-handling.md`: that kart is a pseudo-3D model with v²
drag and per-surface slide; this one is the flat, table-driven kart a canvas can draw directly.

## Units
60 frames per second. Positions are 16.16 pixels on a track bitmap whose tiles are 8 px. Angles are
16-bit, 65536 = 360°, with a 1024-entry sine table (`angle >> 6`), sine scaled to 32768.

Speed is one 32-bit number `v` in **8.24 pixels per frame**: `v / 2^24` px/frame. Every table below is
in units of `1/256 px/frame`, written **u** (so `u = v >> 16`). Velocity is only derived from it:
`vx = (v >> 16) · sin(heading) >> 15`, `vy = −(v >> 16) · cos(heading) >> 15`, in 1/256 px/frame, added to
the 16.16 position as `vel << 8`. Acceleration `a` is in the same 8.24 units and is simply `v += a` each
frame; a table byte `c` becomes `a = c · 4096`, i.e. `c / 4096` px/frame².

| quantity | per frame | per second |
|---|---|---|
| 1 u of speed | 1/256 px | 0.23 px |
| 100cc top speed, 932 u | 3.64 px | 218 px |
| peak acceleration, table 224 | 0.0547 px/f² | 197 px/s² |
| brake at 3 px/f, table −24 | −0.094 px/f² | −337 px/s² |

A lap of a 1024 px track at 3.6 px/frame is 20–30 s, which is what the game feels like.

## State the kart keeps
`x, y` (16.16), `v` (speed, 8.24, signed), `a` (this frame's acceleration), `heading` (where the body
points), `driftAngle` (the kart slides along `heading + driftAngle`), `yawOffset` (visual twist from hops
and spins), `lean` (the eased steering input, signed), `state` (16-way machine: normal, four drift
states, four spin-outs, two boost states, drift exit, recover, spin-turn), `surfaceCase` (0..12, what the
ground under the kart does to acceleration this frame), `speedCap` (base + coin bonus), `coins`, `hop`
and `mtArmed` flags, `driftFrames` (frames of held drift), `counterSteer` (signed accumulator),
`boostTimer`, `hitTimer`, `respawnTimer`, and a 16-bit `input` word. Per character, from tables at
setup: a 16-entry acceleration curve, 16 surface speed limits, four steering rows, a base top speed.

## Input is a 16-bit word, whoever supplies it
`race_main` remaps the pad once per player into a word: accelerate `0x8000`, brake `0x4000`, right
`0x100`, left `0x200`, up `0x800`, down `0x400`, drift-held `0x10`, drift-tap `0x04`, item-hold `0x40`,
item-tap `0x80`, taunt `0x2000`, pause `0x1000`. The driver update takes that word; a ghost replay feeds
recorded words, and the CPU racers write the same bits (`mksc-track-and-ai.md`). Build the kart this
way and the AI, replays and touch controls cost nothing.

## Update order, each frame (per driver)
1. **Position += velocity** (from last frame's `v` and heading). Read the tile under the kart: sector
   id, surface byte, out-of-bounds flag.
2. **Items** (held item trails behind; use/throw on the item button) — `mksc-items.md`.
3. **Speed cap from coins**: `speedCap = base + bonus(coins)` where, in u,
   `bonus = 0.5c` for c ≤ 4, `2c − 10` for 5..20, `c + 18` for 21..36, `0.5c + 34` for 37..64 (coins over
   64 count as 64; the piecewise curve has two small steps at 4→5 and 36→37, the game's own tuning).
   Ten coins are +10 u (+1 %), twenty +30 u (+3 %), the maximum +66 u (+7 % at 100cc).
4. **Steering lean** (`sub_8038AFC`): pick a row of four numbers `{max, reverseStep, step, decay}` by mode
   — 0 normal, 1 while hopping, 2 while brake or drift is held. Left: if `lean > 0`, `lean −= reverseStep`;
   else if `|lean| < max`, `lean −= step`; else clamp. Right mirrors. No input: `lean` moves toward 0 by
   `decay`. Rows for the first character: `{2453, 155, 115, 124}`, `{2688, 160, 120, 128}`,
   `{2816, 181, 146, 146}` (a fourth row `{8192, 2048, …}` is instant, unused by players). Other
   characters differ by a few percent. The lean is zeroed while hit and frozen in the spin states.
5. **Drift / hop state machine** (`sub_8038E34`, below).
6. **Turn** (`sub_8038A08`): when `|v| > 0.44 px/f` or airborne, `heading += lean / 8` per frame — at full
   lean 307 angle units = 1.7°/frame = 100°/s (hop row 1.85°, brake/drift row 1.9°). Below that speed
   the turn comes from a small table by speed in 1/16 px/f: `0, 16, 32, 48, 56, 60, 62` units/frame
   (≤ 0.34°), so a stopped kart barely pivots. Reversing flips the sign. Then
   `moveAngle = heading + driftAngle` and `facing = heading − yawOffset`.
7. **Acceleration by surface case** (`sub_8038298`), writing `a`:
   - hit / spinning (`hitTimer`): `v` decays 1/16 px/f per frame to zero — a full-speed kart stops in a
     second; everything else is skipped.
   - case 0, road: normal acceleration (step 8). Also the mini-turbo arming (step 9).
   - case 1: coast, `a = 0`.
   - cases 2, 3, 5, 6, 7: stopped (fell off; `v = 0`, lean and drift zeroed).
   - case 4, deep off-road: crawl — `a = +1/256 px/f²` while accelerate is held and `v ≤ 0.48 px/f`,
     else `−1/256`.
   - case 8, pad / item boost: `boostTimer−−`; `a = 50/256 = 0.195 px/f²` with the cap lifted to the hard
     maximum 7.875 px/f (2.1× top). The surface handler hands out timers of 50 and 24 frames for its two
     kinds of pad tile. When the timer ends, back to case 0.
   - case 9, launch ramp (a flag the ramp tiles set): accelerate → `+0.25 px/f²` (64 u) up to 3 px/f,
     then `+2 u` up to 5.1 px/f, then `−0.125`; brake → `−0.125`; neither → `−8 u`. Accelerate + brake
     together at low speed nudges toward 0.5 px/f.
   - case 10: hard stop surface, `a = −0.22 px/f²`.
   - case 12, mini-turbo: `boostTimer−−`; `a = 48/256 = 0.1875 px/f²` until `v = cap + 0.75 px/f`
     (+20 %), then held there. 48 frames.
   Reverse: accelerate + up with `v` near zero gives `a = −1/16 px/f²`.
8. **Normal acceleration** (`sub_8038710`, `sub_8038640`), bucket `b = whole px/f` (0..7):
   - **brake** held: `a = brake[b]` with `brake = {−4, −10, −16, −24, −48, −112, −160, −192}` u/frame
     (brake and accelerate together: `{4, −8, −16, −32, −64, −128, −160, −256}`). Braking bites harder
     the faster you go.
   - **accelerate** held: first the surface limit `L = surfaceLimit[surface]` (−1 = none; off-road
     surfaces give `charValue · 16 + classAdjust`, 384..864 u, i.e. 70–78 % of top speed). If `v > L`,
     `a = brake[b]` — off-road bleeds speed with the brake table until under the limit. Otherwise if
     `v < speedCap`: `a = curve[v in 0.25 px/f buckets, 0..15] · 4096` where the first character's
     curve is `64, 64, 96, 96, 144, 192, 224, 224, 192, 128, 96, 80, 64, 32, 16, 8` (×1.5 at 150cc) —
     weak off the line, peaking at 1.5–2 px/f, tapering to nothing at top; about 3.5 s from rest to top.
     If `v ≥ speedCap`: hold with `a = over[(v − cap) / 64 u] · 65536`, `over = {−2, −8, −16, −24, −32,
     −40, −48, −56}` — a boosted kart above its cap bleeds back gently.
   - **neither**: `a = coast[b]`, `coast = {−2, −4, −6, −12, −16, −32, −56, −80}` for the first character
     (each character has a row).
9. **Integrate** (`sub_8038200`): `v += a`, clamp `v ≤ 7.875 px/f`, project to velocity.

There is no drag formula: the cap is a number, the slow-down is a table. Simpler than DKR's `v²·drag`
and it tunes by hand.

## Top speed by class and character
`base = charSpeed + classBonus`, in u: `charSpeed = {932, 934, 944, 928, 940, 936, 928, 926}` (±1 %),
`classBonus = {−128, 0, +160}` for 50/100/150cc. So 804 / 932 / 1092 u = 3.14 / 3.64 / 4.27 px/frame; the
hard ceiling 7.875 px/f is only reached by boosts. Characters are nearly identical in speed; the floor
can collapse them to one number and keep the class spread.

## The drift and hop machine (`sub_8038E34`)
```
            A+B held, v ≤ 1 px/f
  normal ──────────────────────▶ spin-turn (15): rotates in place, back to normal when released
    │
    │ v within `window` of the cap and |lean| > 0x2FF (hard steer, near top speed)
    ▼
  drift (1..4) ──release / slow / no steer──▶ drift exit (11) ──▶ recover (14) ──▶ normal
    │
    │ counterSteer accumulator < −31232
    ▼
  spin-out (5..8): yawOffset turns 6–14°/frame for a full circle, v bleeds (−1/32 px/f²), then recover
```
- Entry needs speed: `window = |col0|` of the current row — only 16 u (0.06 px/f) below the cap with no
  button, 512 u (2 px/f) with the drift button held. Hard steering at speed slides; the button lets
  you slide earlier.
- In a drift the kart moves along `heading + driftAngle`, and the angle only develops while steering
  (with accelerate held, or with the drift button held above 1.75 px/f). Steering **into** the slide:
  `driftAngle += stepIn`, `counterSteer += 224 + row1`; **against** it: `driftAngle += stepOut`,
  `counterSteer −= row1`, and past `−31232` the kart spins out (state 8). `driftAngle` is clamped to
  `±maxDrift`. The row is chosen by surface and button: no button `maxDrift = 2048` (11°), drift button
  held row 7 `maxDrift = 8192` (45°), steps 128–352 units/frame (0.7–1.9°).
- **Airborne** (kart mode 4, after a jump): the turn is a fixed 128 units/frame (0.7°) whatever the
  lean, and the ramp flag picks steering row 1. Two of the spin states turn the body's `yawOffset` by
  1152 units/frame (6.3°) rather than the full 2560 (14°) of a hit spin. Drift exit (state 11) eases
  `yawOffset` and `driftAngle` back by 1024 units/frame.
- **Mini-turbo**: in surface case 0, with drift held and steering, `driftFrames++`; if `driftFrames >
  119` (2 s) and `v ≥ cap − 0.5 px/f`, arm it. On release with it armed (and not already boosting):
  spark sound, `boostTimer = 48`, surface case 12 → `cap + 0.75 px/f` for 0.8 s. Letting speed fall
  below the threshold first disarms it. Compare `dkr-drift-boost.md`: CTR's meter pays by release
  timing; this one pays for holding long enough and staying fast.
- Fell off (water / pit): `v = 0`, surface case 2, `respawnTimer = 60` frames, flag the kart.

## Knobs the line will turn
`classBonus` (slow kid / fast kid), the 16-bucket `curve` (how the launch feels), `coast` and `brake`
rows, `surfaceLimit` per paint colour, `lean.max` (turn rate), `maxDrift` (11° vs 45°), the mini-turbo
`holdFrames` (119) and payout (`+0.75 px/f`, 48 frames), the coin bonus curve, `hardMax` (7.875).

## Edge cases to keep
- Speed is one scalar; a wall never zeroes it directly — the surface case does (case 10 for a hard
  stop, cases 2–7 for a fall).
- The cap is enforced by a decel table, not a clamp, so boosts decay instead of snapping.
- Off-road does not cap speed; it brakes until under the limit, so you keep momentum for a moment.
- The steering lean is eased in and out; the turn uses the lean, not the stick. Touch controls need this.
- Below 0.44 px/f the turn table takes over, so a stopped kart cannot spin unless A+B is held.
- The mini-turbo arms only while fast; dragging a drift around a hairpin at half speed pays nothing.
