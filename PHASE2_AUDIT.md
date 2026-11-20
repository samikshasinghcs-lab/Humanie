# Phase 2 audit / remaining truthfully stated gaps

## Implemented in this package
- SQLite hash-chained ledger; app audit calls also append chain events; verification API returns the first broken link/hash row.
- Deliberate tamper-test endpoint (mutates ledger details, so verify then fails until ledger reset).
- HiGHS scenario endpoint for recorded open cases, floor, stock, transport budget and resource-type selection; outputs coverage allocation and solver marginals.
- Floor-only stock and transport slack estimates when the scenario is infeasible.
- Haversine utility and `Why Not?` alternatives use coordinate arrays when supplied; otherwise they report proxy/locality scoring.
- Dignity/agency fields stored as case constraints.
- Silent-exclusion records-based triage endpoint, approver-bias triage endpoint, override-reason frequency insight.
- Crisis proposal/approval simulation, SMS command parser, explicit opt-in transition endpoint, CSV/PDF brief export, Leaflet map for supplied coordinates, crisis page/QR link.
- Smoke test and focused hash-chain/Haversine tests.

## Not implemented / not validated
- No independently verified ward/census/SECC baseline has been ingested. Silent-exclusion is not a ward-baseline comparison.
- No optimized slack LP; the API provides floor-only aggregate shortfall estimates.
- Jobs/Education simulations are resource-type variants over the same recorded-case schema, not a domain-complete vacancies/voucher/seats model.
- No robust language understanding, direct WhatsApp/SMS gateway, WebSocket live push, or external dispatch integration; crisis updates use authenticated polling endpoint.
- Override reason clustering is rudimentary reason frequency, not NLP clustering. Approver-bias alerts are flags only and must not be interpreted as findings.
- Map requires supplied coordinate arrays; it is not automatically geocoded or road-network distance aware. No validated supply lines/heat layer.
- PDF brief is operational records export; independent audit trail verification status is included but not a population-impact report.
- Application-level integration testing could not be run in this environment because `python-jose` is missing and network installation was unavailable. Focused module tests and compile checks pass.
