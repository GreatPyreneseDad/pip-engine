/* 10-input: keyboard through host messages, drag/heldFor, touch controls off by default. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('keys arrive through the host relay and read as held, pressed, released', () => {
  const code = `let log = []; kit._onTick(() => {});
    const game = { update() { if (kit.pressed('right')) log.push('pressed'); if (kit.key('right')) log.push('held'); if (kit.released('right')) log.push('released'); globalThis.__log = log; }, draw() {} };`;
  const r = runGame(code, { frames: 6, events: [{ frame: 1, type: 'message', data: { gm: 1, type: 'key', key: 'ArrowRight', down: true } }, { frame: 3, type: 'message', data: { gm: 1, type: 'key', key: 'ArrowRight', down: false } }] });
  assert.equal(r.error, null);
  assert.equal(JSON.stringify(r.ctx.__log), JSON.stringify(['pressed', 'held', 'held', 'released']));
});

test('kit.axis combines arrows and WASD; junk key names are harmless', () => {
  const code = `const game = { update() { globalThis.__a = kit.axis(); globalThis.__j = [kit.key(null), kit.key(42), kit.pressed(undefined)]; }, draw() {} };`;
  const r = runGame(code, { frames: 3, events: [{ frame: 0, type: 'keydown', key: 'a' }, { frame: 0, type: 'keydown', key: 'ArrowUp' }] });
  assert.equal(r.error, null);
  assert.equal(JSON.stringify(r.ctx.__a), JSON.stringify({ x: -1, y: -1 }));
  assert.equal(JSON.stringify(r.ctx.__j), JSON.stringify([false, false, false]));
});

test('a held pointer reports heldFor and a drag vector; releasing clears both', () => {
  const code = `const game = { update() { globalThis.__d = { h: kit.pointer.heldFor, a: kit.drag.active, dx: kit.drag.dx }; }, draw() {} };`;
  const r = runGame(code, { frames: 30, taps: [{ frame: 2, x: 100, y: 400, hold: 20 }], events: [{ frame: 10, type: 'pointermove', x: 160, y: 400 }] });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__d.a, false);
  assert.equal(r.ctx.__d.h, 0);
  const mid = runGame(code, { frames: 12, taps: [{ frame: 2, x: 100, y: 400, hold: 20 }], events: [{ frame: 10, type: 'pointermove', x: 160, y: 400 }] });
  assert.ok(mid.ctx.__d.a === true && mid.ctx.__d.h > 0.1 && mid.ctx.__d.dx === 60);
});

test('touch controls are off by default and kit.touchControls ignores junk', () => {
  const code = `kit.touchControls('nonsense'); kit.touchControls(null); const game = { update() { globalThis.__s = [kit.touch, kit.safeBottom]; }, draw() {} };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(JSON.stringify(r.ctx.__s), JSON.stringify([false, 0]));
});

test('kit.approach moves toward the target and never overshoots', () => {
  const code = `let v = 0; const game = { update(dt) { v = kit.approach(v, 10, 100, dt); globalThis.__v = [v, kit.approach(5, 5, NaN, dt), kit.approach('x', 1, 1, 1)]; }, draw() {} };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__v[0], 10); assert.equal(r.ctx.__v[1], 5); assert.equal(r.ctx.__v[2], 1);
});
