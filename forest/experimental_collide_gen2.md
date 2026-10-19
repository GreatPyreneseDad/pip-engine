# EXPERIMENTAL: kit.hit and kit.bounce (gen 2)

Unified collision detection and physics bounce from Phaser's geometry intersection functions.

## Capabilities
- `kit.hit(a, b)`: single function for all shape pairs (circle-circle, circle-rectangle, rectangle-rectangle)
- `kit.bounce(o, bounds)`: velocity reflection and position clamping in one call
- Shape descriptors: `{x, y, r}` for circles, `{x, y, w, h}` for rectangles
- Automatic corner-case handling (circle-rectangle edge detection, zero-size rejection)

## Behaviour changes from CLASSIC
- Tap targets: `kit.hit(kit.pointer, {x: obj.x, y: obj.y, r: 50})` replaces `kit.dist(...) < threshold`
- Wall physics: `kit.bounce(ball, {x: 0, y: 0, w: W, h: H})` replaces 8+ lines of manual checks
- Object overlap: `kit.hit(ball, paddle)` replaces hand-written AABB logic
- EXPERIMENTAL is reachable: functions exist and are callable once the plugin loads

## Examples
```js
// bounce-ball.js: tap detection with kit.hit
if (kit.pointer.pressed && kit.hit(kit.pointer, ball)) {
  ball.vx += kit.rand(-150, 150);
  kit.sound('boing');
}

// Wall bounce in one call
ball.x += ball.vx * dt;
ball.y += ball.vy * dt;
kit.bounce(ball, { x: 0, y: 0, w: W, h: H });

// Paddle collision
if (kit.hit(ball, paddle) && ball.vy > 0) ball.vy = -ball.vy;
```

## Evaluation metrics
- Lines per collision system: 1-2 (vs 4-8 CLASSIC)
- Test coverage: 15 tests, all pass (circle-circle, circle-rect, rect-rect, invalid inputs, edge cases)
- Correctness: Phaser's proven intersection algorithms, adapted to plain objects
- Model prompt cost: +2 lines in api/kit.md (kit.hit, kit.bounce)
- Game compatibility: frog-tap.js and star-collect.js unchanged and green

## Trial success criteria
1. All existing tests stay green (CLASSIC pinned)
2. New tests pass: valid/invalid inputs, all shape pairs, bounce clamping and reflection
3. bounce-ball.js example runs and demonstrates both functions
4. No new dependencies, no network calls, bounded memory (no lists)
