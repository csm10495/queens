// Small, fast, seedable PRNG utilities (pure, no DOM) so puzzle generation is
// deterministic and unit-testable.

/**
 * mulberry32 PRNG. Returns a function that yields floats in [0, 1).
 * @param {number} seed - 32-bit unsigned seed.
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a random 32-bit seed (uses Math.random; non-deterministic). */
export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/**
 * Random integer in [0, n).
 * @param {() => number} rng
 * @param {number} n
 */
export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

/**
 * In-place Fisher-Yates shuffle using the supplied rng. Returns the array.
 * @template T
 * @param {() => number} rng
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
