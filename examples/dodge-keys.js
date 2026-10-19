// A keyboard game on the floor contract: arrows or WASD (or the on-screen stick on a phone) dodge the falling rocks.
let x = 0, rocks = [], score = 0, lives = 3, over = false;
const game = {
  init() { x = W / 2; kit.touchControls('auto'); },
  update(dt) {
    if (over) { if (kit.pressed('space') || kit.pointer.pressed) { over = false; lives = 3; score = 0; rocks = []; } return; }
    x = kit.clamp(x + kit.axis().x * 320 * dt, 30, W - 30);
    if (Math.random() < dt * 1.5 && rocks.length < 40) rocks.push({ x: kit.rand(20, W - 20), y: -20, v: kit.rand(120, 260) });
    for (const r of rocks) { r.y += r.v * dt; if (Math.hypot(r.x - x, r.y - (H - kit.safeBottom - 60)) < 26) { r.y = H + 99; lives--; kit.shake(8); if (!lives) { over = true; kit.over(score); } } }
    rocks = rocks.filter(r => r.y < H + 50); score += dt * 10; kit.score(score);
  },
  draw() {
    kit.band(0, H, '#101820', '#1b2a38');
    for (const r of rocks) kit.circle(r.x, r.y, 14, '#9aa5b1');
    kit.circle(x, H - kit.safeBottom - 60, 18, '#ff8a1f');
    kit.label('score ' + Math.floor(score) + '  lives ' + lives, 12, 20, 14);
    if (over) kit.text('GAME OVER', W / 2, H / 2, 48);
  },
};
