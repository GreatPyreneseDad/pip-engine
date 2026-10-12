// pip-engine game: tap frogs to make them bounce with smooth tweening (EXPERIMENTAL gen 2)
let frogs = [], score = 0;
const game = {
  init() {
    for (let i = 0; i < 4; i++) {
      frogs.push({
        x: kit.rand(80, W - 80),
        y: kit.rand(H * 0.4, H * 0.8),
        baseY: 0,
        size: 90,
        hop: 0
      });
    }
    frogs.forEach(f => f.baseY = f.y);
  },
  update(dt) {
    for (const f of frogs) {
      f.x = kit.clamp(f.x, 60, W - 60);
      f.hop = Math.max(0, f.hop - dt * 2);
      if (kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, f.x, f.y - 40) < 70) {
        f.hop = 1;
        score++;
        kit.sound('boing');
        kit.puff(f.x, f.y - 40, ['#5fd47a', '#ffd84d'], 12);
        // EXPERIMENTAL: tween the frog up with bounce easing
        kit.tween(f, { y: f.baseY - 120 }, 0.4, 'bounce');
        kit.tween(f, { size: 110 }, 0.2, 'elastic');
        setTimeout(() => {
          kit.tween(f, { y: f.baseY }, 0.3, 'bounce');
          kit.tween(f, { size: 90 }, 0.2, 'back');
        }, 400);
        if (score % 10 === 0) kit.win();
      }
    }
  },
  draw() {
    kit.bg('#8fd3ff', '#bdf0a8');
    for (const f of frogs) {
      kit.sprite('frog', f.x, f.y, f.size, { t: f.hop ? kit.t : 0 });
    }
    kit.text(score, W / 2, 160, 56);
  },
};
