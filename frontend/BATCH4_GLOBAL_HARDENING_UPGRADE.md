# HUMANIE Batch 4 — Globalisation, Interoperability & Hardening

Implemented additions in this codebase:

- `GET /api/v1/health`: service/state health response and audit-chain verification.
- `POST /api/v1/interoperability`: CSV-text or JSON-row partner import; validates domain/urgency/required fields, requires explicit service consent, suppresses optional data sharing and follow-up by default, returns row-level errors, logs import outcomes and appends an audit event.
- `GET /api/v1/interoperability`: import log and mapping-template metadata (oversight access).
- `GET /api/v1/interoperability/export`: CSV export of role-filtered case metadata; intentionally excludes beneficiary aliases and sensitive evidence/complaint data.
- CSV parser supports quoted cells and escaped quotes.

Existing Batch 4 UI already contains country-pack switching, partner import, CSV download, evidence/pilot separation and hardening panels. Existing `/api/v1/system` handles country-pack switching and partner import; this upgrade supplements that UI path with an explicit interop API and safer metadata export.

## Example CSV
`alias,domain,ward,need,urgency,consent_granted`

The consent field must be explicitly true for a row; otherwise intake fails. Optional data-sharing and follow-up are disabled on this import endpoint.

## Demonstrator limitations
- The in-memory state is not durable across restarts or serverless instances.
- `x-humanie-role` is a demonstration role selector, not authentication; endpoint checks are not production security.
- Health reports app-state and hash-chain checks, not infrastructure monitoring.
- Country/legal/retention packs, encryption at rest, backups, recovery, retry orchestration and real partner integrations remain deployment-level work.
- CSV import/export is not a secure, production-grade data exchange protocol.
