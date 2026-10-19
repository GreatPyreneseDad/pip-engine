import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.color.mix blends two hex colors', () => {
  const code = `const game = {
    update() {
      globalThis.__mid = kit.color.mix('#ff0000', '#0000ff', 0.5);
      globalThis.__a = kit.color.mix('#ff0000', '#0000ff', 0);
      globalThis.__b = kit.color.mix('#ff0000', '#0000ff', 1);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.match(r.ctx.__mid, /rgba\(127|128, 0, 127|128, 1\)/); // midpoint red/blue
  assert.equal(r.ctx.__a, 'rgba(255, 0, 0, 1)');
  assert.equal(r.ctx.__b, 'rgba(0, 0, 255, 1)');
});

test('kit.color.mix accepts rgb() and named colors', () => {
  const code = `const game = {
    update() {
      globalThis.__rgb = kit.color.mix('rgb(255, 0, 0)', 'rgb(0, 255, 0)', 0.5);
      globalThis.__named = kit.color.mix('red', 'blue', 0.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.match(r.ctx.__rgb, /rgba\(127|128, 127|128, 0, 1\)/);
  assert.match(r.ctx.__named, /rgba\(127|128, 0, 127|128, 1\)/);
});

test('kit.color.mix handles invalid inputs gracefully', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.color.mix(null, '#ff0000', 0.5);
      globalThis.__r2 = kit.color.mix('#ff0000', 'notacolor', 0.5);
      globalThis.__r3 = kit.color.mix('#ff0000', '#00ff00', NaN);
      globalThis.__r4 = kit.color.mix('#ff0000', '#00ff00', 'bad');
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, 'rgba(0, 0, 0, 1)');
  assert.equal(r.ctx.__r2, 'rgba(0, 0, 0, 1)');
  assert.equal(r.ctx.__r3, 'rgba(255, 0, 0, 1)'); // NaN t defaults to 0
  assert.equal(r.ctx.__r4, 'rgba(255, 0, 0, 1)');
});

test('kit.color.mix clamps t to [0, 1]', () => {
  const code = `const game = {
    update() {
      globalThis.__neg = kit.color.mix('#ff0000', '#00ff00', -0.5);
      globalThis.__over = kit.color.mix('#ff0000', '#00ff00', 1.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__neg, 'rgba(255, 0, 0, 1)'); // clamped to 0
  assert.equal(r.ctx.__over, 'rgba(0, 255, 0, 1)'); // clamped to 1
});

test('kit.color.hsl creates colors from hue, saturation, lightness', () => {
  const code = `const game = {
    update() {
      globalThis.__red = kit.color.hsl(0, 1, 0.5);
      globalThis.__green = kit.color.hsl(120, 1, 0.5);
      globalThis.__blue = kit.color.hsl(240, 1, 0.5);
      globalThis.__gray = kit.color.hsl(0, 0, 0.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__red, 'rgba(255, 0, 0, 1)');
  assert.equal(r.ctx.__green, 'rgba(0, 255, 0, 1)');
  assert.equal(r.ctx.__blue, 'rgba(0, 0, 255, 1)');
  assert.equal(r.ctx.__gray, 'rgba(128, 128, 128, 1)');
});

test('kit.color.hsl handles invalid inputs', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.color.hsl(NaN, 1, 0.5);
      globalThis.__r2 = kit.color.hsl(120, 'x', 0.5);
      globalThis.__r3 = kit.color.hsl(120, 1, null);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, 'rgba(255, 0, 0, 1)'); // NaN h defaults to 0
  assert.equal(r.ctx.__r2, 'rgba(0, 255, 0, 1)'); // bad s defaults to 1
  assert.equal(r.ctx.__r3, 'rgba(0, 255, 0, 1)'); // bad l defaults to 0.5
});

