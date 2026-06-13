import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, solutionModeBadge } from '../js/ui.js';

test('formatTime renders M:SS with zero-padded seconds and clamps negatives', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(9000), '0:09');
  assert.equal(formatTime(75000), '1:15');
  assert.equal(formatTime(600000), '10:00');
  assert.equal(formatTime(-500), '0:00');
});

test('solutionModeBadge(true) describes a single-solution board where hints work', () => {
  const badge = solutionModeBadge(true);
  assert.equal(badge.className, 'sol-mode is-unique');
  assert.match(badge.text, /single solution/i);
  assert.match(badge.title, /one solution/i);
  // The label must visibly distinguish the two states.
  assert.notEqual(badge.text, solutionModeBadge(false).text);
});

test('solutionModeBadge(false) describes a multi-solution board where hints are off', () => {
  const badge = solutionModeBadge(false);
  assert.equal(badge.className, 'sol-mode is-multi');
  assert.match(badge.text, /multiple solutions/i);
  assert.match(badge.title, /unavailable/i);
});

test('solutionModeBadge always returns the three presentational fields', () => {
  for (const unique of [true, false]) {
    const badge = solutionModeBadge(unique);
    assert.deepEqual(Object.keys(badge).sort(), ['className', 'text', 'title']);
    for (const v of Object.values(badge)) assert.equal(typeof v, 'string');
    assert.ok(badge.className.startsWith('sol-mode '));
  }
});
