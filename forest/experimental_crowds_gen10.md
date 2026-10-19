# EXPERIMENTAL: crowds (gen 10)

## Capabilities
- `kit.near(list, x, y, radius)`: returns items within radius of a point, using internal spatial hash.
- `kit.pairs(list, fn)`: calls fn(a, b) for every overlapping circle pair, using HSHG for broad-phase culling.
- Both functions rebuild the spatial hash per call (no persistent state).
- Max 200 objects per call (bounded memory).
- Invalid items (missing x/y, NaN values) are silently skipped.

## Behaviour changes from CLASSIC
- Games can tap near a crowd and affect all nearby objects without writing distance loops.
- Circle overlap checks (pushing, collision) scale better than O(n²) for sparse distributions.
- Callback errors in `kit.pairs` are caught; the game continues.

## Evaluation metrics
- Target: 50 moving circles with per-frame overlap checks run at 60fps on a phone (target: no measured baseline yet).
- Memory: HSHG is transient, built and discarded per call; no frame-to-frame leaks.
- Correctness: tests verify accurate neighbor finding, pair detection, and junk-input safety.
