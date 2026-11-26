# WAN22 OS MVP Baseline v0.1

## Scope

The MVP covers the commercial flow from contract to delivery:

`Contract -> Costs -> Project -> Task -> Approval`

## Working Areas

- **Contracts**: contract hierarchy, Draft/Active status, duplicate, services, billing cycles, progress roll-up, and document shortcuts.
- **Commercial documents**: a shared builder for Quotation, Billing note, and Tax invoice with previews and contract-linked billing rows.
- **Costs**: five-step Cost Wizard for service scope, team/staff, pricing and tax, billing plan, and profit allocation.
- **Projects**: parent/child project structure and opening-work progress.
- **Tasks**: internal production tasks separated from client-facing deliverables.
- **Approvals and permissions**: role-aware views for the internal operating flow.
- **Control Panel**: workflow and system configuration used by the MVP.

## Out of Scope (v0.1)

- PDF generation and final company document templates (next document phase).
- Multi-tenant/company support.
- Authentication and role-based access control beyond simple role-aware views.

## State Model

State is stored as JSON with the following top-level collections: `contracts`, `costs`, `projects`, `tasks`, `approvals`. See `apps/wan22-mvp/data/state.json` for the template shape.
