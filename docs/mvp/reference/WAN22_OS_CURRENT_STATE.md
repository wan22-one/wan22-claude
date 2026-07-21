# WAN22 OS - Current MVP State

Tracks what is actually implemented in `apps/wan22-mvp` at any point in time. Update this file as features land.

## Implemented

- Initial project scaffold: static app shell (`index.html`, `main.js`, `styles.css`), local server (`server.js`), and shared state template (`data/state.json`).
- Navigation shell for Contracts, Documents, Costs, Projects, Tasks, Approvals, and Control Panel views.
- Server-backed state sync via `GET/POST /api/state`, with a `localStorage` fallback when the app is opened directly as a file.

## Not Yet Implemented

- Contract hierarchy, billing cycles, and progress roll-up UI.
- Commercial document builder (Quotation, Billing note, Tax invoice).
- Cost Wizard (five steps).
- Project parent/child structure.
- Task management UI.
- Approvals and role-aware permissions.
- Control Panel configuration UI.
- PDF generation and final document templates.
