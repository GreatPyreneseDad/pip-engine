import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.after calls the callback once after the specified time', () => {
  const code = `let fired = 0;
    const game = {
      init() { kit.after(0.5, () => { fired++; }); },
      update() { globalThis.__fired = fired; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 20, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__fired, 0, 'not fired before time');
  const r2 = runGame(code, { frames: 40, dt: 1/60 });
  assert.equal(r2.error, null);
  assert.equal(r2.ctx.__fired, 1, 'fired once after time');
  const r3 = runGame(code, { frames: 100, dt: 1/60 });
  assert.equal(r3.error, null);
  assert.equal(r3.ctx.__fired, 1, 'still only fired once');
});

test('kit.after handle.cancel() prevents the callback from firing', () => {
  const code = `let fired = 0;
    const game = {
      init() {
        const h = kit.after(0.5, () => { fired++; });
        kit.after(0.1, () => { h.cancel(); });
      },
      update() { globalThis.__fired = fired; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 60, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__fired, 0, 'cancelled timer never fired');
});

test('kit.every calls the callback repeatedly', () => {
  const code = `let count = 0;
    const game = {
      init() { kit.every(0.2, () => { count++; }); },
      update() { globalThis.__count = count; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 80, dt: 1/60 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__count >= 5, `repeated at least 5 times in 1.33s: ${r.ctx.__count}`);
});

test('kit.every handle.cancel() stops repetition', () => {
  const code = `let count = 0; let handle;
    const game = {
      init() {
        handle = kit.every(0.1, () => { count++; if (count === 3) handle.cancel(); });
      },
      update() { globalThis.__count = count; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 100, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 3, 'stopped after 3 calls');
});

test('kit.after and kit.every ignore invalid inputs', () => {
  const code = `let fired = 0;
    const game = {
      init() {
        kit.after(-1, () => { fired++; });
        kit.after(NaN, () => { fired++; });
        kit.after(0.5, null);
        kit.after(0.5, 'not a function');
        kit.every(0, () => { fired++; });
        kit.every(-1, () => { fired++; });
        kit.every(NaN, () => { fired++; });
        kit.every(0.2, null);
      },
      update() { globalThis.__fired = fired; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 60, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__fired, 0, 'no invalid timers fired');
});

test('errors inside timer callbacks are reported, not thrown', () => {
  const code = `let ok = 0;
    const game = {
      init() {
        kit.after(0.1, () => { throw new Error('boom'); });
        kit.after(0.2, () => { ok++; });
      },
      update() { globalThis.__ok = ok; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 40, dt: 1/60 });
  const err = r.posts.find(p => p.type === 'error');
  assert.ok(err, 'error was posted');
  assert.ok(err.message.includes('boom'), `error message: ${err.message}`);
  assert.equal(r.ctx.__ok, 1, 'other timers still fire');
});

test('timers cap at 100, dropping the oldest', () => {
  const code = `let count = 0;
    const game = {
      init() {
        for (let i = 0; i < 150; i++) {
          kit.after(0.5, () => { count++; });
        }
      },
      update() { globalThis.__count = count; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 60, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 100, `capped at 100: ${r.ctx.__count}`);
});

test('kit.after fires at the correct game time within one frame', () => {
  const code = `let fireTime = 0;
    const game = {
      init() { kit.after(0.5, () => { fireTime = kit.t; }); },
      update() { globalThis.__fireTime = fireTime; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 40, dt: 1/60 });
  assert.equal(r.error, null);
  const expected = 0.5;
  const tolerance = 1/60 + 0.001; // one frame plus epsilon
  assert.ok(Math.abs(r.ctx.__fireTime - expected) < tolerance,
    `fired at ${r.ctx.__fireTime}, expected ${expected}`);
});

test('kit.every repeats at consistent intervals', () => {
  const code = `const times = [];
    const game = {
      init() { kit.every(0.2, () => { times.push(kit.t); }); },
      update() { globalThis.__times = times; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 80, dt: 1/60 });
  assert.equal(r.error, null);
  const times = r.ctx.__times;
  assert.ok(times.length >= 5, `repeated enough: ${times.length}`);
  for (let i = 1; i < times.length; i++) {
    const interval = times[i] - times[i - 1];
    assert.ok(Math.abs(interval - 0.2) < 1/60 + 0.001,
      `interval ${i}: ${interval}, expected ~0.2`);
  }
});

test('multiple timers coexist and fire independently', () => {
  const code = `let a = 0, b = 0, c = 0;
    const game = {
      init() {
        kit.after(0.3, () => { a++; });
        kit.every(0.15, () => { b++; });
        kit.after(0.6, () => { c++; });
      },
      update() { globalThis.__counts = { a, b, c }; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 60, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__counts.a, 1, 'one-shot a fired');
  assert.ok(r.ctx.__counts.b >= 5, `repeating b fired: ${r.ctx.__counts.b}`);
  assert.equal(r.ctx.__counts.c, 1, 'one-shot c fired');
});

test('kit.after with zero delay fires on the next frame', () => {
  const code = `let fired = false;
    const game = {
      init() { kit.after(0, () => { fired = true; }); },
      update() { globalThis.__fired = fired; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__fired, true, 'zero-delay timer fired immediately');
});

test('cancelling a timer that already fired is harmless', () => {
  const code = `let fired = 0; let handle;
    const game = {
      init() { handle = kit.after(0.1, () => { fired++; }); },
      update() {
        if (kit.t > 0.2) handle.cancel();
        globalThis.__fired = fired;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 40, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__fired, 1, 'late cancel is harmless');
});

test('kit.every with a short interval does not overflow', () => {
  const code = `let count = 0;
    const game = {
      init() { kit.every(0.01, () => { count++; }); },
      update() { globalThis.__count = count; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 120, dt: 1/60 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__count > 50, `short interval repeated many times: ${r.ctx.__count}`);
  assert.ok(r.ctx.__count < 200, `did not spiral out of control: ${r.ctx.__count}`);
});

test('timer callbacks can schedule new timers', () => {
  const code = `let chain = 0;
    function next() {
      chain++;
      if (chain < 5) kit.after(0.1, next);
    }
    const game = {
      init() { kit.after(0.1, next); },
      update() { globalThis.__chain = chain; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 80, dt: 1/60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__chain, 5, 'chained timers all fired');
});
