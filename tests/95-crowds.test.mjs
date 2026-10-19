import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.near returns items within radius', () => {
  const code = `const items = [
    { x: 100, y: 100 },
    { x: 110, y: 110 },
    { x: 200, y: 200 },
    { x: 105, y: 100 }
  ];
  const game = {
    update() {
      if (!globalThis.__done) {
        globalThis.__near = kit.near(items, 100, 100, 20);
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__near.length, 3); // 100,100 itself, 110,110 (dist ~14), 105,100 (dist 5); not 200,200
});

test('kit.near returns empty array for no matches', () => {
  const code = `const items = [{ x: 500, y: 500 }];
  const game = {
    update() { 
      if (!globalThis.__done) {
        globalThis.__near = kit.near(items, 100, 100, 10);
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__near.length, 0);
});

test('kit.near ignores invalid items', () => {
  const code = `const items = [
    { x: 100, y: 100 },
    null,
    { x: 'bad', y: 100 },
    { x: 110, y: NaN },
    { y: 100 },
    { x: 105, y: 105 }
  ];
  const game = {
    update() { 
      if (!globalThis.__done) {
        globalThis.__near = kit.near(items, 100, 100, 20);
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__near.length, 2); // 100,100 and 105,105
});

test('kit.near handles invalid inputs gracefully', () => {
  const code = `const items = [{ x: 100, y: 100 }];
  const game = {
    update() {
      if (!globalThis.__done) {
        globalThis.__r1 = kit.near(null, 100, 100, 10);
        globalThis.__r2 = kit.near(items, NaN, 100, 10);
        globalThis.__r3 = kit.near(items, 100, 100, -5);
        globalThis.__r4 = kit.near(items, 100, 100, NaN);
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.ok(Array.isArray(r.ctx.__r1) && r.ctx.__r1.length === 0);
  assert.ok(Array.isArray(r.ctx.__r2) && r.ctx.__r2.length === 0);
  assert.ok(Array.isArray(r.ctx.__r3) && r.ctx.__r3.length === 0);
  assert.ok(Array.isArray(r.ctx.__r4) && r.ctx.__r4.length === 0);
});

test('kit.near respects MAX_OBJECTS limit', () => {
  const code = `const items = [];
  for (let i = 0; i < 250; i++) items.push({ x: 100, y: 100 });
  const game = {
    update() { 
      if (!globalThis.__done) {
        globalThis.__near = kit.near(items, 100, 100, 50);
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__near.length, 0, 'too many items, returns empty');
});

test('kit.pairs calls fn for overlapping circles', () => {
  const code = `const items = [
    { x: 100, y: 100, r: 20 },
    { x: 115, y: 100, r: 20 },
    { x: 200, y: 200, r: 10 }
  ];
  const pairs = [];
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, (a, b) => pairs.push([a.x, b.x]));
        globalThis.__pairs = pairs;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__pairs.length, 1, 'first two overlap, third is far');
  assert.equal(JSON.stringify(r.ctx.__pairs[0].sort()), JSON.stringify([100, 115]));
});

test('kit.pairs treats missing r as 0', () => {
  const code = `const items = [
    { x: 100, y: 100 },
    { x: 100, y: 100 }
  ];
  const pairs = [];
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, (a, b) => pairs.push(1));
        globalThis.__count = pairs.length;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 1, 'same position, both r=0, they touch');
});

test('kit.pairs ignores invalid items', () => {
  const code = `const items = [
    { x: 100, y: 100, r: 10 },
    null,
    { x: 'bad', y: 100, r: 10 },
    { x: 110, y: NaN, r: 10 },
    { y: 100, r: 10 },
    { x: 105, y: 100, r: 10 }
  ];
  const pairs = [];
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, (a, b) => pairs.push([a.x, b.x]));
        globalThis.__pairs = pairs;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__pairs.length, 1, 'only valid pair is 100,100 and 105,100');
});

test('kit.pairs handles invalid inputs gracefully', () => {
  const code = `const items = [{ x: 100, y: 100, r: 10 }];
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(null, () => {});
        kit.pairs(items, null);
        kit.pairs(items, 'notafunc');
        globalThis.__ok = true;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__ok, true, 'no crashes');
});

test('kit.pairs respects MAX_OBJECTS limit', () => {
  const code = `const items = [];
  for (let i = 0; i < 250; i++) items.push({ x: i, y: i, r: 5 });
  let called = false;
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, () => { called = true; });
        globalThis.__called = called;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__called, false, 'too many items, fn never called');
});

test('kit.pairs does not call fn for non-overlapping circles', () => {
  const code = `const items = [
    { x: 100, y: 100, r: 10 },
    { x: 200, y: 100, r: 10 }
  ];
  let called = false;
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, () => { called = true; });
        globalThis.__called = called;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__called, false, 'circles too far apart');
});

test('kit.pairs handles callback errors without crashing', () => {
  const code = `const items = [
    { x: 100, y: 100, r: 20 },
    { x: 110, y: 100, r: 20 }
  ];
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, () => { throw new Error('kaboom'); });
        globalThis.__ok = true;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__ok, true, 'callback error caught, game continues');
});

test('kit.pairs finds all overlapping pairs in a cluster', () => {
  const code = `const items = [
    { x: 100, y: 100, r: 15 },
    { x: 110, y: 100, r: 15 },
    { x: 105, y: 110, r: 15 }
  ];
  const pairs = [];
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, (a, b) => pairs.push(1));
        globalThis.__count = pairs.length;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 3, 'all three pairs overlap');
});

test('kit.pairs does not modify items permanently', () => {
  const code = `const items = [
    { x: 100, y: 100, r: 10 },
    { x: 110, y: 100, r: 10 }
  ];
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, () => {});
        globalThis.__keys = Object.keys(items[0]).sort();
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.deepEqual(r.ctx.__keys, ['r', 'x', 'y'], 'no __hshgId left behind');
});

test('kit.near works with large radius', () => {
  const code = `const items = [
    { x: 100, y: 100 },
    { x: 300, y: 300 }
  ];
  const game = {
    update() { 
      if (!globalThis.__done) {
        globalThis.__near = kit.near(items, 100, 100, 500);
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__near.length, 2, 'both items within large radius');
});

test('kit.pairs handles negative r as 0', () => {
  const code = `const items = [
    { x: 100, y: 100, r: -5 },
    { x: 100, y: 100, r: 10 }
  ];
  let called = false;
  const game = {
    update() {
      if (!globalThis.__done) {
        kit.pairs(items, () => { called = true; });
        globalThis.__called = called;
        globalThis.__done = true;
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__called, true, 'negative r treated as 0, still touching at same position');
});

test('kit.near and kit.pairs work in a realistic crowd scenario', () => {
  const code = `const bunnies = [];
  for (let i = 0; i < 30; i++) bunnies.push({ x: kit.rand(50, 350), y: kit.rand(200, 600), r: 30 });
  let nearCount = 0, pairCount = 0;
  const game = {
    update() {
      if (kit.t < 0.1 && !globalThis.__done) {
        nearCount = kit.near(bunnies, 200, 400, 80).length;
        kit.pairs(bunnies, () => pairCount++);
        globalThis.__near = nearCount;
        globalThis.__pairs = pairCount;
        globalThis.__done = true;
      }
    },
    draw() { kit.bg('#8fd3ff', '#bdf0a8'); }
  };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__near >= 0, 'near count is valid');
  assert.ok(r.ctx.__pairs >= 0, 'pair count is valid');
});
