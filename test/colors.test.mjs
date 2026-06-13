import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, regionColors } from '../js/colors.js';

const CSS_COLOR_PATTERN =
  /^(#[0-9a-f]{3}(?:[0-9a-f]{3})?|hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+|100%|\d{1,3}%))?\s*\))$/i;

function normalized(colors) {
  return colors.map((color) => color.toLowerCase().replace(/\s+/g, ''));
}

test('exports the required palette names', () => {
  assert.ok(Array.isArray(PALETTES));
  assert.ok(PALETTES.includes('classic'));
  assert.ok(PALETTES.includes('colorblind'));
  assert.ok(PALETTES.includes('pastel'));
});

for (const palette of PALETTES) {
  test(`${palette} returns deterministic valid colors for n=1..20`, () => {
    for (let n = 1; n <= 20; n += 1) {
      const colors = regionColors(n, palette);
      const repeat = regionColors(n, palette);
      const normalizedColors = normalized(colors);

      assert.equal(colors.length, n, `length for n=${n}`);
      assert.deepEqual(repeat, colors, `determinism for n=${n}`);
      assert.equal(new Set(normalizedColors).size, n, `distinct colors for n=${n}`);
      assert.ok(colors.every((color) => typeof color === 'string'), `strings for n=${n}`);
      assert.ok(
        colors.every((color) => CSS_COLOR_PATTERN.test(color)),
        `CSS color shape for n=${n}: ${colors.join(', ')}`,
      );
    }
  });

  test(`${palette} has twenty distinct normalized colors`, () => {
    const colors = normalized(regionColors(20, palette));
    assert.equal(new Set(colors).size, 20);
  });
}

test('unknown palette falls back to classic', () => {
  assert.deepEqual(regionColors(20, 'nope'), regionColors(20, 'classic'));
});

test('n=0 returns an empty array without error', () => {
  assert.deepEqual(regionColors(0), []);
});
