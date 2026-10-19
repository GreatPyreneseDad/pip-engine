/* Headless harness: runs the real engine sources (lib.js, runtime.js, loop.js) against a fake
   canvas in a Node vm context, exactly as the sealed frame would run them. No browser, no deps.

   const r = runGame(code, { frames: 120, taps: [{ frame: 10, x: 100, y: 200 }] });
   r.posts    messages the game sent to the host (ready, sound, win, say, error ...)
   r.calls    canvas calls by name, e.g. r.calls.fillText
   r.error    the first error message posted, or null
   r.ctx      the vm context: r.ctx.kit, r.ctx.__parts (engine globals)               */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** runtime.js followed by every kit plugin in src/kit/ (sorted). Same rule as scripts/build.mjs. */
export function runtimeSource(dir = root) {
  const kitDir = join(dir, 'src/kit');
  const plugins = existsSync(kitDir) ? readdirSync(kitDir).filter(f => f.endsWith('.js')).sort() : [];
  return [readFileSync(join(dir, 'src/runtime.js'), 'utf8'),
    ...plugins.map(f => `/* ---------- kit plugin: src/kit/${f} ---------- */\n` + readFileSync(join(kitDir, f), 'utf8'))].join('\n;\n');
}
export const SOURCES = {
  lib: readFileSync(join(root, 'src/lib.js'), 'utf8'),
  runtime: runtimeSource(),
  loop: readFileSync(join(root, 'src/loop.js'), 'utf8'),
};

function fakeContext2D(calls) {
  const state = { globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px sans-serif' };
  const gradient = () => ({ addColorStop(o, c) { if (!(o >= 0 && o <= 1)) throw new RangeError('offset'); } });
  return new Proxy(state, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k !== 'string') return undefined;
      return (...args) => {
        calls[k] = (calls[k] || 0) + 1;
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return gradient();
        if (k === 'measureText') return { width: String(args[0] ?? '').length * 8 };
        if (k === 'getImageData') return { data: new Uint8ClampedArray(4) };
        return undefined;
      };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

export function runGame(code, { frames = 60, width = 390, height = 800, taps = [], events = [], pre = '', dt = 1 / 60, slowFrame } = {}) {
  const posts = [], calls = {}, listeners = {}, docListeners = {};
  let raf = null, now = 0, slow = false;
  const ctx2d = fakeContext2D(calls);
  const canvas = { width: 0, height: 0, getContext: () => ctx2d };
  const parentWin = { postMessage: m => posts.push(m) };
  const sandbox = {
    innerWidth: width, innerHeight: height, devicePixelRatio: 2,
    document: { getElementById: () => canvas, addEventListener: (e, f) => { docListeners[e] = f; } },
    addEventListener: (e, f) => { (listeners[e] ||= []).push(f); },
    requestAnimationFrame: f => { raf = f; return 1; },
    performance: { now: () => (slow ? (now += 1000) : now) },
    parent: parentWin,
    console,
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  const run = (src, name) => new vm.Script(src, { filename: name }).runInContext(context);
  run(SOURCES.lib, 'lib.js');
  run(SOURCES.runtime, 'runtime.js');
  run('globalThis.kit = kit; globalThis.__parts = parts;', 'expose.js');
  run(`var __SRC = ${JSON.stringify(pre + '\n;\n' + code)};`, 'game.js');
  run(SOURCES.loop, 'loop.js');

  const fire = (type, x, y) => (listeners[type] || []).forEach(f => f({ clientX: x, clientY: y }));
  // events: [{ frame, type, ...fields }] fired as-is; 'message' events get source = parent so host relays work
  const fireEvent = ev => (listeners[ev.type] || []).forEach(f => f({ clientX: ev.x, clientY: ev.y, source: ev.type === 'message' ? parentWin : undefined, ...ev }));
  for (let i = 0; i < frames && raf; i++) {
    for (const t of taps) {
      if (t.frame === i) fire('pointerdown', t.x, t.y);
      if (t.frame + (t.hold ?? 2) === i) fire('pointerup', t.x, t.y);
    }
    for (const ev of events) if (ev.frame === i) fireEvent(ev);
    const f = raf; raf = null;
    now += dt * 1000;
    slow = slowFrame === i;
    f(now);
    slow = false;
  }
  const err = posts.find(p => p.type === 'error');
  return { posts, calls, error: err ? err.message : null, ctx: context };
}

/** A minimal valid game, for tests that only need the engine running. */
export const IDLE_GAME = 'const game = { init() {}, update(dt) {}, draw() { kit.bg("#8fd3ff", "#d6f5c9"); } };';
