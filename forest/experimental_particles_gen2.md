# EXPERIMENTAL: particles gen 2

## New capability
- `kit.burst(kind, x, y, n)`: spawns n particles of a preset kind (confetti, smoke, bubbles, sparkles, rain, fire). Engine animates and draws them on top.
- `kit.emit(kind, x, y, seconds)`: continuous emitter that spawns particles of a kind for the given duration, then stops.
- Six preset kinds with tuned parameters: emission rate, cone angle, color gradients (start/end pairs), size lerp, speed, damping, gravity, fade rate.
- Particles have velocity, angular velocity, damping, rotation, color lerp (RGBA), size lerp, and gravity.
- Emitters spawn particles at a rate, each with randomized parameters within the preset range.

## Behaviour changes from CLASSIC
- **CLASSIC unchanged**: `kit.puff()` still works identically (simple burst, no emitter, same cap).
- **EXPERIMENTAL**: `kit.burst()` creates a one-shot emitter that spawns n particles at once, then removes itself when particles die.
- **EXPERIMENTAL**: `kit.emit()` creates a continuous emitter that spawns at a rate for `seconds`, then stops emitting (particles fade naturally).
- Emitters capped at 20; oldest dropped when full.
- Particles share the same 400 cap as `kit.puff()`.
- Particles rendered after `game.draw()` with per-particle alpha, color, size, and rotation.

## Evaluation metrics
- Particle count cap: 400 (measured by `tests/50-particles.test.mjs`)
- Emitter count cap: 20 (measured by `tests/50-particles.test.mjs`)
- Memory stability: no growth over 300 frames with 5 continuous emitters (target)
- Performance: 400 particles/frame rendered in < 16 ms/frame (target, 60 fps)
- All six kinds spawn and render without error (measured)
- `kit.puff()` regression: existing tests green (measured)

## Known limitations
- Particles are untextured circles (no sprites or images).
- No tile collision (host games have no tile layers).
- Emitter position is fixed after creation (no parent tracking).
- Color lerp is linear RGB, not perceptual (acceptable for game juice).
