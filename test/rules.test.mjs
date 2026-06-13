import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../js/rng.js';
import {
  EMPTY,
  MARK,
  QUEEN,
  findConflicts,
  isAdjacent,
  isSolved,
  queenPositions,
} from '../js/rules.js';

let generateCandidate;
try {
  ({ generateCandidate } = await import('../js/generator.js'));
} catch {
  generateCandidate = generateFallbackCandidate;
}

function generateFallbackCandidate(n) {
  const knownSolutions = new Map([
    [6, [1, 3, 5, 0, 2, 4]],
    [8, [0, 2, 4, 6, 1, 3, 5, 7]],
    [9, [0, 2, 4, 6, 8, 1, 3, 5, 7]],
  ]);
  const solution = knownSolutions.get(n);
  const regions = Array.from({ length: n }, (_, r) => Array(n).fill(r));

  for (let r = 0; r < n; r++) {
    const target = { r: (r + 3) % n, c: (solution[r] + 3) % n };
    if (target.c !== solution[target.r]) {
      regions[target.r][target.c] = r;
    }
  }

  return { n, solution, regions };
}

function makeCells({ n, solution }) {
  const cells = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  for (let r = 0; r < n; r++) {
    cells[r][solution[r]] = QUEEN;
  }
  return cells;
}

function cloneCells(cells) {
  return cells.map((row) => [...row]);
}

function positionKey({ r, c }) {
  return `${r},${c}`;
}

function assertIncludesPositions(actual, expected) {
  const keys = new Set(actual.map(positionKey));
  for (const position of expected) {
    assert.ok(keys.has(positionKey(position)), `expected conflicts to include ${positionKey(position)}`);
  }
}

function findSameRegionEmptyCell(puzzle, queen) {
  const region = puzzle.regions[queen.r][queen.c];
  for (let r = 0; r < puzzle.n; r++) {
    for (let c = 0; c < puzzle.n; c++) {
      if ((r !== queen.r || c !== queen.c) && puzzle.regions[r][c] === region) {
        return { r, c };
      }
    }
  }
  throw new Error(`no second cell found for region ${region}`);
}

function findDiagonalNeighbor(puzzle, queen) {
  for (const dr of [-1, 1]) {
    for (const dc of [-1, 1]) {
      const r = queen.r + dr;
      const c = queen.c + dc;
      if (r >= 0 && r < puzzle.n && c >= 0 && c < puzzle.n) {
        return { r, c };
      }
    }
  }
  throw new Error('no diagonal neighbor found');
}

test('isAdjacent recognizes all and only touching different cells', () => {
  const center = { r: 3, c: 3 };
  const neighbors = [
    { r: 2, c: 2 },
    { r: 2, c: 3 },
    { r: 2, c: 4 },
    { r: 3, c: 2 },
    { r: 3, c: 4 },
    { r: 4, c: 2 },
    { r: 4, c: 3 },
    { r: 4, c: 4 },
  ];

  for (const neighbor of neighbors) {
    assert.equal(isAdjacent(center, neighbor), true);
    assert.equal(isAdjacent(neighbor, center), true);
  }

  assert.equal(isAdjacent(center, { r: 3, c: 3 }), false);
  assert.equal(isAdjacent(center, { r: 1, c: 3 }), false);
  assert.equal(isAdjacent(center, { r: 3, c: 5 }), false);
  assert.equal(isAdjacent(center, { r: 1, c: 2 }), false);
});

test('queenPositions returns queen coordinates and ignores marks and empty cells', () => {
  const cells = [
    [EMPTY, QUEEN, MARK],
    [MARK, EMPTY, QUEEN],
    [EMPTY, EMPTY, EMPTY],
  ];

  assert.deepEqual(queenPositions(cells), [
    { r: 0, c: 1 },
    { r: 1, c: 2 },
  ]);
});

test('valid generated full boards have no conflicts and are solved', () => {
  for (const [n, seeds] of [
    [6, [1001, 1002, 1003]],
    [8, [2001, 2002, 2003]],
    [9, [3001, 3002, 3003]],
  ]) {
    for (const seed of seeds) {
      const puzzle = generateCandidate(n, mulberry32(seed));
      const cells = makeCells(puzzle);

      assert.deepEqual(findConflicts(cells, puzzle.regions), [], `n=${n}, seed=${seed}`);
      assert.equal(isSolved(cells, puzzle.regions), true, `n=${n}, seed=${seed}`);
    }
  }
});

test('findConflicts detects queens sharing a row', () => {
  const puzzle = generateCandidate(8, mulberry32(4101));
  const cells = makeCells(puzzle);
  const original = { r: 0, c: puzzle.solution[0] };
  const added = { r: 0, c: (original.c + 2) % puzzle.n };
  cells[added.r][added.c] = QUEEN;

  assertIncludesPositions(findConflicts(cells, puzzle.regions), [original, added]);
  assert.equal(isSolved(cells, puzzle.regions), false);
});

test('findConflicts detects queens sharing a column', () => {
  const puzzle = generateCandidate(8, mulberry32(4102));
  const cells = makeCells(puzzle);
  const original = { r: 0, c: puzzle.solution[0] };
  const added = { r: 2, c: original.c };
  cells[added.r][added.c] = QUEEN;

  assertIncludesPositions(findConflicts(cells, puzzle.regions), [original, added]);
  assert.equal(isSolved(cells, puzzle.regions), false);
});

test('findConflicts detects queens sharing a region', () => {
  const puzzle = generateCandidate(8, mulberry32(4103));
  const cells = makeCells(puzzle);
  const original = { r: 0, c: puzzle.solution[0] };
  const added = findSameRegionEmptyCell(puzzle, original);
  cells[added.r][added.c] = QUEEN;

  assertIncludesPositions(findConflicts(cells, puzzle.regions), [original, added]);
  assert.equal(isSolved(cells, puzzle.regions), false);
});

test('findConflicts detects diagonally adjacent queens', () => {
  const puzzle = generateCandidate(8, mulberry32(4104));
  const cells = makeCells(puzzle);
  const original = { r: 3, c: puzzle.solution[3] };
  const added = findDiagonalNeighbor(puzzle, original);
  cells[added.r][added.c] = QUEEN;

  assertIncludesPositions(findConflicts(cells, puzzle.regions), [original, added]);
  assert.equal(isSolved(cells, puzzle.regions), false);
});

test('isSolved is false for incomplete boards, marks replacing queens, and extra queens', () => {
  const puzzle = generateCandidate(8, mulberry32(5101));

  const incomplete = makeCells(puzzle);
  incomplete[0][puzzle.solution[0]] = EMPTY;
  assert.equal(isSolved(incomplete, puzzle.regions), false);

  const markedRequiredCell = makeCells(puzzle);
  markedRequiredCell[0][puzzle.solution[0]] = MARK;
  assert.equal(isSolved(markedRequiredCell, puzzle.regions), false);
  assert.deepEqual(queenPositions(markedRequiredCell).find(({ r }) => r === 0), undefined);

  const extra = makeCells(puzzle);
  extra[0][(puzzle.solution[0] + 2) % puzzle.n] = QUEEN;
  assert.equal(isSolved(extra, puzzle.regions), false);
});
