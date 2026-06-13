import { EMPTY, MARK, QUEEN } from './rules.js';

/** Format milliseconds as M:SS. */
export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Presentational details for the "solution mode" badge shown under the board.
 * It surfaces the board's resolved `unique` flag — the exact value that gates
 * continuous hints — so a player (or a bug report) can see at a glance whether
 * hints are expected to work on this board.
 *
 * @param {boolean} unique - true when the board has a single guaranteed solution.
 * @returns {{ text: string, title: string, className: string }}
 */
export function solutionModeBadge(unique) {
  return unique
    ? {
        text: '🟢 Single solution',
        title: 'This board has exactly one solution — continuous hints can flag a misplaced queen.',
        className: 'sol-mode is-unique',
      }
    : {
        text: '🟠 Multiple solutions',
        title: 'This board may have several valid solutions — continuous hints are unavailable here.',
        className: 'sol-mode is-multi',
      };
}

export function show(el) {
  if (el) el.classList.remove('hidden');
}

export function hide(el) {
  if (el) el.classList.add('hidden');
}

/** Populate a <select> with {value,label} options and select one. */
export function fillSelect(select, options, selected) {
  select.innerHTML = '';
  for (const { value, label } of options) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === selected) opt.selected = true;
    select.appendChild(opt);
  }
}

const MARK_GLYPH = '✗';

/**
 * Build the board grid for a game. Cells are coloured by region with thick
 * borders between different regions.
 *
 * Interaction is pointer-based so it works for mouse and touch:
 *  - A plain tap/click cycles a cell (handlers.onTap).
 *  - When handlers.isDragEnabled() is true, pressing and dragging across cells
 *    paints (or erases) ✗ marks: handlers.onDragStart(r,c) returns the value to
 *    paint, handlers.onDragPaint(r,c,value) applies it per cell, handlers.onDragEnd()
 *    finalizes. A drag begins only once the pointer crosses into a different cell,
 *    so taps still cycle normally.
 *
 * @param {HTMLElement} boardEl
 * @param {ReturnType<import('./game.js').createGame>} game
 * @param {string[]} colors - region colours, indexed by region id
 * @param {{
 *   onTap:(r:number,c:number)=>void,
 *   isDragEnabled?:()=>boolean,
 *   onDragStart?:(r:number,c:number)=>number,
 *   onDragPaint?:(r:number,c:number,value:number)=>void,
 *   onDragEnd?:()=>void,
 * }} handlers
 */
export function createBoard(boardEl, game, colors, handlers) {
  const { n, regions } = game;
  boardEl.style.setProperty('--n', n);
  boardEl.classList.remove('solved', 'revealed');
  boardEl.innerHTML = '';

  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const g = regions[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.backgroundColor = colors[g];
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.setAttribute('role', 'gridcell');
      if (r === 0 || regions[r - 1][c] !== g) cell.classList.add('edge-top');
      if (r === n - 1 || regions[r + 1][c] !== g) cell.classList.add('edge-bottom');
      if (c === 0 || regions[r][c - 1] !== g) cell.classList.add('edge-left');
      if (c === n - 1 || regions[r][c + 1] !== g) cell.classList.add('edge-right');
      const glyph = document.createElement('span');
      glyph.className = 'glyph';
      cell.appendChild(glyph);
      frag.appendChild(cell);
    }
  }
  boardEl.appendChild(frag);

  attachInteraction(boardEl, handlers);
}

