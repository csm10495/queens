import { generateSolution } from './generator.js';
import { shuffle } from './rng.js';
import { sizeForMode } from './modes.js';

// Puzzle generation
// -----------------
// Guaranteeing a UNIQUE solution is cheap for small boards but becomes
// computationally infeasible in-browser for large ones. So we use a hybrid:
//   * n <= UNIQUE_MAX_N: build a guaranteed-unique board by growing regions
//     outward from single-cell seeds, only unblocking a cell into a region when
//     the puzzle stays uniquely solvable (verified by a forward-checked oracle).
//   * larger n: build an organic, balanced, contiguous partition that is
//     guaranteed SOLVABLE (the intended solution always exists). It may admit
//     more than one solution, which is fine: win detection is rule-based (any
//     valid placement wins) and "give up" reveals the intended solution.
// Either way each region is contiguous and contains exactly one intended queen.

export const UNIQUE_MAX_N = 12;

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Does a valid completion exist with a queen forced at (fr, fc)? Cells with
 * region === -1 are blocked (no queen). Pruning exploits two facts: with one
 * queen per row, adjacency only matters between consecutive rows; and a region
 * is impossible once we pass its last occupied row without using it.
 */
function completionExistsWith(regions, n, fr, fc) {
  const lastRow = new Array(n).fill(-1);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const g = regions[r][c];
      if (g !== -1 && r > lastRow[g]) lastRow[g] = r;
    }
  }
  const usedCol = new Array(n).fill(false);
  const usedReg = new Array(n).fill(false);

  const dfs = (row, prevCol) => {
    if (row === n) return true;
    for (let g = 0; g < n; g++) if (!usedReg[g] && lastRow[g] < row) return false;

    if (row === fr) {
      const g = regions[fr][fc];
      if (g === -1 || usedReg[g] || usedCol[fc]) return false;
      if (prevCol >= 0 && Math.abs(fc - prevCol) < 2) return false;
      usedCol[fc] = usedReg[g] = true;
      const ok = dfs(row + 1, fc);
      usedCol[fc] = usedReg[g] = false;
      return ok;
    }

    for (let c = 0; c < n; c++) {
      if (usedCol[c]) continue;
      if (prevCol >= 0 && Math.abs(c - prevCol) < 2) continue;
      const g = regions[row][c];
      if (g === -1 || usedReg[g]) continue;
      usedCol[c] = usedReg[g] = true;
      if (dfs(row + 1, c)) {
        usedCol[c] = usedReg[g] = false;
        return true;
      }
      usedCol[c] = usedReg[g] = false;
    }
    return false;
  };

  return dfs(0, -1);
}

/**
 * Grow a guaranteed-unique region map for solution S by unblocking cells one at
 * a time, keeping the puzzle uniquely solvable. Returns regions or null if it
 * could not fully partition the grid while preserving uniqueness.
 */
function growUniqueRegions(n, S, rng) {
  const regions = Array.from({ length: n }, () => new Array(n).fill(-1));
  for (let r = 0; r < n; r++) regions[r][S[r]] = r;

  let pending = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (regions[r][c] === -1) pending.push([r, c]);
  }
  shuffle(rng, pending);

  let noProgressSweeps = 0;
  while (pending.length) {
    const next = [];
    let progressed = false;
    for (const [r, c] of pending) {
      const cand = [];
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] !== -1) {
          const g = regions[nr][nc];
          if (!cand.includes(g)) cand.push(g);
        }
      }
      if (cand.length === 0) {
        next.push([r, c]);
        continue;
      }
      shuffle(rng, cand);
      let placed = false;
      for (const g of cand) {
        regions[r][c] = g;
        // Safe to unblock iff doing so does NOT enable any alternate solution
        // (any solution through this cell would differ from S, breaking uniqueness).
        if (!completionExistsWith(regions, n, r, c)) {
          placed = true;
          progressed = true;
          break;
        }
        regions[r][c] = -1;
      }
      if (!placed) next.push([r, c]);
    }
    pending = next;
    if (!progressed) {
      if (++noProgressSweeps > 1) return null;
      shuffle(rng, pending);
    } else {
      noProgressSweeps = 0;
    }
  }
  return regions;
}

/**
 * Grow an organic, balanced, contiguous partition seeded at each queen via
 * round-robin multi-source BFS. The intended solution S is always a solution,
 * so the puzzle is guaranteed solvable (uniqueness not guaranteed).
 */
function growBalancedRegions(n, S, rng) {
  const regions = Array.from({ length: n }, () => new Array(n).fill(-1));
  const frontier = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) {
    regions[r][S[r]] = r;
    frontier[r].push([r, S[r]]);
  }
  let remaining = n * n - n;
  const order = Array.from({ length: n }, (_, i) => i);

  while (remaining > 0) {
    shuffle(rng, order);
    let any = false;
    for (const g of order) {
      const f = frontier[g];
      let claimed = false;
      while (f.length && !claimed) {
        const idx = Math.floor(rng() * f.length);
        const [cr, cc] = f[idx];
        const free = [];
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] === -1) free.push([nr, nc]);
        }
        if (free.length === 0) {
          f.splice(idx, 1);
          continue;
        }
        const [pr, pc] = free[Math.floor(rng() * free.length)];
        regions[pr][pc] = g;
        remaining--;
        any = true;
        claimed = true;
        f.push([pr, pc]);
      }
    }
    if (!any) break;
  }

  // Defensive cleanup: attach any stragglers to an assigned neighbour's region.
  let guard = n * n;
  while (remaining > 0 && guard-- > 0) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (regions[r][c] !== -1) continue;
        for (const [dr, dc] of DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] !== -1) {
            regions[r][c] = regions[nr][nc];
            remaining--;
            break;
          }
        }
      }
    }
  }
  return regions;
}

/**
 * Attempt to build a guaranteed-UNIQUE puzzle. Returns the puzzle, or null if a
 * unique layout could not be found within the attempt budget.
 * @returns {{ n:number, solution:number[], regions:number[][], unique:true } | null}
 */
export function generateUniquePuzzle(n, rng, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 160;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolution(n, rng);
    if (!solution) continue;
    const regions = growUniqueRegions(n, solution, rng);
    if (regions) return { n, solution, regions, unique: true };
  }
  return null;
}

/**
 * Build a guaranteed-SOLVABLE puzzle (the intended solution always exists; it
 * may not be unique). Generation is effectively instant for any size.
 * @returns {{ n:number, solution:number[], regions:number[][], unique:false }}
 */
export function generateSolvablePuzzle(n, rng) {
  const solution = generateSolution(n, rng);
  const regions = growBalancedRegions(n, solution, rng);
  return { n, solution, regions, unique: false };
}

/**
 * Main entry point: a unique puzzle when that is feasible (n <= UNIQUE_MAX_N),
 * otherwise a solvable organic puzzle.
 * @returns {{ n:number, solution:number[], regions:number[][], unique:boolean }}
 */
export function generatePuzzle(n, rng) {
  if (n <= UNIQUE_MAX_N) {
    const unique = generateUniquePuzzle(n, rng);
    if (unique) return unique;
  }
  return generateSolvablePuzzle(n, rng);
}

/**
 * Generate a puzzle for a difficulty mode.
 * @returns {{ mode:string, n:number, solution:number[], regions:number[][], unique:boolean }}
 */
export function generatePuzzleForMode(mode, customN, rng) {
  const n = sizeForMode(mode, customN);
  return { mode, ...generatePuzzle(n, rng) };
}
