# Consuming into pip-engine

pip-engine is the API a model writes children's games against (ages 2 to 8, can't read, can't lose, one finger,
phones first). A new capability is useful only if the game-writing model can call it, so:

1. **Put it in one new file, `src/kit/NN-name.js`.** It's a plain script, with no imports or exports, that adds
   `kit.name(...)`. Read `src/kit/README.md`. The core (`src/lib.js`, `src/runtime.js`, `src/loop.js`) is
   read-only. For per-frame work, call `kit._onTick(dt => ...)`.
2. **Document it in `api/kit.md`.** Add lines inside the ```text block, in the same terse voice as the
   existing lines (signature, then what it does, in plain words). This file is pasted into the game-writing
   model's prompt. A test fails if a `kit.*` function is missing from it.
3. **Test it in a new `tests/NN-name.test.mjs`** that uses `runGame` from `tests/harness.mjs` (it runs the real
   frame headless). Test junk input too: NaN, missing objects, huge counts.
4. **Add one tiny example game** in `examples/` that uses the new capability. The examples test plays every example.
5. **Keep it small**: tens of lines, not hundreds. Port only what a child's game needs, with no dependencies. Bounded
   memory: cap any list it keeps.
6. **Wiring:** a plugin in `src/kit/` is loaded automatically, so it's live as soon as it exists. The CLASSIC
   trial is that every existing test stays green.
