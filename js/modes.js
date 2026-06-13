// Difficulty modes and grid-size mapping. Pure, shared by the worker, UI, and
// settings so the rules live in exactly one place.

/** Ordered list of mode ids. */
export const MODES = Object.freeze(['easy', 'medium', 'hard', 'veryhard', 'custom']);

/** Human-readable labels. */
export const MODE_LABELS = Object.freeze({
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  veryhard: 'Very Hard',
  custom: 'Custom',
});

/** Fixed grid sizes (N) for the non-custom modes. */
export const FIXED_SIZES = Object.freeze({ easy: 7, medium: 8, hard: 9, veryhard: 15 });

/** Inclusive bounds for the custom N. */
export const CUSTOM_MIN = 6;
export const CUSTOM_MAX = 20;

/** Round + clamp an arbitrary value into the valid custom range. */
export function clampCustom(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return CUSTOM_MIN;
  return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, v));
}

/** True iff n is an integer within the custom range. */
export function isValidCustom(n) {
  return Number.isInteger(n) && n >= CUSTOM_MIN && n <= CUSTOM_MAX;
}

/** True iff mode is a known mode id. */
export function isMode(mode) {
  return MODES.includes(mode);
}

/**
 * Grid size (N) for a mode. For 'custom', clamps customN into range.
 * @param {string} mode
 * @param {number} [customN]
 * @returns {number}
 */
export function sizeForMode(mode, customN) {
  if (mode === 'custom') return clampCustom(customN);
  return FIXED_SIZES[mode];
}

/** Mode id for a grid size, or 'custom' when it is not a fixed mode size. */
export function modeForSize(n) {
  for (const m of ['easy', 'medium', 'hard', 'veryhard']) if (FIXED_SIZES[m] === n) return m;
  return 'custom';
}
