/**
 * Finds valid queen placements for a region-partitioned Queens board.
 *
 * @param {number[][]} regions - n×n grid whose entries are region ids.
 * @param {number} n - Board size.
 * @param {(solution: number[]) => boolean} onSolution - Return true to stop.
 * @returns {number} Number of solutions visited before stopping.
 */
function search(regions, n, onSolution) {
  const usedColumns = new Array(n).fill(false);
  const usedRegions = new Array(n).fill(false);
  const solution = new Array(n);
  let count = 0;

  // The last row index on which each region appears. Once we advance past a
  // region's last row without having used it, no completion is possible, so we
  // can prune the whole branch (a region must hold a queen in one of its rows).
  const regionLastRow = new Array(n).fill(-1);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const g = regions[r][c];
      if (r > regionLastRow[g]) regionLastRow[g] = r;
    }
  }

  function backtrack(row, previousColumn) {
    if (row === n) {
      count += 1;
      return onSolution(solution.slice());
    }

    for (let region = 0; region < n; region++) {
      if (!usedRegions[region] && regionLastRow[region] < row) return false;
    }

    for (let column = 0; column < n; column++) {
      if (usedColumns[column]) continue;
      if (row > 0 && Math.abs(column - previousColumn) < 2) continue;

      const region = regions[row][column];
      if (usedRegions[region]) continue;

      usedColumns[column] = true;
      usedRegions[region] = true;
      solution[row] = column;

      if (backtrack(row + 1, column)) return true;

      usedColumns[column] = false;
      usedRegions[region] = false;
    }

    return false;
  }

  backtrack(0, -Infinity);
  return count;
}

/**
 * Count valid Queens solutions for a region grid, stopping once limit is reached.
 *
 * @param {number[][]} regions - n×n grid with region ids 0..n-1.
 * @param {number} n - Board size.
 * @param {number} [limit=2] - Maximum count to compute before early exit.
 * @returns {number} Solution count capped at limit.
 */
export function countSolutions(regions, n, limit = 2) {
  if (limit <= 0) return 0;

  let cappedCount = 0;
  search(regions, n, () => {
    cappedCount += 1;
    return cappedCount >= limit;
  });
  return cappedCount;
}

/**
 * Return the first valid Queens solution for a region grid.
 *
 * @param {number[][]} regions - n×n grid with region ids 0..n-1.
 * @param {number} n - Board size.
 * @returns {number[] | null} Column index per row, or null if unsolvable.
 */
export function solve(regions, n) {
  let firstSolution = null;

  search(regions, n, (solution) => {
    firstSolution = solution;
    return true;
  });

  return firstSolution;
}
