/* pip-engine · loop. Runs after lib, runtime and game code. Calls game.init once, then update/draw. */
/* game loop: runs after the game code is loaded */
if (typeof game !== 'object' || typeof game.update !== 'function' || typeof game.draw !== 'function') {
  fail('Code must define exactly:  const game = { init() {}, update(dt) {}, draw() {} };');
} else {
  post({ type: 'ready' });
  try { if (typeof game.init === 'function') game.init(); } catch (e) { fail(e); }
  function tick(now) {
    if (dead || paused) { if (!dead) requestAnimationFrame(tick); return; }
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 1 / 60); lastT = now; kit.t += dt; sounds = 0; frames++;
    const t0 = performance.now();
    try {
      game.update(dt);
    } catch (e) { fail(e); return; }
    if (performance.now() - t0 > 200) { fail('Runaway frame in update() after ' + frames + ' frames (infinite loop?)'); return; }
    if (typeof kit._updateTweens === 'function') kit._updateTweens(dt);
    kit.pointer.pressed = false; kit.pointer.released = false;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); else { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; } }
    ctx.resetTransform(); ctx.scale(DPR, DPR);
    if (shakeAmt > 0) { ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt); shakeAmt *= 0.85; }
    try { game.draw(); } catch (e) { fail(e); return; }
    for (const p of parts) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
