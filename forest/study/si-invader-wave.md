# Study · Space Invaders (1978 arcade) · the wave: a formation that marches and drops, speeds up as it dies, fires on a cadence, with a saucer and four shields

Learned from loadzero's `si78c`, a C port of the original 8080 program with the original routine names and ROM
addresses as comments (github.com/loadzero/si78c, commit `0b2b4f1ed3c73ba0765625d589fbdcb21660f3ee`). The port
reads the game's data tables from the arcade ROM at run time, so a few initial values (marked *ROM*) are not in the
repository text; where given they are the well-known values from the Computer Archeology disassembly the port cites,
and should be checked before being baked into a plugin. Everything is in `si78c.c`. The machine runs at 60 fps with
two interrupts per frame; the play field is 224 × 256 with y measured **upward** from the bottom.

## Why this one
"Make a space shooter" from a seven-year-old means this: a block of things that steps sideways, drops, and gets
faster as you kill them. The genius is that the speed-up is not a rule — it falls out of drawing one alien per frame.
Every number in the wave is small and every rule is one line. It is the most teachable arcade loop there is, and the
kids have seen it on T-shirts.

## State the wave keeps
55 alive flags (5 rows × 11 columns, index `k = row·11 + col`), a **reference position** (bottom-left alien's x, y),
a cursor `alienCurIndex` (which alien gets drawn/moved this frame), `refAlienDelta` (dx = ±2, dy = 0 or the drop),
`rackDirection`, `alienFrame` (two animation frames), `numAliens`, a per-wave `rack_cnt` (which start height), and
the explosion timer for the one alien that can be dying at a time. Each alien's position is **derived**:
`x = refX + 16·col, y = refY + 16·row` (`GetAlienCoords` 1221–1233). Nothing per alien but the flag.

## Update order, each frame (`vblank_int` 999–1032, `midscreen_int` 982–996)
1. Draw/move **one** alien (`DrawAlien` 1119–1158): the alien at the cursor is redrawn at its derived position.
   If an alien is exploding, nothing else moves until its 16-frame explosion ends (1123–1133).
2. Run the game objects: player, player shot, the three alien shots, the saucer (`RunGameObjs` 1382–1444, a list
   of records each with a countdown and a handler).
3. Tick the saucer clock (`TimeToSaucer` 2672–2688).
4. At mid-screen: advance the cursor to the next *live* alien (`CursorNextAlien` 1161–1218). When the cursor passes
   55 it wraps to 0 and **then** the reference position moves by `delta` and the animation frame flips. If the new
   alien's y is below 40 px the aliens have landed: game over regardless of lives (1206–1213).
5. Bump test (`RackBump` 3342–3373, called from the player-shot task 4034): scan a 23-px column at x = 213 (moving
   right) or x = 9 (moving left) for any lit pixel; if an alien is there, reverse `dx` and set `dy` to the drop.
   The drop is consumed on the next wrap, then `dy` resets to 0.

### The speed-up, derived
The rack moves 2 px once per full cursor pass, and a pass visits every live alien once, one per frame:
```
 rack speed = 2 px / N frames   (N = aliens alive)
 55 alive → 2.2 px/s, almost a second per step      8 alive → 15 px/s      1 alive → 120 px/s (2 px/f)
```
With exactly one alien left the rightward step becomes 3 px (180 px/s) — the famous last-alien lurch (3366). No
table, no difficulty curve; the ripple you see across the formation *is* the scheduler. A canvas can either
replicate the one-per-frame draw (feels right, cheap) or move the whole rack every `N` frames — the same thing
without the ripple.

### The drop and the start height
Drop = `rackDownDelta` (*ROM*; 8 px). Each new wave sets the reference y from an 8-entry table indexed by
`rack_cnt = (rack_cnt mod 8) + 1` (`HandleEndOfTurn` 2835–2872): the formation starts lower each wave for the first
few waves then cycles (*ROM*; the published values are 120, 96, 80, 72, 72, 72, 64, 64 px). The reference x always
starts at 56. Shields are redrawn fresh each wave.

## Shots
**Player shot** (`GameObj1` 1730–1887): one at a time. States: idle, launched (x = player + 8), moving (y +=
`shotDeltaYr`, *ROM*; 4 px per frame = 240 px/s), hit-something (a 16-frame blow-up with an 8-px explosion sprite
blitted in — which **erases pixels** of whatever it hit), alien-exploding (waits for the alien's 16 frames). The next
shot can't launch until the state returns to idle, so the fire rate is bounded by the flight time plus the
explosion: at most about one shot per 1.3 s to the top of the screen, faster at close range. Firing also advances the
saucer-score pointer and the shot counter (1819–1834).

**Alien shots** (`HandleAlienShot` 2011–2087, `DoHandleAlienShotMove` 2091–2135): three independent shot objects,
each a game record that runs every third frame (its header's extra timer, *ROM*), stepping `alienShotDelta` = 4 px
down per step (`SpeedShots` 2634: 5 px once fewer than 9 aliens remain) — about 80 px/s, a third of the player's
shot. Rules for launching:
- a 48-frame hold after the player (re)appears (`alienFireDelay`, 1464–1470, 1533);
- **reload gate**: a shot may launch only if the other shots have travelled more than `aShotReloadRate` steps
  (2038–2045). The rate comes from the score (`AShotReloadRate` 3527–3547): below 200 → 48 steps, below 1000 → 16,
  below 2000 → 11, below 3000 → 8, after → 7. So early on at most one shot is in flight; later three can be;
- the **rolling** shot picks the column over the player's centre (x + 8) and fires from the lowest live alien in it
  (2049–2058); the **plunger** and **squiggly** shots walk fixed column tables of 16 and 21 entries (1945–1948,
  1977–1981) — pseudo-random, player-independent spray;
- launch point is the chosen alien's (x + 7, y − 10); the plunger stops being used when one alien remains (1958).
A shot below y = 21 explodes on the ground; a shot touching pixels in the band y 30–38 kills the player (2119–2133).
Shots animate by cycling three sprites every step.

## The saucer (`TimeToSaucer` 2672, `GameObj4` 2228–2345)
A 1536-frame clock (25.6 s) that only ticks once the formation has dropped below its start row (reference y <
120). When it fires and **8 or more aliens are alive**, the saucer enters from the left (x = 9, dx = +2) or right
(x = 192, dx = −2) — the side chosen by a parity bit of a ROM byte indexed by the player's **shot count** (1871–1886;
the port notes the 256 bytes are exactly half 0s and half 1s, i.e. deliberately fair). It crosses at 2 px/f
(120 px/s) and leaves at x < 8 or ≥ 193. Hit: 32-frame hold, explosion sprite at frame 31, score text at frame 24
(2290–2334). Its value cycles with the shot count through a 15-entry table (*ROM*; 50–300, with 300 landing on
every 15th shot) — the shot-counting trick. Below 8 aliens the slot runs the squiggly shot instead; a saucer never
appears at the end of a wave.

## Shields and pixel collision
Four shields, each a 44-byte bitmap (22 × 16 px) copied to the screen at wave start (`DrawShieldCommon` 1317–1324)
and **remembered per player** between turns (1327–1355). There is no shield object: shots collide with *pixels*
(`DrawSprCollision` 3121, used at 1764 and 2114), and a shot's explosion sprite is drawn with an erase operation, so
each hit chews a bite out of the bitmap. Aliens marching through a shield erase it the same way. The player shot
decides what it hit by **where**: y ≥ 216 the top, y ≥ 206 the saucer, y below the formation's reference → a shield,
else look up the alien row/column from the shot's position (`PlayerShotHit` 3186–3278).

## Player, death, lives
Player moves 1 px/f (60 px/s) between x 16 and 185 (`GameObj0` 1449–1521). Death: the explosion alternates two
sprites every 5 frames for a count (`HandleBlowingUpPlayer` 1525–1561), alien fire is disabled and the 48-frame hold
re-armed, then a 2-second delay, then the next ship or game over (`player_death` 1567–1622). Lives 3 (DIP 3–6); one
bonus ship at 1500 points (DIP: 1000), awarded once (`CheckAndHandleExtraShipAward` 2700–2733). Scores: 10 / 20 / 30
by row (bottom two, middle two, top) (`AlienScoreValue` 2736–2746).

## Constants
| | value |
|---|---|
| formation | 5 × 11, 16 px grid, reference x 56 |
| step | 2 px per pass (3 px right with 1 alien) |
| rack speed | 2/N px per frame → 2.2 px/s (55) … 120 px/s (1) |
| drop at edge | 8 px (*ROM*) |
| edge columns | x = 9 and 213 |
| landed (game over) | reference y < 40 |
| player speed / bounds | 60 px/s, x 16–185 |
| player shot | 4 px/f = 240 px/s, one alive (*ROM*) |
| alien shot | 4 px per 3 f ≈ 80 px/s; 5 per 3 f under 9 aliens |
| alien fire hold after spawn | 48 f |
| reload gate by score | 48 / 16 / 11 / 8 / 7 steps at <200 / <1000 / <2000 / <3000 / more |
| alien explosion | 16 f, blocks the next shot |
| saucer clock | 1536 f = 25.6 s, needs ≥ 8 aliens |
| saucer speed | 2 px/f = 120 px/s |
| saucer hold on hit | 32 f |
| scores | 10 / 20 / 30; saucer 50–300 by shot count |
| bonus ship | once, at 1500 (or 1000) |
| death sequence | ~1 s explosion + 2 s pause |

## Design shapes seen
- **Derived positions.** One reference point and a grid; the formation is 55 booleans.
- **Speed from scheduling.** Difficulty emerges from "one alien per frame"; no curve to tune.
- **Targeted + untargeted fire.** One shot type aims at you, two spray from tables; the mix feels alive without
  being unfair.
- **Reload gate by score**, not by time: pressure rises with skill.
- **Pixel-erasing cover.** Shields decay because shots erase what they hit. On a canvas: an offscreen alpha mask
  per shield and a destination-out blit.
- **Fairness hidden in data**: a 50/50 saucer side table; a cycling score table that rewards counting.

## Things learned that are not built yet
- The exact ROM data (start-height table, saucer score table, shot timers) — verify against the Computer Archeology
  listing before shipping a "faithful" preset.
- Two-player alternation keeps each player's formation, shields and rack count in a RAM mirror (1296–1355).
- Sound: the four-note march tempo is tied to the fleet speed (`TimeFleetSound` 3564).

## Edge cases to keep
- Only one alien may be exploding at a time and it freezes the march; without that, kills don't feel like events.
- Bump at the edge reverses direction *and* schedules one drop; the drop happens on the next wrap, not at once.
- The reload gate compares against the **other** shots' step counts; a shot that just died counts as travelled.
- Shots that leave through the top must still run their blow-up, or the fire rate doubles.
- When fewer than 8 aliens remain, the saucer stops; otherwise the end of a wave is a 300-point farm.
- Keep the landed check on the *next alien's* derived y, so a dying formation can't land through a dead row.
