# EXPERIMENTAL kit (gen 2)

Trial: add `kit.tween` and `kit.ease` for smooth sprite motion and property animation in young children's touch games.

## New capabilities

- **kit.tween(object, props, duration, easing)**: fire-and-forget tweening. Changes numeric properties smoothly over time. Re-tweening the same object cancels the previous tween. Max 200 concurrent tweens (soft cap, oldest dropped).
- **kit.ease(t, easing)**: manual easing for custom animations. Takes normalized t in [0,1], returns eased value.
- **Easing curves**: `'backOut'` (overshoot), `'bounceOut'` (bounce landing), `'elasticOut'` (spring), `'sineInOut'` (smooth S-curve), `'quadInOut'` (moderate acceleration/deceleration), `'linear'` (default).

## Behaviour changes

None. New capability, no existing behaviour modified. CLASSIC games continue to work unchanged.

## Implementation

- Pure easing functions in `src/ease.js` (backOut, bounceOut, elasticOut, sineInOut, quadInOut), consumed from Phaser @ 02d8931b626d with MIT license.
- Tween management in `src/runtime.js`: tweens array updated each frame in loop.js before draw.
- Easing functions inlined into runtime.js for sealed frame (no imports).
- Tweens cancel on re-tween of same target, complete when t >= 1, ignore non-numeric properties.

## Tests

New tests in `tests/ease.test.mjs` (6 tests) and `tests/tween.test.mjs` (9 tests):
- Easing curves produce expected shapes (overshoot, bounce, oscillation, S-curve)
- Tweens complete, cancel on re-tween, handle zero duration
- Non-numeric properties ignored, bad input tolerated
- Soft cap at 200 concurrent tweens enforced
- Example: frog hopping with bounceOut easing

CLASSIC tests in `tests/kit.test.mjs` remain green (11/11 pass).

## Evaluation

**Target metrics** (to be measured in production):
- Game code reduction: target 15-25% fewer lines for sprite motion (replacing manual lerp loops with single tween calls)
- Model adoption: target 60%+ of new games use tweening for at least one animation
- Frame time impact: target <0.3ms average overhead with 20 active tweens
- Error rate: target <2% of tween calls result in no-op (bad input handled gracefully)

**Qualitative goals**:
- Smoother, more playful sprite motion (bounces, overshoots) in tap games
- Easier for models to write "frog hops with a bounce" or "star flies in with a spring"
- Reduced cognitive load: single tween call instead of multi-line lerp update logic

## Trial notes

No flag required (new capability, backward compatible). Example `examples/frog-hop-tween.js` demonstrates bounceOut easing for frog hops. Contract updated in `api/kit.md`.

Next step: ship to production, measure model adoption and game code reduction in generated games.
