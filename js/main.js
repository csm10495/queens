import * as ui from './ui.js';
import { regionColors, PALETTES } from './colors.js';
import { createGame } from './game.js';
import {
  MODES,
  MODE_LABELS,
  FIXED_SIZES,
  sizeForMode,
  clampCustom,
  CUSTOM_MIN,
  CUSTOM_MAX,
} from './modes.js';
import * as store from './storage.js';
import { recordWin, getBucket, emptyStats } from './stats.js';
import { normalizeSettings, applyTheme } from './settings.js';
import { generatePuzzleForMode, UNIQUE_MAX_N } from './puzzle.js';
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
  setInstall: $('set-install'),
  setInstallHint: $('set-install-hint'),
  setReset: $('set-reset'),
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

const modeLabel = (m) =>
  m === 'custom' ? MODE_LABELS[m] : `${MODE_LABELS[m]} (${FIXED_SIZES[m]}×${FIXED_SIZES[m]})`;
const currentN = () => sizeForMode(mode, customN);

// ---- generation (Web Worker with main-thread fallback) ------------------
function initWorker() {
  try {
    worker = new Worker('./js/worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      const { reqId, ok, puzzle } = e.data || {};
      if (reqId !== pendingReqId) return; // stale response
      if (ok) onPuzzle(puzzle);
      else onPuzzle(generatePuzzleForMode(mode, customN, mulberry32(randomSeed())));
    };
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
}

function newPuzzle() {
  hideModals();
  ui.show(el.loading);
  const seed = randomSeed();
  const id = ++reqCounter;
  pendingReqId = id;
  if (worker) {
    worker.postMessage({ reqId: id, mode, customN, seed });
  } else {
    // Defer so the spinner can paint before a (possibly heavy) synchronous gen.
    setTimeout(() => {
      if (id !== pendingReqId) return;
      onPuzzle(generatePuzzleForMode(mode, customN, mulberry32(seed)));
    }, 16);
  }
}

function onPuzzle(puzzle) {
  ui.hide(el.loading);
  startGame(puzzle);
}

function startGame(puzzle, restore) {
  game = createGame(
    puzzle,
    restore
      ? { initialCells: restore.cells, initialElapsedMs: restore.elapsedMs, solved: restore.solved }
      : {}
  );
  colors = regionColors(puzzle.n, settings.palette);
  ui.createBoard(el.board, game, colors, onCellActivate);
  ui.updateBoard(el.board, game, { highlightConflicts: settings.highlightConflicts });
  locked = false;
  el.hint.textContent = puzzle.n > UNIQUE_MAX_N ? 'Large board — may allow more than one solution.' : '';
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
  ui.updateBoard(el.board, game, { highlightConflicts: settings.highlightConflicts });
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
  ui.revealSolution(el.board, game, colors);
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
    customN,
  });
  applyTheme(settings.theme);
  applyShowTimer();
  // Re-colour the existing board for palette changes without disturbing play.
  if (game) {
    colors = regionColors(game.n, settings.palette);
    ui.createBoard(el.board, game, colors, onCellActivate);
    ui.updateBoard(el.board, game, { highlightConflicts: settings.highlightConflicts });
  }
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
  for (const c of [el.setTheme, el.setPalette, el.setDefaultMode, el.setAutoX, el.setHighlight, el.setTimer]) {
    c.addEventListener('change', onSettingsChange);
  }
  el.setReset.addEventListener('click', resetScores);
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

  const resume = store.loadResume();
  if (resume && !resume.solved) {
    mode = resume.mode;
    if (resume.mode === 'custom') customN = resume.n;
    syncDifficultyUI();
    startGame(
      { n: resume.n, regions: resume.regions, solution: resume.solution, mode: resume.mode },
      resume
    );
  } else {
    newPuzzle();
  }
}

boot();
