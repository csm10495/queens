import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt, shuffle } from '../js/rng.js';

test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('mulberry32 returns values in [0, 1)', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 2000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('different seeds produce different sequences', () => {
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('randInt stays within [0, n)', () => {
  const r = mulberry32(99);
  for (let i = 0; i < 2000; i++) {
    const v = randInt(r, 5);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 5, `bad value ${v}`);
  }
});

test('shuffle returns a permutation (preserves multiset)', () => {
  const r = mulberry32(42);
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const orig = [...arr];
  shuffle(r, arr);
  assert.deepEqual([...arr].sort((x, y) => x - y), orig);
});

test('shuffle is deterministic for a given seed', () => {
  const arr1 = [0, 1, 2, 3, 4, 5];
  const arr2 = [0, 1, 2, 3, 4, 5];
  shuffle(mulberry32(5), arr1);
  shuffle(mulberry32(5), arr2);
  assert.deepEqual(arr1, arr2);
});
