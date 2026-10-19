# Experimental kit capabilities (gen 9)

The kit API with kit.grid added for grid-based games.

## New capabilities
- Grid creation: `kit.grid(cols, rows, cellSize)` returns a grid object
- Grid operations:
  - `get(c, r)` returns cell value or undefined
  - `set(c, r, v)` stores any value type
  - `cellAt(x, y)` converts screen point to `{c, r}` or null
  - `center(c, r)` converts cell to screen `{x, y}` or null
  - `forEach(fn)` iterates all cells with `fn(value, c, r)`
  - `draw(fn)` iterates non-empty cells with `fn(value, x, y, cellSize)`
- Cells can hold numbers, strings, objects, booleans, or undefined/null
- Grid dimensions capped at 64×64 (4096 cells max)

## Behaviour changes from classic
None. This is a capability addition, not a behaviour change. All existing kit functions work identically.

## Grid behaviour
- Invalid inputs (NaN, null, non-numbers) return a minimal 1×1 grid
- Fractional dimensions and indices are floored to integers
- Out-of-bounds reads return undefined, writes are ignored
- cellAt returns null for out-of-bounds or invalid screen coordinates
- center returns null for out-of-bounds or invalid cell coordinates
- forEach visits all cells including undefined ones, in row-major order
- draw skips undefined and null cells, visits others in row-major order
- cellSize minimum is 1, dimensions minimum is 1×1
- Grid at (0,0) with cellSize 50: cell (0,0) occupies screen (0,0) to (50,50)

## Evaluation metrics
- Test coverage: 25 tests covering all methods and edge cases (target)
- Bounded memory: 64×64 cap prevents runaway allocation
- Zero crashes: invalid inputs handled gracefully, never throw
- Match-3 example: functional in 40 lines (target)
- Performance: Grid ops O(1), forEach/draw O(n) where n = cols × rows
