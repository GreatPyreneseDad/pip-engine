/* pip-engine · loop (rt2). Runs last; expects __SRC (game code string) to be defined. */
(function () {
  let game = null;
  try { game = new Function('kit', 'ctx', __SRC + '\n;return (typeof game !== "undefined") ? game : null;')(kit, ctx); } catch (e) { return fail(new Error((e && e.name || 'Error') + ' while loading the code: ' + (e && e.message || e))); }
  if (typeof game !== 'object' || !game || typeof game.update !== 'function' || typeof game.draw !== 'function') return fail(new Error('The code must define, at the top level of <code>: const game = { init() {}, update(dt) {}, draw() {} };'));
  try { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); if (game.init) game.init(); } catch (e) { return fail(e); }
  function loop(now) { if (dead) return; requestAnimationFrame(loop); const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000)); lastT = now; if (paused) return;
    kit.t += dt; sounds = 0; const t0 = performance.now();
    try { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#2a1f5c'; ctx.fillRect(0, 0, W, H);
      if (shakeAmt > 0.3) { ctx.translate((Math.random() - 0.5) * shakeAmt * 2, (Math.random() - 0.5) * shakeAmt * 2); shakeAmt *= Math.pow(0.02, dt); } else shakeAmt = 0;
      ctx.save(); game.update(dt); game.draw(); ctx.restore();
    } catch (e) { return fail(e); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; ctx.globalAlpha = Math.min(1, p.life * 2.2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; kit.pointer.pressed = false; kit.pointer.released = false;
    if (performance.now() - t0 > 400 && frames > 5) return fail(new Error('A frame took far too long (possible runaway loop)'));
    if (++frames === 3) post({ type: 'ready' });
  }
  lastT = performance.now(); requestAnimationFrame(loop);
})();

