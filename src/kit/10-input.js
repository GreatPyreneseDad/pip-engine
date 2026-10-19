// Keyboard, hold/drag pointer extras and on-screen touch controls. Written for MacT Factory (ages 10+);
// Pip's games never see any of it unless they ask: touch controls are off until kit.touchControls('auto').
(function () {
  const NAMES = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'space', Spacebar: 'space', Enter: 'enter', Shift: 'shift', Escape: 'esc', Control: 'ctrl' };
  const norm = k => { k = String(k ?? ''); return NAMES[k] || k.toLowerCase(); };
  const held = new Set(), fresh = new Set(), lifted = new Set();
  function down(k) { k = norm(k); if (!held.has(k)) { held.add(k); fresh.add(k); } }
  function up(k) { k = norm(k); held.delete(k); lifted.add(k); }
  addEventListener('keydown', e => { if (!e || e.repeat) return; down(e.key); if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key) && e.preventDefault) e.preventDefault(); });
  addEventListener('keyup', e => { if (e) up(e.key); });
  addEventListener('blur', () => { for (const k of held) lifted.add(k); held.clear(); });
  // the host page relays keys when the frame does not have focus: { gm: 1, type: 'key', key, down }
  addEventListener('message', e => { if (e && e.source === parent && e.data && e.data.gm && e.data.type === 'key') (e.data.down ? down : up)(e.data.key); });
  addEventListener('pointerdown', () => { try { window.focus(); } catch (e) {} });
  kit.keys = held;
  kit.key = n => held.has(norm(n));
  kit.pressed = n => fresh.has(norm(n));
  kit.released = n => lifted.has(norm(n));

  /* pointer extras: hold time, drag vector, angles */
  const ptr = kit.pointer; let downAt = -1, lastT = 0;
  kit.drag = { active: false, x0: 0, y0: 0, dx: 0, dy: 0, dist: 0, angle: 0 };
  ptr.heldFor = 0;
  kit.angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  kit.approach = (v, target, rate, dt) => { v = +v || 0; target = +target || 0; const k = Math.min(1, Math.max(0, (+rate || 0) * (+dt || 0))); return v + (target - v) * k; };

  /* touch controls: a floating stick (lower left) and A/B buttons (lower right) that press the same keys */
  const coarse = !!(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  let tmode = 'none';
  kit.touch = coarse;
  kit.touchControls = m => { if (['auto', 'stick', 'buttons', 'none'].includes(m)) tmode = m; };
  Object.defineProperty(kit, 'safeBottom', { get: () => (coarse && tmode !== 'none') ? 170 : 0 });
  const stick = { on: false, id: -1, ox: 0, oy: 0, kx: 0, ky: 0, x: 0, y: 0 }, R = 54, DEAD = 10;
  const BTN = [{ k: 'space', label: 'A', dx: 74, dy: 84, r: 40, id: -1 }, { k: 'shift', label: 'B', dx: 158, dy: 138, r: 32, id: -1 }];
  const wantStick = () => coarse && (tmode === 'auto' || tmode === 'stick'), wantBtns = () => coarse && (tmode === 'auto' || tmode === 'buttons');
  kit.axis = () => stick.on ? { x: stick.x, y: stick.y } : ({ x: (kit.key('right') || kit.key('d') ? 1 : 0) - (kit.key('left') || kit.key('a') ? 1 : 0), y: (kit.key('down') || kit.key('s') ? 1 : 0) - (kit.key('up') || kit.key('w') ? 1 : 0) });
  const DIRS = [['right', 'left', 'x'], ['down', 'up', 'y']];
  function stickKeys() { for (const [pos, neg, ax] of DIRS) { const v = stick.on ? stick[ax] : 0; v > 0.45 ? down(pos) : (held.has(pos) && up(pos)); v < -0.45 ? down(neg) : (held.has(neg) && up(neg)); } }
  function hitBtn(x, y) { if (!wantBtns()) return null; for (const b of BTN) if (Math.hypot(x - (W - b.dx), y - (H - b.dy)) < b.r + 12) return b; return null; }
  const stop = e => { if (e.stopImmediatePropagation) e.stopImmediatePropagation(); if (e.preventDefault) e.preventDefault(); };
  function tDown(e) { if (!e || e.pointerType !== 'touch' || tmode === 'none') return; const b = hitBtn(e.clientX, e.clientY);
    if (b) { if (b.id < 0) { b.id = e.pointerId; down(b.k); } stop(e); return; }
    if (wantStick() && !stick.on && e.clientX < W * 0.5 && e.clientY > H * 0.35) { stick.on = true; stick.id = e.pointerId; stick.ox = stick.kx = e.clientX; stick.oy = stick.ky = e.clientY; stick.x = stick.y = 0; stop(e); } }
  function tMove(e) { if (!e) return; if (e.pointerId !== stick.id) { if (BTN.some(b => b.id === e.pointerId) && e.stopImmediatePropagation) e.stopImmediatePropagation(); return; } let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    stick.kx = stick.ox + dx; stick.ky = stick.oy + dy; const m = Math.max(0, d - DEAD) / (R - DEAD); const dd = d || 1; stick.x = kit.clamp(dx / dd * Math.min(1, m), -1, 1); stick.y = kit.clamp(dy / dd * Math.min(1, m), -1, 1); stickKeys(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
  function tUp(e) { if (!e) return; if (e.pointerId === stick.id) { stick.on = false; stick.id = -1; stick.x = stick.y = 0; stickKeys(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); return; } for (const b of BTN) if (b.id === e.pointerId) { b.id = -1; up(b.k); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } }
  addEventListener('pointerdown', tDown, { capture: true, passive: false }); addEventListener('pointermove', tMove, true); addEventListener('pointerup', tUp, true); addEventListener('pointercancel', tUp, true);
  function drawControls() { if (!coarse || tmode === 'none') return; ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;
    const ring = (x, y, r, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
    const disc = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    const label = (s, x, y, size, c) => { ctx.font = '600 ' + size + 'px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c; ctx.fillText(s, x, y); };
    if (wantStick()) { if (stick.on) { ring(stick.ox, stick.oy, R, 'rgba(255,255,255,.35)', 2); disc(stick.kx, stick.ky, 22, 'rgba(255,255,255,.45)'); } else { ring(90, H - 110, R, 'rgba(255,255,255,.12)', 2); label('MOVE', 90, H - 110, 11, 'rgba(255,255,255,.3)'); } }
    if (wantBtns()) for (const b of BTN) { disc(W - b.dx, H - b.dy, b.r, b.id >= 0 ? 'rgba(255,138,31,.55)' : 'rgba(255,255,255,.14)'); ring(W - b.dx, H - b.dy, b.r, 'rgba(255,255,255,.3)', 2); label(b.label, W - b.dx, H - b.dy, 18, 'rgba(255,255,255,.7)'); }
    ctx.restore(); }
  /* the controls are drawn after the game's draw: the loop brackets each frame in save/restore, so the restore that returns to depth 0 ends the frame */
  let depth = 0, armed = false; const _save = ctx.save.bind(ctx), _restore = ctx.restore.bind(ctx);
  ctx.save = function () { depth++; return _save(); };
  ctx.restore = function () { const r = _restore(); if (depth > 0) depth--; if (depth === 0 && armed) { armed = false; try { drawControls(); } catch (e) {} } return r; };

  kit._onTick(dt => {
    fresh.clear(); lifted.clear(); armed = true;
    lastT += dt; if (ptr.pressed) { downAt = lastT; kit.drag.x0 = ptr.x; kit.drag.y0 = ptr.y; }
    if (ptr.down && downAt >= 0) { kit.drag.active = true; kit.drag.dx = ptr.x - kit.drag.x0; kit.drag.dy = ptr.y - kit.drag.y0; kit.drag.dist = Math.hypot(kit.drag.dx, kit.drag.dy); kit.drag.angle = Math.atan2(kit.drag.dy, kit.drag.dx); ptr.heldFor = lastT - downAt; }
    else { if (!ptr.down) { kit.drag.active = false; downAt = -1; } ptr.heldFor = 0; }
  });
})();
