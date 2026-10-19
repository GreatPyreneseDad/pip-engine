# The kit contract

This is the API a game is written against, verbatim from the maker's build prompt. It is the engine's public surface: **a capability the model is not told about does not exist.** Every new kit feature must be added here in the same voice, and the maker's prompt must be generated from this file.

```text
YOUR CODE must define exactly:  const game = { init() {}, update(dt) {}, draw() {} };
init runs once. Every frame update(dt) then draw() run (dt in seconds, at most 0.05). Draw the whole screen every frame.

GLOBALS YOU CAN USE
W, H            canvas size in CSS pixels. Read them every frame; they change when the device rotates. Phones are tall (about 390x800), laptops wide.
ctx             CanvasRenderingContext2D for free drawing.
kit.t           seconds since the game started
kit.pointer     { x, y, down, pressed, released }   finger or mouse. pressed/released are true for one frame.
kit.bg(topColor, bottomColor)                 fill the background with a vertical gradient
kit.sprite(kind, x, y, size, opts)            cute built-in character, FEET at (x, y), size = height in pixels. opts: { flip: bool, t: animation seconds (pass kit.t to animate walking/flapping, 0 to stand), rot: radians, alpha }
    kinds: girl boy robot unicorn dino kitten cat puppy bunny chick pig sheep fox owl hedgehog frog turtle duck penguin bear bat mouse butterfly ladybug crab firefly ghost cloud snowball
kit.item(kind, x, y, size, opts)              CENTERED at (x, y). kinds: star apple gem fish flower cupcake heart coin
kit.prop(kind, x, y, size)                    scenery, BASE at (x, y). kinds: tree pine bush flower rock palm shell snowman mushroom crystal lollipop cane
kit.emoji(char, x, y, size, opts)             any emoji CENTERED at (x, y). Use for everything not built in (pancake, moon, rocket, dragon, pizza, truck...). opts: { rot, alpha, flip }
kit.text(str, x, y, size, color, align)       bold rounded text. Use only for numbers or one or two words. The child cannot read.
kit.sound(name)                               pop join bonk win tap magic boing whoosh splash munch
kit.note(freq, seconds)                       a single musical tone
kit.puff(x, y, colors, n)                     sparkle burst. kit animates and draws its particles on top by itself.
kit.shake(amount)                             brief screen shake, amount about 4 to 12
kit.say(text)                                 Pip says up to 10 words aloud. Use rarely: at big moments only, never every frame.
kit.win()                                     call ONCE when the child finishes a round: confetti and fanfare. Then start a new, slightly different round yourself about 3 seconds later.
kit.tween(obj, props, seconds, ease)          smooth animation. Changes obj's properties to match props over seconds. ease: 'backOut' 'bounceOut' 'elasticOut' 'sineInOut' 'quadInOut' 'linear' (default 'sineInOut'). A new tween on the same property replaces the old one. Example: kit.tween(star, {y: 100, x: 200}, 1.5, 'bounceOut')
kit.ease(name, t)                             easing curve value at time t (0 to 1). Same names as tween; unknown names act as 'linear'.
kit.rand(a, b)  kit.pick(array)  kit.clamp(v, a, b)  kit.dist(x1, y1, x2, y2)  kit.lerp(a, b, k)
```

## The floor contract

The second block is the extra surface MacT Factory's builder (ages 10+) is told about, on top of the block above: a keyboard, on-screen touch controls, plain shapes, meters and noise. It is exported as `FLOOR_PROMPT`. Pip's games can use these too, but Pip's prompt does not mention them, and touch controls stay off until a game asks.

```text
INPUT
kit.key(name)        true while held.  names: left right up down space enter shift esc  and single characters: w a s d e q f r x z ...
kit.pressed(name)    true for the one frame the key went down.   kit.released(name) likewise.   kit.keys is the Set of names held right now.
kit.axis()           { x, y } in -1..1 from arrows and WASD together (or the on-screen stick).
kit.pointer          also has heldFor: seconds the finger or button has been held (charge-up).
kit.drag             { active, x0, y0, dx, dy, dist, angle }  the current press as a drag from where it started: pull back and release to cast, throw, aim, slingshot.
kit.angleTo(x1, y1, x2, y2)   kit.approach(v, target, rate, dt)   smooth follow (camera, rod tip, needle).
kit.touch            true on phones and tablets. kit.touchControls('auto') in init shows a floating stick (left half, bottom) and A/B buttons (bottom right) that feed the same keys: stick = arrows/WASD and kit.axis(), A = space, B = shift. 'stick' or 'buttons' shows one; 'none' (default) shows nothing. Taps elsewhere still drive kit.pointer.
kit.safeBottom       pixels at the bottom covered by the touch controls (0 when none). Keep the HUD and the action out of that band.

DRAWING
kit.band(y0, y1, top, bottom)                     horizontal gradient band (sky, water depth, ground).
kit.rect(x, y, w, h, color, radius)  kit.circle(x, y, r, color)  kit.ellipse(x, y, rx, ry, color, rot)  kit.ring(x, y, r, color, width)  kit.line(x1, y1, x2, y2, color, width)  kit.poly([[x,y],...], color)
kit.polyline([[x,y],...], color, width)  kit.curve(x1, y1, cx, cy, x2, y2, color, width)  kit.arc(x, y, r, a0, a1, color, width)      rods, lines, ropes, trails, waves.
kit.radial(x, y, r, innerColor, outerColor)      soft light, glow, fog, sun.    kit.shadow(blur, color, () => {...})   drop shadow around what the function draws.    kit.alpha(a, () => {...})   draw translucent.
kit.bar(x, y, w, h, frac, color, back)           meter: health, tension, charge.
kit.label(str, x, y, size, color, align)         small monospace HUD text.
kit.noise(x, y?)                                 smooth noise 0..1: kit.noise(kit.t * .3) drifts slowly (wind, current); kit.noise(x * .01, kit.t) ripples water. Layer two or three octaves for natural motion.
kit.wrap(v, lo, hi)                              v jumps to the other edge when it leaves lo..hi.

SCORE
kit.score(n)      report the current score to the host HUD (call whenever it changes).
kit.over(score)   call once at game over; the host shows it. Draw your own game-over screen too and restart on space or tap.
```
