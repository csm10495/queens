import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyHistory,
  normalizeEntry,
  normalizeHistory,
  recordSolve,
  MAX_ENTRIES,
} from '../js/history.js';

function entry(overrides = {}) {
  return { mode: 'easy', n: 7, timeMs: 12_345, solvedAt: 1_700_000_000_000, ...overrides };
}

test('emptyHistory is an empty array', () => {
  assert.deepEqual(emptyHistory(), []);
});

test('recordSolve prepends newest-first and is immutable', () => {
  const a = entry({ solvedAt: 1 });
  const b = entry({ solvedAt: 2 });
  const h1 = recordSolve(emptyHistory(), a);
  const h2 = recordSolve(h1, b);

  assert.deepEqual(h1, [a]);
  assert.deepEqual(h2, [b, a]); // newest first
  assert.deepEqual(h1, [a]); // h1 not mutated
});

test('recordSolve keeps an optional puzzle code and drops missing/blank codes', () => {
  assert.equal(recordSolve([], entry({ code: '7-1abc' }))[0].code, '7-1abc');
  assert.equal('code' in recordSolve([], entry())[0], false);
  assert.equal('code' in recordSolve([], entry({ code: '' }))[0], false);
});

test('recordSolve ignores invalid entries but still normalizes the list', () => {
  const good = entry();
  const list = [good];
  assert.deepEqual(recordSolve(list, { mode: 'nope', n: 7, timeMs: 1, solvedAt: 1 }), [good]);
  assert.deepEqual(recordSolve(list, null), [good]);
});

test('recordSolve caps the history at MAX_ENTRIES', () => {
  let h = emptyHistory();
  for (let i = 0; i < MAX_ENTRIES + 10; i++) h = recordSolve(h, entry({ solvedAt: i }));
  assert.equal(h.length, MAX_ENTRIES);
  // newest (largest solvedAt) is first, oldest survivors trimmed
  assert.equal(h[0].solvedAt, MAX_ENTRIES + 9);
});

test('normalizeEntry rejects malformed entries', () => {
  assert.equal(normalizeEntry(entry()) !== null, true);
  assert.equal(normalizeEntry({ ...entry(), mode: 'expert' }), null);
  assert.equal(normalizeEntry({ ...entry(), n: 0 }), null);
  assert.equal(normalizeEntry({ ...entry(), n: 1.5 }), null);
  assert.equal(normalizeEntry({ ...entry(), timeMs: -1 }), null);
  assert.equal(normalizeEntry({ ...entry(), timeMs: 'x' }), null);
  assert.equal(normalizeEntry({ ...entry(), solvedAt: -1 }), null);
  assert.equal(normalizeEntry(undefined), null);
});

test('normalizeHistory filters junk, caps length, and accepts custom mode', () => {
  assert.deepEqual(normalizeHistory('not an array'), []);
  const mixed = [entry(), 'junk', entry({ mode: 'custom', n: 14 }), { bad: true }];
  assert.deepEqual(normalizeHistory(mixed), [entry(), entry({ mode: 'custom', n: 14 })]);

  const tooMany = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => entry({ solvedAt: i }));
  assert.equal(normalizeHistory(tooMany).length, MAX_ENTRIES);
});
