/* 35-platform: falls onto a floor and rests; runs up to top speed and brakes; jumps with a cut, coyote time and a buffer; walls stop; junk is harmless. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

const WORLD = `const floor = { x: 0, y: 500, w: 390, h: 40 }, wall = { x: 300, y: 300, w: 40, h: 200 }, ledge = { x: 100, y: 420, w: 60, h: 10, oneWay: true };
  const p = { x: 50, y: 100, w: 24, h: 32, vx: 0, vy: 0 }; globalThis.__p = p;`;
const GROUNDED = WORLD.replace('y: 100, w: 24', 'y: 468, w: 24');

test('a body falls, lands on the floor and rests there', () => {
  const r = runGame(WORLD + `const game = { update(dt) { kit.platform(p, [floor, wall, ledge], dt, { left: false, right: false, jump: false, jumpHeld: false }); }, draw() {} };`, { frames: 120 });
  assert.equal(r.error, null);
  const p = r.ctx.__p; assert.equal(Math.round(p.y + p.h), 500); assert.equal(p.vy, 0); assert.equal(p.onGround, true);
});

test('running builds to top speed and braking bites', () => {
  const code = WORLD + `let t = 0; const game = { update(dt) { t += dt; kit.platform(p, [floor], dt, { right: t < 4, left: t >= 4, jump: false, jumpHeld: false }); if (t < 4) globalThis.__top = Math.max(globalThis.__top || 0, p.vx); else if (globalThis.__brake === undefined && p.vx <= 0) globalThis.__brake = t - 4; }, draw() {} };`;
  const r = runGame(code, { frames: 330 });
  assert.equal(r.error, null);
  assert.ok(Math.abs(r.ctx.__top - 360 * .8) < 1, 'top speed ' + r.ctx.__top);
  assert.ok(r.ctx.__brake < .4, 'brake time ' + r.ctx.__brake);
});

test('a tapped jump is lower than a held jump', () => {
  const run = (hold) => runGame(GROUNDED + `let t = 0, top = 1e9; const game = { update(dt) { t += dt; kit.platform(p, [floor], dt, { jump: t > 1 && t < 1 + dt * 1.5, jumpHeld: ${hold} ? (t > 1 && t < 1.6) : (t > 1 && t < 1.05) }); top = Math.min(top, p.y); globalThis.__top = top; }, draw() {} };`, { frames: 140 });
  const held = run(true), tapped = run(false);
  assert.equal(held.error, null);
  assert.ok(tapped.ctx.__top > held.ctx.__top + 20, `tap ${tapped.ctx.__top} vs hold ${held.ctx.__top}`);
});

test('coyote time: a jump just after walking off a ledge still happens', () => {
  const code = `const ledge = { x: 0, y: 300, w: 100, h: 20 }, p = { x: 70, y: 268, w: 24, h: 32, vx: 0, vy: 0, onGround: true }; globalThis.__p = p; let t = 0, off = null;
    const game = { update(dt) { t += dt; const j = off !== null && t - off > 0.05 && t - off < 0.05 + dt * 1.5; kit.platform(p, [ledge], dt, { right: off === null, jump: j, jumpHeld: j }); if (off === null && !p.onGround) off = t; if (p.jumped) globalThis.__jumped = true; }, draw() {} };`;
  const r = runGame(code, { frames: 90 });
  assert.equal(r.error, null); assert.equal(r.ctx.__jumped, true);
});

test('walls stop you, one-way ledges catch you from above only', () => {
  const code = WORLD + `let t = 0; const game = { update(dt) { t += dt; kit.platform(p, [floor, wall, ledge], dt, { right: true, jump: false, jumpHeld: false }); if (p.hitWall) globalThis.__wall = p.x + p.w; }, draw() {} };`;
  const r = runGame(code, { frames: 240 });
  assert.equal(r.error, null); assert.equal(Math.round(r.ctx.__wall), 300);
  const up = runGame(`const ledge = { x: 0, y: 300, w: 200, h: 10, oneWay: true }, p = { x: 50, y: 330, w: 24, h: 32, vx: 0, vy: -400 }; globalThis.__p = p;
    const game = { update(dt) { kit.platform(p, [ledge], dt, { jump: false, jumpHeld: true }); globalThis.__min = Math.min(globalThis.__min ?? 1e9, p.y); }, draw() {} };`, { frames: 60 });
  assert.ok(up.ctx.__min < 300, 'passed up through the one-way ledge');
});

test('junk is harmless', () => {
  const r = runGame(`const game = { update(dt) { kit.platform(null); kit.platform({}, 'nope', NaN, 7); kit.platform({ x: 'a', y: null, w: -1 }, [null, 3, { x: 0 }], dt); globalThis.__ok = true; }, draw() {} };`, { frames: 3 });
  assert.equal(r.error, null); assert.equal(r.ctx.__ok, true);
});
