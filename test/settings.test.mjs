import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  QUEEN_PRESETS,
  normalizeSettings,
  resolveTheme,
  sanitizeQueenIcon,
} from '../js/settings.js';

test('normalizeSettings returns defaults for empty/garbage input', () => {
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings('nope'), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
});

test('normalizeSettings rejects invalid enum values', () => {
  const s = normalizeSettings({ theme: 'neon', palette: 'rainbow', defaultMode: 'extreme' });
  assert.equal(s.theme, 'system');
  assert.equal(s.palette, 'classic');
  assert.equal(s.defaultMode, 'easy');
});

test('normalizeSettings accepts valid values', () => {
  const s = normalizeSettings({
    theme: 'dark',
    palette: 'colorblind',
    autoX: true,
    highlightConflicts: false,
    showTimer: false,
    defaultMode: 'veryhard',
    customN: 14,
    queenIcon: '🍕',
    dragMark: true,
    continuousHints: true,
  });
  assert.deepEqual(s, {
    theme: 'dark',
    palette: 'colorblind',
    autoX: true,
    highlightConflicts: false,
    showTimer: false,
    defaultMode: 'veryhard',
    customN: 14,
    queenIcon: '🍕',
    dragMark: true,
    continuousHints: true,
  });
});

test('normalizeSettings clamps customN and coerces non-booleans', () => {
  assert.equal(normalizeSettings({ customN: 2 }).customN, 6);
  assert.equal(normalizeSettings({ customN: 99 }).customN, 20);
  assert.equal(normalizeSettings({ customN: 13.6 }).customN, 14);
  // non-boolean assist values fall back to defaults
  assert.equal(normalizeSettings({ autoX: 'yes' }).autoX, DEFAULT_SETTINGS.autoX);
  assert.equal(normalizeSettings({ showTimer: 1 }).showTimer, DEFAULT_SETTINGS.showTimer);
  assert.equal(normalizeSettings({ dragMark: 'on' }).dragMark, DEFAULT_SETTINGS.dragMark);
});

test('dragMark defaults to false and accepts booleans', () => {
  assert.equal(DEFAULT_SETTINGS.dragMark, false);
  assert.equal(normalizeSettings({}).dragMark, false);
  assert.equal(normalizeSettings({ dragMark: true }).dragMark, true);
  assert.equal(normalizeSettings({ dragMark: false }).dragMark, false);
});

test('continuousHints defaults to false and accepts booleans', () => {
  assert.equal(DEFAULT_SETTINGS.continuousHints, false);
  assert.equal(normalizeSettings({}).continuousHints, false);
  assert.equal(normalizeSettings({ continuousHints: true }).continuousHints, true);
  assert.equal(normalizeSettings({ continuousHints: 'yes' }).continuousHints, false);
});

test('queen icon defaults and presets are exposed', () => {
  assert.equal(DEFAULT_SETTINGS.queenIcon, '👑');
  assert.deepEqual([...QUEEN_PRESETS], ['👑', '♛', '⭐', '❤️', '🔥', '🌸', '🦄', '💎']);
});

test('sanitizeQueenIcon accepts arbitrary emoji and first grapheme only', () => {
  assert.equal(sanitizeQueenIcon('🍕'), '🍕');
  assert.equal(sanitizeQueenIcon('🍕abc'), '🍕');
  assert.equal(normalizeSettings({ queenIcon: '🍕abc' }).queenIcon, '🍕');
});

test('sanitizeQueenIcon defaults empty whitespace and non-string values', () => {
  assert.equal(sanitizeQueenIcon(''), '👑');
  assert.equal(sanitizeQueenIcon('   '), '👑');
  assert.equal(sanitizeQueenIcon(null), '👑');
  assert.equal(sanitizeQueenIcon(123), '👑');
});

test('sanitizeQueenIcon preserves ZWJ emoji when grapheme segmenter is available', () => {
  if (typeof Intl.Segmenter !== 'function') return;

  assert.equal(sanitizeQueenIcon('👩‍🚀abc'), '👩‍🚀');
  assert.equal(normalizeSettings({ queenIcon: '👩‍🚀abc' }).queenIcon, '👩‍🚀');
});

test('resolveTheme maps system to light/dark and passes explicit through', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});
