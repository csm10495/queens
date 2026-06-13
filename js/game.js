import { EMPTY, MARK, QUEEN, findConflicts, isSolved } from './rules.js';

const ADJ = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/**
 * Create an in-memory game from a puzzle. DOM-free and unit-testable; the UI
 * reads `cells` for rendering and calls the methods below.
 *
 * @param {{ n:number, regions:number[][], solution:number[], mode?:string, unique?:boolean }} puzzle
 * @param {{ now?: () => number, initialCells?: number[][], initialElapsedMs?: number, solved?: boolean }} [opts]
 */
export function createGame(puzzle, opts = {}) {
  const { n, regions, solution, mode = 'easy', unique = false, seed: puzzleSeed = null } = puzzle;
  const now = opts.now ?? (() => Date.now());

  const cells = opts.initialCells
    ? opts.initialCells.map((row) => row.slice())
    : Array.from({ length: n }, () => new Array(n).fill(EMPTY));

  let accumulated = opts.initialElapsedMs ?? 0;
  let startedAt = null;
  let running = false;
  let solved = opts.solved ?? false;
  const seed = opts.seed ?? puzzleSeed;

  function start() {
    if (!running && !solved) {
      startedAt = now();
      running = true;
    }
  }

  function pause() {
    if (running) {
      accumulated += now() - startedAt;
      running = false;
      startedAt = null;
    }
  }

  function elapsedMs() {
    return accumulated + (running && startedAt !== null ? now() - startedAt : 0);
  }

  function autoMark(r, c) {
    for (let i = 0; i < n; i++) {
      if (cells[r][i] === EMPTY) cells[r][i] = MARK;
      if (cells[i][c] === EMPTY) cells[i][c] = MARK;
    }
    for (const [dr, dc] of ADJ) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && cells[nr][nc] === EMPTY) cells[nr][nc] = MARK;
    }
  }

  /** Cycle a cell EMPTY -> MARK -> QUEEN -> EMPTY. Returns true if now solved. */
  function cycle(r, c, { autoX = false } = {}) {
    if (solved) return solved;
    const cur = cells[r][c];
    const next = cur === EMPTY ? MARK : cur === MARK ? QUEEN : EMPTY;
    cells[r][c] = next;
    if (next === QUEEN && autoX) autoMark(r, c);
    return checkSolved();
  }

  function checkSolved() {
    if (!solved && isSolved(cells, regions)) {
      solved = true;
      pause();
    }
    return solved;
  }

  function conflicts() {
    return findConflicts(cells, regions);
  }

  function reset() {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells[r][c] = EMPTY;
    solved = false;
  }

  /** Serializable snapshot for resume (matches serialize.js state shape). */
  function toState() {
    return {
      version: 1,
      mode,
      n,
      ...(Number.isFinite(seed) ? { seed } : {}),
      regions: regions.map((row) => row.slice()),
      solution: solution.slice(),
      cells: cells.map((row) => row.slice()),
      elapsedMs: elapsedMs(),
      solved,
    };
  }

  return {
    n,
    regions,
    solution,
    mode,
    unique,
    seed,
    cells,
    start,
    pause,
    elapsedMs,
    cycle,
    autoMark,
    conflicts,
    checkSolved,
    isSolved: () => solved,
    isRunning: () => running,
    reset,
    toState,
  };
}
