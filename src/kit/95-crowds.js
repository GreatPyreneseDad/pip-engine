// Spatial queries for crowd behaviors: find nearby items, test circle overlaps.
// Collision detection approach inspired by lance-gg/lance @ fd9bc5dce93f (Apache-2.0 License)
// Hierarchical Spatial Hash Grid concept adapted from:
//   src/physics/SimplePhysics/HSHGCollisionDetection.ts
// Implementation simplified for one-shot queries (no persistent state).

(function() {
  // Minimal HSHG: a grid of cells, each holding objects whose bounding box overlaps it.
  // Cell size is chosen to be roughly the size of typical game objects (64px).
  const CELL_SIZE = 64;

  function makeGrid() {
    const cells = {};
    return {
      add(obj, x, y, r) {
        const minCellX = Math.floor((x - r) / CELL_SIZE);
        const maxCellX = Math.floor((x + r) / CELL_SIZE);
        const minCellY = Math.floor((y - r) / CELL_SIZE);
        const maxCellY = Math.floor((y + r) / CELL_SIZE);
        for (let cx = minCellX; cx <= maxCellX; cx++) {
          for (let cy = minCellY; cy <= maxCellY; cy++) {
            const key = cx + ',' + cy;
            (cells[key] || (cells[key] = [])).push(obj);
          }
        }
      },
      query(x, y, r) {
        const minCellX = Math.floor((x - r) / CELL_SIZE);
        const maxCellX = Math.floor((x + r) / CELL_SIZE);
        const minCellY = Math.floor((y - r) / CELL_SIZE);
        const maxCellY = Math.floor((y + r) / CELL_SIZE);
        const seen = new Set();
        const results = [];
        for (let cx = minCellX; cx <= maxCellX; cx++) {
          for (let cy = minCellY; cy <= maxCellY; cy++) {
            const key = cx + ',' + cy;
            const cell = cells[key];
            if (!cell) continue;
            for (const obj of cell) {
              if (seen.has(obj)) continue;
              seen.add(obj);
              results.push(obj);
            }
          }
        }
        return results;
      },
      allPairs() {
        const pairs = [];
        const globalSeen = new Set();
        for (const key in cells) {
          const cell = cells[key];
          for (let i = 0; i < cell.length; i++) {
            for (let j = i + 1; j < cell.length; j++) {
              const a = cell[i];
              const b = cell[j];
              const pairId = a.__hshgId < b.__hshgId ? a.__hshgId + '-' + b.__hshgId : b.__hshgId + '-' + a.__hshgId;
              if (globalSeen.has(pairId)) continue;
              globalSeen.add(pairId);
              pairs.push([a, b]);
            }
          }
        }
        return pairs;
      }
    };
  }

  const MAX_OBJECTS = 200;

  kit.near = function(list, x, y, radius) {
    if (!Array.isArray(list) || typeof x !== 'number' || typeof y !== 'number' || typeof radius !== 'number') return [];
    if (isNaN(x) || isNaN(y) || isNaN(radius) || radius < 0) return [];
    if (list.length === 0 || list.length > MAX_OBJECTS) return [];

    const results = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || typeof item !== 'object') continue;
      if (typeof item.x !== 'number' || typeof item.y !== 'number') continue;
      if (isNaN(item.x) || isNaN(item.y)) continue;
      const dx = item.x - x;
      const dy = item.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) results.push(item);
    }
    return results;
  };

  kit.pairs = function(list, fn) {
    if (!Array.isArray(list) || typeof fn !== 'function') return;
    if (list.length === 0 || list.length > MAX_OBJECTS) return;

    const grid = makeGrid();
    let nextId = 1;
    const validItems = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || typeof item !== 'object') continue;
      if (typeof item.x !== 'number' || typeof item.y !== 'number') continue;
      if (isNaN(item.x) || isNaN(item.y)) continue;
      let r = typeof item.r === 'number' && !isNaN(item.r) && item.r >= 0 ? item.r : 0;
      item.__hshgId = nextId++;
      validItems.push(item);
      grid.add(item, item.x, item.y, r);
    }

    const pairs = grid.allPairs();
    for (const [a, b] of pairs) {
      const ra = typeof a.r === 'number' && !isNaN(a.r) && a.r >= 0 ? a.r : 0;
      const rb = typeof b.r === 'number' && !isNaN(b.r) && b.r >= 0 ? b.r : 0;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;
      const sumR = ra + rb;
      if (distSq <= sumR * sumR) {
        try {
          fn(a, b);
        } catch (e) {
          // Ignore errors in user callback: a child's game must never freeze.
        }
      }
    }

    // Clean up temporary IDs
    for (const item of validItems) {
      delete item.__hshgId;
    }
  };
})();
