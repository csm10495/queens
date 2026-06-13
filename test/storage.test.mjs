import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KEYS,
  clearAll,
  clearResume,
  loadResume,
  loadSettings,
  loadStats,
  saveResume,
  saveSettings,
  saveStats,
} from '../js/storage.js';
import { emptyStats, recordWin } from '../js/stats.js';

function fakeStorage(entries = []) {
  const data = new Map(entries);
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function sampleState() {
  const n = 7;
  return {
    version: 1,
    mode: 'easy',
    n,
    regions: Array.from({ length: n }, (_, row) => Array.from({ length: n }, () => row)),
    solution: Array.from({ length: n }, (_, column) => column),
    cells: Array.from({ length: n }, () => Array.from({ length: n }, () => 0)),
    elapsedMs: 12345,
    solved: false,
  };
}

test('loadStats returns empty stats for empty storage', () => {
  assert.deepEqual(loadStats(fakeStorage()), emptyStats());
});

test('saveStats and loadStats round-trip recorded wins', () => {
  const storage = fakeStorage();
  const stats = recordWin(emptyStats(), 'medium', 8, 4567);

  saveStats(stats, storage);

  assert.deepEqual(loadStats(storage), stats);
});

test('loadStats returns empty stats for corrupt JSON without throwing', () => {
  const storage = fakeStorage([[KEYS.stats, '{not json']]);

  assert.doesNotThrow(() => loadStats(storage));
  assert.deepEqual(loadStats(storage), emptyStats());
});

test('loadStats normalizes partially-shaped stats', () => {
  const partial = {
    easy: { bestMs: 1000, wins: 2 },
    custom: { 6: { bestMs: 3000, wins: 1 } },
  };
  const storage = fakeStorage([[KEYS.stats, JSON.stringify(partial)]]);

  assert.deepEqual(loadStats(storage), {
    easy: { bestMs: 1000, wins: 2 },
    medium: { bestMs: null, wins: 0 },
    hard: { bestMs: null, wins: 0 },
    veryhard: { bestMs: null, wins: 0 },
    custom: { 6: { bestMs: 3000, wins: 1 } },
  });
});

test('resume storage returns null for empty storage', () => {
  assert.equal(loadResume(fakeStorage()), null);
});

test('saveResume and loadResume round-trip valid state', () => {
  const storage = fakeStorage();
  const state = sampleState();

  saveResume(state, storage);

  assert.deepEqual(loadResume(storage), state);
});

test('loadResume returns null for corrupt or invalid data', () => {
  assert.equal(loadResume(fakeStorage([[KEYS.resume, '{bad json']])), null);
  assert.equal(loadResume(fakeStorage([[KEYS.resume, JSON.stringify({ version: 1 })]])), null);
});

test('clearResume removes resume state', () => {
  const storage = fakeStorage();
  saveResume(sampleState(), storage);

  clearResume(storage);

  assert.equal(loadResume(storage), null);
});

test('settings storage returns null for empty storage', () => {
  assert.equal(loadSettings(fakeStorage()), null);
});

test('saveSettings and loadSettings round-trip values', () => {
  const storage = fakeStorage();

  saveSettings({ theme: 'dark' }, storage);

  assert.deepEqual(loadSettings(storage), { theme: 'dark' });
});

test('loadSettings returns null for corrupt data', () => {
  const storage = fakeStorage([[KEYS.settings, '{"theme":']]);

  assert.doesNotThrow(() => loadSettings(storage));
  assert.equal(loadSettings(storage), null);
});

test('clearAll removes stats, settings, and resume keys', () => {
  const storage = fakeStorage();
  saveStats(recordWin(emptyStats(), 'hard', 9, 9000), storage);
  saveSettings({ theme: 'dark' }, storage);
  saveResume(sampleState(), storage);

  clearAll(storage);

  assert.equal(storage.getItem(KEYS.stats), null);
  assert.equal(storage.getItem(KEYS.settings), null);
  assert.equal(storage.getItem(KEYS.resume), null);
});

test('load functions never throw when getItem returns garbage', () => {
  const garbageStorage = {
    getItem() {
      return 'not valid persisted data';
    },
    setItem() {},
    removeItem() {},
  };

  assert.doesNotThrow(() => loadStats(garbageStorage));
  assert.doesNotThrow(() => loadResume(garbageStorage));
  assert.doesNotThrow(() => loadSettings(garbageStorage));
  assert.deepEqual(loadStats(garbageStorage), emptyStats());
  assert.equal(loadResume(garbageStorage), null);
  assert.equal(loadSettings(garbageStorage), null);
});

test('save functions swallow setItem errors', () => {
  const throwingStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
    removeItem() {},
  };

  assert.doesNotThrow(() => saveStats(emptyStats(), throwingStorage));
  assert.doesNotThrow(() => saveResume(sampleState(), throwingStorage));
  assert.doesNotThrow(() => saveSettings({ theme: 'dark' }, throwingStorage));
});
