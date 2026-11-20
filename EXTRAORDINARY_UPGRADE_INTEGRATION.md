# Integration notes
1. Copy/import `app/extraordinary_upgrade.py` into the FastAPI application and initialize `AuditLedger` and `Governance` from app lifespan.
2. Protect endpoints with server-side authentication. Never accept actor_id or role from request payloads. Validate role claims and case/provider/units against tenant scope.
3. Review endpoint: call `Governance.review(case_id, authenticated_actor_id, authenticated_role, notes)`.
4. Decision endpoint: call `Governance.decide(...)`; review is persistent and reviewer/approver IDs must differ.
5. Allocation endpoint: convert validated community records to `Community`, call `allocation(nodes,stock,budget,floor)`, and present diagnostics. Keep a human policy approval step.
6. Audit verification endpoint: call `ledger.verify()`. Export/anchor tip hash outside the DB periodically for stronger tamper resistance.
7. Weight audit: pass normalized candidate score feature dictionaries and the weight dictionary to `sensitivity()`. This checks top-candidate stability only; it is not a causal or fairness guarantee.
