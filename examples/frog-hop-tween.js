// Frog hopping with kit.tween: tap a frog to make it hop with a bouncy landing.
// Demonstrates EXPERIMENTAL gen 2 tweening.
let frogs = [], score = 0;
const game = {
  init() {
    for (let i = 0; i < 4; i++) {
      frogs.push({ x: kit.rand(80, W - 80), y: kit.rand(H * 0.4, H * 0.8), hop: 0 });
    }
  },
  update(dt) {
    for (const f of frogs) {
      f.x = kit.clamp(f.x, 60, W - 60);
      f.y = kit.clamp(f.y, 200, H - 140);
      
      if (kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, f.x, f.y - 40) < 70) {
        f.hop = 1;
        kit.tween(f, { hop: 0 }, 0.6, 'bounceOut');
        score++;
        kit.sound('boing');
        kit.puff(f.x, f.y - 40, ['#5fd47a', '#ffd84d'], 12);
        if (score % 10 === 0) kit.win();
      }
    }
  },
  draw() {
    kit.bg('#8fd3ff', '#bdf0a8');
    for (const f of frogs) {
      const hopHeight = Math.sin(f.hop * Math.PI) * 80;
      kit.sprite('frog', f.x, f.y - hopHeight, 90, { t: f.hop > 0 ? kit.t : 0 });
    }
    kit.text(score, W / 2, 160, 56);
  },
};
