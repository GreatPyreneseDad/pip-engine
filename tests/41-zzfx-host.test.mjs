/* host-side ZzFX: sample generation is finite, bounded and junk-tolerant; playZzfx is a no-op without WebAudio. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zzfxSamples, playZzfx } from '../src/zzfx.mjs';

test('zzfxSamples returns finite samples within -1..1 for presets and junk', () => {
  for (const p of [[.5, .05, 600, .01, .05, .1, 0, 1, 0, 0, 0, 0, 0, 0, 50, 0, 0, 1, .01], [1, .05, 200, .01, .3, .5, 3, .1, 0, 0, 0, 0, 0, .5, 0, 0, .1, .5, .01], [], 'junk', null, [NaN, 'x', Infinity]]) {
    const s = zzfxSamples(p);
    assert.ok(s.length > 0 && s.length < 44100 * 4, 'reasonable length');
    assert.ok(Array.from(s).every(v => Number.isFinite(v) && v >= -1 && v <= 1));
  }
});

test('playZzfx returns null when there is no AudioContext', () => {
  assert.equal(playZzfx([.5, .05, 600]), null);
});
