// Platformer movement: a run that builds, a brake that bites, a jump you can shorten, ground you can't fall through.
// Built from forest/study/sonic-movement.md (Sonic Retro's disassemblies, numbers converted to px/s). No code from the prey.
// kit.platform(o, solids, dt, opts) moves one body each frame against a list of rectangles.
(function () {
  const DEF = { acc: 169, dec: 1800, friction: 169, top: 360, jump: 390, cut: 240, gravity: 788, maxFall: 960, airAcc: 169, coyote: .1, buffer: .1, scale: .8 };
  const num = (v, d) => typeof v === 'number' && isFinite(v) ? v : d;
  const rect = r => r && typeof r === 'object' && num(r.x, NaN) === r.x && num(r.y, NaN) === r.y && num(r.w, 0) > 0 && num(r.h, 0) > 0;
  const overlap = (o, r) => o.x < r.x + r.w && o.x + o.w > r.x && o.y < r.y + r.h && o.y + o.h > r.y;
  /**
   * o: { x, y, w, h, vx, vy }  top-left box. Adds/keeps: onGround, facing, hitWall, hitHead, _coy, _buf.
   * solids: [{ x, y, w, h, oneWay }]  oneWay: only stops a fall onto its top.
   * opts: { left, right, jump, jumpHeld }  booleans; default from kit.axis() and space. Plus any DEF knob and scale.
   */
  kit.platform = function (o, solids, dt, opts) {
    if (!o || typeof o !== 'object') return o;
    dt = Math.min(num(dt, 1 / 60), .05); opts = opts && typeof opts === 'object' ? opts : {};
    const s = num(opts.scale, DEF.scale);
    const k = {}; for (const n in DEF) k[n] = num(opts[n], DEF[n]) * (['acc', 'dec', 'friction', 'top', 'jump', 'cut', 'gravity', 'maxFall', 'airAcc'].includes(n) ? s : 1);
    o.x = num(o.x, 0); o.y = num(o.y, 0); o.w = num(o.w, 24) || 24; o.h = num(o.h, 32) || 32; o.vx = num(o.vx, 0); o.vy = num(o.vy, 0);
    o._coy = num(o._coy, 9); o._buf = num(o._buf, 9);
    const ax = kit.axis ? kit.axis().x : 0;
    const left = opts.left !== undefined ? !!opts.left : ax < -.3, right = opts.right !== undefined ? !!opts.right : ax > .3;
    const jumpNow = opts.jump !== undefined ? !!opts.jump : !!(kit.pressed && kit.pressed('space'));
    const held = opts.jumpHeld !== undefined ? !!opts.jumpHeld : !!(kit.key && kit.key('space'));
    const list = Array.isArray(solids) ? solids.filter(rect).slice(0, 400) : [];
    // 1. ground speed
    const dir = (right ? 1 : 0) - (left ? 1 : 0), accel = o.onGround ? k.acc : k.airAcc;
    if (dir !== 0) {
      if (o.vx * dir < 0) o.vx += dir * k.dec * dt;                 // braking against travel
      else o.vx = dir * Math.min(k.top, Math.abs(o.vx) + accel * dt); // building toward top speed
      o.facing = dir;
    } else if (o.onGround) { const f = k.friction * dt; o.vx = Math.abs(o.vx) <= f ? 0 : o.vx - Math.sign(o.vx) * f; }
    // 2. jump, with coyote time and a buffered press
    o._coy = o.onGround ? 0 : o._coy + dt; o._buf = jumpNow ? 0 : o._buf + dt;
    if (o._coy <= k.coyote && o._buf <= k.buffer) { o.vy = -k.jump; o.onGround = false; o._coy = 9; o._buf = 9; o.jumped = true; } else o.jumped = false;
    // 3. variable height
    if (o.vy < -k.cut && !held) o.vy = -k.cut;
    // 4. gravity
    o.vy = Math.min(k.maxFall, o.vy + k.gravity * dt);
    // 5. move and resolve, one axis at a time, in steps no bigger than half the body
    o.hitWall = 0; o.hitHead = false; const wasGround = o.onGround; o.onGround = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(o.vx), Math.abs(o.vy)) * dt / (Math.min(o.w, o.h) / 2)));
    const sx = o.vx * dt / steps, sy = o.vy * dt / steps;
    for (let i = 0; i < steps; i++) {
      o.x += sx;
      for (const r of list) { if (r.oneWay || !overlap(o, r)) continue; if (sx > 0) o.x = r.x - o.w; else if (sx < 0) o.x = r.x + r.w; o.vx = 0; o.hitWall = sx > 0 ? 1 : -1; }
      const y0 = o.y; o.y += sy;
      for (const r of list) {
        if (!overlap(o, r)) continue;
        if (r.oneWay) { if (sy > 0 && y0 + o.h <= r.y + .01) { o.y = r.y - o.h; o.vy = 0; o.onGround = true; } continue; }
        if (sy > 0) { o.y = r.y - o.h; o.vy = 0; o.onGround = true; } else if (sy < 0) { o.y = r.y + r.h; o.vy = 0; o.hitHead = true; }
      }
    }
    // standing still on the ground: stay flagged grounded (a resting body does not move into its floor)
    if (!o.onGround && wasGround && o.vy >= 0) { const probe = { x: o.x, y: o.y + 1, w: o.w, h: o.h }; for (const r of list) if (overlap(probe, r) && (!r.oneWay || o.y + o.h <= r.y + 1.01)) { o.onGround = true; o.vy = 0; break; } }
    o.landed = o.onGround && !wasGround;
    return o;
  };
})();
