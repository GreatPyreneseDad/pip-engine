/* 12-draw: shapes draw, junk is ignored, noise is smooth and bounded, score posts once per change. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('shapes reach the canvas and junk input draws nothing and throws nothing', () => {
  const code = `const game = { update() {}, draw() {
    kit.rect(10, 10, 50, 20, '#f00', 4); kit.circle(50, 50, 10, '#0f0'); kit.ellipse(60, 60, 20, 10); kit.ring(50, 50, 20); kit.line(0, 0, 10, 10); kit.poly([[0,0],[10,0],[5,10]]);
    kit.polyline([[0,0],[10,10]]); kit.curve(0,0,5,5,10,0); kit.arc(50,50,10,0,1); kit.label('hi', 10, 10); kit.radial(50,50,40,'#fff'); kit.band(0, 100, '#000', '#fff'); kit.bar(10, 10, 100, 8, 0.5);
    kit.shadow(8, '#000', () => kit.circle(5, 5, 5)); kit.alpha(0.5, () => kit.rect(0,0,5,5));
    kit.rect(NaN, 0, 10, 10); kit.circle(0, 0, -5); kit.poly('nope'); kit.polyline([[0,0]]); kit.curve(); kit.label('x', NaN, 1); kit.bar(0,0,10,10,'junk'); kit.shadow(1, 1, 'nope'); kit.alpha('a');
  } };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.ok(r.calls.fillRect > 0 && r.calls.arc > 0 && r.calls.quadraticCurveTo > 0 && r.calls.fillText > 0 && r.calls.createRadialGradient > 0);
});

test('noise stays in 0..1, is deterministic, smooth, and survives junk', () => {
  const code = `const a = [], b = []; for (let i = 0; i < 200; i++) { a.push(kit.noise(i * 0.05)); b.push(kit.noise(i * 0.05, 3)); }
    globalThis.__n = { min: Math.min(...a, ...b), max: Math.max(...a, ...b), same: kit.noise(1.5) === kit.noise(1.5), step: Math.max(...a.map((v, i) => i ? Math.abs(v - a[i - 1]) : 0)), junk: [kit.noise(NaN), kit.noise('x'), kit.noise()] };
    const game = { update() {}, draw() {} };`;
  const r = runGame(code, { frames: 1 });
  assert.equal(r.error, null);
  const n = r.ctx.__n;
  assert.ok(n.min >= 0 && n.max <= 1 && n.same && n.step < 0.15);
  assert.equal(JSON.stringify(n.junk), JSON.stringify([0.5, 0.5, 0.5]));
});

test('kit.score posts only on change and kit.over at most once a second', () => {
  const code = `let s = 0; const game = { update() { kit.score(s); kit.score(s); if (kit.t > 0.2) s = 5; kit.over(s); kit.over(s); }, draw() {} };`;
  const r = runGame(code, { frames: 30 });
  assert.equal(r.error, null);
  assert.equal(JSON.stringify(r.posts.filter(p => p.type === 'score').map(p => p.score)), JSON.stringify([0, 5]));
  assert.equal(r.posts.filter(p => p.type === 'over').length, 1);
});
