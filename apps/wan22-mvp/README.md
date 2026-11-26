# WAN22 OS MVP App Notes

This is the local, browser-based MVP described in the root [README](../../README.md).

## Structure

- `index.html` / `app.js` / `styles.css` — the app shell, views (contracts, projects, tasks, costs, people) and styling.
- `quotation.html` — standalone printable quotation page.
- `server.py` — local Python server (default, no dependencies) that serves the app and exposes `GET/POST /api/state`, backed by `data/state.json`. On first run it seeds `data/state.json` from `state.json` if the data file is missing.
- `server.js` — equivalent Node server with the same `/api/state` API.
- `state.json` — sanitized seed/demo state.
- `data/state.json` — the live shared state file written by the server. Do not commit real company data here.
- `test.js` — `npm test`: checks files exist, state JSON shape, and that the main app modules are wired.

## Run

```bash
npm start
```

Or with Node: `node server.js`. Both honour the `PORT` env var (default 4180). Then open `http://127.0.0.1:4180/`.

## Standalone Preview

Opening `index.html` directly in a browser works for a quick preview, but state is kept in that browser's `localStorage` only and will not sync with other browsers or with `data/state.json`.
