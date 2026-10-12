# CLASSIC kit (gen 1)

The pip-engine kit as shipped before the gen 2 tween trial. This record pins the behaviour that EXPERIMENTAL must not break.

## Capabilities

- **Drawing**: `kit.bg`, `kit.sprite`, `kit.item`, `kit.prop`, `kit.emoji`, `kit.text`
- **Input**: `kit.pointer` (x, y, down, pressed, released)
- **Audio**: `kit.sound`, `kit.note`, `kit.say`
- **Effects**: `kit.puff`, `kit.shake`, `kit.win`
- **Utilities**: `kit.rand`, `kit.pick`, `kit.clamp`, `kit.dist`, `kit.lerp`
- **Time**: `kit.t`

## Behaviour

- Sprites are drawn with optional flip, rotation, alpha, and animation time.
- Pointer pressed/released last exactly one frame.
- Sound and note are throttled to 4 per frame.
- Puff particles cap at 400 and expire after 0.5-1.1 seconds.
- Win is debounced (2 seconds), say is rate-limited (5 seconds).
- Errors are reported, not thrown. Runaway frames (>400ms) are caught.
- Games run at up to 60fps with dt capped at 0.05s.
- No tweening or easing capability exists.

## Tests

All tests in `tests/kit.test.mjs` must stay green. 11 tests cover:
- Valid game boot and ready message
- Contract enforcement (game object shape)
- Error reporting (syntax, runtime, runaway frames)
- Drawing tolerance to junk input
- Sound/note throttling
- Particle cap and expiry
- Win debounce and say rate limit
- Pointer pressed/released single-frame behaviour
- Helper functions (clamp, lerp, dist, pick, rand)
- Parts (pre) loading before game code
- frameDoc XSS safety
- Every kit function documented in contract

## Evaluation

No frame-time or memory metrics exist. Games are written in 80-320 lines and run smoothly on phones at 60fps. Manual animation uses `kit.lerp` in update loops.
