/* The two builds carry the same engine and agree with src/. The test rebuilds dist/ first, so a change
   to src/ (by hand or by a CERATA consume) is always checked against fresh builds. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/build.mjs', import.meta.url))], { stdio: 'ignore' });
const esm = await import('../dist/pip-engine.mjs?' + Date.now());
import { frameDoc } from '../src/frame.mjs';
import { SOURCES } from './harness.mjs';

const classicSrc = readFileSync(new URL('../dist/pip-engine.js', import.meta.url), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(classicSrc, ctx);
const PIP = ctx.PIP_ENGINE;

test('dist is built from src', () => {
  assert.equal(esm.LIB, SOURCES.lib);
  assert.equal(esm.RUNTIME, SOURCES.runtime);
  assert.equal(esm.LOOP, SOURCES.loop);
});

test('classic build exposes the same engine as the module', () => {
  for (const k of ['VERSION', 'LIB', 'RUNTIME', 'LOOP', 'CONTRACT', 'CONTRACT_PROMPT']) assert.equal(PIP[k], esm[k], k);
  const game = { pre: 'function a(){}', code: 'const game = { update() {}, draw() {} };' };
  assert.equal(PIP.frameDoc(PIP.engine, game), frameDoc(esm.engine, game));
});

test('CONTRACT_PROMPT is the bare contract text', () => {
  assert.ok(esm.CONTRACT_PROMPT.startsWith('YOUR CODE must define exactly:'));
  assert.ok(!esm.CONTRACT_PROMPT.includes('```'));
  assert.match(esm.CONTRACT_PROMPT, /kit\.win\(\)/);
});
