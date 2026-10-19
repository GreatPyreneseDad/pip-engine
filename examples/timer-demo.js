// Timer demo: spawn stars that fade out, with a counter showing how many spawned.
let stars = [], spawnCount = 0, spawnHandle = null;
const game = {
  init() {
    spawnHandle = kit.every(1.5, () => {
      const s = { x: kit.rand(60, W - 60), y: kit.rand(200, H - 200), alpha: 1, born: kit.t };
      stars.push(s);
      spawnCount++;
      kit.after(3, () => {
        kit.tween(s, { alpha: 0 }, 1, 'sineInOut');
      });
      if (spawnCount >= 20) {
        spawnHandle.cancel();
        kit.after(2, () => { kit.win(); kit.after(3, () => { spawnCount = 0; stars = []; game.init(); }); });
      }
    });
  },
  update(dt) {
    stars = stars.filter(s => s.alpha > 0.01 || kit.t - s.born < 4);
  },
  draw() {
    kit.bg('#0a0a1a', '#1a1a3e');
    for (const s of stars) kit.item('star', s.x, s.y, 60, { alpha: s.alpha });
    kit.text(spawnCount, W / 2, 160, 56, '#ffd84d', 'center');
  },
};
