# Queens

A LinkedIn-style **Queens** puzzle game for desktop and mobile browsers. Vanilla
HTML/CSS/JS with **no build step**, installable as an offline **PWA**.

## Play

Place one 👑 per **row**, **column**, and **color region**. No two queens may touch —
including diagonally. Tap/click a cell to cycle empty → ✗ → 👑.

Difficulties: Easy 7×7 · Medium 8×8 · Hard 9×9 · Very Hard 15×15 · Custom N (6–20).

Every puzzle has a short **share code** (e.g. `9-1z3x`) shown under the board — tap **Share** to
copy a link (`?p=<code>`) that reopens the exact puzzle. In **Settings** you can set the **queen
icon to any emoji**, change theme/palette, toggle assists, and load a puzzle by code.

## Run locally

ES modules, the Web Worker, and the service worker require serving over **http(s)** (not
`file://`). Any static server works, e.g.:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

## Test

Tests use Node's built-in runner (no dependencies):

```sh
node --test
```

## Deploy to GitHub Pages

The app is fully static (no build step) and uses only **relative paths**, so it works at
either a domain root or a `https://<user>.github.io/<repo>/` subpath. GitHub Pages serves
over HTTPS, which the service worker and module worker require.

1. Push this folder to a GitHub repo (the app lives at the repo **root**).
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Choose your branch (e.g. `main`) and folder **`/ (root)`**, then save.
4. Open the published URL. The included `.nojekyll` file disables Jekyll so every asset is
   served as-is.

To update after changes, bump `CACHE_VERSION` in [`sw.js`](./sw.js) so clients pick up the
new files, then push.

See [`AGENTS.md`](./AGENTS.md) for architecture and contributor/agent guidance.
