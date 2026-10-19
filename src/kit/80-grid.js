// Grid system for board games, match-3, tic-tac-toe and tile puzzles.
// Consumed from KilledByAPixel/LittleJS @ cdcbef463d88 (MIT License)
// Adapted from:
//   src/engineTileLayer.js (TileLayer data storage and bounds checking)

(function() {
  const MAX_CELLS = 64; // cap each dimension to prevent runaway memory allocation

  function Grid(cols, rows, cellSize) {
    // validate and clamp dimensions to whole numbers
    if (typeof cols !== 'number' || typeof rows !== 'number' || typeof cellSize !== 'number') {
      return null;
    }
    if (isNaN(cols) || isNaN(rows) || isNaN(cellSize)) {
      return null;
    }
    cols = Math.max(1, Math.min(MAX_CELLS, Math.floor(cols)));
    rows = Math.max(1, Math.min(MAX_CELLS, Math.floor(rows)));
    cellSize = Math.max(1, cellSize);

    const data = new Array(cols * rows).fill(undefined);
    const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;

    return {
      get(c, r) {
        if (typeof c !== 'number' || typeof r !== 'number') return undefined;
        c = Math.floor(c);
        r = Math.floor(r);
        if (!inBounds(c, r)) return undefined;
        return data[r * cols + c];
      },
      set(c, r, v) {
        if (typeof c !== 'number' || typeof r !== 'number') return;
        c = Math.floor(c);
        r = Math.floor(r);
        if (!inBounds(c, r)) return;
        data[r * cols + c] = v;
      },
      cellAt(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') return null;
        if (isNaN(x) || isNaN(y)) return null;
        const c = Math.floor(x / cellSize);
        const r = Math.floor(y / cellSize);
        if (!inBounds(c, r)) return null;
        return { c: c, r: r };
      },
      center(c, r) {
        if (typeof c !== 'number' || typeof r !== 'number') return null;
        c = Math.floor(c);
        r = Math.floor(r);
        if (!inBounds(c, r)) return null;
        return { x: c * cellSize + cellSize / 2, y: r * cellSize + cellSize / 2 };
      },
      forEach(fn) {
        if (typeof fn !== 'function') return;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const v = data[r * cols + c];
            fn(v, c, r);
          }
        }
      },
      draw(fn) {
        if (typeof fn !== 'function') return;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const v = data[r * cols + c];
            if (v !== undefined && v !== null) {
              const x = c * cellSize + cellSize / 2;
              const y = r * cellSize + cellSize / 2;
              fn(v, x, y, cellSize);
            }
          }
        }
      }
    };
  }

  kit.grid = function(cols, rows, cellSize) {
    const g = Grid(cols, rows, cellSize);
    return g || Grid(1, 1, 1); // invalid inputs get a minimal 1×1 grid
  };
})();
