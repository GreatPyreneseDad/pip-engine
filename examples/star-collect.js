// Tween demo: stars fall smoothly from the top with bounceOut easing.
let stars = [], score = 0, nextSpawn = 0;
const game = {
  init() {},
  update(dt) {
    nextSpawn -= dt;
    if (nextSpawn <= 0 && stars.length < 8) {
      const s = { x: kit.rand(60, W - 60), y: -50, collected: false };
      kit.tween(s, { y: kit.rand(H * 0.3, H * 0.7) }, kit.rand(1, 2), 'bounceOut');
      stars.push(s);
      nextSpawn = 0.8;
    }
    for (const s of stars) {
      if (!s.collected && kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, s.x, s.y) < 50) {
        s.collected = true; s.gone = kit.t + 0.6;
        score++;
        kit.sound('magic');
        kit.puff(s.x, s.y, ['#ffd84d', '#ff6b9d'], 15);
        kit.tween(s, { y: s.y - 100 }, 0.5, 'elasticOut');
        if (score % 5 === 0) kit.win();
      }
    }
    stars = stars.filter(s => !(s.collected && kit.t > s.gone)); // collected stars leave, so new ones keep falling
  },
  draw() {
    kit.bg('#1a1a2e', '#16213e');
    for (const s of stars) {
      if (!s.collected) kit.item('star', s.x, s.y, 80);
    }
    kit.text(score, W / 2, 160, 64, '#ffd84d', 'center'); // below the button strip (top 120 px)
  },
};
