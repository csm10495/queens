import { generatePuzzleForMode } from './puzzle.js';
import { mulberry32, randomSeed } from './rng.js';

self.onmessage = (e) => {
  const { reqId, mode, customN, seed } = e.data || {};
  try {
    const usedSeed = Number.isInteger(seed) ? seed >>> 0 : randomSeed();
    const rng = mulberry32(usedSeed);
    const puzzle = generatePuzzleForMode(mode, customN, rng);
    self.postMessage({ reqId, ok: true, puzzle, seed: usedSeed });
  } catch (err) {
    self.postMessage({ reqId, ok: false, error: String((err && err.message) || err) });
  }
};
