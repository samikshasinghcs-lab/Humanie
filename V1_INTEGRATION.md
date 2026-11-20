# HUMANIE v1 integrated upgrade

This branch integrates authenticated v1 evaluation endpoints into the FastAPI app:

- `POST /api/v1/evaluation/floor-allocation`: fairness-floor allocation evaluation using stock and transport constraints.
- `POST /api/v1/evaluation/weight-sensitivity`: deterministic seeded weight perturbation to quantify top-candidate stability.
- `GET /api/v1/audit-chain/verify`: verifies the append-only SHA-256 linked audit chain.

These endpoints require the existing authenticated bearer-token dependency. Inputs are validated and audit events are recorded in the existing user audit log. The chain ledger is a separate persistent file under `data/`.

**Limitations:** This does not implement cross-user workspace membership or real institutional reviewer/approver roles. The module's Governance primitive is not exposed as a route; separation-of-duties cannot be safely implemented by client-supplied role strings. These APIs are decision-support only, not autonomous allocation authority. Synthetic data must be labelled; field validation is required.

## Tests
Run `pytest -q`. Tests cover ledger verification, separation-of-duties logic in the isolated governance primitive, allocation floor feasibility, and deterministic sensitivity.
