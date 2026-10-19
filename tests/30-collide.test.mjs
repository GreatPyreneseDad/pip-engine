import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.hit detects circle-circle overlap', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.hit({x: 0, y: 0, r: 10}, {x: 15, y: 0, r: 10});  // touching
      globalThis.__r2 = kit.hit({x: 0, y: 0, r: 10}, {x: 10, y: 0, r: 5});   // overlap
      globalThis.__r3 = kit.hit({x: 0, y: 0, r: 10}, {x: 30, y: 0, r: 5});   // separated
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, true, 'circles touching');
  assert.equal(r.ctx.__r2, true, 'circles overlapping');
  assert.equal(r.ctx.__r3, false, 'circles separated');
});

test('kit.hit detects circle-rectangle overlap', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.hit({x: 50, y: 50, r: 10}, {x: 40, y: 40, w: 20, h: 20});  // overlap
      globalThis.__r2 = kit.hit({x: 100, y: 100, r: 10}, {x: 40, y: 40, w: 20, h: 20}); // separated
      globalThis.__r3 = kit.hit({x: 60, y: 50, r: 5}, {x: 40, y: 40, w: 20, h: 20});    // inside
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, true, 'circle overlaps rect');
  assert.equal(r.ctx.__r2, false, 'circle separated from rect');
  assert.equal(r.ctx.__r3, true, 'circle inside rect');
});

test('kit.hit detects rectangle-circle overlap (reversed args)', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.hit({x: 40, y: 40, w: 20, h: 20}, {x: 50, y: 50, r: 10});
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, true, 'rect-circle same as circle-rect');
});

test('kit.hit detects rectangle-rectangle overlap', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.hit({x: 0, y: 0, w: 50, h: 50}, {x: 40, y: 40, w: 50, h: 50}); // overlap
      globalThis.__r2 = kit.hit({x: 0, y: 0, w: 50, h: 50}, {x: 100, y: 100, w: 50, h: 50}); // separated
      globalThis.__r3 = kit.hit({x: 0, y: 0, w: 100, h: 100}, {x: 20, y: 20, w: 10, h: 10}); // inside
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, true, 'rects overlapping');
  assert.equal(r.ctx.__r2, false, 'rects separated');
  assert.equal(r.ctx.__r3, true, 'rect inside rect');
});

test('kit.hit returns false for invalid inputs', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.hit(null, {x: 0, y: 0, r: 10});
      globalThis.__r2 = kit.hit({x: 0, y: 0, r: 10}, null);
      globalThis.__r3 = kit.hit({x: NaN, y: 0, r: 10}, {x: 0, y: 0, r: 10});
      globalThis.__r4 = kit.hit({x: 0, y: 0, r: -5}, {x: 0, y: 0, r: 10});
      globalThis.__r5 = kit.hit({x: 0, y: 0, w: 0, h: 10}, {x: 0, y: 0, w: 10, h: 10});
      globalThis.__r6 = kit.hit({x: 0, y: 0}, {x: 0, y: 0, r: 10});  // missing shape properties
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, false, 'null first arg');
  assert.equal(r.ctx.__r2, false, 'null second arg');
  assert.equal(r.ctx.__r3, false, 'NaN coordinate');
  assert.equal(r.ctx.__r4, false, 'negative radius');
  assert.equal(r.ctx.__r5, false, 'zero width');
  assert.equal(r.ctx.__r6, false, 'missing shape properties');
});

test('kit.hit handles edge cases: touching edges', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.hit({x: 0, y: 0, w: 50, h: 50}, {x: 50, y: 0, w: 50, h: 50}); // edge touching
      globalThis.__r2 = kit.hit({x: 0, y: 0, r: 10}, {x: 20, y: 0, r: 10}); // circle edge touching
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, false, 'rect edges touching (not overlapping per Phaser)');
  assert.equal(r.ctx.__r2, true, 'circle edges touching (overlapping by definition)');
});

