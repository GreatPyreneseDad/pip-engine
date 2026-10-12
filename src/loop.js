/* pip-engine · the frame loop (runs inside the sealed frame, after lib.js and runtime.js) */
/* the loop runs the game and handles particles/shake/errors. CERATA: do not modify this file
   without updating tests/harness.mjs to match (it runs this exact source in a vm). */
try { eval(__SRC); } catch (e) { fail('Error while loading the code: ' + e.message); dead = true; }
if (!dead && (typeof game !== 'object' || !game || typeof game.update !== 'function' || typeof game.draw !== 'function')) {
  fail('YOUR CODE must define exactly:  const game = { init() {}, update(dt) {}, draw() {} };\ninit runs once. Every frame update(dt) then draw() run (dt in seconds, at most 0.05).');
  dead = true;
}
if (!dead && typeof game.init === 'function') try { game.init(); } catch (e) { fail('Error in init: ' + e.message); }
if (!dead) post({ type: 'ready' });

function anim(now) {
  if (dead) return;
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; kit.t += dt; sounds = 0;
  if (!paused) {
    try { game.update(dt); } catch (e) { fail(`Error in update (frame ${frames}): ${e.message}`); return; }
    if (typeof updateTweens === 'function') updateTweens(dt);
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  ctx.save(); ctx.scale(DPR, DPR);
  if (shakeAmt > 0) { ctx.translate((Math.random() - 0.5) * shakeAmt * 2, (Math.random() - 0.5) * shakeAmt * 2); shakeAmt *= 0.85; }
  const start = performance.now();
  try { game.draw(); } catch (e) { fail(`Error in draw (frame ${frames}): ${e.message}`); ctx.restore(); return; }
  if (performance.now() - start > 400) { fail(`Runaway frame ${frames} took ${Math.round(performance.now() - start)} ms`); ctx.restore(); return; }
  for (const p of parts) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  ctx.restore();
  kit.pointer.pressed = false; kit.pointer.released = false; frames++;
  requestAnimationFrame(anim);
}
requestAnimationFrame(anim);
