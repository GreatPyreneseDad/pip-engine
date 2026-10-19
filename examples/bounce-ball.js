// Bouncing ball physics demo: tap to add velocity, ball bounces off walls.
let ball = { x: 200, y: 300, vx: 0, vy: 0, r: 30 };
const game = {
  init() {},
  update(dt) {
    if (kit.pointer.pressed && kit.hit(kit.pointer, ball)) {
      ball.vx += kit.rand(-150, 150);
      ball.vy += kit.rand(-200, -100);
      kit.sound('boing');
      kit.puff(ball.x, ball.y, ['#5fd47a', '#ffd84d'], 15);
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vy += 500 * dt; // gravity
    kit.bounce(ball, { x: 0, y: 0, w: W, h: H });
    // friction
    ball.vx *= 0.99;
    ball.vy *= 0.99;
  },
  draw() {
    kit.bg('#1a1a2e', '#16213e');
    kit.emoji('⚽', ball.x, ball.y, ball.r * 2);
    kit.text('TAP THE BALL', W / 2, 160, 32, '#ffffff', 'center');
  },
};
