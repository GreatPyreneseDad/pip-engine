# CLASSIC: collision and bounce (gen 1)

Collision detection and simple physics before kit.hit and kit.bounce existed.

## Capabilities
- Manual distance checks with `kit.dist(x1, y1, x2, y2) < threshold` for circular tap targets
- Manual AABB (axis-aligned bounding box) overlap: `if (x1 < x2 + w2 && x1 + w1 > x2 && ...)` for rectangles
- Manual velocity reflection: `if (ball.x < 0) ball.vx = -ball.vx`
- Manual clamping: `ball.x = kit.clamp(ball.x, minX, maxX)`

## Behaviour
- Games implemented collision per object with inline conditionals
- Tap detection: `if (kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, obj.x, obj.y) < 50)`
- Wall bounce: separate checks for each edge, often verbose and error-prone
- No unified API: each game repeated similar logic

## Examples
```js
// frog-tap.js uses kit.dist for tap detection
if (kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, f.x, f.y - 40) < 70) {
  f.hop = 1; score++; kit.sound('boing');
}

// Manual bounce (typical pattern before kit.bounce):
if (ball.x < ball.r) { ball.x = ball.r; ball.vx = -ball.vx; }
if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -ball.vx; }
if (ball.y < ball.r) { ball.y = ball.r; ball.vy = -ball.vy; }
if (ball.y > H - ball.r) { ball.y = H - ball.r; ball.vy = -ball.vy; }
```

## Metrics (target)
- Lines per collision check: 1 (distance) or 4-8 (AABB + bounce)
- Error rate: high (off-by-one, missing edge cases)
- Model token cost: ~50-80 tokens per collision system per game
