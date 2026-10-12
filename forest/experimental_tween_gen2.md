# EXPERIMENTAL tween gen2

This trial adds `kit.tween(obj, props, seconds, ease)` and `kit.ease(name, t)` from Phaser's easing library.

**Capabilities:**
- `kit.tween(obj, props, seconds, ease)`: animate numeric properties of any object over time
- `kit.ease(name, t)`: standalone easing function for custom animations
- Five easing curves: `backOut`, `bounceOut`, `elasticOut`, `sineInOut`, `quadInOut`
- Automatic completion: tweens remove themselves when done
- Bounded memory: max 50 active tweens per frame

**Behaviour changes:**
- NEW: games can write `kit.tween(star, {x: 200, y: 100}, 1.5, 'bounceOut')` instead of manual lerp loops
- NEW: easing curves available for playful motion (overshoot, bounce, spring)
- Tweens update after `game.update(dt)` via `kit._onTick`, before `draw()`
- Invalid inputs (null object, negative duration, bad property types) are silently ignored

**Evaluation metrics:**
- Tween duration accuracy: measured tweens complete within 2% of target duration
- Easing bounds: all easing functions return values in [0, 1.05] for any input
- Memory cap: confirmed max 50 tweens active, 51st is dropped
- CLASSIC tests: all existing kit tests remain green (no behaviour changes to existing functions)
- Example game: `star-collect.js` uses bounceOut and elasticOut to show the new capability

**Contract surface additions:**
```
kit.tween(obj, props, seconds, ease)          smooth animation. Changes obj's properties to match props over seconds. ease: 'backOut' 'bounceOut' 'elasticOut' 'sineInOut' 'quadInOut' (default 'sineInOut'). Example: kit.tween(star, {y: 100, x: 200}, 1.5, 'bounceOut')
kit.ease(name, t)                             easing curve value at time t (0 to 1). Same names as tween. Returns 0 to 1.
```
