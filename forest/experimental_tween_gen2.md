# EXPERIMENTAL: gen 2 (kit.tween and kit.ease)

## Capabilities
- `kit.tween(target, props, duration, ease)` for stateful frame-based animation
- `kit.ease(name, v)` for pure easing functions consumable manually
- 6 easing curves: linear, quad, sine, bounce, elastic, back
- Tweens auto-cleanup when finished, support multiple concurrent animations per object

## Behaviour changes from CLASSIC
- **ADDITIVE**: no existing behaviour changes. Games that don't call tween/ease are unchanged.
- A game can now write:
  ```js
  kit.tween(frog, { y: 100, size: 120 }, 0.8, 'bounce');
  ```
- Multiple tweens on the same object work correctly (last write wins per property)
- Easing functions produce overshoot (values outside [0,1] for bounce/elastic/back)—this is correct for playful child-friendly motion

## Integration
- Easing functions consumed from Phaser (MIT), adapted to plain functions
- Tweens tracked in `src/runtime.js` internal array, updated in `src/loop.js` before game.update()
- `kit.ease()` is pure: no side effects, can be called in draw() safely
- `kit.tween()` modifies target in-place every frame until duration elapses

## Metrics (targets)
- Lines of code for a bouncing frog: 1 (kit.tween call) vs 8-12 (CLASSIC manual lerp)
- Easing complexity: model writes 'bounce' string vs 15+ lines of bounce math
- API surface: 2 new functions (kit.tween, kit.ease), 6 easing names
- Tween overhead: <0.5ms per 10 concurrent tweens at 60fps (target, not measured)

## Evaluation
- CLASSIC tests stay green (no tween/ease calls in existing tests)
- New tests verify: easing math correctness, tween completion, multi-tween concurrency, cleanup, overshoot behaviour
- Example `frog-bounce.js` shows typical usage: tap → tween with bounce/elastic for playful motion
