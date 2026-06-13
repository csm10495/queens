const MODES = new Set(['easy', 'medium', 'hard', 'veryhard', 'custom']);
const FIXED_SIZES = { easy: 7, medium: 8, hard: 9, veryhard: 15 };
const CELL_VALUES = new Set([0, 1, 2]);

/**
 * Serialize a game state to a compact, stable JSON string.
 * @param {object} state Game state to serialize.
 * @returns {string} Stable JSON representation.
 */
export function serializeState(state) {
  const serialized = {
    version: state.version,
    mode: state.mode,
    n: state.n,
    regions: state.regions,
    solution: state.solution,
    cells: state.cells,
    elapsedMs: state.elapsedMs,
    solved: state.solved,
  };
  if (Number.isFinite(state.seed)) serialized.seed = state.seed;
  return JSON.stringify(serialized);
}

/**
 * Deserialize and validate a saved game state.
 * @param {string} str Serialized game state.
 * @returns {object|null} Parsed state, or null if invalid/corrupt.
 */
export function deserializeState(str) {
  if (typeof str !== 'string') return null;

  let state;
  try {
    state = JSON.parse(str);
  } catch {
    return null;
  }

  if (!isValidState(state)) return null;
  if (!('seed' in state) || Number.isFinite(state.seed)) return state;

  const withoutSeed = { ...state };
  delete withoutSeed.seed;
  return withoutSeed;
}

function isValidState(state) {
  if (!isPlainObject(state)) return false;
  if (state.version !== 1) return false;
  if (!MODES.has(state.mode)) return false;
  if (!Number.isInteger(state.n)) return false;
  if (state.mode === 'custom') {
    if (state.n < 6 || state.n > 20) return false;
  } else if (FIXED_SIZES[state.mode] !== state.n) {
    return false;
  }
  if (!isMatrix(state.regions, state.n, isRegionId(state.n))) return false;
  if (!isSolution(state.solution, state.n)) return false;
  if (!isMatrix(state.cells, state.n, value => CELL_VALUES.has(value))) return false;
  if (!Number.isFinite(state.elapsedMs) || state.elapsedMs < 0) return false;
  if (typeof state.solved !== 'boolean') return false;

  return true;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMatrix(value, n, isValidCell) {
  return Array.isArray(value)
    && value.length === n
    && value.every(row => (
      Array.isArray(row)
      && row.length === n
      && row.every(isValidCell)
    ));
}

function isRegionId(n) {
  return value => Number.isInteger(value) && value >= 0 && value < n;
}

function isSolution(value, n) {
  return Array.isArray(value)
    && value.length === n
    && value.every(column => Number.isInteger(column) && column >= 0 && column < n);
}
