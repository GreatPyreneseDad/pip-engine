/* Tests for easing functions (EXPERIMENTAL gen 2). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backOut, bounceOut, elasticOut, sineInOut, quadInOut } from '../src/ease.js';

test('backOut overshoots then settles', () => {
  assert.equal(backOut(0), 0);
  assert.equal(backOut(1), 1);
  assert.ok(backOut(0.9) > 1, 'overshoots at 0.9');
  assert.ok(backOut(0.95) > 1, 'still overshoots at 0.95');
  assert.ok(backOut(0.99) < 1.05, 'settles back near 1');
});

test('bounceOut bounces diminishingly', () => {
  assert.equal(bounceOut(0), 0);
  assert.equal(bounceOut(1), 1);
  // first bounce peak around v=0.5
  const mid = bounceOut(0.5);
  assert.ok(mid > 0.7 && mid < 1, `mid bounce ${mid}`);
  // monotonic in final segment
  assert.ok(bounceOut(0.95) < bounceOut(0.98));
});

test('elasticOut oscillates and settles', () => {
  assert.equal(elasticOut(0), 0);
  assert.equal(elasticOut(1), 1);
  // should oscillate around 1 near the end
  const vals = [0.8, 0.85, 0.9, 0.95].map(elasticOut);
  const crossesOne = vals.some(v => v < 1) && vals.some(v => v > 1);
  assert.ok(crossesOne, 'oscillates around target');
});

test('sineInOut is smooth S-curve', () => {
  assert.equal(sineInOut(0), 0);
  assert.equal(sineInOut(1), 1);
  assert.equal(sineInOut(0.5), 0.5);
  // derivative at 0 and 1 should be near zero (slow start/end)
  const d0 = sineInOut(0.01) - sineInOut(0);
  const d1 = sineInOut(1) - sineInOut(0.99);
  assert.ok(d0 < 0.02, 'slow start');
  assert.ok(d1 < 0.02, 'slow end');
});

test('quadInOut accelerates then decelerates', () => {
  assert.equal(quadInOut(0), 0);
  assert.equal(quadInOut(1), 1);
  assert.equal(quadInOut(0.5), 0.5);
  // first half accelerates
  assert.ok(quadInOut(0.25) < 0.25);
  // second half decelerates
  assert.ok(quadInOut(0.75) > 0.75);
});

test('easing functions clamp edge cases gracefully', () => {
  // functions should not NaN or throw on edge inputs
  for (const fn of [backOut, bounceOut, elasticOut, sineInOut, quadInOut]) {
    assert.ok(isFinite(fn(0)));
    assert.ok(isFinite(fn(1)));
    assert.ok(isFinite(fn(0.5)));
  }
});
