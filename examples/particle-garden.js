// Tap to plant flowers that emit sparkles and butterflies.
let flowers = [];
const game = {
  init() {},
  update(dt) {
    if (kit.pointer.pressed) {
      const x = kit.pointer.x, y = kit.pointer.y;
      if (y > 200 && flowers.length < 20) {
        flowers.push({ x, y, age: 0 });
        kit.sound('pop');
        kit.burst('sparkles', x, y - 30, 15);
      }
    }
    for (const f of flowers) {
      f.age += dt;
      if (f.age > 2 && Math.random() < 0.01) {
        kit.emit('bubbles', f.x, f.y - 40, 0.3);
      }
    }
  },
  draw() {
    kit.bg('#8fd3ff', '#d6f5c9');
    kit.text('Tap to plant flowers!', W / 2, 120, 32, '#fff');
    for (const f of flowers) {
      kit.prop('flower', f.x, f.y, 60);
      if (f.age < 0.5) {
        const s = kit.ease('backOut', f.age / 0.5);
        kit.emoji('✨', f.x, f.y - 30, 30 * s);
      }
    }
  },
};
