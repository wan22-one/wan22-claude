# WAN22 OS MVP App Notes

This is the local, browser-based MVP described in the root [README](../../README.md).

## Structure

- `index.html` / `main.js` / `styles.css` — the app shell and views.
- `server.js` — local Node server (no external dependencies) that serves the app and exposes `GET/POST /api/state` for shared state, backed by `data/state.json`.
- `data/state.json` — shared state file used when running via `npm run start:mvp`. Kept as a sanitized template; do not commit real company data here.
- `scripts/check-syntax.js` — used by `npm test` to syntax-check all MVP JavaScript.

## Run

```bash
npm run start:mvp
```

Then open `http://127.0.0.1:4180/`.

## Standalone Preview

Opening `index.html` directly in a browser works for a quick preview, but state is kept in that browser's `localStorage` only and will not sync with other browsers or with `data/state.json`.