function attachInteraction(boardEl, handlers) {
  // Remove any listeners from a previous board build on this element.
  if (boardEl._queensListeners) {
    for (const [type, fn] of boardEl._queensListeners) boardEl.removeEventListener(type, fn);
  }

  const dragEnabled = () => (handlers.isDragEnabled ? handlers.isDragEnabled() : false);
  const coords = (cell) => [Number(cell.dataset.r), Number(cell.dataset.c)];
  const cellAtPoint = (x, y) => {
    const t = document.elementFromPoint(x, y);
    const cell = t && t.closest ? t.closest('.cell') : null;
    return cell && boardEl.contains(cell) ? cell : null;
  };

  let startCell = null;
  let painting = false;
  let paintValue = 0;
  let lastKey = '';
  let suppressClick = false;

  const onPointerDown = (e) => {
    if (!dragEnabled() || e.button > 0) return;
    const cell = e.target.closest && e.target.closest('.cell');
    if (!cell || !boardEl.contains(cell)) return;
    startCell = cell;
    painting = false;
    lastKey = '';
  };

  const onPointerMove = (e) => {
    if (!startCell) return;
    const cell = cellAtPoint(e.clientX, e.clientY);
    if (!cell) return;
    const [r, c] = coords(cell);
    const key = `${r},${c}`;
    if (!painting) {
      if (cell === startCell) return; // same cell → still a potential tap
      const [sr, sc] = coords(startCell);
      paintValue = handlers.onDragStart ? handlers.onDragStart(sr, sc) : 0;
      painting = true;
      handlers.onDragPaint && handlers.onDragPaint(sr, sc, paintValue);
      lastKey = `${sr},${sc}`;
    }
    if (key !== lastKey) {
      handlers.onDragPaint && handlers.onDragPaint(r, c, paintValue);
      lastKey = key;
    }
    e.preventDefault();
  };

  const endPointer = () => {
    if (painting) {
      suppressClick = true; // swallow the click that follows a paint drag
      handlers.onDragEnd && handlers.onDragEnd();
    }
    startCell = null;
    painting = false;
    lastKey = '';
  };

  const onClick = (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const cell = e.target.closest('.cell');
    if (!cell || !boardEl.contains(cell)) return;
    handlers.onTap(...coords(cell));
  };

  const listeners = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', endPointer],
    ['pointercancel', endPointer],
    ['pointerleave', endPointer],
    ['click', onClick],
  ];
  for (const [type, fn] of listeners) boardEl.addEventListener(type, fn);
  boardEl._queensListeners = listeners;
}

/** Repaint glyphs + conflict highlights from the current game state. */
export function updateBoard(
  boardEl,
  game,
  { highlightConflicts, queenIcon = '👑', continuousHints = false }
) {
  const { n, cells } = game;
  const conflictSet = new Set();
  if (highlightConflicts) for (const { r, c } of game.conflicts()) conflictSet.add(r * n + c);

  // Continuous hints only make sense when there is a single intended solution:
  // a queen not on the solution cell is provably wrong on a unique board.
  const hintsOn = continuousHints && game.unique && Array.isArray(game.solution);

  const nodes = boardEl.children;
  for (let i = 0; i < nodes.length; i++) {
    const cell = nodes[i];
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const state = cells[r][c];
    const glyph = cell.firstChild;
    glyph.textContent = state === QUEEN ? queenIcon : state === MARK ? MARK_GLYPH : '';
    glyph.classList.toggle('queen', state === QUEEN);
    glyph.classList.toggle('mark', state === MARK);
    cell.classList.toggle('conflict', conflictSet.has(r * n + c));
    cell.classList.toggle('hint-wrong', hintsOn && state === QUEEN && game.solution[r] !== c);
  }
  boardEl.classList.toggle('solved', game.isSolved());
}

/** Reveal the intended solution (used on "give up"). */
export function revealSolution(boardEl, game, colors, queenIcon = '👑') {
  const { n, solution } = game;
  const nodes = boardEl.children;
  for (let i = 0; i < nodes.length; i++) {
    const cell = nodes[i];
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const glyph = cell.firstChild;
    const isQueen = solution[r] === c;
    glyph.textContent = isQueen ? queenIcon : '';
    glyph.classList.toggle('queen', isQueen);
    glyph.classList.remove('mark');
    cell.classList.remove('conflict');
  }
  boardEl.classList.add('revealed', 'solved');
}
