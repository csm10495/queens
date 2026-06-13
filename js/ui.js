import { EMPTY, MARK, QUEEN } from './rules.js';

/** Format milliseconds as M:SS. */
export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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

const GLYPH = { [QUEEN]: '👑', [MARK]: '✗' };

/**
 * Build the board grid for a game. Cells are coloured by region with thick
 * borders between different regions. Uses event delegation for taps/clicks.
 * @param {HTMLElement} boardEl
 * @param {ReturnType<import('./game.js').createGame>} game
 * @param {string[]} colors - region colours, indexed by region id
 * @param {(r:number,c:number)=>void} onActivate
 */
export function createBoard(boardEl, game, colors, onActivate) {
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

  if (boardEl._queensHandler) boardEl.removeEventListener('click', boardEl._queensHandler);
  const handler = (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !boardEl.contains(cell)) return;
    onActivate(Number(cell.dataset.r), Number(cell.dataset.c));
  };
  boardEl._queensHandler = handler;
  boardEl.addEventListener('click', handler);
}

/** Repaint glyphs + conflict highlights from the current game state. */
export function updateBoard(boardEl, game, { highlightConflicts }) {
  const { n, cells } = game;
  const conflictSet = new Set();
  if (highlightConflicts) for (const { r, c } of game.conflicts()) conflictSet.add(r * n + c);

  const nodes = boardEl.children;
  for (let i = 0; i < nodes.length; i++) {
    const cell = nodes[i];
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const state = cells[r][c];
    const glyph = cell.firstChild;
    glyph.textContent = GLYPH[state] || '';
    glyph.classList.toggle('queen', state === QUEEN);
    glyph.classList.toggle('mark', state === MARK);
    cell.classList.toggle('conflict', conflictSet.has(r * n + c));
  }
  boardEl.classList.toggle('solved', game.isSolved());
}

/** Reveal the intended solution (used on "give up"). */
export function revealSolution(boardEl, game, colors) {
  const { n, solution } = game;
  const nodes = boardEl.children;
  for (let i = 0; i < nodes.length; i++) {
    const cell = nodes[i];
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const glyph = cell.firstChild;
    const isQueen = solution[r] === c;
    glyph.textContent = isQueen ? '👑' : '';
    glyph.classList.toggle('queen', isQueen);
    glyph.classList.remove('mark');
    cell.classList.remove('conflict');
  }
  boardEl.classList.add('revealed', 'solved');
}
