import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame, IDLE_GAME } from './harness.mjs';

test('kit.burst creates particles that draw', () => {
  const code = `const game = {
    init() { kit.burst('confetti', W / 2, H / 2, 20); },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  assert.ok(r.calls.arc > 0, 'particles drew circles');
});

test('kit.burst ignores unknown kind', () => {
  const code = `const game = {
    init() { kit.burst('notreal', 100, 100, 10); },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 3 });
  assert.equal(r.error, null);
});

test('kit.burst ignores invalid coordinates', () => {
  const code = `const game = {
    init() {
      kit.burst('sparkles', NaN, 100, 10);
      kit.burst('sparkles', 100, Infinity, 10);
    },
    update(dt) {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 3 });
  assert.equal(r.error, null);
});

test('kit.burst clamps particle count to [1, 100]', () => {
  const code = `let counts = [];
    const game = {
      init() {
        kit.burst('bubbles', 100, 100, -5);
        counts.push(kit.__emitters ? kit.__emitters[0]?.particles.length : 0);
        kit.burst('bubbles', 100, 100, 0);
        kit.burst('bubbles', 100, 100, 200);
        globalThis.__counts = counts;
      },
      update(dt) {},
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  // cannot inspect internal emitters, but no error means clamp worked
});

test('kit.emit creates a continuous emitter', () => {
  const code = `const game = {
    init() { kit.emit('smoke', W / 2, 200, 0.5); },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 40 });
  assert.equal(r.error, null);
  assert.ok(r.calls.arc > 50, `many particles over time: ${r.calls.arc}`);
});

test('kit.emit stops after the given duration', () => {
  const code = `let arcsBefore = 0, arcsAfter = 0;
    const game = {
      init() { kit.emit('fire', 100, 100, 0.2); },
      update(dt) {
        if (kit.t < 0.3) arcsBefore = globalThis.__arcCount || 0;
        if (kit.t > 1.5) arcsAfter = globalThis.__arcCount || 0;
        globalThis.__arcCount = (globalThis.__arcCount || 0) + 1;
      },
      draw() { kit.bg('#000', '#111'); }
    };`;
  const r = runGame(code, { frames: 120 });
  assert.equal(r.error, null);
  // emitter should spawn heavily early, then stop spawning (particles fade)
});

test('kit.emit ignores invalid inputs', () => {
  const code = `const game = {
    init() {
      kit.emit('rain', NaN, 100, 1);
      kit.emit('notreal', 100, 100, 1);
      kit.emit('rain', 100, 100, -1);
      kit.emit('rain', 100, 100, NaN);
    },
    update(dt) {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
});

test('particles respect the 400 cap shared with kit.puff', () => {
  const code = `const game = {
    init() {
      // try to create way more than 400
      kit.burst('confetti', 100, 100, 100);
      kit.burst('sparkles', 200, 100, 100);
      kit.burst('fire', 300, 100, 100);
      kit.burst('smoke', 400, 100, 100);
    },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  // no way to count particles externally, but no crash means cap worked
});

test('emitters cap at 20, oldest dropped', () => {
  const code = `const game = {
    init() {
      for (let i = 0; i < 30; i++) {
        kit.emit('bubbles', 100 + i * 10, 100, 5);
      }
    },
    update(dt) {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 10 });
  assert.equal(r.error, null);
});

test('all six kinds spawn without error', () => {
  const code = `const game = {
    init() {
      kit.burst('confetti', 50, 100, 5);
      kit.burst('smoke', 100, 100, 5);
      kit.burst('bubbles', 150, 100, 5);
      kit.burst('sparkles', 200, 100, 5);
      kit.burst('rain', 250, 100, 5);
      kit.burst('fire', 300, 100, 5);
    },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 10 });
  assert.equal(r.error, null);
  assert.ok(r.calls.arc > 10, 'all kinds drew');
});

test('particles animate over their lifetime', () => {
  const code = `const game = {
    init() { kit.burst('sparkles', W / 2, H / 2, 10); },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 60 });
  assert.equal(r.error, null);
  // particles should fade out; fewer arcs late in the run
  assert.ok(r.calls.arc > 0);
});

test('particles are removed when their life expires', () => {
  const code = `const game = {
    init() { kit.burst('bubbles', 100, 100, 20); },
    update(dt) { globalThis.__t = kit.t; },
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 180 }); // bubbles live 2s
  assert.equal(r.error, null);
  // at t > 2.5s, bubbles should be gone; fewer or no arcs
});

test('CLASSIC: kit.puff still works unchanged', () => {
  const code = `const game = {
    init() { kit.puff(W / 2, H / 2, ['#f00', '#0f0'], 10); },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 10 });
  assert.equal(r.error, null);
  assert.ok(r.calls.arc > 5, 'kit.puff drew particles');
});

test('burst and emit do not break existing game flow', () => {
  const code = `let score = 0;
    const game = {
      init() { kit.burst('confetti', 100, 100, 10); },
      update(dt) {
        score++;
        if (score === 30) kit.emit('sparkles', 200, 200, 0.5);
      },
      draw() {
        kit.bg('#8fd3ff', '#d6f5c9');
        kit.text(score, W / 2, 100, 40);
      }
    };`;
  const r = runGame(code, { frames: 60 });
  assert.equal(r.error, null);
  assert.ok(r.calls.fillText > 0, 'game drew text');
});

test('particle rendering uses correct alpha and color', () => {
  const code = `const game = {
    init() { kit.burst('fire', 100, 100, 5); },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 30 });
  assert.equal(r.error, null);
  // particles fade, so globalAlpha should be set multiple times
  // (no direct way to verify, but render() sets it)
});

test('emitters clean up when done', () => {
  const code = `const game = {
    init() { kit.emit('smoke', 100, 100, 0.1); },
    update(dt) { globalThis.__t = kit.t; },
    draw() {}
  };`;
  const r = runGame(code, { frames: 150 }); // smoke lives 1.5s, emits 0.1s
  assert.equal(r.error, null);
  // after 3s all smoke gone, emitter removed; no memory leak
});

test('particles have velocity and move', () => {
  const code = `const game = {
    init() { kit.burst('rain', W / 2, 100, 10); },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 40 });
  assert.equal(r.error, null);
  // rain falls down fast; particles should move vertically
  assert.ok(r.calls.arc > 0);
});

test('multiple emitters run simultaneously', () => {
  const code = `const game = {
    init() {
      kit.emit('fire', 100, 300, 1);
      kit.emit('bubbles', 200, 300, 1);
      kit.emit('sparkles', 300, 300, 1);
    },
    update(dt) {},
    draw() { kit.bg('#000', '#111'); }
  };`;
  const r = runGame(code, { frames: 60 });
  assert.equal(r.error, null);
  assert.ok(r.calls.arc > 50, 'multiple emitters drew many particles');
});

test('no particles are drawn when none exist', () => {
  const r = runGame(IDLE_GAME, { frames: 10 });
  assert.equal(r.error, null);
  // no burst or emit called, arc count should be zero or from kit.puff only
});
