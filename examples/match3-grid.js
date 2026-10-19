// A match-3 game using kit.grid: swap gems to make lines of 3.
const COLS = 6, ROWS = 8, SIZE = Math.min(W / COLS, H / ROWS) * 0.9;
const GEMS = ['💎', '💚', '💙', '🧡', '💜'];
let grid, selected = null, score = 0, moves = 0;

const game = {
  init() {
    grid = kit.grid(COLS, ROWS, SIZE);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid.set(c, r, kit.pick(GEMS));
      }
    }
  },
  update(dt) {
    if (kit.pointer.pressed) {
      const cell = grid.cellAt(kit.pointer.x, kit.pointer.y);
      if (cell) {
        if (selected && Math.abs(selected.c - cell.c) + Math.abs(selected.r - cell.r) === 1) {
          const v1 = grid.get(selected.c, selected.r);
          const v2 = grid.get(cell.c, cell.r);
          grid.set(selected.c, selected.r, v2);
          grid.set(cell.c, cell.r, v1);
          kit.sound('tap');
          moves++;
          selected = null;
          // Check for matches (simplified: just count, real game would clear them)
          let matches = 0;
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
              const a = grid.get(c, r), b = grid.get(c + 1, r), d = grid.get(c + 2, r);
              if (a && a === b && b === d) matches++;
            }
          }
          if (matches > 0) {
            score += matches * 10;
            kit.sound('pop');
            kit.puff(W / 2, H / 2, ['#ffd700', '#ff69b4'], 20);
            if (score >= 50) kit.win();
          }
        } else {
          selected = cell;
        }
      }
    }
  },
  draw() {
    kit.bg('#4a148c', '#1a237e');
    grid.draw((gem, x, y, size) => {
      kit.emoji(gem, x, y, size * 0.8);
    });
    if (selected) {
      const pos = grid.center(selected.c, selected.r);
      if (pos) {
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 4;
        ctx.strokeRect(pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
      }
    }
    kit.text(score, W / 2, 60, 48, '#fff');
  },
};
