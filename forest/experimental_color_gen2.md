# EXPERIMENTAL: Color utilities (gen 2)

## Capabilities
- `kit.color.mix(a, b, t)`: blend between two colors with linear interpolation
- `kit.color.hsl(h, s, l)`: create colors from hue/saturation/lightness (easier palettes than hex)
- `kit.color.rainbow(t)`: spectrum color at t (0-1), wraps for continuous cycling
- `kit.color.alpha(color, a)`: adjust transparency of any color
- Parser accepts: hex (`#RGB`, `#RRGGBB`), rgb/rgba strings, 17 named HTML colors

## Behaviour changes
- Games can animate color transitions smoothly (damage flash: red→normal, day→night gradient)
- Rainbow effects with a single function call instead of color arrays
- Palette generation from a base hue (complementary, analogous colors via HSL)
- Fade-in/out without manual rgba string construction

## Evaluation metrics
**Reachability**: `examples/color-rainbow.js` demonstrates all four functions:
  - Background: `kit.color.rainbow(kit.t * 0.05)` for cycling gradient
  - Star glow: `kit.color.mix(baseColor, glowColor, pulseMix)` for pulsing
  - Star fade: `kit.color.alpha(starColor, fadeAmount)` on collection
  - Palette: `kit.color.hsl(hue, 1, 0.6)` for per-star base colors

**CLASSIC preservation**: existing examples run unchanged, hardcoded strings still work

**Robustness**: 
  - Invalid color strings return black (`rgba(0, 0, 0, 1)`), never throw
  - NaN/missing parameters default to safe values (t→0, a→1, h→0)
  - All functions clamp output to valid CSS rgba() range

**Model utility targets**:
  - 40% reduction in color-related code tokens (1 function call vs 3-line rgba construction)
  - Enables "smooth color fade over 2 seconds" in natural language (via `kit.tween` + `kit.color.mix`)
  - Rainbow/palette requests become 1-line solutions instead of "not possible with current kit"
