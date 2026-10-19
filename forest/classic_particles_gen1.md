# CLASSIC: particles gen 1

## Capability
- `kit.puff(x, y, colors, n)`: spawns n sparkle particles (capped at 40) with random velocities in all directions, drawn and animated by the engine on top of the game.
- Particles are simple circles with initial velocity, gravity (260 px/s²), color, radius (3–7 px), and life (0.5–1.1 s).
- Shared particle array capped at 400 total across all sources.
- Drawn after `game.draw()` with alpha fade based on remaining life.

## Behaviour
- Each `kit.puff()` creates up to 40 new particles with colors picked cyclically from the `colors` array.
- Particles move, fall, and fade over their lifetime.
- Older particles removed when life expires.
- Used for celebratory bursts (e.g. on tap, on `kit.win()`).

## Metrics
- Particle count cap: 400 (measured by `tests/kit.test.mjs`)
- Single burst max: 40 particles
- Performance: 400 particles/frame with no frame drop (target)
