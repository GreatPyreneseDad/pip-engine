# Classic kit capabilities (gen 8)

The kit API a game is written against, before kit.grid was added.

## Capabilities
- Background gradients: `kit.bg(topColor, bottomColor)`
- Built-in sprites: girl, boy, robot, unicorn, dino, and 20+ animals with walk/flap animation
- Items and props: stars, gems, trees, rocks, scenery
- Emoji drawing for anything not built in
- Text rendering (numbers and short words, children can't read)
- Sounds: pop, join, bonk, win, tap, magic, boing, whoosh, splash, munch
- Musical tones: `kit.note(freq, seconds)`
- Particle effects: `kit.puff(x, y, colors, n)` with automatic animation
- Screen shake: `kit.shake(amount)`
- Text-to-speech: `kit.say(text)` for up to 10 words
- Win celebration: confetti and fanfare
- Tweening: smooth property animation with 5 easing functions
- Pointer input: touch or mouse with pressed/released states
- Utilities: rand, pick, clamp, dist, lerp

## Behaviour
- Games define `{ init(), update(dt), draw() }`
- Update and draw run every frame (dt capped at 0.05s)
- Pointer states (pressed/released) last one frame
- Tweens replace older tweens on the same property
- Unknown easing names default to linear
- Max 50 active tweens, oldest dropped when full
- Particles animate and draw themselves on top

## Known limitations
- No grid/board game support: games must manage cell arrays manually
- No built-in screen-to-cell or cell-to-screen conversion
- No bounded iteration over non-empty cells
