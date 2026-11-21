# HUMANIE Batch 2 Operational Upgrade

Implemented in the demonstrator's shared state/service layer:

- Food: stock, expiry/condition updates, allocation validation, dispatch, receipt reconciliation and discrepancy state.
- Work: validated workflow transitions across referral, employer response, interview, placement and retention check stages; status/contract/reason fields can be updated.
- Education: programme workflow transitions, capacity checks and seat decrement on enrollment, attendance recording (0-100), and 30-day status.
- Follow-up: scheduling case-linked follow-ups and status tracking.
- Metrics: unified operational roll-up for food, work, education and follow-ups.
- Audit: each command appends an audit-ledger event.
- API: POST `/api/v1/operations` and GET `/api/v1/metrics`.

POST operations payload shape:
`{ "action": "...", "payload": { ... } }`

Supported action names: `food_stock_update`, `food_allocate`, `food_dispatch`, `food_receipt`, `work_transition`, `education_transition`, `followup_schedule`, `followup_status`, `domain_metrics`.

These are functional demonstrator workflows backed by shared in-memory state, not external logistics/employer/education integrations or durable production storage. API role-header validation remains demonstrator-level and should not be represented as production authorization.
