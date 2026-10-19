// Color utilities demo: rainbow gradient background, color-mixing particles, fading stars
let stars = [], nextSpawn = 0, score = 0;
const game = {
  init() {},
  update(dt) {
    nextSpawn -= dt;
    if (nextSpawn <= 0 && stars.length < 6) {
      const s = {
        x: kit.rand(60, W - 60),
        y: kit.rand(200, H - 100),
        hue: kit.rand(0, 360),
        phase: 0,
        collected: false
      };
      stars.push(s);
      nextSpawn = 1.2;
    }

    for (const s of stars) {
      if (!s.collected) {
        s.phase += dt * 2;
        if (kit.pointer.pressed && kit.dist(kit.pointer.x, kit.pointer.y, s.x, s.y) < 50) {
          s.collected = true;
          s.fadeStart = kit.t;
          score++;
          kit.sound('magic');
          const c1 = kit.color.hsl(s.hue, 1, 0.5);
          const c2 = kit.color.hsl((s.hue + 60) % 360, 1, 0.7);
          kit.puff(s.x, s.y, [c1, c2], 20);
          if (score % 5 === 0) kit.win();
        }
      }
    }

    stars = stars.filter(s => !s.collected || (kit.t - s.fadeStart) < 0.8);
  },
  draw() {
    const topColor = kit.color.rainbow(kit.t * 0.05);
    const botColor = kit.color.rainbow(kit.t * 0.05 + 0.5);
    kit.bg(topColor, botColor);

    for (const s of stars) {
      const baseColor = kit.color.hsl(s.hue, 1, 0.6);
      const glowColor = kit.color.hsl(s.hue, 0.8, 0.8);
      const pulseMix = 0.5 + 0.5 * Math.sin(s.phase * Math.PI);
      const starColor = kit.color.mix(baseColor, glowColor, pulseMix);

      let alpha = 1;
      if (s.collected) {
        const elapsed = kit.t - s.fadeStart;
        alpha = 1 - elapsed / 0.8;
      }

      const drawColor = kit.color.alpha(starColor, alpha);
      ctx.fillStyle = drawColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    kit.text(score, W / 2, 160, 64, '#ffffff', 'center');
  }
};
