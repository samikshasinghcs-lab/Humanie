# HUMANIE Batch 3 Governance Upgrade

Added `/api/v1/governance` GET/POST interface.

## GET
Returns Decision Vault records, integrity flags, protected complaint review metadata (identity vault reference redacted), audit ledger and hash-chain verification, and summary counts.

## POST actions (payload required)
- `second_approve`: `{decisionId, approverName}`; rejects a same-name/same-role primary approver.
- `declare_conflict`: `{decisionId, note}`; marks conflict and escalates decision.
- `flag_status`: `{flagId, status, note}`; updates signal state.
- `complaint_review`: `{complaintId, status, note, reviewerOrgId}`; blocks reviewer-org match with accused organization.
- `add_signal`: `{category, severity, title, description, caseId, orgId, ward, evidenceMetric}`.

Role may be passed through `x-humanie-role` or `actorRole` in body. Demonstrator-only: this header is not authentication and must not be trusted in production. State remains the app's shared demonstrator state. Identity reference generation in the existing complaint module is not cryptographic encryption or a true separate identity vault.
