import { PALETTES } from './colors.js';
import { MODES, clampCustom } from './modes.js';

/** Default user settings. */
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system', // 'system' | 'light' | 'dark'
  palette: 'classic', // one of PALETTES
  autoX: false, // auto-place ✗ marks when a queen is set
  highlightConflicts: true, // paint rule-breaking queens red
  showTimer: true, // show the live timer
  defaultMode: 'easy', // mode used on first load / new game
  customN: 10, // remembered custom board size
  queenIcon: '👑', // glyph used for queens
  dragMark: false, // press-and-drag to paint ✗ marks across cells
  continuousHints: false, // flag a misplaced queen with a corner ✗ (unique boards only)
});

export const QUEEN_PRESETS = Object.freeze(['👑', '♛', '⭐', '❤️', '🔥', '🌸', '🦄', '💎']);

const THEMES = ['system', 'light', 'dark'];

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reduce an arbitrary queen icon setting to a single display glyph.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeQueenIcon(value) {
  if (typeof value !== 'string') return DEFAULT_SETTINGS.queenIcon;

  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SETTINGS.queenIcon;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return segmenter.segment(trimmed)[Symbol.iterator]().next().value.segment;
  }

  return Array.from(trimmed)[0] ?? DEFAULT_SETTINGS.queenIcon;
}

/**
 * Decide what to commit from a *live* queen-icon field while the user is typing.
 * Returns the sanitized icon, or null when the field is empty/whitespace so the
 * caller leaves it untouched. This lets the user backspace the field clear (and
 * keep an in-progress IME/emoji composition on Android) without it instantly
 * snapping back to the default crown.
 * @param {unknown} value
 * @returns {string|null}
 */
export function liveQueenIcon(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return sanitizeQueenIcon(value);
}

/**
 * Validate/merge an arbitrary (possibly corrupt) object into a complete,
 * safe settings object. Unknown or invalid fields fall back to defaults.
 * @param {any} obj
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function normalizeSettings(obj) {
  const s = obj && typeof obj === 'object' ? obj : {};
  return {
    theme: THEMES.includes(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    palette: PALETTES.includes(s.palette) ? s.palette : DEFAULT_SETTINGS.palette,
    autoX: bool(s.autoX, DEFAULT_SETTINGS.autoX),
    highlightConflicts: bool(s.highlightConflicts, DEFAULT_SETTINGS.highlightConflicts),
    showTimer: bool(s.showTimer, DEFAULT_SETTINGS.showTimer),
    defaultMode: MODES.includes(s.defaultMode) ? s.defaultMode : DEFAULT_SETTINGS.defaultMode,
    customN: clampCustom(s.customN ?? DEFAULT_SETTINGS.customN),
    queenIcon: sanitizeQueenIcon(s.queenIcon ?? DEFAULT_SETTINGS.queenIcon),
    dragMark: bool(s.dragMark, DEFAULT_SETTINGS.dragMark),
    continuousHints: bool(s.continuousHints, DEFAULT_SETTINGS.continuousHints),
  };
}

/**
 * Resolve a theme preference to a concrete 'light'/'dark'.
 * @param {string} theme
 * @param {boolean} prefersDark - value of prefers-color-scheme: dark
 */
export function resolveTheme(theme, prefersDark) {
  if (theme === 'light' || theme === 'dark') return theme;
  return prefersDark ? 'dark' : 'light';
}

/**
 * Apply the resolved theme to the document (sets data-theme + theme-color meta).
 * Safe to call in non-DOM environments (no-op).
 * @param {string} theme
 * @param {Document} [doc]
 * @returns {string} resolved theme
 */
export function applyTheme(theme, doc = typeof document !== 'undefined' ? document : null) {
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  const resolved = resolveTheme(theme, prefersDark);
  if (doc && doc.documentElement) {
    doc.documentElement.setAttribute('data-theme', resolved);
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0f1226' : '#4f46e5');
  }
  return resolved;
}
