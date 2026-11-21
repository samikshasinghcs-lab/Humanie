# HUMANIE — Unified Batch 1–4 Codebase

This archive is the cumulative Batch 4 snapshot and includes the implementation modules and upgrade notes from Batches 1–4.

## Included batches
- Batch 1 — Foundation & Unified Case Infrastructure: case/intake API foundation, organization/user/consent endpoints, shared case infrastructure.
- Batch 2 — Food, Work, Education & Outcomes: operational workflow API, metrics, stock/allocation/dispatch/receipt, employment and education workflow, follow-up infrastructure.
- Batch 3 — Governance, Integrity Shield & Decision Vault: governance API, approvals/conflicts/flags/complaint review and audit-related infrastructure.
- Batch 4 — Globalisation, Interoperability & Hardening: CSV/API interoperability, export, health endpoint and import validation/logging infrastructure.

## Key API modules
- `/app/api/v1/consent`
- `/app/api/v1/users`
- `/app/api/v1/organizations`
- `/app/api/v1/cases`
- `/app/api/v1/intake`
- `/app/api/v1/events`
- `/app/api/v1/operations`
- `/app/api/v1/metrics`
- `/app/api/v1/governance`
- `/app/api/v1/interoperability`
- `/app/api/v1/interoperability/export`
- `/app/api/v1/health`

## Verification caveat
This is a consolidated code snapshot, not a declaration of production readiness. Compilation/build and integration tests remain to be completed. Security, persistence, authentication, infrastructure integrations and resilience controls require further verification/hardening.
