/* Every example must boot and survive 5 seconds of play. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { runGame } from './harness.mjs';

for (const f of readdirSync(new URL('../examples/', import.meta.url)).filter(f => f.endsWith('.js'))) {
  test(`example ${f} runs`, () => {
    const code = readFileSync(new URL(`../examples/${f}`, import.meta.url), 'utf8');
    const taps = Array.from({ length: 20 }, (_, i) => ({ frame: 10 + i * 14, x: 100 + (i * 37) % 200, y: 400 + (i * 53) % 300 }));
    const r = runGame(code, { frames: 300, taps });
    assert.equal(r.error, null);
    assert.ok(r.posts.some(p => p.type === 'ready'));
  });
}
