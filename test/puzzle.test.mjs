import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generatePuzzle,
  generateUniquePuzzle,
  generateSolvablePuzzle,
  generatePuzzleForMode,
  UNIQUE_MAX_N,
} from '../js/puzzle.js';
import { mulberry32 } from '../js/rng.js';
import { countSolutions, solve } from '../js/solver.js';

function isPermutation(values, n) {
  return (
    Array.isArray(values) &&
    values.length === n &&
    new Set(values).size === n &&
    values.every((v) => Number.isInteger(v) && v >= 0 && v < n)
  );
}

// A column-per-row placement satisfies all geometric + region rules.
function isValidSolution(sol, regions, n) {
  if (!isPermutation(sol, n)) return false;
  const regs = new Set();
  for (let r = 0; r < n; r++) {
    if (r > 0 && Math.abs(sol[r] - sol[r - 1]) < 2) return false;
    regs.add(regions[r][sol[r]]);
  }
  return regs.size === n;
}

// Every region id 0..n-1 is present and 4-connected.
function regionsContiguous(regions, n) {
  const cellsByRegion = new Map();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const g = regions[r][c];
      if (!cellsByRegion.has(g)) cellsByRegion.set(g, []);
      cellsByRegion.get(g).push([r, c]);
    }
  }
  if (cellsByRegion.size !== n) return false;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [g, cells] of cellsByRegion) {
    const seen = new Set([cells[0][0] * n + cells[0][1]]);
    const stack = [cells[0]];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] === g) {
          const id = nr * n + nc;
          if (!seen.has(id)) {
            seen.add(id);
            stack.push([nr, nc]);
          }
        }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

function assertValidPuzzle(p, n, { requireUnique }) {
  assert.equal(p.n, n);
  assert.equal(isPermutation(p.solution, n), true, 'intended solution is a permutation');
  for (let r = 1; r < n; r++) {
    assert.ok(Math.abs(p.solution[r] - p.solution[r - 1]) >= 2, `rows ${r - 1},${r} not adjacent`);
  }

  assert.equal(p.regions.length, n);
  const present = new Set();
  for (let r = 0; r < n; r++) {
    assert.equal(p.regions[r].length, n, `region row ${r} width`);
    for (let c = 0; c < n; c++) {
      const g = p.regions[r][c];
      assert.ok(Number.isInteger(g) && g >= 0 && g < n, `region id in range at ${r},${c}`);
      present.add(g);
    }
  }
  assert.equal(present.size, n, 'all n region ids present');
  for (let r = 0; r < n; r++) {
    assert.equal(p.regions[r][p.solution[r]], r, `row ${r} queen seeds region ${r}`);
  }
  assert.equal(regionsContiguous(p.regions, n), true, 'every region is contiguous');

  // The intended solution must actually be a solution.
  assert.equal(isValidSolution(p.solution, p.regions, n), true, 'intended solution obeys all rules');
  const found = solve(p.regions, n);
  assert.equal(isValidSolution(found, p.regions, n), true, 'solver returns a valid solution');
  const solutionCount = countSolutions(p.regions, n, 2);
  assert.ok(solutionCount >= 1, 'puzzle is solvable');

  if (requireUnique) {
    assert.equal(p.unique, true, 'flagged unique');
    assert.equal(solutionCount, 1, 'exactly one solution');
    assert.deepEqual(found, p.solution, 'the unique solution is the intended one');
  }
}

test('generatePuzzle yields guaranteed-unique boards for small sizes', () => {
  for (const n of [6, 7, 8, 9, 10, 11]) {
    for (const seed of [0x12345678, 0xdecafbad]) {
      const p = generatePuzzle(n, mulberry32(seed + n));
      assertValidPuzzle(p, n, { requireUnique: true });
    }
  }
});

test('generatePuzzle yields solvable organic boards for large sizes', () => {
  for (const n of [13, 15, 18, 20]) {
    for (const seed of [0x12345678, 0xdecafbad]) {
      const p = generatePuzzle(n, mulberry32(seed + n));
      assert.equal(p.unique, false, 'large boards are not flagged unique');
      assertValidPuzzle(p, n, { requireUnique: false });
    }
  }
});

test('n=12 is the unique/feasible boundary and always produces a valid board', () => {
  const p = generatePuzzle(12, mulberry32(2024));
  assert.equal(p.n, 12);
  assert.equal(UNIQUE_MAX_N, 12);
  assertValidPuzzle(p, 12, { requireUnique: false });
});

test('generateUniquePuzzle returns a unique board (or null) and generateSolvablePuzzle is always solvable', () => {
  const u = generateUniquePuzzle(8, mulberry32(7));
  assert.notEqual(u, null);
  assertValidPuzzle(u, 8, { requireUnique: true });

  const s = generateSolvablePuzzle(16, mulberry32(7));
  assert.equal(s.unique, false);
  assertValidPuzzle(s, 16, { requireUnique: false });
});

test('generatePuzzleForMode maps modes to sizes and tags mode + uniqueness', () => {
  const easy = generatePuzzleForMode('easy', undefined, mulberry32(11));
  assert.equal(easy.mode, 'easy');
  assertValidPuzzle(easy, 7, { requireUnique: true });

  const vh = generatePuzzleForMode('veryhard', undefined, mulberry32(11));
  assert.equal(vh.mode, 'veryhard');
  assertValidPuzzle(vh, 15, { requireUnique: false });

  const cLow = generatePuzzleForMode('custom', 4, mulberry32(11)); // clamps up to 6
  assertValidPuzzle(cLow, 6, { requireUnique: true });

  const cHigh = generatePuzzleForMode('custom', 99, mulberry32(11)); // clamps to 20
  assertValidPuzzle(cHigh, 20, { requireUnique: false });
});

test('generation is deterministic for a fixed size and seed', () => {
  assert.deepEqual(generatePuzzle(8, mulberry32(99)), generatePuzzle(8, mulberry32(99)));
  assert.deepEqual(generatePuzzle(15, mulberry32(99)), generatePuzzle(15, mulberry32(99)));
});
