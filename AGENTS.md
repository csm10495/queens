# AGENTS.md

Guidance for AI agents and human contributors working on **Queens**.

> **Keep this file up to date (required).** Whenever you change the architecture,
> commands, conventions, data shapes, or the file map, update `AGENTS.md` **and**
> `README.md` **and** the relevant tests in the same change. Treat documentation and
> tests as part of "done". Run `node --test` and keep it green; for UI changes, serve
> the app and smoke-test it in a browser.

## What this is

A LinkedIn-style **Queens** puzzle game. Place exactly one 👑 per **row**, **column**,
and **color region**; no two queens may touch, **including diagonally**. (Queens may share
a diagonal as long as they are not directly adjacent.)

It is a fully client-side, **vanilla HTML/CSS/JS** app with **no build step**, installable
as an **offline PWA**. It runs on desktop and phone.

## Run & test

- **Serve** (ES modules, the Web Worker, and the service worker require http(s)/localhost,
  not `file://`):
  ```sh
  python -m http.server 8000      # then open http://localhost:8000
  ```
- **Test** (Node's built-in runner, zero dependencies):
  ```sh
  node --test                     # or: npm test
  ```
- **Regenerate app icons** (only if the brand art changes):
  ```sh
  node tools/make-icons.mjs
  ```

## Conventions

- Vanilla JS **ES modules**; `package.json` has `"type":"module"` so every `.js` is ESM.
- **No build step / no runtime dependencies.** `package.json` only wires up `node --test`.
- Keep **game logic pure and DOM/storage-free** so it imports cleanly into Node and is
  unit-testable. Side effects (DOM, `localStorage`, service worker, install prompt) live in
  thin adapters.
- Tests: `test/<module>.test.mjs` using `node:test` + `node:assert/strict`. Tests must be
  **useful and functional** (assert real behavior, invariants, edge cases) — not coverage padding.

## Architecture

### Canonical data shapes
- **puzzle**: `{ n, regions, solution, mode, unique }`
  - `regions`: `number[][]` (`n×n`), region id `0..n-1` per cell. Each region is
    4-connected and contains exactly one intended queen. Region `i` is seeded by the queen
    in row `i`, so `regions[i][solution[i]] === i`.
  - `solution`: `number[]` length `n`, `solution[row] = column`. A permutation with
    `|solution[r] - solution[r-1]| >= 2` for consecutive rows.
  - `unique`: `true` if the board has a guaranteed-unique solution (see generation).
- **cells** (player board): `number[][]`, `EMPTY=0 | MARK=1 | QUEEN=2` (from `rules.js`).
- **state** (resume): `{ version:1, mode, n, seed?, unique?, regions, solution, cells, elapsedMs, solved }`
  (`seed` is what powers shareable puzzle codes; `unique` is persisted so continuous hints keep
  working after a reload/resume).
- **stats**: `{ easy|medium|hard|veryhard: {bestMs, wins}, custom: { [nAsString]: {bestMs, wins} } }`.
- **settings**: `{ theme, palette, queenIcon, autoX, highlightConflicts, showTimer, dragMark, continuousHints, defaultMode, customN }`
  (`queenIcon` is any emoji — sanitized to one grapheme; `dragMark` enables press-and-drag ✗
  painting; `continuousHints` flags a misplaced queen with a corner ✗, only on `unique` boards).

### Pure, DOM-free modules (unit-tested directly)
- `js/rng.js` — seedable PRNG (`mulberry32`, `randInt`, `shuffle`) for deterministic generation.
- `js/modes.js` — difficulty modes + size mapping (Easy 7, Medium 8, Hard 9, Very Hard 15,
  Custom N in `[6,20]`).
- `js/generator.js` — random valid solution placement + organic region growth.
- `js/solver.js` — backtracking solution counter / finder (forward-checked).
- `js/puzzle.js` — **generation orchestration** (see below).
- `js/code.js` — shareable puzzle codes: `encodePuzzleCode(n, seed)` / `parsePuzzleCode(str)`. A
  board is fully determined by `(n, seed)`; the worker echoes the seed it used, and the UI shows a
  `n-<seed36>` code with a `?p=<code>` share link / "Play a puzzle code" loader.
- `js/rules.js` — conflict detection + win detection + cell-state constants.
- `js/colors.js` — deterministic region palettes (`classic`, `colorblind`, `pastel`),
  distinct up to N=20.
- `js/serialize.js` — resume state (de)serialization (defensive).
- `js/stats.js` — immutable best-time/win bookkeeping.
- `js/settings.js` — settings normalization + theme resolution (`applyTheme` is DOM-guarded).
- `js/game.js` — in-memory game state machine (cells, timer, cycle, conflicts, win, snapshot).

### Side-effecting / glue
- `js/storage.js` — defensive `localStorage` wrapper (stats, settings, resume). Accepts an
  injected storage for tests.
- `js/worker.js` — Web Worker that runs generation off the main thread.
- `js/ui.js` — board rendering, region borders, timer formatting, modal/banner helpers.
  `createBoard` takes a handlers object; interaction is pointer-based (tap cycles; when
  `dragMark` is on, press-and-drag paints/erases ✗ marks via `game.paintCell`).
- `js/pwa.js` — service-worker registration + `beforeinstallprompt` handling.
- `js/main.js` — bootstrap: wires worker, board, timer, persistence, settings, PWA.
- `index.html`, `styles.css` — responsive app shell + CSS-variable theming (light/dark).
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA manifest, service worker, icons.

### Puzzle generation (the important part) — `js/puzzle.js`
Guaranteeing a **unique** solution is cheap for small boards but **computationally
infeasible in-browser for large ones** (benchmarked: ~0.4s at 12×12, effectively impossible
at 15×15+). So generation is **hybrid**:
- `n <= UNIQUE_MAX_N` (**12**): grow regions outward from single-cell seeds, only unblocking
  a cell into a region when the puzzle stays uniquely solvable (a forward-checked feasibility
  oracle). Result is guaranteed unique. `unique: true`.
- larger `n`: grow an organic, balanced, contiguous partition (round-robin multi-source BFS).
  The intended solution always exists, so the board is **guaranteed solvable** but may admit
  more than one solution. `unique: false`. This is fine: win detection is rule-based (any
  valid placement wins) and "give up" reveals the intended solution.

Key structural fact exploited everywhere: with one queen per row, **adjacency only matters
between consecutive rows** (`|col - prevCol| >= 2`), and a region is impossible once we pass
its last occupied row — the solver/oracle use these to prune hard.

### Flow
Generation runs in `worker.js` (main-thread fallback in `main.js`) with a "Generating…"
overlay. Win and give-up show a **bottom banner** (not a centered modal) so the board stays
visible. The in-progress puzzle auto-saves to `localStorage` and resumes on reload.

## Gotchas
- Serve over **http(s)/localhost** — ES modules, the module worker, and the SW do not work
  from `file://`.
- **Bump `CACHE_VERSION` in `sw.js`** whenever any shipped asset changes, and keep the
  precache `ASSETS` list in sync with the files in `js/` and `icons/`.
- **Unique solutions are only guaranteed for `n <= 12`** (`UNIQUE_MAX_N`). Don't add tests
  that assert uniqueness for larger boards.
- Custom size is clamped to `[6, 20]`; `n = 2` and `n = 3` have no valid Queens solution.
- **iOS Safari** has no programmatic install prompt — `pwa.js`/the UI fall back to an
  "Add to Home Screen" hint.
- Generation is deterministic given an RNG seed; keep it that way (no wall-clock branching)
  so tests can assert determinism.

## File map
```
index.html              app shell (header, board, banners, settings)
styles.css              responsive, themeable (light/dark + palettes)
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline precache; bump CACHE_VERSION!)
icons/                  PNG app icons (generated by tools/make-icons.mjs)
js/
  rng.js modes.js generator.js solver.js puzzle.js code.js rules.js colors.js
  serialize.js stats.js settings.js game.js     # pure / testable
  storage.js worker.js ui.js pwa.js main.js      # side-effecting / glue
test/                   node:test suites, one per pure module
tools/make-icons.mjs    dev-only icon generator
package.json            "type":"module" + "test": "node --test"
```
