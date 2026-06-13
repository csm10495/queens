import { deserializeState, serializeState } from './serialize.js';
import { emptyStats } from './stats.js';

export const KEYS = {
  stats: 'queens:stats',
  settings: 'queens:settings',
  resume: 'queens:resume',
};

const FIXED_MODES = ['easy', 'medium', 'hard', 'veryhard'];

const memoryStorage = (() => {
  const data = new Map();
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
})();

/**
 * Load saved stats, falling back to empty stats for missing or corrupt data.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {object} Normalized stats.
 */
export function loadStats(storage = defaultStorage()) {
  try {
    const raw = storage.getItem(KEYS.stats);
    if (raw === null) return emptyStats();

    const parsed = JSON.parse(raw);
    return normalizeStats(parsed);
  } catch {
    return emptyStats();
  }
}

/**
 * Save stats to storage.
 * @param {object} stats Stats to persist.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {void}
 */
export function saveStats(stats, storage = defaultStorage()) {
  try {
    storage.setItem(KEYS.stats, JSON.stringify(stats));
  } catch {
    // Storage failures should not interrupt gameplay.
  }
}

/**
 * Load a saved resume game state.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {object|null} Valid game state, or null.
 */
export function loadResume(storage = defaultStorage()) {
  try {
    const raw = storage.getItem(KEYS.resume);
    return raw === null ? null : deserializeState(raw);
  } catch {
    return null;
  }
}

/**
 * Save a resume game state.
 * @param {object} state Game state to persist.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {void}
 */
export function saveResume(state, storage = defaultStorage()) {
  try {
    storage.setItem(KEYS.resume, serializeState(state));
  } catch {
    // Storage failures should not interrupt gameplay.
  }
}

/**
 * Remove the saved resume game state.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {void}
 */
export function clearResume(storage = defaultStorage()) {
  safeRemove(KEYS.resume, storage);
}

/**
 * Load saved settings without applying a schema.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {object|null} Parsed settings object/value, or null.
 */
export function loadSettings(storage = defaultStorage()) {
  try {
    const raw = storage.getItem(KEYS.settings);
    if (raw === null) return null;

    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Save settings to storage.
 * @param {object} obj Settings to persist.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {void}
 */
export function saveSettings(obj, storage = defaultStorage()) {
  try {
    storage.setItem(KEYS.settings, JSON.stringify(obj));
  } catch {
    // Storage failures should not interrupt gameplay.
  }
}

/**
 * Remove all Queens storage keys.
 * @param {Storage|object} [storage] Web Storage-like object.
 * @returns {void}
 */
export function clearAll(storage = defaultStorage()) {
  safeRemove(KEYS.stats, storage);
  safeRemove(KEYS.settings, storage);
  safeRemove(KEYS.resume, storage);
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Fall through to the module-local shim.
  }
  return memoryStorage;
}

function safeRemove(key, storage) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

function normalizeStats(value) {
  if (!isPlainObject(value)) return emptyStats();

  const normalized = emptyStats();
  for (const mode of FIXED_MODES) {
    normalized[mode] = normalizeBucket(value[mode]);
  }

  if (isPlainObject(value.custom)) {
    for (const [key, bucket] of Object.entries(value.custom)) {
      normalized.custom[key] = normalizeBucket(bucket);
    }
  }

  return normalized;
}

function normalizeBucket(bucket) {
  if (!isPlainObject(bucket)) return { bestMs: null, wins: 0 };

  const bestMs = bucket.bestMs === null || isNonNegativeFiniteNumber(bucket.bestMs)
    ? bucket.bestMs
    : null;
  const wins = Number.isInteger(bucket.wins) && bucket.wins >= 0 ? bucket.wins : 0;

  return { bestMs, wins };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeFiniteNumber(value) {
  return Number.isFinite(value) && value >= 0;
}
