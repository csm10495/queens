import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStats, getBucket, recordWin } from '../js/stats.js';

test('emptyStats has the correct fresh shape', () => {
  const stats = emptyStats();

  assert.deepEqual(stats, {
    easy: { bestMs: null, wins: 0 },
    medium: { bestMs: null, wins: 0 },
    hard: { bestMs: null, wins: 0 },
    veryhard: { bestMs: null, wins: 0 },
    custom: {},
  });
  assert.notEqual(emptyStats().easy, emptyStats().easy);
});

test('recordWin updates fixed mode wins and best time', () => {
  const first = recordWin(emptyStats(), 'medium', 8, 5_000);
  const slower = recordWin(first, 'medium', 8, 7_000);
  const faster = recordWin(slower, 'medium', 8, 3_000);

  assert.deepEqual(first.medium, { bestMs: 5_000, wins: 1 });
  assert.deepEqual(slower.medium, { bestMs: 5_000, wins: 2 });
  assert.deepEqual(faster.medium, { bestMs: 3_000, wins: 3 });
  assert.deepEqual(faster.easy, { bestMs: null, wins: 0 });
});

test('recordWin does not mutate input stats', () => {
  const original = recordWin(emptyStats(), 'hard', 9, 9_000);
  const before = structuredClone(original);
  const next = recordWin(original, 'hard', 9, 8_000);

  assert.deepEqual(original, before);
  assert.notEqual(next, original);
  assert.notEqual(next.hard, original.hard);
  assert.deepEqual(next.hard, { bestMs: 8_000, wins: 2 });
});

test('custom buckets are independent and keyed by board size', () => {
  const afterSix = recordWin(emptyStats(), 'custom', 6, 6_000);
  const afterTwenty = recordWin(afterSix, 'custom', 20, 20_000);
  const afterSixAgain = recordWin(afterTwenty, 'custom', 6, 5_000);

  assert.deepEqual(getBucket(afterSixAgain, 'custom', 6), { bestMs: 5_000, wins: 2 });
  assert.deepEqual(getBucket(afterSixAgain, 'custom', 20), { bestMs: 20_000, wins: 1 });
  assert.deepEqual(afterSixAgain.custom, {
    6: { bestMs: 5_000, wins: 2 },
    20: { bestMs: 20_000, wins: 1 },
  });
});

test('getBucket returns missing custom bucket without mutating stats', () => {
  const stats = recordWin(emptyStats(), 'custom', 6, 6_000);
  const before = structuredClone(stats);
  const missing = getBucket(stats, 'custom', 20);

  assert.deepEqual(missing, { bestMs: null, wins: 0 });
  assert.deepEqual(stats, before);
  assert.equal(Object.hasOwn(stats.custom, '20'), false);
});

test('getBucket returns a detached bucket copy', () => {
  const stats = recordWin(emptyStats(), 'easy', 7, 1_000);
  const bucket = getBucket(stats, 'easy', 7);

  bucket.bestMs = 999;
  bucket.wins = 99;

  assert.deepEqual(stats.easy, { bestMs: 1_000, wins: 1 });
});
