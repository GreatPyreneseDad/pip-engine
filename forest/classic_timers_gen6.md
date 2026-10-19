# Classic: Timers Generation 6

**Status:** BASELINE (no timer capability exists)

## Capabilities
- Games schedule events by managing their own counters in `update(dt)`.
- Example pattern: `if (++frameCount === 90) spawnEnemy();`
- No built-in delayed or repeating callbacks.

## Behaviour
- Event timing requires manual tracking: games count frames or accumulate dt.
- Errors in timed logic can freeze the game if a counter is mismanaged.
- No way to cancel a pending event without custom state management.

## Known limitations
- Verbose: every timed event needs a variable and condition check.
- Error-prone: easy to forget to reset counters or check them in the right place.
- Cognitive load: the model must track multiple timers manually.

## Evaluation metrics
- Lines of code for "spawn an enemy every 3 seconds": target ~5-8 lines (manual counter).
- Lines of code for "show a hint after 5 seconds, cancellable": target ~10-15 lines (state machine).
