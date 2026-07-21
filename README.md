# WAN22 OS

WAN22 OS is WAN22's internal agency operating system for managing the commercial flow from contract to delivery:

`Contract -> Costs -> Project -> Task -> Approval`

This repository is the primary GitHub-first workspace for the private WAN22 OS MVP.

## Current MVP

The current app is a local, browser-based MVP with these working areas:

- Contracts: contract hierarchy, Draft/Active status, duplicate, services, billing cycles, progress roll-up, and document shortcuts.
- Commercial documents: a shared builder for Quotation, Billing note, and Tax invoice with previews and contract-linked billing rows.
- Costs: five-step Cost Wizard for service scope, team/staff, pricing and tax, billing plan, and profit allocation.
- Projects: parent/child project structure and opening-work progress.
- Tasks: internal production tasks separated from client-facing deliverables.
- Approvals and permissions: role-aware views for the internal operating flow.
- Control Panel: workflow and system configuration used by the MVP.

The document builder currently provides UI preview and state wiring. PDF generation and final company document templates are the next document phase.

## Run Locally

From the repository root:

```bash
npm run start:mvp
```

Open:

`http://127.0.0.1:4180/`

Use this same URL in ChatGPT browser, Safari, and Chrome. The local server stores shared state in `apps/wan22-mvp/data/state.json`, so the browsers can see the same changes.

Opening `apps/wan22-mvp/index.html` directly is still useful for a quick standalone preview, but it uses that browser's private localStorage and will not synchronize with the other browsers.

## Validate

```bash
npm test
```

This runs a syntax check for the MVP JavaScript.

## Repository Guide

- [Project structure](docs/PROJECT_STRUCTURE.md)
- [MVP documentation index](docs/mvp/README.md)
- [MVP baseline](docs/mvp/WAN22_OS_MVP_Baseline_v0.1.md)
- [Current MVP state](docs/mvp/reference/WAN22_OS_CURRENT_STATE.md)
- [Retainer billing UI plan](docs/mvp/reference/WAN22_OS_RETAINER_BILLING_UI_PLAN.md)
- [Imported source documents](docs/imports/README.md)
- [MVP app notes](apps/wan22-mvp/README.md)

## GitHub-First Working Rules

1. Work on a `codex/*` or feature branch for meaningful changes.
2. Keep product specs, implementation files, and sanitized examples in this repository.
3. Keep private company records, accounting files, IDs, signatures, bank documents, and bulky design archives outside Git unless explicitly sanitized.
4. Run validation before committing.
5. Push the branch and review the pull request before merging to `main`.

## Data Safety

The MVP is local-only and intended for private development. Do not place real customer documents, bank details, tax IDs, signatures, or confidential source PDFs in Git. Use sanitized fixtures for demos and tests.
