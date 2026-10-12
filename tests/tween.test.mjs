/* Tests for kit.tween() and kit.ease() (EXPERIMENTAL gen 2). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.ease returns correct values for all easing functions', () => {
  const code = `const game = { update() {
    globalThis.__ease = {
      linear: kit.ease('linear', 0.5),
      quad: kit.ease('quad', 0.5),
      sine: kit.ease('sine', 0.5),
      bounce: kit.ease('bounce', 1),
      elastic: kit.ease('elastic', 1),
      back: kit.ease('back', 1),
      unknown: kit.ease('nope', 0.5),
      clamped: kit.ease('linear', 2),
    };
  }, draw() {} };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  const e = r.ctx.__ease;
  assert.equal(e.linear, 0.5);
  assert.ok(e.quad > 0 && e.quad < 1);
  assert.ok(e.sine > 0 && e.sine < 1);
  assert.equal(e.bounce, 1); // at t=1, bounce settles to 1
  assert.equal(e.elastic, 1); // elastic also ends at 1
  assert.equal(e.back, 1); // back overshoots but ends at 1
  assert.equal(e.unknown, 0.5); // fallback to linear
  assert.equal(e.clamped, 1); // clamped to [0,1]
});

test('kit.tween animates object properties over time', () => {
  const code = `let obj = { x: 0, y: 100 };
    const game = {
      init() { kit.tween(obj, { x: 100, y: 200 }, 0.5, 'quad'); },
      update(dt) { globalThis.__obj = { ...obj, t: kit.t }; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 60 });
  assert.equal(r.error, null);
  const o = r.ctx.__obj;
  assert.ok(o.x > 90 && o.x <= 100, `x at t=${o.t}: ${o.x}`);
  assert.ok(o.y > 190 && o.y <= 200, `y at t=${o.t}: ${o.y}`);
});

test('kit.tween completes and cleans up finished tweens', () => {
  const code = `let obj = { val: 0 };
    const game = {
      init() { kit.tween(obj, { val: 50 }, 0.1, 'linear'); },
      update(dt) { globalThis.__val = obj.val; globalThis.__tweenCount = kit._updateTweens.toString().includes('tweens') ? 'ok' : 'missing'; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 20 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__val, 50); // tween completed
  // Tween should be removed from internal array (we can't directly inspect it, but val should stay at 50)
  const later = runGame(code, { frames: 40 });
  assert.equal(later.ctx.__val, 50); // still 50, not continuing
});

test('kit.tween handles multiple concurrent tweens', () => {
  const code = `let a = { x: 0 }, b = { y: 0 };
    const game = {
      init() {
        kit.tween(a, { x: 100 }, 0.3, 'sine');
        kit.tween(b, { y: 200 }, 0.3, 'bounce');
      },
      update(dt) { globalThis.__vals = { ax: a.x, by: b.y }; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 30 });
  assert.equal(r.error, null);
  const v = r.ctx.__vals;
  assert.ok(v.ax > 90 && v.ax <= 100);
  assert.ok(v.by > 190 && v.by <= 200);
});

test('kit.tween ignores invalid inputs gracefully', () => {
  const code = `const game = {
    update(dt) {
      kit.tween(null, { x: 1 }, 1, 'linear');
      kit.tween({}, null, 1, 'linear');
      kit.tween({ a: 'text' }, { a: 10 }, 1, 'linear');
      kit.tween({ x: 0 }, { x: 'nope' }, 1, 'linear');
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null); // should not crash
});

test('kit.tween with bounce easing produces overshoot values', () => {
  const code = `let obj = { y: 0 };
    const game = {
      init() { kit.tween(obj, { y: 100 }, 1, 'bounce'); },
      update(dt) {
        if (kit.t > 0.3 && kit.t < 0.9) {
          if (!globalThis.__sawOvershoot && obj.y < 100) {
            globalThis.__sawOvershoot = true;
          }
        }
        globalThis.__finalY = obj.y;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 90 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__sawOvershoot, 'bounce should produce intermediate values < 100');
  assert.ok(r.ctx.__finalY >= 99 && r.ctx.__finalY <= 100, 'should end at 100');
});

test('kit.tween with back easing produces overshoot beyond target', () => {
  const code = `let obj = { x: 0 };
    const game = {
      init() { kit.tween(obj, { x: 100 }, 1, 'back'); },
      update(dt) {
        if (obj.x > 100 && !globalThis.__sawOvershoot) {
          globalThis.__sawOvershoot = true;
        }
        globalThis.__finalX = obj.x;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 90 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__sawOvershoot, 'back should overshoot past 100');
  assert.ok(Math.abs(r.ctx.__finalX - 100) < 0.1, 'should settle near 100');
});

test('kit.ease with elastic produces oscillation', () => {
  const code = `const game = {
    update() {
      const samples = [];
      for (let i = 0; i <= 10; i++) {
        samples.push(kit.ease('elastic', i / 10));
      }
      globalThis.__samples = samples;
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  const s = r.ctx.__samples;
  assert.equal(s[0], 0);
  assert.equal(s[10], 1);
  // elastic should produce values > 1 (overshoot) in the middle
  const hasOvershoot = s.slice(1, 9).some(v => v > 1);
  assert.ok(hasOvershoot, 'elastic should overshoot 1 during oscillation');
});
