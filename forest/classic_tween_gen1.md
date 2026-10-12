# CLASSIC tween gen1

Before this trial, pip-engine had no built-in animation system. Games animated positions manually with `kit.lerp` or direct math:

```js
obj.y += dt * speed;
obj.x = kit.lerp(obj.x, targetX, 0.1);
```

**Capabilities:**
- Manual property updates in `game.update(dt)`
- `kit.lerp(a, b, k)` for linear interpolation
- No easing curves
- No automatic completion detection

**Behaviour:**
- Games control all motion explicitly every frame
- Smooth curves require mathematical knowledge
- Overshoots, bounces, elastic effects are tedious to hand-code

**Contract surface:**
No tween or ease functions in `kit`.
