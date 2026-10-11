# Hunting ground

pip-engine grows by predation. Each generation below is one `/cerata consume` on an issue in this repo.
Prey come from GitHub's [game-engines collection](https://github.com/collections/game-engines).
Paths and licenses were checked on 2026-10-11, and the coherence scores are CERATA hunts from the same day.

**The body's DNA** (repeat the gist in every consume's focus note):
plain JavaScript, no imports, one sealed canvas frame, phones first, one finger, a child of 2 to 8 who cannot
lose and cannot read. Every new capability is a `kit.*` function documented in `api/kit.md` in the same voice
(the model only uses what the contract names). Pure logic goes in its own testable file under `src/`;
`src/runtime.js` only wires it into `kit`. Anything that makes sound or speech is posted to the host.

| Gen | Capability | Prey (license, coherence) | Files | Becomes |
|---|---|---|---|---|
| 2 | Tweens and easing | phaserjs/phaser (MIT, 2.927) | `src/math/easing/back/Out.js` `src/math/easing/bounce/Out.js` `src/math/easing/elastic/Out.js` `src/math/easing/sine/InOut.js` `src/math/easing/quadratic/InOut.js` | `kit.tween(obj, props, seconds, ease)`, `kit.ease.*` |
| 3 | Collision | phaserjs/phaser (MIT) | `src/geom/intersects/CircleToCircle.js` `src/geom/intersects/CircleToRectangle.js` `src/geom/intersects/RectangleToRectangle.js` | `kit.hit(a, b)`, `kit.bounce(o, bounds)` |
| 4 | Generated sound | KilledByAPixel/LittleJS (MIT, 3.024) | `src/engineAudio.js` (ZzFX only) | `kit.zzfx(...)` + more named sounds, synthesised host-side |
| 5 | Particle emitters | KilledByAPixel/LittleJS (MIT) | `src/engineParticles.js` | `kit.burst(kind, x, y)`: confetti, smoke, bubbles, sparkles, rain |
| 6 | Touch gestures | KilledByAPixel/LittleJS (MIT) | `src/engineInput.js` | `kit.touches`, `kit.drag`, `kit.swipe` |
| 7 | Timers and sequences | KilledByAPixel/LittleJS (MIT) | `src/engineUtilities.js` (Timer) | `kit.after(s, fn)`, `kit.every(s, fn)` driven by dt |
| 8 | Grids | KilledByAPixel/LittleJS (MIT) | `src/engineTileLayer.js` | `kit.grid(cols, rows)` for mazes, match and sort games |
| 9 | Colour | craftyjs/Crafty (MIT, 2.781) | `src/graphics/color.js` | `kit.color.mix`, `kit.color.hsl`, rainbows |
| 10 | Crowds | lance-gg/lance (Apache-2.0, 2.781) | `src/physics/SimplePhysics/HSHGCollisionDetection.ts` | spatial hash so 200 objects stay at 60 fps |

**Not prey**, and why: Luanti, LÖVE, Haxe, DarkPlaces, o3de and Lumberyard are LGPL or GPL; OpenRA and OpenRCT2 are AGPL.
CERATA blocks copyleft by default, and pip-engine stays MIT. Godot, raylib and Bevy are permissive, but they're
C++, C and Rust, so a consume there is a port and not a digestion; keep them for later generations.
PhysicsJS has no license file, so CERATA refuses it until a human verifies the license.

## Running a generation

Open one issue per generation, then comment (generation 2 shown):

```
/cerata consume phaserjs/phaser src/math/easing/back/Out.js src/math/easing/bounce/Out.js src/math/easing/elastic/Out.js src/math/easing/sine/InOut.js src/math/easing/quadratic/InOut.js -- gen 2: kit.tween and kit.ease for a 2 to 8 year old's touch games. Pure easing in src/ease.js, kit wiring in src/runtime.js, document both in api/kit.md, add an example in examples/.
```

CERATA will run `tests/*.test.mjs` before and after. Any CLASSIC test that goes red fails the trial.
