import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.grid creates a grid with get/set', () => {
  const code = `const g = kit.grid(3, 3, 50);
    g.set(1, 1, 'X');
    const game = {
      update() { globalThis.__val = g.get(1, 1); },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__val, 'X');
});

test('kit.grid get returns undefined for out-of-bounds', () => {
  const code = `const g = kit.grid(3, 3, 50);
    const game = {
      update() {
        globalThis.__results = [g.get(-1, 0), g.get(0, -1), g.get(3, 0), g.get(0, 3), g.get(10, 10)];
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  for (const v of r.ctx.__results) {
    assert.equal(v, undefined, 'out of bounds returns undefined');
  }
});

test('kit.grid set ignores out-of-bounds writes', () => {
  const code = `const g = kit.grid(2, 2, 50);
    g.set(-1, 0, 'bad');
    g.set(0, -1, 'bad');
    g.set(2, 0, 'bad');
    g.set(0, 2, 'bad');
    g.set(0, 0, 'ok');
    const game = {
      update() {
        let count = 0;
        g.forEach((v) => { if (v !== undefined) count++; });
        globalThis.__count = count;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 1, 'only the valid write persisted');
});

test('kit.grid cellAt converts screen coords to cell', () => {
  const code = `const g = kit.grid(4, 4, 100);
    const game = {
      update() {
        globalThis.__cell1 = g.cellAt(50, 50);
        globalThis.__cell2 = g.cellAt(150, 250);
        globalThis.__cell3 = g.cellAt(500, 500);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__cell1.c, 0);
  assert.equal(r.ctx.__cell1.r, 0);
  assert.equal(r.ctx.__cell2.c, 1);
  assert.equal(r.ctx.__cell2.r, 2);
  assert.equal(r.ctx.__cell3, null, 'out of bounds returns null');
});

test('kit.grid center converts cell to screen center', () => {
  const code = `const g = kit.grid(4, 4, 100);
    const game = {
      update() {
        globalThis.__pos1 = g.center(0, 0);
        globalThis.__pos2 = g.center(2, 1);
        globalThis.__pos3 = g.center(5, 5);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__pos1.x, 50);
  assert.equal(r.ctx.__pos1.y, 50);
  assert.equal(r.ctx.__pos2.x, 250);
  assert.equal(r.ctx.__pos2.y, 150);
  assert.equal(r.ctx.__pos3, null, 'out of bounds returns null');
});

test('kit.grid forEach iterates all cells in row-major order', () => {
  const code = `const g = kit.grid(3, 2, 50);
    g.set(0, 0, 'a'); g.set(1, 0, 'b'); g.set(2, 0, 'c');
    g.set(0, 1, 'd'); g.set(1, 1, 'e'); g.set(2, 1, 'f');
    const game = {
      update() {
        const vals = [];
        g.forEach((v, c, r) => vals.push({v, c, r}));
        globalThis.__vals = vals;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__vals.length, 6);
  assert.equal(r.ctx.__vals[0].v, 'a');
  assert.equal(r.ctx.__vals[0].c, 0);
  assert.equal(r.ctx.__vals[0].r, 0);
  assert.equal(r.ctx.__vals[5].v, 'f');
  assert.equal(r.ctx.__vals[5].c, 2);
  assert.equal(r.ctx.__vals[5].r, 1);
});

test('kit.grid forEach includes undefined cells', () => {
  const code = `const g = kit.grid(2, 2, 50);
    g.set(0, 0, 'X');
    const game = {
      update() {
        let count = 0;
        g.forEach(() => count++);
        globalThis.__count = count;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 4, 'forEach visits all cells');
});

test('kit.grid draw calls fn only for non-empty cells', () => {
  const code = `const g = kit.grid(3, 3, 100);
    g.set(0, 0, 'A'); g.set(2, 2, 'B');
    const game = {
      update() {},
      draw() {
        const drawn = [];
        g.draw((v, x, y, size) => drawn.push({v, x, y, size}));
        globalThis.__drawn = drawn;
      }
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__drawn.length, 2);
  assert.equal(r.ctx.__drawn[0].v, 'A');
  assert.equal(r.ctx.__drawn[0].x, 50);
  assert.equal(r.ctx.__drawn[0].y, 50);
  assert.equal(r.ctx.__drawn[0].size, 100);
  assert.equal(r.ctx.__drawn[1].v, 'B');
  assert.equal(r.ctx.__drawn[1].x, 250);
  assert.equal(r.ctx.__drawn[1].y, 250);
});

test('kit.grid draw skips undefined and null cells', () => {
  const code = `const g = kit.grid(2, 2, 50);
    g.set(0, 0, 'X');
    g.set(1, 0, null);
    g.set(0, 1, undefined);
    const game = {
      update() {},
      draw() {
        let count = 0;
        g.draw(() => count++);
        globalThis.__count = count;
      }
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 1, 'only non-null/undefined cells drawn');
});

test('kit.grid caps dimensions at 64×64', () => {
  const code = `const g = kit.grid(100, 200, 10);
    const game = {
      update() {
        let count = 0;
        g.forEach(() => count++);
        globalThis.__count = count;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 64 * 64, 'capped at 4096 cells');
});

test('kit.grid ignores invalid inputs and returns minimal grid', () => {
  const code = `const g1 = kit.grid(null, 5, 50);
    const g2 = kit.grid(5, NaN, 50);
    const g3 = kit.grid(5, 5, 'bad');
    const game = {
      update() {
        let c1 = 0, c2 = 0, c3 = 0;
        g1.forEach(() => c1++);
        g2.forEach(() => c2++);
        g3.forEach(() => c3++);
        globalThis.__counts = [c1, c2, c3];
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  for (const c of r.ctx.__counts) {
    assert.equal(c, 1, 'invalid inputs get a 1×1 grid');
  }
});

test('kit.grid floors fractional dimensions', () => {
  const code = `const g = kit.grid(3.9, 2.1, 50);
    const game = {
      update() {
        let count = 0;
        g.forEach(() => count++);
        globalThis.__count = count;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 6, '3×2 grid from floored dimensions');
});

test('kit.grid floors cell indices in get/set', () => {
  const code = `const g = kit.grid(3, 3, 50);
    g.set(1.7, 0.3, 'test');
    const game = {
      update() {
        globalThis.__val = g.get(1.9, 0.1);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__val, 'test', 'floored to cell (1, 0)');
});

test('kit.grid cellAt handles negative coords', () => {
  const code = `const g = kit.grid(4, 4, 100);
    const game = {
      update() {
        globalThis.__cell = g.cellAt(-50, -10);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__cell, null, 'negative coords out of bounds');
});

test('kit.grid cellAt handles NaN', () => {
  const code = `const g = kit.grid(4, 4, 100);
    const game = {
      update() {
        globalThis.__cell = g.cellAt(NaN, 100);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__cell, null);
});

test('kit.grid get/set ignore NaN indices', () => {
  const code = `const g = kit.grid(3, 3, 50);
    g.set(NaN, 0, 'bad');
    g.set(0, NaN, 'bad');
    const game = {
      update() {
        globalThis.__vals = [g.get(NaN, 0), g.get(0, NaN)];
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__vals[0], undefined);
  assert.equal(r.ctx.__vals[1], undefined);
});

test('kit.grid center floors fractional indices', () => {
  const code = `const g = kit.grid(4, 4, 100);
    const game = {
      update() {
        globalThis.__pos = g.center(1.9, 2.1);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__pos.x, 150, 'floored to cell (1, 2)');
  assert.equal(r.ctx.__pos.y, 250);
});

test('kit.grid forEach/draw handle non-function gracefully', () => {
  const code = `const g = kit.grid(2, 2, 50);
    const game = {
      init() {
        g.forEach(null);
        g.forEach('not a function');
        g.draw(null);
        g.draw(123);
      },
      update() { globalThis.__ok = true; },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__ok, true, 'no crash from invalid callbacks');
});

test('kit.grid stores different value types', () => {
  const code = `const g = kit.grid(3, 3, 50);
    g.set(0, 0, 42);
    g.set(1, 0, 'text');
    g.set(2, 0, {hp: 100});
    g.set(0, 1, true);
    const game = {
      update() {
        globalThis.__vals = [g.get(0,0), g.get(1,0), g.get(2,0), g.get(0,1)];
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__vals[0], 42);
  assert.equal(r.ctx.__vals[1], 'text');
  assert.equal(r.ctx.__vals[2].hp, 100);
  assert.equal(r.ctx.__vals[3], true);
});

test('kit.grid minimum size is 1×1', () => {
  const code = `const g = kit.grid(0, 0, 50);
    const game = {
      update() {
        let count = 0;
        g.forEach(() => count++);
        globalThis.__count = count;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__count, 1, 'zero dimensions clamped to 1×1');
});

test('kit.grid cellSize minimum is 1', () => {
  const code = `const g = kit.grid(2, 2, -10);
    const game = {
      update() {
        globalThis.__pos = g.center(0, 0);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__pos.x, 0.5, 'negative cellSize clamped to 1');
  assert.equal(r.ctx.__pos.y, 0.5);
});
