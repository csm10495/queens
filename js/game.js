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

  // Undo/redo history of full board snapshots. A snapshot is pushed onto the
  // undo stack *before* every mutating action; the redo stack is cleared by any
  // new action, so undo can walk all the way back to the game's starting board.
  const undoStack = [];
  const redoStack = [];
  let txnBaseline = null; // pre-state captured at the start of a drag transaction

  function snapshot() {
    return cells.map((row) => row.slice());
  }
  function applySnapshot(snap) {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells[r][c] = snap[r][c];
  }
  function sameCells(a, b) {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (a[r][c] !== b[r][c]) return false;
    return true;
  }
  /** Record a pre-action snapshot, invalidating any redo history. */
  function recordChange(before) {
    undoStack.push(before);
    redoStack.length = 0;
  }

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
    const before = snapshot();
    const cur = cells[r][c];
    const next = cur === EMPTY ? MARK : cur === MARK ? QUEEN : EMPTY;
    cells[r][c] = next;
    if (next === QUEEN && autoX) autoMark(r, c);
    recordChange(before);
    return checkSolved();
  }

  function checkSolved() {
    if (!solved && isSolved(cells, regions)) {
      solved = true;
      pause();
    }
    return solved;
  }

  /**
   * Directly set a cell during a drag-paint, without cycling. Only EMPTY<->MARK
   * transitions are allowed; QUEEN cells are never touched (so a drag can't wipe
   * or create queens). Returns true if the cell changed.
   * @param {number} r
   * @param {number} c
   * @param {number} value - MARK to paint, EMPTY to erase
   */
  function paintCell(r, c, value) {
    if (solved) return false;
    const cur = cells[r][c];
    if (cur === QUEEN) return false;
    if (value === MARK && cur === EMPTY) {
      cells[r][c] = MARK;
      return true;
    }
    if (value === EMPTY && cur === MARK) {
      cells[r][c] = EMPTY;
      return true;
    }
    return false;
  }

  /** The value a drag starting on (r,c) should paint: erase if on a mark, else mark. */
  function dragPaintValue(r, c) {
    return cells[r][c] === MARK ? EMPTY : MARK;
  }

  /** Open a drag-paint transaction so the whole gesture is a single undo step. */
  function beginDrag() {
    if (solved) return;
    txnBaseline = snapshot();
  }

  /** Close a drag-paint transaction, recording one undo step if anything changed. */
  function endDrag() {
    if (txnBaseline && !sameCells(txnBaseline, cells)) recordChange(txnBaseline);
    txnBaseline = null;
  }

  function conflicts() {
    return findConflicts(cells, regions);
  }

  function isEmpty() {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (cells[r][c] !== EMPTY) return false;
    return true;
  }

  /**
   * Clear every cell back to EMPTY. Records an undo step (so a clear can be
   * undone) and returns true if the board actually changed.
   */
  function clear() {
    if (solved || isEmpty()) return false;
    const before = snapshot();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells[r][c] = EMPTY;
    recordChange(before);
    return true;
  }

  // Hard reset with no undo history (used internally / by tests).
  function reset() {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells[r][c] = EMPTY;
    undoStack.length = 0;
    redoStack.length = 0;
    txnBaseline = null;
    solved = false;
  }

  /**
   * Place one correct queen the player has not found yet, taken from the
   * intended solution. Existing correct queens are kept; the cell that receives
   * the new queen is cleared of any mark first. Returns the {r,c} placed, or
   * null when every solution queen is already present.
   */
  function hint() {
    if (solved || !Array.isArray(solution)) return null;
    const missing = [];
    for (let r = 0; r < n; r++) {
      if (cells[r][solution[r]] !== QUEEN) missing.push(r);
    }
    if (missing.length === 0) return null;
    const before = snapshot();
    const r = missing[0];
    const c = solution[r];
    cells[r][c] = QUEEN;
    recordChange(before);
    checkSolved();
    return { r, c };
  }

  function canUndo() {
    return undoStack.length > 0;
  }
  function canRedo() {
    return redoStack.length > 0;
  }

  /** Step back to the previous board state. Returns true if it moved. */
  function undo() {
    if (solved || undoStack.length === 0) return false;
    redoStack.push(snapshot());
    applySnapshot(undoStack.pop());
    return true;
  }

  /** Re-apply the most recently undone state. Returns true if it moved. */
  function redo() {
    if (solved || redoStack.length === 0) return false;
    undoStack.push(snapshot());
    applySnapshot(redoStack.pop());
    return checkSolved() || true;
  }

  /** Serializable snapshot for resume (matches serialize.js state shape). */
  function toState() {
    return {
      version: 1,
      mode,
      n,
      ...(Number.isFinite(seed) ? { seed } : {}),
      unique,
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
    paintCell,
    dragPaintValue,
    beginDrag,
    endDrag,
    conflicts,
    checkSolved,
    isSolved: () => solved,
    isRunning: () => running,
    isEmpty,
    clear,
    hint,
    canUndo,
    canRedo,
    undo,
    redo,
    reset,
    toState,
  };
}