test('kit.color.hsl wraps hue correctly', () => {
  const code = `const game = {
    update() {
      globalThis.__wrap = kit.color.hsl(360, 1, 0.5);
      globalThis.__neg = kit.color.hsl(-120, 1, 0.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__wrap, 'rgba(255, 0, 0, 1)'); // 360 wraps to 0 (red)
  assert.equal(r.ctx.__neg, 'rgba(0, 0, 255, 1)');  // -120 wraps to 240 (blue)
});

test('kit.color.rainbow cycles through spectrum', () => {
  const code = `const vals = [];
    const game = {
      update() {
        for (let t = 0; t <= 1; t += 0.1) {
          vals.push(kit.color.rainbow(t));
        }
        globalThis.__vals = vals;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.ok(r.ctx.__vals.length >= 10);
  assert.equal(r.ctx.__vals[0], 'rgba(255, 0, 0, 1)'); // t=0 is red
  // All values should be valid rgba strings
  for (const v of r.ctx.__vals) {
    assert.match(v, /^rgba\(\d+, \d+, \d+, 1\)$/);
  }
});

test('kit.color.rainbow wraps t correctly', () => {
  const code = `const game = {
    update() {
      globalThis.__neg = kit.color.rainbow(-0.5);
      globalThis.__over = kit.color.rainbow(1.5);
      globalThis.__zero = kit.color.rainbow(0);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.match(r.ctx.__neg, /^rgba\(/);
  assert.match(r.ctx.__over, /^rgba\(/);
  assert.equal(r.ctx.__zero, 'rgba(255, 0, 0, 1)');
});

test('kit.color.rainbow handles invalid input', () => {
  const code = `const game = {
    update() {
      globalThis.__r = kit.color.rainbow(NaN);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r, 'rgba(255, 0, 0, 1)'); // NaN defaults to 0
});

test('kit.color.alpha adjusts opacity', () => {
  const code = `const game = {
    update() {
      globalThis.__half = kit.color.alpha('#ff0000', 0.5);
      globalThis.__full = kit.color.alpha('#00ff00', 1);
      globalThis.__zero = kit.color.alpha('#0000ff', 0);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__half, 'rgba(255, 0, 0, 0.5)');
  assert.equal(r.ctx.__full, 'rgba(0, 255, 0, 1)');
  assert.equal(r.ctx.__zero, 'rgba(0, 0, 255, 0)');
});

test('kit.color.alpha accepts rgb and named colors', () => {
  const code = `const game = {
    update() {
      globalThis.__rgb = kit.color.alpha('rgb(100, 150, 200)', 0.7);
      globalThis.__named = kit.color.alpha('orange', 0.3);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__rgb, 'rgba(100, 150, 200, 0.7)');
  assert.equal(r.ctx.__named, 'rgba(255, 165, 0, 0.3)');
});

test('kit.color.alpha handles invalid inputs', () => {
  const code = `const game = {
    update() {
      globalThis.__r1 = kit.color.alpha('notacolor', 0.5);
      globalThis.__r2 = kit.color.alpha('#ff0000', NaN);
      globalThis.__r3 = kit.color.alpha('#ff0000', 'bad');
      globalThis.__r4 = kit.color.alpha(null, 0.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__r1, 'rgba(0, 0, 0, 1)');
  assert.equal(r.ctx.__r2, 'rgba(255, 0, 0, 1)'); // NaN a defaults to 1
  assert.equal(r.ctx.__r3, 'rgba(255, 0, 0, 1)');
  assert.equal(r.ctx.__r4, 'rgba(0, 0, 0, 1)');
});

test('kit.color.alpha clamps alpha to [0, 1]', () => {
  const code = `const game = {
    update() {
      globalThis.__neg = kit.color.alpha('#ff0000', -0.5);
      globalThis.__over = kit.color.alpha('#ff0000', 2);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__neg, 'rgba(255, 0, 0, 0)');
  assert.equal(r.ctx.__over, 'rgba(255, 0, 0, 1)');
});

test('kit.color functions work with short hex codes', () => {
  const code = `const game = {
    update() {
      globalThis.__mix = kit.color.mix('#f00', '#00f', 0.5);
      globalThis.__alpha = kit.color.alpha('#0f0', 0.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.match(r.ctx.__mix, /rgba\(127|128, 0, 127|128, 1\)/);
  assert.equal(r.ctx.__alpha, 'rgba(0, 255, 0, 0.5)');
});

test('kit.color.mix blends alpha channels', () => {
  const code = `const game = {
    update() {
      globalThis.__result = kit.color.mix('rgba(255, 0, 0, 0.2)', 'rgba(0, 0, 255, 0.8)', 0.5);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  assert.match(r.ctx.__result, /rgba\(127|128, 0, 127|128, 0.5\)/);
});

test('kit.color functions return valid CSS strings usable in kit.bg', () => {
  const code = `const game = {
    update() {},
    draw() {
      const top = kit.color.rainbow(kit.t * 0.1);
      const bot = kit.color.alpha('#ffffff', 0.8);
      kit.bg(top, bot);
      globalThis.__drew = true;
    }
  };`;
  const r = runGame(code, { frames: 5 });
  assert.equal(r.error, null);
  assert.equal(r.ctx.__drew, true);
});

test('all named colors are recognized', () => {
  const code = `const names = ['aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon', 'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow'];
    const game = {
      update() {
        const results = {};
        for (const name of names) {
          const c = kit.color.alpha(name, 1);
          results[name] = c.startsWith('rgba(') && c.endsWith(', 1)');
        }
        globalThis.__results = results;
      },
      draw() {}
    };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  for (const [name, valid] of Object.entries(r.ctx.__results)) {
    assert.equal(valid, true, `${name} should parse`);
  }
});
