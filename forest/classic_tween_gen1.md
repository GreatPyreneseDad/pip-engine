# CLASSIC: gen 1 (no tweening)

## Capabilities
- Manual interpolation only via `kit.lerp(a, b, k)`
- Games compute their own easing curves or use linear motion
- No built-in animation system for smooth transitions

## Behaviour
- A game that wants smooth motion writes:
  ```js
  obj.x = kit.lerp(obj.x, targetX, 0.1 * dt * 60);
  ```
- Bounce/elastic/overshoot effects require manual math
- Multiple simultaneous animations need manual state tracking per object

## Metrics
- Lines of code for a bouncing object: ~8-12 (manual lerp + sine)
- Easing complexity: model must write overshoot math itself
- API surface: 1 function (kit.lerp)
