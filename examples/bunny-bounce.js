// Crowd demo: bunnies hop when tapped, and bounce away from each other using kit.pairs.
let bunnies = [];
const game = {
  init() {
    for (let i = 0; i < 12; i++) {
      bunnies.push({ x: kit.rand(80, W - 80), y: kit.rand(H * 0.3, H * 0.7), vx: 0, vy: 0, hop: 0, r: 35 });
    }
  },
  update(dt) {
    if (kit.pointer.pressed) {
      const near = kit.near(bunnies, kit.pointer.x, kit.pointer.y, 100);
      for (const b of near) {
        b.hop = 1;
        kit.sound('boing');
        kit.puff(b.x, b.y - 40, ['#ffd84d', '#ff6b9d'], 8);
      }
    }
    kit.pairs(bunnies, (a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) return;
      const push = (a.r + b.r - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      a.vx -= nx * push * 3; a.vy -= ny * push * 3;
      b.vx += nx * push * 3; b.vy += ny * push * 3;
    });
    for (const b of bunnies) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= 0.9; b.vy *= 0.9;
      b.x = kit.clamp(b.x, 60, W - 60); b.y = kit.clamp(b.y, 200, H - 100);
      if (b.x === 60 || b.x === W - 60) b.vx = 0;
      if (b.y === 200 || b.y === H - 100) b.vy = 0;
      b.hop = Math.max(0, b.hop - dt * 2);
    }
  },
  draw() {
    kit.bg('#8fd3ff', '#bdf0a8');
    for (const b of bunnies) {
      kit.sprite('bunny', b.x, b.y - Math.sin(b.hop * Math.PI) * 50, 70, { t: b.hop ? kit.t : 0 });
    }
  },
};
