import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/game.js';
import { generatePuzzle } from '../js/puzzle.js';
import { EMPTY, MARK, QUEEN } from '../js/rules.js';
import { mulberry32 } from '../js/rng.js';

function makePuzzle(n = 7, seed = 42) {
  return generatePuzzle(n, mulberry32(seed));
}

// Cycle a cell up to QUEEN (empty -> mark -> queen).
function placeQueen(game, r, c, autoX = false) {
  game.cycle(r, c, { autoX }); // -> MARK
  game.cycle(r, c, { autoX }); // -> QUEEN
}

test('a cell cycles EMPTY -> MARK -> QUEEN -> EMPTY', () => {
  const g = createGame(makePuzzle());
  assert.equal(g.cells[0][0], EMPTY);
  g.cycle(0, 0);
  assert.equal(g.cells[0][0], MARK);
  g.cycle(0, 0);
  assert.equal(g.cells[0][0], QUEEN);
  g.cycle(0, 0);
  assert.equal(g.cells[0][0], EMPTY);
});

test('placing the intended solution wins with no conflicts', () => {
  const p = makePuzzle(8, 7);
  const g = createGame(p);
  for (let r = 0; r < p.n; r++) placeQueen(g, r, p.solution[r]);
  assert.equal(g.isSolved(), true);
  assert.deepEqual(g.conflicts(), []);
});

test('an incomplete board is not solved', () => {
  const p = makePuzzle(8, 11);
  const g = createGame(p);
  for (let r = 0; r < p.n - 1; r++) placeQueen(g, r, p.solution[r]);
  assert.equal(g.isSolved(), false);
});

test('adjacent queens are reported as conflicts and do not win', () => {
  const g = createGame(makePuzzle(8, 3));
  placeQueen(g, 0, 0);
  placeQueen(g, 1, 1); // diagonally adjacent
  const conflicts = g.conflicts();
  const keys = conflicts.map((q) => `${q.r},${q.c}`).sort();
  assert.ok(keys.includes('0,0') && keys.includes('1,1'));
  assert.equal(g.isSolved(), false);
});

test('auto-X marks eliminated empty cells when a queen is placed', () => {
  const g = createGame(makePuzzle(8, 5));
  placeQueen(g, 3, 3, true);
  assert.equal(g.cells[3][3], QUEEN);
  // same row / column
  assert.equal(g.cells[3][0], MARK);
  assert.equal(g.cells[0][3], MARK);
  // diagonal neighbour
  assert.equal(g.cells[2][2], MARK);
});

test('timer accumulates while running and stops on solve', () => {
  const p = makePuzzle(7, 9);
  let t = 0;
  const g = createGame(p, { now: () => t });
  g.start();
  t = 5000;
  assert.equal(g.elapsedMs(), 5000);
  // solve it; timer should freeze at solve time
  for (let r = 0; r < p.n; r++) placeQueen(g, r, p.solution[r]);
  const atSolve = g.elapsedMs();
  t = 999999;
  assert.equal(g.isSolved(), true);
  assert.equal(g.elapsedMs(), atSolve);
});

test('paintCell paints and erases marks but never touches queens', () => {
  const p = makePuzzle(8, 33);
  const g = createGame(p);
  // paint a mark on an empty cell
  assert.equal(g.paintCell(0, 0, MARK), true);
  assert.equal(g.cells[0][0], MARK);
  // painting MARK again is a no-op
  assert.equal(g.paintCell(0, 0, MARK), false);
  // erase it
  assert.equal(g.paintCell(0, 0, EMPTY), true);
  assert.equal(g.cells[0][0], EMPTY);
  // erasing an empty cell is a no-op
  assert.equal(g.paintCell(0, 0, EMPTY), false);
  // a queen is never overwritten by paint/erase
  placeQueen(g, 2, p.solution[2]);
  assert.equal(g.cells[2][p.solution[2]], QUEEN);
  assert.equal(g.paintCell(2, p.solution[2], MARK), false);
  assert.equal(g.paintCell(2, p.solution[2], EMPTY), false);
  assert.equal(g.cells[2][p.solution[2]], QUEEN);
});

test('dragPaintValue erases when starting on a mark, else paints a mark', () => {
  const g = createGame(makePuzzle(7, 4));
  assert.equal(g.dragPaintValue(1, 1), MARK); // empty -> paint
  g.paintCell(1, 1, MARK);
  assert.equal(g.dragPaintValue(1, 1), EMPTY); // mark -> erase
});

test('toState snapshots and restores cells + elapsed time', () => {
  const p = makePuzzle(7, 21);
  let t = 0;
  const g = createGame(p, { now: () => t });
  g.start();
  t = 1234;
  g.cycle(0, 0); // a mark
  const state = g.toState();
  assert.equal(state.n, p.n);
  assert.equal(state.cells[0][0], MARK);
  assert.equal(state.elapsedMs, 1234);

  const restored = createGame(p, {
    now: () => t,
    initialCells: state.cells,
    initialElapsedMs: state.elapsedMs,
    solved: state.solved,
  });
  assert.equal(restored.cells[0][0], MARK);
  assert.equal(restored.elapsedMs(), 1234);
});

test('toState carries the puzzle unique flag (so continuous hints survive resume)', () => {
  const uniquePuzzle = { ...makePuzzle(7, 21), unique: true };
  const g = createGame(uniquePuzzle);
  assert.equal(g.unique, true);
  assert.equal(g.toState().unique, true);

  const solvable = { ...makePuzzle(7, 21), unique: false };
  assert.equal(createGame(solvable).toState().unique, false);
});
