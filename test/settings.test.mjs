import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  resolveTheme,
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
  });
  assert.deepEqual(s, {
    theme: 'dark',
    palette: 'colorblind',
    autoX: true,
    highlightConflicts: false,
    showTimer: false,
    defaultMode: 'veryhard',
    customN: 14,
  });
});

test('normalizeSettings clamps customN and coerces non-booleans', () => {
  assert.equal(normalizeSettings({ customN: 2 }).customN, 6);
  assert.equal(normalizeSettings({ customN: 99 }).customN, 20);
  assert.equal(normalizeSettings({ customN: 13.6 }).customN, 14);
  // non-boolean assist values fall back to defaults
  assert.equal(normalizeSettings({ autoX: 'yes' }).autoX, DEFAULT_SETTINGS.autoX);
  assert.equal(normalizeSettings({ showTimer: 1 }).showTimer, DEFAULT_SETTINGS.showTimer);
});

test('resolveTheme maps system to light/dark and passes explicit through', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});
