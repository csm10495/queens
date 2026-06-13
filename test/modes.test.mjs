import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES,
  FIXED_SIZES,
  CUSTOM_MIN,
  CUSTOM_MAX,
  clampCustom,
  isValidCustom,
  isMode,
  sizeForMode,
} from '../js/modes.js';

test('MODES contains the five expected modes', () => {
  assert.deepEqual([...MODES], ['easy', 'medium', 'hard', 'veryhard', 'custom']);
});

test('sizeForMode maps fixed modes correctly', () => {
  assert.equal(sizeForMode('easy'), 7);
  assert.equal(sizeForMode('medium'), 8);
  assert.equal(sizeForMode('hard'), 9);
  assert.equal(sizeForMode('veryhard'), 15);
  assert.equal(FIXED_SIZES.easy, 7);
});

test('sizeForMode clamps custom into [6,20]', () => {
  assert.equal(sizeForMode('custom', 12), 12);
  assert.equal(sizeForMode('custom', 3), CUSTOM_MIN);
  assert.equal(sizeForMode('custom', 99), CUSTOM_MAX);
});

test('clampCustom rounds and clamps, handling junk', () => {
  assert.equal(clampCustom(6.4), 6);
  assert.equal(clampCustom(19.6), 20);
  assert.equal(clampCustom(0), CUSTOM_MIN);
  assert.equal(clampCustom(1000), CUSTOM_MAX);
  assert.equal(clampCustom(NaN), CUSTOM_MIN);
  assert.equal(clampCustom('abc'), CUSTOM_MIN);
});

test('isValidCustom only accepts integers in range', () => {
  assert.equal(isValidCustom(6), true);
  assert.equal(isValidCustom(20), true);
  assert.equal(isValidCustom(5), false);
  assert.equal(isValidCustom(21), false);
  assert.equal(isValidCustom(12.5), false);
  assert.equal(isValidCustom('12'), false);
});

test('isMode recognizes known modes only', () => {
  assert.equal(isMode('easy'), true);
  assert.equal(isMode('custom'), true);
  assert.equal(isMode('nope'), false);
});
