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
kit.tween(object, props, duration, easing)    smooth animation. Change object's numeric properties to props values over duration seconds. Re-tweening the same object cancels the previous tween. Fire-and-forget, no callback. easing: 'backOut' (overshoot), 'bounceOut' (bounce landing), 'elasticOut' (spring), 'sineInOut' (smooth), 'quadInOut' (moderate), 'linear' (default: sineInOut).
kit.ease(t, easing)                           manual easing. t in [0,1], returns eased value. Same easing names as kit.tween.
kit.sound(name)                               pop join bonk win tap magic boing whoosh splash munch
kit.note(freq, seconds)                       a single musical tone
kit.puff(x, y, colors, n)                     sparkle burst. kit animates and draws its particles on top by itself.
kit.shake(amount)                             brief screen shake, amount about 4 to 12
kit.say(text)                                 Pip says up to 10 words aloud. Use rarely: at big moments only, never every frame.
kit.win()                                     call ONCE when the child finishes a round: confetti and fanfare. Then start a new, slightly different round yourself about 3 seconds later.
kit.rand(a, b)  kit.pick(array)  kit.clamp(v, a, b)  kit.dist(x1, y1, x2, y2)  kit.lerp(a, b, k)
```
