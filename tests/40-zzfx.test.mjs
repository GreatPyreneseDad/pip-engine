import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from './harness.mjs';

test('kit.zzfx posts raw ZzFX parameter arrays to host', () => {
  const code = `const game = {
    init() { kit.zzfx([.5, .05, 400, .01, .05, .1]); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.ok(Array.isArray(zzfx[0].params));
  assert.equal(zzfx[0].params.length, 21); // filled to 21 parameters
  assert.equal(zzfx[0].params[0], .5); // volume preserved
  assert.equal(zzfx[0].params[2], 400); // frequency preserved
});

test('kit.zzfx fills missing parameters with defaults', () => {
  const code = `const game = {
    init() { kit.zzfx([.8]); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.equal(zzfx[0].params[0], .8);
  assert.equal(zzfx[0].params[1], .05); // default randomness
  assert.equal(zzfx[0].params[2], 220); // default frequency
});

test('kit.zzfx treats NaN and Infinity as defaults', () => {
  const code = `const game = {
    init() { kit.zzfx([NaN, Infinity, 500, -Infinity]); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.equal(zzfx[0].params[0], 1); // NaN -> default volume
  assert.equal(zzfx[0].params[1], .05); // Infinity -> default randomness
  assert.equal(zzfx[0].params[2], 500); // valid number kept
  assert.equal(zzfx[0].params[3], 0); // -Infinity -> default attack
});

test('kit.zzfx ignores invalid inputs', () => {
  const code = `const game = {
    init() {
      kit.zzfx(null);
      kit.zzfx('not an array');
      kit.zzfx(42);
      kit.zzfx({});
    },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 0);
});

test('kit.zzfx rate-limits to 8 per frame', () => {
  const code = `const game = {
    update() {
      for (let i = 0; i < 20; i++) kit.zzfx([.5]);
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 3 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 16); // 8 per frame * 2 frames (init doesn't count)
});

test('kit.sound plays synthesized presets: laser', () => {
  const code = `const game = {
    init() { kit.sound('laser'); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.equal(zzfx[0].params[0], .5); // laser volume
  assert.equal(zzfx[0].params[2], 400); // laser frequency
});

test('kit.sound plays synthesized presets: zap', () => {
  const code = `const game = {
    init() { kit.sound('zap'); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.equal(zzfx[0].params[2], 300); // zap frequency
});

test('kit.sound plays synthesized presets: explode', () => {
  const code = `const game = {
    init() { kit.sound('explode'); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.equal(zzfx[0].params[0], 1); // explode volume
});

test('kit.sound plays synthesized presets: coin, jump, hit, powerup, blip', () => {
  const code = `const game = {
    init() {
      kit.sound('coin');
      kit.sound('jump');
      kit.sound('hit');
      kit.sound('powerup');
      kit.sound('blip');
    },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 5);
});

test('kit.sound falls back to original behavior for non-preset names', () => {
  const code = `const game = {
    init() { kit.sound('pop'); kit.sound('boing'); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const sounds = r.posts.filter(m => m.type === 'sound');
  assert.equal(sounds.length, 2);
  assert.equal(sounds[0].name, 'pop');
  assert.equal(sounds[1].name, 'boing');
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 0);
});

test('kit.sound and kit.zzfx coexist without interference', () => {
  const code = `const game = {
    init() {
      kit.sound('pop');
      kit.zzfx([.5, 0, 300]);
      kit.sound('laser');
      kit.sound('boing');
    },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const sounds = r.posts.filter(m => m.type === 'sound');
  assert.equal(sounds.length, 2); // pop and boing
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 2); // raw zzfx and laser preset
});

test('synthesized sounds respect rate limit with sampled sounds', () => {
  const code = `const game = {
    update() {
      for (let i = 0; i < 10; i++) {
        kit.sound('laser');
        kit.sound('pop');
      }
    },
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  // Both should be rate-limited together (max 8 zzfx + unlimited sampled sounds per frame)
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.ok(zzfx.length <= 16); // 8 per frame max for zzfx
});

test('ZzFX parameter array accepts all 21 parameters', () => {
  const code = `const game = {
    init() {
      kit.zzfx([1, .05, 220, 0, 0, .1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
    },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.equal(zzfx[0].params.length, 21);
  assert.equal(zzfx[0].params[20], 0); // last parameter preserved
});

test('empty array gets all defaults', () => {
  const code = `const game = {
    init() { kit.zzfx([]); },
    update() {},
    draw() {}
  };`;
  const r = runGame(code, { frames: 2 });
  assert.equal(r.error, null);
  const zzfx = r.posts.filter(m => m.type === 'zzfx');
  assert.equal(zzfx.length, 1);
  assert.equal(zzfx[0].params[0], 1); // default volume
  assert.equal(zzfx[0].params[1], .05); // default randomness
  assert.equal(zzfx[0].params[2], 220); // default frequency
});
