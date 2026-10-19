# CLASSIC: Color handling (gen 1)

## Capabilities
- Hardcoded hex color strings (`'#8fd3ff'`, `'#ffd84d'`) passed directly to `kit.bg()`, `kit.text()` and `ctx.fillStyle`
- No color manipulation: each color state requires a separate hardcoded string
- No programmatic palette generation or smooth color transitions
- Alpha transparency only available through `rgba()` strings manually constructed by the model

## Behaviour
- Games use 3-8 distinct hardcoded colors
- Color changes are instant: no gradients between states (hit/normal, day/night)
- Rainbow or cycling effects require the model to maintain arrays of pre-written color strings
- Fading effects (star collection, ghost appearance) require manual rgba() string construction with calculated alpha

## Test surface
- `examples/frog-tap.js`: 2 background colors, 1 text color (hardcoded hex)
- `examples/star-collect.js`: 3 hardcoded colors for background, particles and text
- Existing tests verify no runtime errors when color strings are passed to kit functions
