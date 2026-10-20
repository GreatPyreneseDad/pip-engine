// A jumping game on the floor contract: arrows run, space jumps (tap low, hold high), collect the stars.
const solids = [{ x: 0, y: 740, w: 390, h: 60 }, { x: 60, y: 620, w: 120, h: 16, oneWay: true }, { x: 230, y: 520, w: 120, h: 16, oneWay: true }, { x: 150, y: 400, w: 90, h: 16, oneWay: true }];
const p = { x: 40, y: 700, w: 24, h: 32, vx: 0, vy: 0, facing: 1 }; let stars = [], score = 0;
const game = {
  init() { kit.touchControls('auto'); stars = solids.slice(1).map(s => ({ x: s.x + s.w / 2, y: s.y - 24, r: 14 })); },
  update(dt) { kit.platform(p, solids, dt); if (p.landed) kit.sound('tap'); if (p.jumped) kit.sound('jump');
    stars = stars.filter(st => { if (kit.hit(p, st)) { score++; kit.score(score); kit.puff(st.x, st.y, ['#ffd27a'], 10); kit.sound('coin'); return false; } return true; });
    if (!stars.length) { kit.win(); game.init(); } },
  draw() { kit.bg('#1b2a44', '#3a5a7a'); for (const s of solids) kit.rect(s.x, s.y, s.w, s.h, s.oneWay ? '#8a6a3a' : '#3a4a3a'); for (const st of stars) kit.item('star', st.x, st.y, 28);
    kit.sprite('robot', p.x + p.w / 2, p.y + p.h, 40, { flip: p.facing < 0, t: Math.abs(p.vx) > 10 ? kit.t : 0 }); kit.label('stars ' + score, 12, 20, 14); },
};
