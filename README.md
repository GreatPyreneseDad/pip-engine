# pip-engine

A tiny 2D game engine that an AI writes games against, for children who can't read yet.

A child tells Pip the wish-unicorn about a game out loud. A model writes it in plain JavaScript against `kit`,
and it runs in a sealed canvas on a phone, a tablet or a laptop. pip-engine is that `kit`: the drawing,
sound, touch and safety layer underneath every game on [Maple's World](https://maplesworld.org).

It is grown, not written. [CERATA](https://github.com/GreatPyreneseDad/CERATA-Project) hunts the open-source
game engines, digests the best pieces into this body, and proves each one in a CLASSIC/EXPERIMENTAL trial.
See [`CERATA_TARGETS.md`](CERATA_TARGETS.md) for the hunting ground and [`forest/`](forest/) for the trials.

## A game

```js
let frogs = [], score = 0;
const game = {
  init() { for (let i = 0; i < 4; i++) frogs.push({ x: kit.rand(80, W - 80), y: kit.rand(H * 0.4, H * 0.8), hop: 0 }); },
  update(dt) { /* tap a frog: kit.sound('boing'), kit.puff(...), every 10 taps kit.win() */ },
  draw() { kit.bg('#8fd3ff', '#bdf0a8'); for (const f of frogs) kit.sprite('frog', f.x, f.y, 90); },
};
```

The full API is [`api/kit.md`](api/kit.md). It is the contract the model is given, verbatim, so a capability
that is not written there does not exist. A test fails if `kit` grows a function the contract doesn't name.

## Rules of the body

- Plain JavaScript, no imports. A game is 80 to 320 lines.
- One sealed frame: CSP `default-src 'none'`, no DOM, no network, no storage, no timers.
- Phones first, one finger, targets of 80 px or more.
- The child cannot lose. No game over, no countdown, no buzzer.
- Errors are reported to the host, never thrown. Runaway frames are stopped.
- Sound and speech are posted to the host page, which owns audio.

## Use it

Two builds of the same engine:

```js
// ES module: bundlers, Deno and edge functions, Node
import { engine, frameDoc, CONTRACT_PROMPT, VERSION } from './pip-engine.mjs';
iframe.srcdoc = frameDoc(engine, { pre: partsSource, code: gameSource });
// CONTRACT_PROMPT is the contract from api/kit.md, ready to paste into the model's system prompt.
```

```html
<!-- classic script for plain pages: sets globalThis.PIP_ENGINE -->
<script src="pip-engine.js"></script>
<script>frame.srcdoc = PIP_ENGINE.frameDoc(PIP_ENGINE.engine, game);</script>
```

Pin a version, and ship the page's engine and the model's contract together. A game written against a
newer `kit.*` will crash on an older runtime.

The host listens for `postMessage` events from the frame: `ready`, `error`, `sound`, `note`, `say`, `win`,
`zzfx` (play it with the exported `playZzfx(params)`), `score` and `over`.

A second, optional contract block, `FLOOR_PROMPT`, documents the surface written for older builders
(MacT Factory, ages 10+): keyboard, on-screen touch controls, plain shapes, meters, noise, raw ZzFX, score.
Pip's prompt does not include it, and touch controls stay off until a game calls `kit.touchControls('auto')`.
Hosts that relay keyboard focus post `{ gm: 1, type: 'key', key, down }` into the frame.

## Develop

```
npm test          # headless: the real engine in a Node vm against a fake canvas, no browser, no deps
npm run build     # dist/pip-engine.mjs (CI rebuilds it on main)
```

New capabilities are **kit plugins**: one file in `src/kit/` each, loaded after the runtime, with per-frame work
registered through `kit._onTick`. See [`src/kit/README.md`](src/kit/README.md). The core files are read-only to CERATA.

`tests/harness.mjs` runs any game for N frames with scripted taps and returns what it posted and drew.
That harness is how CERATA proves a trial: the CLASSIC tests must stay green.

## License

MIT. Consumed code keeps its upstream license file beside it, and every consumed file carries its attribution.
