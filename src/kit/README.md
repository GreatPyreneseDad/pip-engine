# Kit plugins

Every `*.js` file here is a kit plugin. The build (and the test harness) appends them, sorted by name, after
`src/runtime.js` inside the sealed game frame. So a plugin can use everything the runtime defines: `kit`, `ctx`,
`W`, `H`, `post`, `parts`, `TAU`.

A plugin:
- adds one capability as `kit.something(...)`, plus private helpers it keeps to itself
- registers per-frame work with `kit._onTick(dt => ...)`. It runs after `game.update(dt)` and before `game.draw()`.
- never throws: it checks its inputs and ignores junk
- is documented in `api/kit.md` in the same voice as the rest of the contract (a test enforces this)
- is tested through `tests/harness.mjs` (`runGame(code, ...)`) in a new `tests/<name>.test.mjs`
- carries an attribution header when its code was consumed from another project

Name files with a number for order: `20-tween.js`, `30-collide.js`, ...
