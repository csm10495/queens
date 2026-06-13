import test from 'node:test';
import assert from 'node:assert/strict';
import { deserializeState, serializeState } from '../js/serialize.js';

test('round-trips easy, veryhard, and custom states', () => {
  for (const state of [
    makeState('easy', 7, { queens: [[0, 1], [3, 4]], marks: [[2, 2]] }),
    makeState('veryhard', 15, { solved: true, queens: [[0, 0], [14, 14]], marks: [[7, 7], [8, 3]] }),
    makeState('custom', 6, { queens: [[1, 5]], marks: [[5, 0]] }),
    makeState('custom', 20, { solved: true, queens: [[0, 19], [19, 0]], marks: [[10, 10]] }),
  ]) {
    assert.deepEqual(deserializeState(serializeState(state)), state);
  }
});

test('serializeState produces compact stable key order', () => {
  const state = makeState('easy', 7);

  assert.equal(
    serializeState(state).startsWith('{"version":1,"mode":"easy","n":7,"regions":'),
    true,
  );
  assert.equal(serializeState(state), serializeState(structuredClone(state)));
});

test('deserializeState returns null for invalid JSON and non-string input', () => {
  assert.equal(deserializeState('not json'), null);
  assert.equal(deserializeState(''), null);
  assert.equal(deserializeState(null), null);
  assert.equal(deserializeState(undefined), null);
});

test('deserializeState returns null for shape mismatches', () => {
  const state = makeState('easy', 7);

  assert.equal(deserializeState(JSON.stringify(without(state, 'cells'))), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, regions: state.regions.slice(1) })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, regions: state.regions.map(row => row.slice(1)) })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, solution: state.solution.slice(1) })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, mode: 'expert' })), null);
});

test('deserializeState rejects invalid field values', () => {
  const state = makeState('custom', 6);

  assert.equal(deserializeState(JSON.stringify({ ...state, version: 2 })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, n: 5 })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, cells: withCell(state.cells, 0, 0, 3) })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, regions: withCell(state.regions, 0, 0, 6) })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, elapsedMs: -1 })), null);
  assert.equal(deserializeState(JSON.stringify({ ...state, solved: 'yes' })), null);
});

test('deserialized copy is independent from later original mutation', () => {
  const original = makeState('easy', 7, { queens: [[0, 0]], marks: [[1, 1]] });
  const copy = deserializeState(serializeState(original));

  original.regions[0][0] = 6;
  original.solution[0] = 6;
  original.cells[0][0] = 0;
  original.elapsedMs = 99_999;
  original.solved = true;

  assert.deepEqual(copy, makeState('easy', 7, { queens: [[0, 0]], marks: [[1, 1]] }));
});

function makeState(mode, n, options = {}) {
  const regions = Array.from({ length: n }, (_, row) => (
    Array.from({ length: n }, (_, column) => (row + column) % n)
  ));
  const solution = Array.from({ length: n }, (_, row) => (row * 2 + 1) % n);
  const cells = Array.from({ length: n }, () => Array(n).fill(0));

  for (const [row, column] of options.marks ?? []) {
    cells[row][column] = 1;
  }
  for (const [row, column] of options.queens ?? []) {
    cells[row][column] = 2;
  }

  return {
    version: 1,
    mode,
    n,
    regions,
    solution,
    cells,
    elapsedMs: options.elapsedMs ?? 12_345,
    solved: options.solved ?? false,
  };
}

function without(object, key) {
  const clone = { ...object };
  delete clone[key];
  return clone;
}

function withCell(matrix, row, column, value) {
  const clone = matrix.map(cells => cells.slice());
  clone[row][column] = value;
  return clone;
}
