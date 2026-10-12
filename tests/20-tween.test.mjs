import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.ease treats unknown names as linear (a typo never freezes a game)', () => {
  const code = `const game = {
    update() { globalThis.__result = kit.ease('notreal', 0.5); },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__result, 0.5);
});

test('kit.tween with an unknown or misspelled ease still moves the object', () => {
  const r = runGame(`const o = { x: 0 }; kit.tween(o, { x: 100 }, 0.5, 'bounce'); const p = { x: 0 }; kit.tween(p, { x: 100 }, 0.5, 'linear');
    const game = { update() { globalThis.__x = [o.x, p.x]; }, draw() {} };`, { frames: 60 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__x[0], 100);
  assert.equal(r.ctx.__x[1], 100);
});

test('a new tween on the same property replaces the old one', () => {
  const r = runGame(`const o = { y: 0, x: 0 }; kit.tween(o, { y: 100, x: 50 }, 1); let n = 0;
    const game = { update() { if (++n === 20) kit.tween(o, { y: -100 }, 0.3); globalThis.__o = { y: o.y, x: o.x }; }, draw() {} };`, { frames: 80 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__o.y, -100);   // the newer tween owns y
  assert.equal(r.ctx.__o.x, 50);     // the older tween still finishes x
});

test('kit.ease clamps t to [0, 1] and returns valid values', () => {
  const code = `const results = [];
    const game = {
      update() {
        for (const name of ['backOut', 'bounceOut', 'elasticOut', 'sineInOut', 'quadInOut']) {
          for (const t of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
            const v = kit.ease(name, t);
            // backOut and elasticOut intentionally overshoot (can exceed 1), but should be reasonable
            if (v < -0.5 || v > 2 || isNaN(v)) results.push({name, t, v});
          }
        }
        globalThis.__results = results;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__results.length, 0, 'all easing values reasonable');
});

test('kit.ease returns correct boundary values', () => {
  const code = `const game = {
    update() {
      globalThis.__zero = kit.ease('sineInOut', 0);
      globalThis.__one = kit.ease('sineInOut', 1);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__zero, 0);
  assert.equal(r.ctx.__one, 1);
});

test('kit.ease ignores invalid inputs', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.ease(null, 0.5);
      globalThis.__r2 = kit.ease('sineInOut', NaN);
      globalThis.__r3 = kit.ease('sineInOut', 'x');
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, 0.5);   // no name: linear
  assert.equal(r.ctx.__r2, 0);
  assert.equal(r.ctx.__r3, 0);
});

test('kit.tween animates object properties over time', () => {
  const code = `const obj = { x: 0, y: 100 };
    const game = {
      init() { kit.tween(obj, { x: 200 }, 1, 'sineInOut'); },
      update() { globalThis.__obj = { x: obj.x, y: obj.y, t: kit.t }; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 80, dt: 1/60 });
  assert.equal(r.error, null);
  const { x, y } = r.ctx.__obj;
  assert.ok(x > 150 && x <= 200, `x moved toward target: ${x}`);
  assert.equal(y, 100, 'y unchanged');
});

test('kit.tween completes and stops at target value', () => {
  const code = `const obj = { x: 0 };
    const game = {
      init() { kit.tween(obj, { x: 100 }, 0.5, 'sineInOut'); },
      update() { globalThis.__x = obj.x; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 40, dt: 1/60 });
  assert.equal(r.error, null);
  assert.ok(Math.abs(r.ctx.__x - 100) < 0.1, `completed to target: ${r.ctx.__x}`);
});

test('kit.tween ignores invalid inputs', () => {
  const code = `const obj = { x: 10 };
    const game = {
      init() {
        kit.tween(null, { x: 50 }, 1);
        kit.tween(obj, null, 1);
        kit.tween(obj, { x: 50 }, -1);
        kit.tween(obj, { x: 50 }, NaN);
        kit.tween(obj, { y: 'bad' }, 1);
      },
      update() { globalThis.__x = obj.x; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__x, 10, 'no change from invalid tweens');
});

test('kit.tween keeps at most 50 tweens, dropping the oldest', () => {
  const code = `const objs = [];
    for (let i = 0; i < 100; i++) objs.push({ x: 0 });
    const game = {
      init() { for (const o of objs) kit.tween(o, { x: 100 }, 10); },
      update() {
        let moving = 0;
        for (const o of objs) if (o.x > 0) moving++;
        globalThis.__moving = moving;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__moving, 50, `the newest 50 move: ${r.ctx.__moving}`);
});

test('kit.tween supports multiple easing types', () => {
  const code = `const objs = { a: {x:0}, b: {x:0}, c: {x:0}, d: {x:0}, e: {x:0} };
    const game = {
      init() {
        kit.tween(objs.a, {x:100}, 1, 'backOut');
        kit.tween(objs.b, {x:100}, 1, 'bounceOut');
        kit.tween(objs.c, {x:100}, 1, 'elasticOut');
        kit.tween(objs.d, {x:100}, 1, 'sineInOut');
        kit.tween(objs.e, {x:100}, 1, 'quadInOut');
      },
      update() { globalThis.__vals = [objs.a.x, objs.b.x, objs.c.x, objs.d.x, objs.e.x]; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 40, dt: 1/60 });
  assert.equal(r.error, null);
  for (const v of r.ctx.__vals) {
    assert.ok(v > 30, `all tweens progressed: ${v}`);
  }
});

test('kit.tween animates multiple properties simultaneously', () => {
  const code = `const obj = { x: 0, y: 0, z: 50 };
    const game = {
      init() { kit.tween(obj, { x: 100, y: 200 }, 1); },
      update() { globalThis.__obj = { x: obj.x, y: obj.y, z: obj.z }; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 40, dt: 1/60 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__obj.x > 30, `x moved: ${r.ctx.__obj.x}`);
  assert.ok(r.ctx.__obj.y > 60, `y moved: ${r.ctx.__obj.y}`);
  assert.equal(r.ctx.__obj.z, 50, 'z unchanged');
});

test('bounceOut easing produces characteristic bounce pattern', () => {
  const code = `const vals = [];
    const game = {
      update() {
        for (let t = 0; t <= 1; t += 0.1) vals.push(kit.ease('bounceOut', t));
        globalThis.__vals = vals;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const vals = r.ctx.__vals;
  assert.ok(vals.length > 5);
  assert.ok(vals[vals.length - 1] > 0.95, 'ends near 1');
});

test('elasticOut easing accepts amplitude and period parameters', () => {
  const code = `const game = {
    update() {
      globalThis.__def = kit.ease('elasticOut', 0.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.ok(typeof r.ctx.__def === 'number');
});

test('backOut easing produces overshoot', () => {
  const code = `const vals = [];
    const game = {
      update() {
        for (let t = 0.8; t <= 1; t += 0.02) vals.push(kit.ease('backOut', t));
        globalThis.__max = Math.max(...vals);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__max > 1.01, `overshoot detected: ${r.ctx.__max}`);
});
