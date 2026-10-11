// A complete pip-engine game: tap the frogs to make them jump. This is the shape every game takes.
let frogs = [], score = 0;
const game = {
  init() { for (let i = 0; i < 4; i++) frogs.push({ x: kit.rand(80, W - 80), y: kit.rand(H * 0.4, H * 0.8), hop: 0 }); },
  update(dt) {
    for (const f of frogs) {
      f.x = kit.clamp(f.x, 60, W - 60); f.y = kit.clamp(f.y, 200, H - 140);
      f.hop = Math.max(0, f.hop - dt * 2);
      if (kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, f.x, f.y - 40) < 70) {
        f.hop = 1; score++; kit.sound('boing'); kit.puff(f.x, f.y - 40, ['#5fd47a', '#ffd84d'], 12);
        if (score % 10 === 0) kit.win();
      }
    }
  },
  draw() {
    kit.bg('#8fd3ff', '#bdf0a8');
    for (const f of frogs) kit.sprite('frog', f.x, f.y - Math.sin(f.hop * Math.PI) * 80, 90, { t: f.hop ? kit.t : 0 });
    kit.text(score, W / 2, 160, 56);
  },
};
