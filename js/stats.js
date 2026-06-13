const FIXED_MODES = ['easy', 'medium', 'hard', 'veryhard'];

/**
 * Create a fresh empty stats object.
 * @returns {object} Empty stats for all modes.
 */
export function emptyStats() {
  return {
    easy: emptyBucket(),
    medium: emptyBucket(),
    hard: emptyBucket(),
    veryhard: emptyBucket(),
    custom: {},
  };
}

/**
 * Get a stats bucket for a mode and board size.
 * @param {object} stats Stats object.
 * @param {'easy'|'medium'|'hard'|'veryhard'|'custom'} mode Difficulty mode.
 * @param {number} n Board size for custom mode.
 * @returns {{bestMs: number|null, wins: number}} Bucket values.
 */
export function getBucket(stats, mode, n) {
  if (mode === 'custom') {
    return cloneBucket(stats?.custom?.[String(n)] ?? emptyBucket());
  }

  return cloneBucket(stats?.[mode] ?? emptyBucket());
}

/**
 * Return a new stats object with a recorded win.
 * @param {object} stats Existing stats object.
 * @param {'easy'|'medium'|'hard'|'veryhard'|'custom'} mode Difficulty mode.
 * @param {number} n Board size for custom mode.
 * @param {number} timeMs Completion time in milliseconds.
 * @returns {object} Updated stats object.
 */
export function recordWin(stats, mode, n, timeMs) {
  const next = cloneStats(stats);
  const key = mode === 'custom' ? String(n) : mode;
  const current = mode === 'custom'
    ? next.custom[key] ?? emptyBucket()
    : next[key] ?? emptyBucket();
  const updated = {
    bestMs: current.bestMs === null ? timeMs : Math.min(current.bestMs, timeMs),
    wins: current.wins + 1,
  };

  if (mode === 'custom') {
    next.custom[key] = updated;
  } else {
    next[key] = updated;
  }

  return next;
}

function cloneStats(stats) {
  const next = emptyStats();

  for (const mode of FIXED_MODES) {
    next[mode] = cloneBucket(stats?.[mode] ?? emptyBucket());
  }

  for (const [key, bucket] of Object.entries(stats?.custom ?? {})) {
    next.custom[key] = cloneBucket(bucket);
  }

  return next;
}

function emptyBucket() {
  return { bestMs: null, wins: 0 };
}

function cloneBucket(bucket) {
  return {
    bestMs: bucket.bestMs,
    wins: bucket.wins,
  };
}
