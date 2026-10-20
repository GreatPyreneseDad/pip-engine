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
kit.sound(name)                               pop join bonk win tap magic boing whoosh splash munch laser zap explode coin jump hit powerup blip
kit.note(freq, seconds)                       a single musical tone
kit.puff(x, y, colors, n)                     sparkle burst. kit animates and draws its particles on top by itself.
kit.burst(kind, x, y, n)                      particle burst of n particles. kinds: confetti smoke bubbles sparkles rain fire. kit animates and draws them on top.
kit.emit(kind, x, y, seconds)                 continuous particle emitter that stops after seconds. same kinds as burst.
kit.shake(amount)                             brief screen shake, amount about 4 to 12
kit.say(text)                                 Pip says up to 10 words aloud. Use rarely: at big moments only, never every frame.
kit.win()                                     call ONCE when the child finishes a round: confetti and fanfare. Then start a new, slightly different round yourself about 3 seconds later.
kit.tween(obj, props, seconds, ease)          smooth animation. Changes obj's properties to match props over seconds. ease: 'backOut' 'bounceOut' 'elasticOut' 'sineInOut' 'quadInOut' 'linear' (default 'sineInOut'). A new tween on the same property replaces the old one. Example: kit.tween(star, {y: 100, x: 200}, 1.5, 'bounceOut')
kit.ease(name, t)                             easing curve value at time t (0 to 1). Same names as tween; unknown names act as 'linear'.
kit.after(seconds, fn)                        call fn once after seconds of game time. Returns handle with cancel() to stop it before it fires.
kit.every(seconds, fn)                        call fn repeatedly every seconds of game time. Returns handle with cancel() to stop it.
kit.color.mix(a, b, t)                        blend two colors (hex, rgb, rgba or named). t: 0=a, 1=b. Returns CSS rgba() string. Example: kit.color.mix('#ff0000', '#0000ff', 0.5)
kit.color.hsl(h, s, l)                        create color from hue (0-360), saturation (0-1), lightness (0-1). Returns CSS rgba() string.
kit.color.rainbow(t)                          rainbow spectrum color at t (0-1, wraps). Returns CSS rgba() string. Animate with kit.t for cycling rainbow.
kit.color.alpha(color, a)                     adjust alpha of a color (a: 0-1). Returns CSS rgba() string. Example: kit.color.alpha('#ff0000', 0.5)
kit.grid(cols, rows, cellSize)                grid for board games (match-3, tic-tac-toe). Returns grid object with: get(c, r) returns cell value or undefined; set(c, r, v) sets cell; cellAt(x, y) returns {c, r} for screen point or null; center(c, r) returns {x, y} screen center of cell or null; forEach(fn) calls fn(value, c, r) for every cell; draw(fn) calls fn(value, x, y, cellSize) for non-empty cells. Max 64×64 cells.
kit.hit(a, b)                                 true if two shapes overlap. Each is {x, y, r} for a circle or {x, y, w, h} for a rectangle. Any mix. Example: kit.hit(ball, paddle) or kit.hit(kit.pointer, {x: star.x, y: star.y, r: 40})
kit.bounce(o, bounds)                         reflect o's velocity (o.vx, o.vy) when it hits bounds edges and clamp o inside. o is {x, y, vx, vy} and optionally {r} or {w, h}. bounds is {x, y, w, h}. Mutates o. Example: kit.bounce(ball, {x: 0, y: 0, w: W, h: H})
kit.near(list, x, y, radius)                  items of list within radius of (x, y). Each item needs {x, y}. Returns array (empty if none). Max 200 items.
kit.pairs(list, fn)                           calls fn(a, b) for every overlapping pair of circles in list. Each item needs {x, y, r}. Missing r treated as 0. Max 200 items.
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
kit.swipe            null, or for one frame after a quick flick: { dir: 'left'|'right'|'up'|'down', dx, dy, dist }. Lane changes, card tosses, page turns.
kit.angleTo(x1, y1, x2, y2)   kit.approach(v, target, rate, dt)   smooth follow (camera, rod tip, needle).
kit.touch            true on phones and tablets. kit.touchControls('auto') in init shows a stick in the bottom-left corner pad and A/B buttons in the bottom-right that feed the same keys: stick = arrows/WASD and kit.axis(), A = space, B = shift. 'stick' or 'buttons' shows one; 'none' (default) shows nothing. Taps elsewhere still drive kit.pointer.
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

PLATFORMER
kit.platform(o, solids, dt, opts)   a jumping game's body, every frame: o is {x, y, w, h, vx, vy} (top-left box), solids a list of {x, y, w, h} (add oneWay: true for ledges you can jump up through). Reads arrows/WASD and space by itself; or pass {left, right, jump, jumpHeld}. Sets o.onGround, o.facing, o.landed, o.jumped, o.hitWall, o.hitHead. A tap jumps low, a held space jumps high; walking off a ledge still allows a jump for a moment. Feel knobs in opts: top (speed), jump, gravity (floaty vs heavy), dec (small = ice), airAcc (0 = committed jumps), scale (default .8). Draw o yourself.

SOUND
kit.zzfx([volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter])
                  a custom ZzFX sound (any prefix of the 21 numbers; the rest take defaults). kit.sound(name) already covers laser zap explode coin jump hit powerup blip. At most 4 sounds a frame.

SCORE
kit.score(n)      report the current score to the host HUD (call whenever it changes).
kit.over(score)   call once at game over; the host shows it. Draw your own game-over screen too and restart on space or tap.
```
