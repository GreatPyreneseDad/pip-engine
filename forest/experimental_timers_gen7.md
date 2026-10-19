# Experimental: Timers Generation 7

**Status:** TRIAL (testing kit.after and kit.every)

## Capabilities
- `kit.after(seconds, fn)`: call fn once after seconds of game time.
- `kit.every(seconds, fn)`: call fn repeatedly every seconds of game time.
- Both return a handle with `cancel()` to stop before firing or repeating.
- Driven by `update(dt)`, not `setTimeout`: timers pause with the game (if pause is added).
- Cap of 100 live timers; oldest is dropped when full.
- Errors inside callbacks are reported via `post({type: 'error', ...})`, not thrown.

## Behaviour changes from CLASSIC
- NEW: declarative timer API reduces boilerplate for timed events.
- NEW: cancel handles let games stop pending events cleanly.
- UNCHANGED: existing games without timers work identically.

## Integration points
- Plugin: `src/kit/70-timers.js` (runs after tween plugin, before any future plugins).
- Contract: `api/kit.md` documents `kit.after` and `kit.every`.
- Tests: `tests/70-timers.test.mjs` covers firing, repetition, cancellation, cap, and error handling.
- Example: `examples/timer-demo.js` shows spawning with `kit.every` and delayed fade-out with `kit.after`.

## Evaluation metrics (measured in tests)
- Timers fire within 1 frame (1/60 s) of the target time: ✓ `kit.after fires at the correct game time within one frame`
- `kit.every` repeats at consistent ~0.2s intervals: ✓ `kit.every repeats at consistent intervals`
- Cap enforced: 150 scheduled timers results in exactly 100 firing: ✓ `timers cap at 100, dropping the oldest`
- Errors reported: callback throwing `Error('boom')` posts an error, other timers fire: ✓ `errors inside timer callbacks are reported, not thrown`
- Lines of code for "spawn an enemy every 3 seconds": 1 line (`kit.every(3, spawnEnemy)`).
- Lines of code for "show a hint after 5 seconds, cancellable": 2 lines (`const h = kit.after(5, showHint); if (hintCancelled) h.cancel();`).

## Risk assessment
- Low: timers are isolated in their own plugin, with no changes to core runtime.
- Errors in timer callbacks are caught and reported, preventing game freezes.
- Cap prevents runaway timer creation from exhausting memory.
- CLASSIC behaviour: all existing tests green (no timer capability, so no conflict).
