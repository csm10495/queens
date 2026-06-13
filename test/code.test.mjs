import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePuzzleCode, parsePuzzleCode } from '../js/code.js';

test('encodePuzzleCode and parsePuzzleCode round-trip valid sizes and seeds', () => {
  for (const [n, seed] of [
    [6, 0],
    [9, 255],
    [15, 123456789],
    [20, 0xffffffff],
  ]) {
    assert.deepEqual(parsePuzzleCode(encodePuzzleCode(n, seed)), { n, seed: seed >>> 0 });
  }
  assert.equal(encodePuzzleCode(9, 255), '9-73');
});

test('parsePuzzleCode is case-insensitive and tolerates surrounding whitespace', () => {
  assert.deepEqual(parsePuzzleCode('  9-73  '), { n: 9, seed: 255 });
  assert.deepEqual(parsePuzzleCode('15-21I3V9'), { n: 15, seed: Number.parseInt('21i3v9', 36) });
});

test('parsePuzzleCode rejects invalid values', () => {
  for (const value of ['abc', '', '5-1', '21-1', '9-', '9', '9-zzzzzzzz', null, 123]) {
    assert.equal(parsePuzzleCode(value), null);
  }
});
