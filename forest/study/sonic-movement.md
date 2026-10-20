# Study · Sonic the Hedgehog (Genesis) · ground movement and jumping

Learned from the Sonic Retro community's disassemblies of Sonic 1/2/3 (sonicretro `s1disasm`, `s2disasm`) and the
Sonic Physics Guide they wrote from them. No code taken; the mechanism and its constants are the subject.
Units in the original are pixels per frame at 60 fps, in 1/256 sub-pixels. Below they are converted to pixels per
second for a canvas running on `dt`.

## Why this one first
Every "make me a platformer" on the floor needs the same four feelings: a run that builds, a stop that bites, a jump
you can shorten, and ground you can't fall through. Sonic's numbers are the most copied in the genre because they
*feel* right at any speed; Mario's are gentler, Mega Man's are stiffer. Start here, expose the knobs.

## State the mover keeps
`x, y` (feet or box), `vx, vy`, `onGround`, `facing`, and two small timers: `coyote` (time since the ground was last
under us) and `buffer` (time since jump was pressed). Both timers make a jump that was "almost right" succeed.

## Update order, each frame
1. **Input → ground speed** (only the horizontal part):
   - pressing in the direction of travel (or from rest): `vx += acc · dt`, capped at `top`
   - pressing against travel: `vx -= dec · dt` (a hard brake; Sonic's is 10× his acceleration, and that bite is the feel)
   - no input: `vx` decays toward 0 by `friction · dt` (Sonic: friction = acc, so coasting is long)
2. **Jump**: if (onGround or coyote < 0.1 s) and (jump pressed or buffer < 0.1 s): `vy = -jump`, onGround = false.
3. **Variable height**: while rising, if the jump button is released and `vy < -cut`, clamp `vy = -cut`.
   Sonic cuts to −4 px/frame from a −6.5 launch: a tap gives about a third of the full height.
4. **Gravity**: `vy += gravity · dt`, capped at `maxFall` (Sonic 16 px/frame; without a cap the fall becomes a teleport).
5. **Move and resolve**, one axis at a time: move x, push out of any solid horizontally (and zero `vx`, set `hitWall`);
   move y, push out vertically (landing sets `onGround`, zeroes `vy`; a ceiling sets `hitHead`, zeroes `vy`).
   Axis-by-axis is what keeps corners honest; diagonal resolution is where platformers get sticky.
6. **Air control**: Sonic uses the same acceleration in the air (`airAcc = acc`), with no friction in the air.
   Mario-likes use less air control; it is a knob.

## The constants (Sonic 1/2 standing physics)
| | per frame | per second (× 60, × 60²) |
|---|---|---|
| acceleration | 0.046875 px/f² | 169 px/s² |
| deceleration (brake) | 0.5 px/f² | 1800 px/s² |
| friction (coasting) | 0.046875 px/f² | 169 px/s² |
| top speed | 6 px/f | 360 px/s |
| jump launch | 6.5 px/f | 390 px/s |
| jump cut | 4 px/f | 240 px/s |
| gravity | 0.21875 px/f² | 788 px/s² |
| max fall | 16 px/f | 960 px/s |

Sonic's sprite is 40 px tall; on a phone screen 390 px wide those numbers run a little hot. A `scale` of 0.75–0.85
reads well on the floor. Knobs the line will turn: `top` (slow kid vs fast kid), `jump`, `gravity` (floaty vs heavy),
`dec` (slippery ice = small), `airAcc` (0 for a committed jump).

## Things learned that are not built yet
- **Slopes.** Sonic adds `slopeFactor · sin(angle)` (0.125 px/f²) to ground speed every frame, and the sensor pair
  under the feet decides the angle. That is a terrain representation we do not have; the first version is rectangles.
- **Rolling** halves acceleration and friction and raises top speed. **Springs** set a velocity directly.
- **Ring loss** on a hit: rings scatter in rings of 16 and 32 with fixed speeds — a good `kit.burst` kind later.

## Edge cases to keep
- A jump pressed the frame before landing must still happen (buffer).
- Walking off a ledge must still allow a jump for ~6 frames (coyote).
- Landing on a moving or thin platform: resolve y only when falling (`vy > 0`) onto a `oneWay` solid.
- Never let `dt` spikes tunnel through a floor: step the move in chunks of at most half the body's height.
