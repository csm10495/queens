import * as ui from './ui.js';
import { regionColors, PALETTES } from './colors.js';
import { createGame } from './game.js';
import {
  MODES,
  MODE_LABELS,
  FIXED_SIZES,
  sizeForMode,
  clampCustom,
  modeForSize,
  CUSTOM_MIN,
  CUSTOM_MAX,
} from './modes.js';
import * as store from './storage.js';
import { recordWin, getBucket, emptyStats } from './stats.js';
import { normalizeSettings, applyTheme, QUEEN_PRESETS } from './settings.js';
import { generatePuzzleForMode, UNIQUE_MAX_N } from './puzzle.js';
import { encodePuzzleCode, parsePuzzleCode } from './code.js';
import { EMPTY, MARK } from './rules.js';
import { mulberry32, randomSeed } from './rng.js';
import * as pwa from './pwa.js';

const $ = (id) => document.getElementById(id);
const el = {
  difficulty: $('difficulty'),
  customField: $('custom-size-field'),
  customSize: $('custom-size'),
  newBtn: $('new-btn'),
  giveupBtn: $('giveup-btn'),
  settingsBtn: $('settings-btn'),
  statusbar: $('statusbar'),
  timer: $('timer'),
  best: $('best'),
  wins: $('wins'),
  hint: $('hint'),
  board: $('board'),
  loading: $('loading'),
  winModal: $('win-modal'),
  winTime: $('win-time'),
  winBest: $('win-best'),
  winNext: $('win-next'),
  solutionModal: $('solution-modal'),
  solNext: $('sol-next'),
  settingsModal: $('settings-modal'),
  settingsClose: $('settings-close'),
  setTheme: $('set-theme'),
  setPalette: $('set-palette'),
  setDefaultMode: $('set-default-mode'),
  setAutoX: $('set-autox'),
  setHighlight: $('set-highlight'),
  setTimer: $('set-timer'),
  setDrag: $('set-drag'),
  setHints: $('set-hints'),
  setInstall: $('set-install'),
  setInstallHint: $('set-install-hint'),
  setReset: $('set-reset'),
  setQueen: $('set-queen'),
  queenPresets: $('queen-presets'),
  loadCode: $('load-code'),
  loadCodeBtn: $('load-code-btn'),
  shareBtn: $('share-btn'),
  puzzleCode: $('puzzle-code'),
  shareStatus: $('share-status'),
};

let settings = normalizeSettings(store.loadSettings());
let stats = store.loadStats();
let mode = settings.defaultMode;
let customN = settings.customN;
let game = null;
let colors = [];
let timerId = null;
let worker = null;
let pendingReqId = 0;
let reqCounter = 0;
let locked = false; // true after win/give-up so the board can't be edited
let revealed = false; // true after give-up (board shows the solution)
let currentSeed = null; // seed of the current puzzle (for share codes)

const modeLabel = (m) =>
  m === 'custom' ? MODE_LABELS[m] : `${MODE_LABELS[m]} (${FIXED_SIZES[m]}×${FIXED_SIZES[m]})`;
const currentN = () => sizeForMode(mode, customN);

// Standard options for ui.updateBoard, so every repaint stays consistent.
function boardRenderOpts() {
  return {
    highlightConflicts: settings.highlightConflicts,
    queenIcon: settings.queenIcon,
    continuousHints: settings.continuousHints,
  };
}

// Board interaction handlers shared by every createBoard call.
const boardHandlers = {
  onTap: onCellActivate,
  isDragEnabled: () => settings.dragMark,
  onDragStart: (r, c) => game.dragPaintValue(r, c),
  onDragPaint: (r, c, value) => {
    if (game.paintCell(r, c, value)) {
      ui.updateBoard(el.board, game, boardRenderOpts());
    }
  },
  onDragEnd: () => persist(),
};

function renderBoard() {
  ui.createBoard(el.board, game, colors, boardHandlers);
  applyDragMark();
}

function applyDragMark() {
  el.board.classList.toggle('drag-mark', settings.dragMark);
}

