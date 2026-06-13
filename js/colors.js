const CLASSIC_BASE = [
  '#f4a261',
  '#8ecae6',
  '#e76f51',
  '#b8de6f',
  '#cdb4db',
  '#ffd166',
  '#90be6d',
  '#f28482',
  '#80ed99',
  '#a0c4ff',
  '#ffafcc',
  '#bde0fe',
];

const COLORBLIND_BASE = [
  '#e69f00',
  '#56b4e9',
  '#009e73',
  '#f0e442',
  '#0072b2',
  '#d55e00',
  '#cc79a7',
  '#999999',
  '#88ccee',
  '#ddcc77',
  '#117733',
  '#ee8866',
];

const PASTEL_BASE = [
  '#ffd6a5',
  '#caffbf',
  '#9bf6ff',
  '#bdb2ff',
  '#ffc6ff',
  '#fdffb6',
  '#d0f4de',
  '#a9def9',
  '#e4c1f9',
  '#f694c1',
  '#fcf6bd',
  '#b5ead7',
];

const PALETTE_CONFIG = {
  classic: { base: CLASSIC_BASE, saturation: 68, lightness: 72, hueOffset: 18 },
  colorblind: { base: COLORBLIND_BASE, saturation: 58, lightness: 70, hueOffset: 30 },
  pastel: { base: PASTEL_BASE, saturation: 78, lightness: 84, hueOffset: 10 },
};

/** The available deterministic region color palette names. */
export const PALETTES = Object.freeze(['classic', 'colorblind', 'pastel']);

/**
 * Return deterministic, distinct CSS colors for puzzle regions.
 *
 * Unknown palette names fall back to the classic palette. Counts less than one
 * return an empty array.
 *
 * @param {number} n - Number of colors to return.
 * @param {string} [palette='classic'] - Palette name.
 * @returns {string[]} Exactly n distinct CSS color strings.
 */
export function regionColors(n, palette = 'classic') {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const config = PALETTE_CONFIG[palette] ?? PALETTE_CONFIG.classic;

  if (count <= config.base.length) {
    return config.base.slice(0, count);
  }

  const colors = [...config.base];
  const extraCount = count - config.base.length;

  for (let index = 0; index < extraCount; index += 1) {
    const hue = Math.round((config.hueOffset + (360 * index) / extraCount) % 360);
    const lightness = config.lightness + (index % 2 === 0 ? 0 : -8);
    colors.push(`hsl(${hue}, ${config.saturation}%, ${lightness}%)`);
  }

  return colors;
}
