import test from 'node:test';
import assert from 'node:assert/strict';

import { countSolutions, solve } from '../js/solver.js';
import { mulberry32 } from '../js/rng.js';

const BIG_LIMIT = 100_000;
const generatorModule = await import('../js/generator.js').catch(() => null);

function columnsAsRegions(n) {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, (_, column) => column),
  );
}

function fallbackCandidate(n) {
  return { n, regions: columnsAsRegions(n) };
}

function makeCandidate(n, seed) {
  if (generatorModule?.generateCandidate) {
    return generatorModule.generateCandidate(n, mulberry32(seed));
  }
  return fallbackCandidate(n);
}

function isPermutation(solution, n) {
  return (
    Array.isArray(solution) &&
    solution.length === n &&
    new Set(solution).size === n &&
    solution.every((column) => Number.isInteger(column) && column >= 0 && column < n)
  );
}

function assertValidSolution(regions, n, solution) {
  assert.equal(isPermutation(solution, n), true, 'solution must be a column permutation');

  const usedRegions = new Set();
  for (let row = 0; row < n; row++) {
    usedRegions.add(regions[row][solution[row]]);
    if (row > 0) {
      assert.ok(
        Math.abs(solution[row] - solution[row - 1]) >= 2,
        'consecutive rows must not contain adjacent queens',
      );
    }
  }

  assert.equal(usedRegions.size, n, 'solution must use every region exactly once');
}

function solutionSatisfiesRegions(regions, n, solution) {
  const usedRegions = new Set();
  for (let row = 0; row < n; row++) {
    const region = regions[row][solution[row]];
    if (usedRegions.has(region)) return false;
    usedRegions.add(region);
  }
  return usedRegions.size === n;
}

function bruteForceCount(regions, n) {
  const usedColumns = new Array(n).fill(false);
  const solution = new Array(n);
  let count = 0;

  function visit(row) {
    if (row === n) {
      if (solutionSatisfiesRegions(regions, n, solution)) count += 1;
      return;
    }

    for (let column = 0; column < n; column++) {
      if (usedColumns[column]) continue;
      if (row > 0 && Math.abs(column - solution[row - 1]) < 2) continue;

      usedColumns[column] = true;
      solution[row] = column;
      visit(row + 1);
      usedColumns[column] = false;
    }
  }

  visit(0);
  return count;
}

test('countSolutions matches independent brute force and solve returns valid generated solutions', () => {
  const cases = [
    { n: 4, seed: 101 },
    { n: 5, seed: 202 },
    { n: 6, seed: 303 },
    { n: 7, seed: 404 },
    { n: 7, seed: 505 },
  ];

  for (const { n, seed } of cases) {
    const candidate = makeCandidate(n, seed);
    const trueCount = bruteForceCount(candidate.regions, n);

    assert.equal(
      countSolutions(candidate.regions, n, BIG_LIMIT),
      trueCount,
      `solver count must match brute force for n=${n}, seed=${seed}`,
    );

    const solution = solve(candidate.regions, n);
    assert.notEqual(solution, null, `generated board should be solvable for n=${n}, seed=${seed}`);
    assertValidSolution(candidate.regions, n, solution);
    assert.ok(
      countSolutions(candidate.regions, n, 1) >= 1,
      'a solved generated board must have at least one counted solution',
    );
  }
});

test('countSolutions respects early-exit limits consistently with true counts', () => {
  for (const { n, seed } of [
    { n: 4, seed: 606 },
    { n: 5, seed: 707 },
    { n: 6, seed: 808 },
    { n: 7, seed: 909 },
  ]) {
    const { regions } = makeCandidate(n, seed);
    const trueCount = bruteForceCount(regions, n);

    assert.equal(countSolutions(regions, n, 1), Math.min(trueCount, 1));
    assert.equal(countSolutions(regions, n, 2), Math.min(trueCount, 2));
    assert.ok(countSolutions(regions, n, 1) <= 1);
    assert.ok(countSolutions(regions, n, 2) <= 2);
  }
});

test('column regions produce the expected deterministic non-unique n=4 board', () => {
  const regions = columnsAsRegions(4);

  assert.equal(bruteForceCount(regions, 4), 2);
  assert.equal(countSolutions(regions, 4, 99), 2);
  assert.equal(countSolutions(regions, 4, 1), 1);
  assertValidSolution(regions, 4, solve(regions, 4));
});

test('n=2 column regions are unsolvable', () => {
  const regions = columnsAsRegions(2);

  assert.equal(bruteForceCount(regions, 2), 0);
  assert.equal(countSolutions(regions, 2, 99), 0);
  assert.equal(solve(regions, 2), null);
});

test('zero or negative limits return zero without searching for solutions', () => {
  const regions = columnsAsRegions(4);

  assert.equal(countSolutions(regions, 4, 0), 0);
  assert.equal(countSolutions(regions, 4, -3), 0);
});
