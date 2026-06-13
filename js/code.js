import { CUSTOM_MAX, CUSTOM_MIN } from './modes.js';

/**
 * Encode a puzzle size and seed into a shareable puzzle code.
 * @param {number} n
 * @param {number} seed
 * @returns {string}
 */
export function encodePuzzleCode(n, seed) {
  return `${n}-${(seed >>> 0).toString(36)}`;
}

/**
 * Parse a shareable puzzle code.
 * @param {unknown} str
 * @returns {{ n: number, seed: number } | null}
 */
export function parsePuzzleCode(str) {
  if (typeof str !== 'string') return null;

  const match = str.trim().toLowerCase().match(/^(\d{1,2})-([0-9a-z]{1,7})$/);
  if (!match) return null;

  const n = Number.parseInt(match[1], 10);
  if (!Number.isInteger(n) || n < CUSTOM_MIN || n > CUSTOM_MAX) return null;

  const seed = Number.parseInt(match[2], 36);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null;

  return { n, seed: seed >>> 0 };
}
