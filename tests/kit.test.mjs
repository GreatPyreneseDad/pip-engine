/* CLASSIC (gen 1) behaviour of the kit, pinned. CERATA trials must keep these green. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runGame, IDLE_GAME } from './harness.mjs';
import { frameDoc, encodeSource } from '../src/frame.mjs';

test('a valid game boots and reports ready on frame 3', () => {
  const r = runGame(IDLE_GAME, { frames: 10 });
  assert.equal(r.error, null);
  assert.ok(r.posts.some(p => p.type === 'ready'));
});

test('the contract is enforced: no game object is a readable error', () => {
  const r = runGame('let x = 1;', { frames: 5 });
  assert.match(r.error, /const game = \{ init\(\) \{\}, update\(dt\) \{\}, draw\(\) \{\} \}/);
});

test('syntax errors are reported, not thrown', () => {
  const r = runGame('const game = {', { frames: 5 });
  assert.match(r.error, /while loading the code/);
});

test('runtime errors in update are reported with the frame count', () => {
  const r = runGame('const game = { update() { if (kit.t > 0.1) null.x; }, draw() {} };', { frames: 30 });
  assert.match(r.error, /null/);
  assert.equal(r.posts.find(p => p.type === 'error').frames > 0, true);
});

test('a runaway frame is caught', () => {
  const r = runGame(IDLE_GAME, { frames: 20, slowFrame: 12 });
  assert.match(r.error ?? '', /runaway/);
});

test('kit drawing tolerates junk input without throwing', () => {
  const code = `const game = { update() {}, draw() {
    kit.sprite('nonsense', NaN, 10, -5); kit.sprite('fox', 100, 100, 80, { t: kit.t, flip: true, rot: 1, alpha: 7 });
    kit.item('nothing', 1, 2); kit.item('star', 50, 50, 40); kit.prop('nope', 1, 1); kit.prop('tree', 100, 400);
    kit.emoji(null, Infinity, 0); kit.emoji('🐸', 100, 100, 60); kit.text(undefined, 10, 10);
    kit.bg('not-a-colour', 42); } };`;
  const r = runGame(code, { frames: 20 });
  assert.equal(r.error, null);
  assert.ok(r.calls.fillText > 0);
});

test('sound and note are throttled to 4 per frame', () => {
  const r = runGame('const game = { update() { for (let i = 0; i < 50; i++) { kit.sound("pop"); kit.note(440, 0.1); } }, draw() {} };', { frames: 3 });
  const perFrame = r.posts.filter(p => p.type === 'sound' || p.type === 'note').length / 3;
  assert.ok(perFrame <= 4, `got ${perFrame}`);
});

test('puff particles are capped at 400 and expire', () => {
  const r = runGame('let n = 0; const game = { update() { if (n++ < 30) kit.puff(100, 100, null, 99); }, draw() {} };', { frames: 40 });
  assert.equal(r.error, null);
  const live = r.ctx.__parts.length;
  assert.ok(live <= 400, `live ${live}`);
  const later = runGame('let n = 0; const game = { update() { if (n++ < 1) kit.puff(100, 100, ["#f00"], 10); }, draw() {} };', { frames: 120 });
  assert.equal(later.ctx.__parts.length, 0);
});

test('win is debounced and say is rate-limited', () => {
  const r = runGame('const game = { update() { kit.win(); kit.say("hooray"); }, draw() {} };', { frames: 60 });
  assert.equal(r.posts.filter(p => p.type === 'win').length, 1);
  assert.equal(r.posts.filter(p => p.type === 'say').length, 1);
});

test('pointer: pressed and released last exactly one frame', () => {
  const code = `let pressed = 0, released = 0, downFrames = 0;
    const game = { update() { if (kit.pointer.pressed) pressed++; if (kit.pointer.released) released++; if (kit.pointer.down) downFrames++;
      globalThis.__p = { pressed, released, downFrames, x: kit.pointer.x, y: kit.pointer.y }; }, draw() {} };`;
  const r = runGame(code, { frames: 20, taps: [{ frame: 5, x: 120, y: 340, hold: 4 }] });
  const p = r.ctx.__p;
  assert.deepEqual([p.pressed, p.released, p.downFrames, p.x, p.y], [1, 1, 4, 120, 340]);
});

test('helpers', () => {
  const r = runGame(IDLE_GAME, { frames: 1 });
  const k = r.ctx.kit;
  assert.equal(k.clamp(5, 0, 3), 3);
  assert.equal(k.lerp(0, 10, 0.25), 2.5);
  assert.equal(k.dist(0, 0, 3, 4), 5);
  assert.equal(k.pick([]), undefined);
  for (let i = 0; i < 100; i++) { const v = k.rand(2, 3); assert.ok(v >= 2 && v < 3); }
});

test('parts (pre) load before game code', () => {
  const r = runGame('const game = { update() { globalThis.__w = wobble(2); }, draw() {} };', { frames: 5, pre: 'function wobble(a) { return a * 2; }' });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__w, 4);
});

test('frameDoc seals the game source inside its script element', () => {
  const evil = 'const game = {}; // </script><script>alert(1)</script> <!--  ';
  const doc = frameDoc({ lib: '/*lib*/', runtime: '/*rt*/', loop: '/*loop*/' }, { code: evil });
  assert.equal(doc.split('</script>').length - 1, 5, 'only the engine closes script tags');
  assert.ok(doc.includes("default-src 'none'"));
  assert.ok(!encodeSource(evil).includes('</'));
});

test('every kit function is documented in the contract', () => {
  const contract = readFileSync(new URL('../api/kit.md', import.meta.url), 'utf8');
  const r = runGame(IDLE_GAME, { frames: 1 });
  const undocumented = Object.keys(r.ctx.kit).filter(k => !k.startsWith('_') && !contract.includes(`kit.${k}`));
  assert.deepEqual(undocumented, [], 'add these to api/kit.md or the model will never use them');
});
