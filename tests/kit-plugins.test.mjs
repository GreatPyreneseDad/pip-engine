/* The extension point: src/kit/*.js plugins load after the runtime, and kit._onTick runs every frame. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGame, runtimeSource, SOURCES } from './harness.mjs';

test('tick hooks run after update and before draw, every frame', () => {
  const code = `const order = []; kit._onTick(dt => order.push('tick'));
    const game = { update() { order.push('update'); }, draw() { order.push('draw'); globalThis.__order = order.slice(0, 6); } };`;
  const r = runGame(code, { frames: 4 });
  assert.equal(r.error, null);
  assert.equal(JSON.stringify(r.ctx.__order), JSON.stringify(['update', 'tick', 'draw', 'update', 'tick', 'draw']));
});

test('a throwing tick hook is reported like any game error', () => {
  const r = runGame('kit._onTick(() => { throw new Error("boom"); }); const game = { update() {}, draw() {} };', { frames: 3 });
  assert.match(r.error, /boom/);
});

test('_onTick ignores junk and is capped', () => {
  const r = runGame('kit._onTick(null); kit._onTick(42); for (let i = 0; i < 100; i++) kit._onTick(() => {}); const game = { update() {}, draw() {} };', { frames: 3 });
  assert.equal(r.error, null);
});

test('plugins in src/kit/ are appended to the runtime in name order', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pip-'));
  mkdirSync(join(dir, 'src/kit'), { recursive: true });
  writeFileSync(join(dir, 'src/runtime.js'), '/*rt*/');
  writeFileSync(join(dir, 'src/kit/20-b.js'), '/*b*/');
  writeFileSync(join(dir, 'src/kit/10-a.js'), '/*a*/');
  writeFileSync(join(dir, 'src/kit/README.md'), 'not code');
  const src = runtimeSource(dir);
  assert.ok(src.indexOf('/*rt*/') < src.indexOf('/*a*/') && src.indexOf('/*a*/') < src.indexOf('/*b*/'));
  assert.ok(!src.includes('not code'));
  assert.ok(SOURCES.runtime.startsWith(runtimeSource().slice(0, 50)));
});