// ---- generation (Web Worker with main-thread fallback) ------------------
function initWorker() {
  try {
    worker = new Worker('./js/worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      const { reqId, ok, puzzle, seed } = e.data || {};
      if (reqId !== pendingReqId) return; // stale response
      if (ok) {
        onPuzzle(puzzle, seed);
      } else {
        const s = randomSeed();
        onPuzzle(generatePuzzleForMode(mode, customN, mulberry32(s)), s);
      }
    };
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
}

function newPuzzle(opts = {}) {
  hideModals();
  ui.show(el.loading);
  const seed = opts.seed != null ? opts.seed >>> 0 : randomSeed();
  const id = ++reqCounter;
  pendingReqId = id;
  if (worker) {
    worker.postMessage({ reqId: id, mode, customN, seed });
  } else {
    // Defer so the spinner can paint before a (possibly heavy) synchronous gen.
    setTimeout(() => {
      if (id !== pendingReqId) return;
      onPuzzle(generatePuzzleForMode(mode, customN, mulberry32(seed)), seed);
    }, 16);
  }
}

function onPuzzle(puzzle, seed) {
  ui.hide(el.loading);
  startGame(puzzle, seed);
}

function startGame(puzzle, seed, restore) {
  game = createGame(puzzle, {
    seed: seed ?? null,
    ...(restore
      ? { initialCells: restore.cells, initialElapsedMs: restore.elapsedMs, solved: restore.solved }
      : {}),
  });
  currentSeed = game.seed ?? null;
  colors = regionColors(puzzle.n, settings.palette);
  renderBoard();
  ui.updateBoard(el.board, game, boardRenderOpts());
  locked = false;
  revealed = false;
  el.hint.textContent = puzzle.n > UNIQUE_MAX_N ? 'Large board — may allow more than one solution.' : '';
  updateCodeDisplay();
  updateStats();
  if (!game.isSolved()) {
    game.start();
    startTimer();
  } else {
    stopTimer();
  }
  updateTimer();
  persist();
}

// ---- interaction --------------------------------------------------------
function onCellActivate(r, c) {
  if (!game || game.isSolved() || locked) return;
  game.cycle(r, c, { autoX: settings.autoX });
  ui.updateBoard(el.board, game, boardRenderOpts());
  if (game.isSolved()) handleWin();
  else persist();
}

function handleWin() {
  stopTimer();
  updateTimer();
  locked = true;
  const ms = game.elapsedMs();
  const before = getBucket(stats, mode, currentN());
  const isBest = before.bestMs == null || ms < before.bestMs;
  stats = recordWin(stats, mode, currentN(), ms);
  store.saveStats(stats);
  store.clearResume();
  updateStats();
  el.winTime.textContent = ui.formatTime(ms);
  el.winBest.textContent = isBest ? 'New best time! 🏆' : `Best: ${ui.formatTime(getBucket(stats, mode, currentN()).bestMs)}`;
  ui.show(el.winModal);
}

function giveUp() {
  if (!game || game.isSolved()) return;
  stopTimer();
  locked = true;
  revealed = true;
  ui.revealSolution(el.board, game, colors, settings.queenIcon);
  store.clearResume();
  ui.show(el.solutionModal);
}

// ---- timer --------------------------------------------------------------
function startTimer() {
  stopTimer();
  timerId = setInterval(updateTimer, 250);
}
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}
function updateTimer() {
  el.timer.textContent = game ? ui.formatTime(game.elapsedMs()) : '0:00';
}

// ---- stats / persistence ------------------------------------------------
function updateStats() {
  const bucket = getBucket(stats, mode, currentN());
  el.best.textContent = bucket.bestMs != null ? ui.formatTime(bucket.bestMs) : '—';
  el.wins.textContent = String(bucket.wins);
}

function persist() {
  if (game && !game.isSolved()) store.saveResume(game.toState());
}

