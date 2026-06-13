import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCandidate, generateSolution, growRegions } from '../js/generator.js';
import { mulberry32 } from '../js/rng.js';

function isPermutation(values, n) {
  if (!Array.isArray(values) || values.length !== n) {
    return false;
  }
  const seen = new Set(values);
  return seen.size === n && values.every((value) => Number.isInteger(value) && value >= 0 && value < n);
}

function regionCells(regions, regionId) {
  const cells = [];
  for (let row = 0; row < regions.length; row++) {
    for (let col = 0; col < regions[row].length; col++) {
      if (regions[row][col] === regionId) {
        cells.push([row, col]);
      }
    }
  }
  return cells;
}

function assertContiguousRegion(regions, regionId) {
  const cells = regionCells(regions, regionId);
  assert.ok(cells.length > 0, `region ${regionId} is present`);

  const expected = new Set(cells.map(([row, col]) => `${row},${col}`));
  const visited = new Set();
  const queue = [cells[0]];
  visited.add(`${cells[0][0]},${cells[0][1]}`);

  for (let index = 0; index < queue.length; index++) {
    const [row, col] = queue[index];
    for (const [nextRow, nextCol] of [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]) {
      const key = `${nextRow},${nextCol}`;
      if (expected.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push([nextRow, nextCol]);
      }
    }
  }

  assert.equal(visited.size, expected.size, `region ${regionId} is 4-directionally contiguous`);
}

function assertValidSolution(solution, n) {
  assert.equal(solution.length, n);
  assert.ok(isPermutation(solution, n), 'solution is a permutation of 0..n-1');
  for (let row = 1; row < n; row++) {
    assert.ok(
      Math.abs(solution[row] - solution[row - 1]) >= 2,
      `rows ${row - 1} and ${row} have non-adjacent queen columns`,
    );
  }
}

function assertValidRegions(regions, solution, n) {
  assert.equal(regions.length, n);

  const ids = new Set();
  let coveredCells = 0;
  const queenCountByRegion = Array(n).fill(0);

  for (let row = 0; row < n; row++) {
    assert.equal(regions[row].length, n, `row ${row} has width n`);
    for (let col = 0; col < n; col++) {
      const regionId = regions[row][col];
      assert.ok(Number.isInteger(regionId), `cell ${row},${col} has an integer region id`);
      assert.ok(regionId >= 0 && regionId < n, `cell ${row},${col} has an in-range region id`);
      ids.add(regionId);
      coveredCells++;
      if (solution[row] === col) {
        queenCountByRegion[regionId]++;
      }
    }
  }

  assert.equal(coveredCells, n * n, 'regions cover every grid cell exactly once');
  assert.equal(ids.size, n, 'all region ids are present');

  for (let regionId = 0; regionId < n; regionId++) {
    assert.equal(regions[regionId][solution[regionId]], regionId, `region ${regionId} owns its seed queen`);
    assert.equal(queenCountByRegion[regionId], 1, `region ${regionId} contains exactly one queen cell`);
    assertContiguousRegion(regions, regionId);
  }
}

test('generateSolution returns null for unsolvable small sizes and supports n=1', () => {
  assert.deepEqual(generateSolution(1, mulberry32(1)), [0]);
  assert.equal(generateSolution(2, mulberry32(1)), null);
  assert.equal(generateSolution(3, mulberry32(1)), null);
});

test('generateSolution creates valid placements for representative sizes and seeds', () => {
  const sizes = [4, 5, 6, 7, 8, 9, 15, 20];
  const seeds = [1, 2, 3, 42, 99, 12345, 0xdecafbad];

  for (const n of sizes) {
    for (const seed of seeds) {
      const solution = generateSolution(n, mulberry32(seed));
      assertValidSolution(solution, n);
    }
  }
});

test('growRegions creates complete contiguous partitions with exactly one queen per region', () => {
  const sizes = [4, 5, 6, 7, 8, 9, 15, 20];
  const seeds = [7, 11, 29, 101, 2024];

  for (const n of sizes) {
    for (const seed of seeds) {
      const solution = generateSolution(n, mulberry32(seed));
      const regions = growRegions(n, solution, mulberry32(seed + 1000));
      assertValidRegions(regions, solution, n);
    }
  }
});

test('generateCandidate returns valid candidate puzzles across sizes and seeds', () => {
  const sizes = [4, 5, 6, 7, 8, 9, 15, 20];
  const seeds = [5, 17, 73, 1009, 65535];

  for (const n of sizes) {
    for (const seed of seeds) {
      const candidate = generateCandidate(n, mulberry32(seed));
      assert.equal(candidate.n, n);
      assertValidSolution(candidate.solution, n);
      assertValidRegions(candidate.regions, candidate.solution, n);
    }
  }
});

test('generateCandidate is deterministic for the same seed', () => {
  for (const n of [4, 8, 15, 20]) {
    const first = generateCandidate(n, mulberry32(123456));
    const second = generateCandidate(n, mulberry32(123456));
    assert.deepEqual(first, second);
  }
});

test('different seeds usually produce different candidate regions', () => {
  const first = generateCandidate(10, mulberry32(111));
  const second = generateCandidate(10, mulberry32(222));
  assert.notDeepEqual(first.regions, second.regions);
});
