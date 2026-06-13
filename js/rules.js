/** Empty player board cell. */
export const EMPTY = 0;
/** Player-placed mark cell. */
export const MARK = 1;
/** Queen cell. */
export const QUEEN = 2;

/**
 * Return the coordinates of every queen on the board.
 * @param {number[][]} cells
 * @returns {Array<{ r: number, c: number }>}
 */
export function queenPositions(cells) {
  const queens = [];

  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (cells[r][c] === QUEEN) {
        queens.push({ r, c });
      }
    }
  }

  return queens;
}

/**
 * Test whether two different positions touch horizontally, vertically, or diagonally.
 * @param {{ r: number, c: number }} a
 * @param {{ r: number, c: number }} b
 * @returns {boolean}
 */
export function isAdjacent(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr !== 0 || dc !== 0) && dr <= 1 && dc <= 1;
}

/**
 * Find every queen that shares a row, column, region, or adjacent cell with another queen.
 * @param {number[][]} cells
 * @param {number[][]} regions
 * @returns {Array<{ r: number, c: number }>}
 */
export function findConflicts(cells, regions) {
  const queens = queenPositions(cells);
  const conflicts = new Map();

  function addConflict(position) {
    conflicts.set(`${position.r},${position.c}`, position);
  }

  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      const a = queens[i];
      const b = queens[j];
      const sameRow = a.r === b.r;
      const sameColumn = a.c === b.c;
      const sameRegion = regions[a.r][a.c] === regions[b.r][b.c];

      if (sameRow || sameColumn || sameRegion || isAdjacent(a, b)) {
        addConflict(a);
        addConflict(b);
      }
    }
  }

  return [...conflicts.values()];
}

/**
 * Test whether the board is solved under all Queens puzzle rules.
 * @param {number[][]} cells
 * @param {number[][]} regions
 * @returns {boolean}
 */
export function isSolved(cells, regions) {
  const n = regions.length;
  return queenPositions(cells).length === n && findConflicts(cells, regions).length === 0;
}