// ---- share / puzzle codes ----------------------------------------------
function puzzleCodeStr() {
  return game && currentSeed != null ? encodePuzzleCode(game.n, currentSeed) : null;
}

function updateCodeDisplay() {
  el.puzzleCode.textContent = puzzleCodeStr() || '—';
  el.shareStatus.textContent = '';
}

function flashShare(msg) {
  el.shareStatus.textContent = msg;
  setTimeout(() => {
    el.shareStatus.textContent = '';
  }, 2000);
}

async function sharePuzzle() {
  const code = puzzleCodeStr();
  if (!code) return;
  const url = `${location.origin}${location.pathname}?p=${code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Queens puzzle', text: `Queens puzzle ${code}`, url });
      return;
    } catch {
      /* cancelled/unsupported — fall back to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    flashShare('Link copied!');
  } catch {
    flashShare(code);
  }
}

function loadCodeFromInput() {
  const parsed = parsePuzzleCode(el.loadCode.value);
  if (!parsed) {
    el.loadCode.classList.add('invalid');
    return;
  }
  el.loadCode.classList.remove('invalid');
  mode = modeForSize(parsed.n);
  customN = parsed.n;
  syncDifficultyUI();
  ui.hide(el.settingsModal);
  newPuzzle({ seed: parsed.seed });
}

// ---- difficulty controls ------------------------------------------------
function syncDifficultyUI() {
  el.difficulty.value = mode;
  el.customSize.value = customN;
  el.customField.classList.toggle('hidden', mode !== 'custom');
}

function onDifficultyChange() {
  mode = el.difficulty.value;
  if (mode === 'custom') customN = clampCustom(el.customSize.value);
  syncDifficultyUI();
  newPuzzle();
}

function onCustomChange() {
  customN = clampCustom(el.customSize.value);
  el.customSize.value = customN;
  if (mode === 'custom') newPuzzle();
}

// ---- settings -----------------------------------------------------------
function openSettings() {
  el.setTheme.value = settings.theme;
  el.setPalette.value = settings.palette;
  el.setDefaultMode.value = settings.defaultMode;
  el.setAutoX.checked = settings.autoX;
  el.setHighlight.checked = settings.highlightConflicts;
  el.setTimer.checked = settings.showTimer;
  el.setDrag.checked = settings.dragMark;
  el.setHints.checked = settings.continuousHints;
  el.setQueen.value = settings.queenIcon;
  el.loadCode.value = '';
  el.loadCode.classList.remove('invalid');
  refreshInstallButton();
  ui.show(el.settingsModal);
}

function saveSettings() {
  store.saveSettings(settings);
}

function onSettingsChange() {
  settings = normalizeSettings({
    theme: el.setTheme.value,
    palette: el.setPalette.value,
    defaultMode: el.setDefaultMode.value,
    autoX: el.setAutoX.checked,
    highlightConflicts: el.setHighlight.checked,
    showTimer: el.setTimer.checked,
    dragMark: el.setDrag.checked,
    continuousHints: el.setHints.checked,
    queenIcon: el.setQueen.value,
    customN,
  });
  applyTheme(settings.theme);
  applyShowTimer();
  // Re-render the board for palette / queen-icon changes without disturbing play.
  if (game) {
    colors = regionColors(game.n, settings.palette);
    renderBoard();
    if (revealed) {
      ui.revealSolution(el.board, game, colors, settings.queenIcon);
    } else {
      ui.updateBoard(el.board, game, boardRenderOpts());
    }
  }
  applyDragMark();
  el.setQueen.value = settings.queenIcon;
  saveSettings();
}

function applyShowTimer() {
  el.statusbar.classList.toggle('timer-hidden', !settings.showTimer);
}

function resetScores() {
  if (!window.confirm('Reset all best times and wins?')) return;
  stats = emptyStats();
  store.saveStats(stats);
  updateStats();
}

// ---- install (PWA) ------------------------------------------------------
function refreshInstallButton() {
  const st = pwa.getInstallState();
  if (st.installed) {
    ui.hide(el.setInstall);
    ui.hide(el.setInstallHint);
  } else if (st.canPrompt) {
    ui.show(el.setInstall);
    ui.hide(el.setInstallHint);
  } else if (st.ios) {
    ui.hide(el.setInstall);
    ui.show(el.setInstallHint);
  } else {
    ui.hide(el.setInstall);
    ui.hide(el.setInstallHint);
  }
}

// ---- modals -------------------------------------------------------------
function hideModals() {
  ui.hide(el.winModal);
  ui.hide(el.solutionModal);
}

// ---- bootstrap ----------------------------------------------------------
function populateSelects() {
  const opts = MODES.map((m) => ({ value: m, label: modeLabel(m) }));
  ui.fillSelect(el.difficulty, opts, mode);
  ui.fillSelect(el.setDefaultMode, opts, settings.defaultMode);
  ui.fillSelect(
    el.setPalette,
    PALETTES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })),
    settings.palette
  );
  el.customSize.min = CUSTOM_MIN;
  el.customSize.max = CUSTOM_MAX;
  populateQueenPresets();
}

function populateQueenPresets() {
  el.queenPresets.innerHTML = '';
  for (const emoji of QUEEN_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'emoji-btn';
    b.textContent = emoji;
    b.title = `Use ${emoji}`;
    b.addEventListener('click', () => {
      el.setQueen.value = emoji;
      onSettingsChange();
    });
    el.queenPresets.appendChild(b);
  }
}

function wireEvents() {
  el.newBtn.addEventListener('click', newPuzzle);
  el.giveupBtn.addEventListener('click', giveUp);
  el.settingsBtn.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', () => ui.hide(el.settingsModal));
  el.difficulty.addEventListener('change', onDifficultyChange);
  el.customSize.addEventListener('change', onCustomChange);
  el.winNext.addEventListener('click', newPuzzle);
  el.solNext.addEventListener('click', newPuzzle);
  for (const c of [el.setTheme, el.setPalette, el.setDefaultMode, el.setAutoX, el.setHighlight, el.setTimer, el.setDrag, el.setHints]) {
    c.addEventListener('change', onSettingsChange);
  }
  el.setReset.addEventListener('click', resetScores);
  el.shareBtn.addEventListener('click', sharePuzzle);
  el.puzzleCode.addEventListener('click', sharePuzzle);
  el.setQueen.addEventListener('input', onSettingsChange);
  el.loadCodeBtn.addEventListener('click', loadCodeFromInput);
  el.loadCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCodeFromInput();
  });
  el.setInstall.addEventListener('click', async () => {
    await pwa.promptInstall();
    refreshInstallButton();
  });
  // Close the settings panel by clicking its backdrop.
  el.settingsModal.addEventListener('click', (e) => {
    if (e.target === el.settingsModal) ui.hide(el.settingsModal);
  });
  // React to OS light/dark changes while on "system".
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.theme === 'system') applyTheme('system');
    });
  }
  pwa.onInstallStateChange(refreshInstallButton);
}

function boot() {
  applyTheme(settings.theme);
  applyShowTimer();
  populateSelects();
  syncDifficultyUI();
  wireEvents();
  pwa.initPwa();
  initWorker();

  // A shared ?p=<code> link takes precedence and loads that exact puzzle.
  const codeParam = new URLSearchParams(location.search).get('p');
  const parsed = codeParam ? parsePuzzleCode(codeParam) : null;
  if (parsed) {
    mode = modeForSize(parsed.n);
    customN = parsed.n;
    syncDifficultyUI();
    history.replaceState(null, '', location.pathname);
    newPuzzle({ seed: parsed.seed });
    return;
  }

  const resume = store.loadResume();
  if (resume && !resume.solved) {
    mode = resume.mode;
    if (resume.mode === 'custom') customN = resume.n;
    syncDifficultyUI();
    startGame(
      { n: resume.n, regions: resume.regions, solution: resume.solution, mode: resume.mode },
      resume.seed,
      resume
    );
  } else {
    newPuzzle();
  }
}

boot();
