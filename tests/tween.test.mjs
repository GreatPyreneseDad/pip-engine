/* Tests for kit.tween and kit.ease (EXPERIMENTAL gen 2). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.ease applies easing curves to manual input', () => {
  const code = `const game = { init() {
    globalThis.__eased = {
      linear: kit.ease(0.5, 'linear'),
      sine: kit.ease(0.5, 'sineInOut'),
      bounce: kit.ease(1, 'bounceOut'),
      unknown: kit.ease(0.5, 'nope'),
      clamped: kit.ease(1.5, 'quadInOut'),
    };
  }, update() {}, draw() {} };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  const e = r.ctx.__eased;
  assert.equal(e.linear, 0.5);
  assert.equal(e.sine, 0.5);
  assert.equal(e.bounce, 1);
  assert.equal(e.unknown, 0.5, 'unknown easing falls back to input');
  assert.equal(e.clamped, 1, 'clamps to [0,1]');
});

test('kit.tween completes a simple tween', () => {
  const code = `const obj = { x: 0, y: 100 };
    const game = { init() { kit.tween(obj, { x: 200 }, 0.3, 'linear'); }, update(dt) { globalThis.__obj = obj; }, draw() {} };`;
  const r = runGame(code, { frames: 30, dt: 1/60 });
  assert.equal(r.error, null);
  const obj = r.ctx.__obj;
  assert.ok(obj.x > 190 && obj.x <= 200, `x=${obj.x}`);
  assert.equal(obj.y, 100, 'untweened property unchanged');
});

test('kit.tween handles zero duration (instant set)', () => {
  const code = `const obj = { x: 0 };
    const game = { init() { kit.tween(obj, { x: 50 }, 0); }, update() { globalThis.__x = obj.x; }, draw() {} };`;
  const r = runGame(code, { frames: 3 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__x, 50);
});

test('re-tweening the same object cancels the previous tween', () => {
  const code = `const obj = { x: 0 };
    let frame = 0;
    const game = { init() { kit.tween(obj, { x: 100 }, 1, 'linear'); },
      update(dt) { frame++; if (frame === 10) kit.tween(obj, { x: 200 }, 1, 'linear'); globalThis.__x = obj.x; }, draw() {} };`;
  const r = runGame(code, { frames: 70, dt: 1/60 });
  assert.equal(r.error, null);
  // after 70 frames at 1/60, second tween (started at frame 10) should complete
  assert.ok(r.ctx.__x > 190 && r.ctx.__x <= 200, `x=${r.ctx.__x}`);
});

test('kit.tween ignores non-numeric properties', () => {
  const code = `const obj = { x: 0, name: 'test', arr: [1, 2] };
    const game = { init() { kit.tween(obj, { x: 10, name: 'new', arr: [3, 4], missing: 5 }, 0.1); },
      update() { globalThis.__obj = obj; }, draw() {} };`;
  const r = runGame(code, { frames: 10 });
  assert.equal(r.error, null);
  const obj = r.ctx.__obj;
  assert.ok(obj.x > 5);
  assert.equal(obj.name, 'test', 'string unchanged');
  assert.deepEqual(obj.arr, [1, 2], 'array unchanged');
  assert.equal(obj.missing, undefined, 'missing prop not added');
});

test('kit.tween applies easing curves', () => {
  const code = `const obj = { x: 0 };
    const game = { init() { kit.tween(obj, { x: 100 }, 1, 'quadInOut'); }, update() { globalThis.__x = obj.x; }, draw() {} };`;
  const r = runGame(code, { frames: 30, dt: 1/60 }); // 30 frames = 0.5s
  assert.equal(r.error, null);
  // quadInOut at t=0.5 should be 0.5, so x should be near 50
  assert.ok(r.ctx.__x > 45 && r.ctx.__x < 55, `x=${r.ctx.__x}`);
});

test('kit.tween tolerates bad input gracefully', () => {
  const code = `const game = { init() {
    kit.tween(null, { x: 10 }, 1);
    kit.tween({ x: 0 }, null, 1);
    kit.tween({ x: 0 }, { x: 10 }, -5);
    kit.tween({ x: 0 }, { x: 'bad' }, 1);
  }, update() {}, draw() {} };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null, 'no crash on bad input');
});

test('tween soft cap at 200 concurrent tweens', () => {
  const code = `const objs = [];
    const game = { init() {
      for (let i = 0; i < 250; i++) {
        const obj = { x: 0 };
        objs.push(obj);
        kit.tween(obj, { x: 100 }, 10);
      }
    }, update() { globalThis.__tweens = objs.filter(o => o.x > 0 && o.x < 100).length; }, draw() {} };`;
  const r = runGame(code, { frames: 10 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__tweens <= 200, `live tweens ${r.ctx.__tweens}`);
});

test('example: frog hopping with bounceOut', () => {
  const code = `const frog = { x: 100, y: 400, hop: 0 };
    const game = { init() {}, update(dt) {
      if (kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, frog.x, frog.y - 40) < 70) {
        frog.hop = 1;
        kit.tween(frog, { hop: 0 }, 0.6, 'bounceOut');
      }
      globalThis.__frog = frog;
    }, draw() {} };`;
  const r = runGame(code, { frames: 50, taps: [{ frame: 5, x: 100, y: 360 }], dt: 1/60 });
  assert.equal(r.error, null);
  const frog = r.ctx.__frog;
  assert.ok(frog.hop >= 0 && frog.hop < 0.2, `hop=${frog.hop}, should be near 0 after bounceOut`);
});
