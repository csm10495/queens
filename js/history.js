// Solved-puzzle history: an immutable, newest-first list of completed games.
// Pure and storage-free so it imports cleanly into Node and is unit-testable;
// storage.js persists it and main.js renders it.

const MODES = new Set(['easy', 'medium', 'hard', 'veryhard', 'custom']);

/** Most recent solves kept; older entries are dropped. */
export const MAX_ENTRIES = 50;

/** A fresh, empty history. */
export function emptyHistory() {
  return [];
}

/**
 * Validate and shape a single history entry, or return null if it is invalid.
 * @param {any} entry
 * @returns {{ mode:string, n:number, timeMs:number, solvedAt:number, code?:string }|null}
 */
export function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (!MODES.has(entry.mode)) return null;
  if (!Number.isInteger(entry.n) || entry.n < 1) return null;
  if (!Number.isFinite(entry.timeMs) || entry.timeMs < 0) return null;
  if (!Number.isFinite(entry.solvedAt) || entry.solvedAt < 0) return null;

  const clean = {
    mode: entry.mode,
    n: entry.n,
    timeMs: entry.timeMs,
    solvedAt: entry.solvedAt,
  };
  if (typeof entry.code === 'string') {
    const code = entry.code.trim();
    if (code) clean.code = code;
  }
  return clean;
}

/**
 * Validate/clean an arbitrary (possibly corrupt) value into a history list.
 * @param {any} value
 * @returns {Array}
 */
export function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const clean = normalizeEntry(entry);
    if (clean) out.push(clean);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

/**
 * Return a new history with `entry` prepended (newest first), capped to
 * MAX_ENTRIES. Invalid entries are ignored (the history is returned unchanged
 * except for the cap).
 * @param {Array} history
 * @param {object} entry
 * @returns {Array}
 */
export function recordSolve(history, entry) {
  const list = normalizeHistory(history);
  const clean = normalizeEntry(entry);
  if (!clean) return list;
  return [clean, ...list].slice(0, MAX_ENTRIES);
}
