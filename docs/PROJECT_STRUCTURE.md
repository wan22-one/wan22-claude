# Project Structure

```
wan22-claude/
├── apps/
│   └── wan22-mvp/          # Local, browser-based MVP app
│       ├── data/
│       │   └── state.json  # Shared state (server-backed, gitignored data is NOT ignored here since it is a template)
│       ├── scripts/
│       │   └── check-syntax.js
│       ├── index.html
│       ├── main.js
│       ├── styles.css
│       ├── server.js        # Local server for `npm run start:mvp`
│       └── README.md
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   ├── imports/
│   │   └── README.md
│   └── mvp/
│       ├── README.md
│       ├── WAN22_OS_MVP_Baseline_v0.1.md
│       └── reference/
│           ├── WAN22_OS_CURRENT_STATE.md
│           └── WAN22_OS_RETAINER_BILLING_UI_PLAN.md
├── package.json
└── README.md
```

## Notes

- `apps/wan22-mvp` is the only application in this repository today.
- `apps/wan22-mvp/data/state.json` holds the shared MVP state when the app is run via `npm run start:mvp`. Do not commit real customer or company data into this file — keep it as sanitized/template data.
- `docs/mvp` holds the working specification and reference material for the MVP described in the root [README](../README.md).
- `docs/imports` holds sanitized source documents imported for reference during MVP development.