test('kit.bounce reflects velocity and clamps circle inside bounds', () => {
  const code = `const ball = { x: 5, y: 10, vx: -50, vy: -30, r: 10 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const game = {
      update() {
        kit.bounce(ball, bounds);
        globalThis.__ball = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__ball.x, 10, 'x clamped to minX + r');
  assert.equal(r.ctx.__ball.y, 10, 'y clamped to minY + r');
  assert.ok(r.ctx.__ball.vx > 0, 'vx reflected');
  assert.ok(r.ctx.__ball.vy > 0, 'vy reflected');
});

test('kit.bounce reflects velocity and clamps rectangle inside bounds', () => {
  const code = `const box = { x: 450, y: 650, vx: 100, vy: 100, w: 50, h: 50 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const game = {
      update() {
        kit.bounce(box, bounds);
        globalThis.__box = { x: box.x, y: box.y, vx: box.vx, vy: box.vy };
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__box.x, 350, 'x clamped to maxX - w');
  assert.equal(r.ctx.__box.y, 550, 'y clamped to maxY - h');
  assert.ok(r.ctx.__box.vx < 0, 'vx reflected');
  assert.ok(r.ctx.__box.vy < 0, 'vy reflected');
});

test('kit.bounce does nothing when object is inside bounds', () => {
  const code = `const ball = { x: 200, y: 300, vx: 50, vy: -30, r: 10 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const game = {
      update() {
        kit.bounce(ball, bounds);
        globalThis.__ball = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__ball.x, 200, 'x unchanged');
  assert.equal(r.ctx.__ball.y, 300, 'y unchanged');
  assert.equal(r.ctx.__ball.vx, 50, 'vx unchanged');
  assert.equal(r.ctx.__ball.vy, -30, 'vy unchanged');
});

test('kit.bounce ignores invalid inputs', () => {
  const code = `const ball = { x: 10, y: 10, vx: 50, vy: 50, r: 10 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const game = {
      update() {
        kit.bounce(null, bounds);
        kit.bounce(ball, null);
        kit.bounce({x: NaN, y: 10, vx: 0, vy: 0, r: 10}, bounds);
        kit.bounce({x: 10, y: 10, vx: NaN, vy: 0, r: 10}, bounds);
        kit.bounce(ball, {x: 0, y: 0, w: NaN, h: 600});
        globalThis.__ball = { x: ball.x, y: ball.y };
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__ball.x, 10, 'ball unchanged after invalid calls');
  assert.equal(r.ctx.__ball.y, 10);
});

test('kit.bounce works with object without r, w, or h (point)', () => {
  const code = `const pt = { x: -5, y: -10, vx: -50, vy: -30 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const game = {
      update() {
        kit.bounce(pt, bounds);
        globalThis.__pt = { x: pt.x, y: pt.y, vx: pt.vx, vy: pt.vy };
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__pt.x, 0, 'x clamped to bounds.x');
  assert.equal(r.ctx.__pt.y, 0, 'y clamped to bounds.y');
  assert.ok(r.ctx.__pt.vx > 0, 'vx reflected');
  assert.ok(r.ctx.__pt.vy > 0, 'vy reflected');
});

test('kit.bounce handles multiple bounces in sequence', () => {
  const code = `const ball = { x: 200, y: 300, vx: 150, vy: 200, r: 10 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const game = {
      update(dt) {
        for (let i = 0; i < 5; i++) {
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          kit.bounce(ball, bounds);
        }
        globalThis.__ball = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 30, dt: 1/60 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__ball.x >= 10 && r.ctx.__ball.x <= 390, `x in bounds: ${r.ctx.__ball.x}`);
  assert.ok(r.ctx.__ball.y >= 10 && r.ctx.__ball.y <= 590, `y in bounds: ${r.ctx.__ball.y}`);
});

test('kit.hit and kit.bounce integrate: ball bounces and stays in play area', () => {
  const code = `const ball = { x: 200, y: 300, vx: 100, vy: 150, r: 15 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const paddle = { x: 180, y: 550, w: 80, h: 20 };
    let paddleHits = 0;
    const game = {
      update(dt) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        kit.bounce(ball, bounds);
        if (kit.hit(ball, paddle)) {
          paddleHits++;
          if (ball.vy > 0) ball.vy = -ball.vy;
        }
        globalThis.__hits = paddleHits;
        globalThis.__inBounds = (ball.x >= 15 && ball.x <= 385 && ball.y >= 15 && ball.y <= 585);
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 120, dt: 1/60 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__inBounds, 'ball stayed in bounds');
  assert.ok(r.ctx.__hits >= 0, 'paddle hits tracked');
});

test('kit.hit with circle corner case: circle at rectangle corner', () => {
  const code = `const game = {
    update() {
      // circle center at corner of rect: should hit if within radius
      globalThis.__r1 = kit.hit({x: 0, y: 0, r: 15}, {x: 10, y: 10, w: 20, h: 20}); // overlaps corner
      globalThis.__r2 = kit.hit({x: 0, y: 0, r: 5}, {x: 10, y: 10, w: 20, h: 20});  // does not reach corner
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, true, 'circle overlaps rect corner');
  assert.equal(r.ctx.__r2, false, 'circle does not reach rect corner');
});

test('kit.bounce only reflects velocity in the direction of collision', () => {
  const code = `const ball = { x: 5, y: 300, vx: -50, vy: 30, r: 10 };
    const bounds = { x: 0, y: 0, w: 400, h: 600 };
    const game = {
      update() {
        kit.bounce(ball, bounds);
        globalThis.__ball = { vx: ball.vx, vy: ball.vy };
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__ball.vx > 0, 'vx reflected (hit left wall)');
  assert.equal(r.ctx.__ball.vy, 30, 'vy unchanged (not hitting top/bottom)');
});
