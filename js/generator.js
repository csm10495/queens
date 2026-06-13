import { randInt, shuffle } from './rng.js';

function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

function validateGridSize(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError('n must be a positive integer');
  }
}

function backtrackSolution(n, rng, row, solution, usedColumns) {
  if (row === n) {
    return true;
  }

  const columns = shuffle(rng, range(n));
  const prevCol = row > 0 ? solution[row - 1] : null;

  for (const col of columns) {
    if (usedColumns.has(col)) {
      continue;
    }
    if (prevCol !== null && Math.abs(col - prevCol) < 2) {
      continue;
    }

    solution[row] = col;
    usedColumns.add(col);

    if (backtrackSolution(n, rng, row + 1, solution, usedColumns)) {
      return true;
    }

    usedColumns.delete(col);
    solution[row] = undefined;
  }

  return false;
}

function neighbors(n, row, col) {
  const cells = [];
  if (row > 0) cells.push([row - 1, col]);
  if (row < n - 1) cells.push([row + 1, col]);
  if (col > 0) cells.push([row, col - 1]);
  if (col < n - 1) cells.push([row, col + 1]);
  return cells;
}

/**
 * Generate a queen placement with one queen per row and column and no adjacent
 * queens in consecutive rows.
 * @param {number} n - Grid size.
 * @param {() => number} rng - Random number generator returning floats in [0, 1).
 * @returns {number[] | null} A valid solution, or null for unsolvable n=2 or n=3.
 */
export function generateSolution(n, rng) {
  validateGridSize(n);

  if (n === 1) {
    return [0];
  }
  if (n === 2 || n === 3) {
    return null;
  }

  const maxAttempts = 5000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = new Array(n);
    if (backtrackSolution(n, rng, 0, solution, new Set())) {
      return solution;
    }
  }

  throw new Error(`Unable to generate a solution for n=${n}`);
}

/**
 * Grow contiguous color regions from the queen cells with randomized
 * multi-source flood fill.
 * @param {number} n - Grid size.
 * @param {number[]} solution - solution[row] = queen column for that row.
 * @param {() => number} rng - Random number generator returning floats in [0, 1).
 * @returns {number[][]} Region id grid.
 */
export function growRegions(n, solution, rng) {
  validateGridSize(n);
  if (!Array.isArray(solution) || solution.length !== n) {
    throw new RangeError('solution must be an array of length n');
  }

  const regions = Array.from({ length: n }, () => Array(n).fill(-1));
  const frontier = [];
  let assigned = 0;

  for (let regionId = 0; regionId < n; regionId++) {
    const col = solution[regionId];
    if (!Number.isInteger(col) || col < 0 || col >= n) {
      throw new RangeError('solution columns must be integers in [0, n)');
    }
    if (regions[regionId][col] !== -1) {
      throw new RangeError('solution must contain distinct queen cells');
    }

    regions[regionId][col] = regionId;
    assigned++;
  }

  for (let regionId = 0; regionId < n; regionId++) {
    for (const [row, col] of neighbors(n, regionId, solution[regionId])) {
      if (regions[row][col] === -1) {
        frontier.push({ row, col, regionId });
      }
    }
  }

  while (assigned < n * n) {
    if (frontier.length === 0) {
      throw new Error('Unable to grow regions to cover the grid');
    }

    const index = randInt(rng, frontier.length);
    const candidate = frontier[index];
    frontier[index] = frontier[frontier.length - 1];
    frontier.pop();

    if (regions[candidate.row][candidate.col] !== -1) {
      continue;
    }

    regions[candidate.row][candidate.col] = candidate.regionId;
    assigned++;

    for (const [row, col] of neighbors(n, candidate.row, candidate.col)) {
      if (regions[row][col] === -1) {
        frontier.push({ row, col, regionId: candidate.regionId });
      }
    }
  }

  return regions;
}

/**
 * Generate a candidate puzzle without checking whether its solution is unique.
 * @param {number} n - Grid size.
 * @param {() => number} rng - Random number generator returning floats in [0, 1).
 * @returns {{ n: number, solution: number[], regions: number[][] }}
 */
export function generateCandidate(n, rng) {
  const solution = generateSolution(n, rng);
  if (solution === null) {
    throw new Error(`No candidate exists for n=${n}`);
  }

  return {
    n,
    solution,
    regions: growRegions(n, solution, rng),
  };
}
