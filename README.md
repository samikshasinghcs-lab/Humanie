# HUMANIE v0.9 — District Evaluation & Operations Demonstrator

**Intelligence for humanity.** This release packages the district workflow demonstrator with an end-to-end district workflow: pseudonymous need intake, provider/resource registration, explainable candidate matching, mandatory human approval, dispatch and receipt confirmation, complaints, audit events and operational outcome reporting.

## Start locally

Python 3.10+ recommended.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set a long random `HUMANIE_SECRET_KEY` in `.env` before running. After copying `.env.example`, run `python scripts/quickstart_local.py` to generate a local random key if one is not already present. The application currently has a hardcoded fallback for convenience; never rely on it, and never expose the service to a network without setting your own secret.

```bash
uvicorn app.main:app --reload
```

Open:
- `http://127.0.0.1:8000` — research dashboard (World Bank data, country-level map, LP allocation, exploratory model, opportunity scenario simulator)
- `http://127.0.0.1:8000/district` — district operations console, including the Evaluation Lab
- `http://127.0.0.1:8000/docs` — API documentation

Create an account in either console. The same local token is used by both.

## District workflow (v0.3)

1. **Need intake:** create a pseudonymous case reference, district/locality, need type, urgency, vulnerability score and demand quantity.
2. **Resource register:** record a provider, resource type, capacity, locality, unit and verification status.
3. **Candidate matching:** generate ranked candidates where district and resource type match. The score is explainable and uses urgency (40%), vulnerability (25%), locality text match (20%), provider verification (10%) and capacity fit (5%). Only the top three candidates per case are returned.
4. **Human decision:** approve or reject a candidate with a mandatory written reason. Approval reserves resource capacity and checks that cumulative approved quantities do not exceed recorded case demand.
5. **Dispatch:** record the dispatched quantity and confirmation channel.
6. **Receipt confirmation:** record received quantity. A quantity mismatch is flagged as a discrepancy.
7. **Complaints:** record bribery, discrimination, non-delivery, quality, privacy or misconduct complaints and track status/resolution through the API.
8. **Impact & audit:** inspect workflow metrics and district audit events.

### Demo data

The district console has a **Load fictional demo records** button. It inserts three fictional cases and three fictional providers into an empty case workspace. These are not real households, verified providers or field observations. They are labelled as synthetic demo data in the audit log.

## Key district API endpoints

All endpoints below (except health and static pages) require a Bearer token.

| Endpoint | Purpose |
|---|---|
| `POST /api/district/cases` | Register pseudonymous need case |
| `GET /api/district/cases` | List workspace cases |
| `POST /api/district/resources` | Register provider/resource capacity |
| `GET /api/district/resources` | List resources |
| `POST /api/district/matches/generate` | Generate explainable candidate matches |
| `GET /api/district/matches` | List candidates and decisions |
| `POST /api/district/matches/{id}/decision` | Human approve/reject with reason |
| `POST /api/district/matches/{id}/dispatch` | Record dispatch |
| `GET /api/district/deliveries` | List delivery records |
| `POST /api/district/deliveries/{id}/confirm` | Confirm quantity received |
| `POST /api/district/complaints` | Submit complaint |
| `GET /api/district/complaints` | List complaints |
| `POST /api/district/complaints/{id}/resolve` | Record complaint disposition |
| `GET /api/district/impact` | Operational metrics |
| `GET /api/district/audit` | District event log |
| `GET /api/evaluation/allocation?scenario=urban&floor_pct=30` | Three-policy synthetic allocation comparison |
| `GET /api/data/catalog` | Indicator provenance, granularity and limitations |
| `POST /api/district/demo/seed` | Add fictional walkthrough records to an empty workspace |

## v0.5 evaluation additions

- **Three-policy Evaluation Lab:** compares (1) proportional-to-demand baseline, (2) unconstrained vulnerability-weighted LP, and (3) the same LP with a configurable minimum community coverage floor (default 30%).
- Three deterministic synthetic contexts are available: urban/baseline capacity, rural/higher route costs, and low-capacity/constrained stock.
- Reports allocation, unmet demand, transport cost, stock utilisation, overall coverage, minimum community coverage, vulnerability-weighted coverage and coverage gap, plus community-level results.
- The proportional baseline may leave stock unused because equal-share allocation hits the transport budget. This is explicitly disclosed; all policies respect the same stock, transport and demand constraints.
- The 30% floor is a demonstration policy assumption, not a universal or empirically validated fairness threshold. A floor makes the trade-off visible; it does not prove fairness, causal impact or reduced hunger.
- **Data catalog:** `/api/data/catalog` explains each public indicator source, national country-year granularity, intended use and limitations.

## Important design and evidence limitations

- **No live public-service integration exists.** There are no signed agreements with a district, government department, NGO, food bank, employer or training provider in this codebase.
- **No real beneficiary data is bundled.** The district console starts empty. The optional seed data is fictional. Do not enter identifiable or sensitive personal data.
- **Matching is a transparent heuristic, not a validated allocation policy.** Locality comparison is a text equality proxy, not GIS routing. It does not verify eligibility, nutritional requirements, provider quality, stock provenance or actual travel distance. It is a candidate-ranking aid only.
- **Human approval is mandatory.** The platform must not autonomously deny essential support. Real programmes need an appeal path, published eligibility criteria, trained human reviewers and independent oversight.
- **Verification is self-attested in this prototype.** A `verified=true` flag is entered by the workspace operator; there is no independent provider identity or capacity verification service.
- **Delivery evidence is a note field.** No signed recipient receipt, geotag, independent verifier or secure evidence vault is integrated yet. The event log is not an independent audit system.
- **Complaint handling is a workflow skeleton.** It is not a protected whistleblower channel, emergency response system, legal case-management tool or guarantee of non-retaliation.
- **Single-workspace access control only.** Accounts are isolated by owner ID, but there are no institutional organisations, granular staff roles, delegated access, reviewer/approver separation, MFA, SSO or approval quorum.
- **Security is prototype-grade, not production-grade.** Before real use: managed secrets, HTTPS, secure cookies/token storage, MFA, CSRF protections where applicable, hardened rate limiting, database encryption, backups, monitoring, vulnerability testing, dependency scanning, incident response, key rotation and independent penetration testing are required. Browser localStorage token storage is used in the demo UI.
- **SQLite is for local development only.** Production needs a managed database, migrations, transaction design, tenant isolation and tested disaster recovery.
- **Impact metrics are operational indicators.** They measure recorded cases, capacity, approvals, dispatches, receipt quantities, discrepancies and complaints. They do not prove reduced hunger, improved nutrition, better employment or causal impact. Those require validated baseline/follow-up outcomes and independent evaluation.

## Existing research modules (v0.2)

- World Bank Indicators API ingestion script: `scripts/fetch_world_bank.py` (requires internet when run).
- FAO-sourced national prevalence of undernourishment indicator (`SN.ITK.DEFC.ZS`) and country-level population, GDP per capita PPP and unemployment indicators.
- Linear programming food allocation demonstrator using SciPy HiGHS; its community-level inputs are synthetic.
- Exploratory Random Forest model using country-year data with a chronological holdout; not causal, not subnational and not for individual eligibility or operational decisions.
- Country-level choropleth; latest available year per country may differ.
- Opportunity intervention calculator; effect sizes are assumptions, not causal estimates.

To download the public dataset:

```bash
python scripts/fetch_world_bank.py
```

## Production pathway before any live district pilot

1. Secure a formal district/partner sponsor and written operating agreement.
2. Conduct legal review for each jurisdiction and programme; map lawful basis, rights, retention, cross-border restrictions and complaint obligations.
3. Complete a data protection impact assessment and threat model with affected-community input.
4. Establish independent provider verification and a controlled eligibility/appeals process.
5. Replace locality proxy with verified GIS coordinates, road-network routing and accessibility constraints.
6. Introduce organisation/tenant boundaries, granular RBAC/ABAC, separation of duties, MFA and independent auditor access.
7. Move audit events to independently controlled append-only storage with cryptographic integrity checks and periodic external anchoring.
8. Integrate verified inventory, procurement, finance and delivery evidence systems.
9. Define outcome indicators with communities and independent evaluators; publish methodology and uncertainty.
10. Run a small, opt-in, independently monitored pilot before scaling.

**Status:** Research and operational workflow demonstrator. Not certified, not production-ready and not authorised to administer public benefits.

## Important comparison caveat

The proportional baseline is a policy comparator, not a same-throughput optimum. It may leave stock unused because the transport budget binds while preserving equal percentage coverage. The two LP policies may use more stock under the same transport budget by changing the allocation pattern. The deck and API report stock utilisation so this is visible rather than hidden.

## v0.6 — Fairness–efficiency floor sweep

The Evaluation Lab now returns a floor sweep at 0%, 5%, ..., 50% for the selected synthetic context. Each point re-solves the same weighted LP under the same stock, transport-budget and demand-cap constraints, adding a minimum per-community coverage bound. Infeasible points are explicitly marked `feasible: false` with null metrics.

The response includes `floor_sweep[]` with:
- `floor_pct`
- `feasible`
- `minimum_community_coverage_pct`
- `vulnerability_weighted_coverage_pct`
- `allocated_units`
- `transport_cost`

The district console plots the floor sweep and community-level coverage. The floor is a policy parameter, not a mathematical proof of fairness.

### How to interpret the baseline comparison

The proportional baseline gives each community the same percentage coverage, so its minimum coverage equals its overall coverage. In these scenarios it may leave stock unused because its proportional pattern hits the transport budget. The floored LP can increase vulnerability-weighted coverage by changing who receives available stock, but it reduces the minimum coverage guarantee compared with the proportional baseline. In low-capacity, the weighted-coverage difference is small and should be described as approximately a tie.

### Updated local run

1. `pip install -r requirements.txt`
2. `python scripts/quickstart_local.py`
3. `uvicorn app.main:app --reload`
4. Open `/district` → Evaluation Lab → select a scenario → Run comparison.

### 66-second judge demo

Use `DEMO_WALKTHROUGH.md`. Record the workflow sequence before the event; do not rely on an untested live connection.

## v0.7 — baseline-anchored floor sweep and release consistency
- Release labels aligned to v0.7; API metadata and health endpoint report 0.7.0.
- Floor-sweep CSV and chart include proportional-baseline reference values.
- The 40% floor is shown as a policy comparison, not a universal fairness claim.
- Synthetic urban 40% floor: 46.53% vulnerability-weighted coverage; 40.00% minimum community coverage. Proportional baseline: 43.69% weighted and minimum coverage.
- Synthetic rural 40% floor: 41.03% vulnerability-weighted coverage; 40.00% minimum community coverage. Proportional baseline: 40.59% weighted and minimum coverage.
- Feasibility gate before any field pilot: partner agreement, legal review, privacy impact assessment, and supervised field test.
- No signed partners, live integrations, or proven impact are claimed.

## v0.9 — final presentation and release cleanup
- API metadata and health endpoint report 0.9.0.
- District console, research console and demo walkthrough labels aligned to v0.9.
- Corrected the 30% floor throughput statement and cleaned release filenames.
- Packaged one canonical floor-sweep CSV and chart.
- Presentation clarifies unequal throughput, labels scenario baselines by matching colours, and marks low-capacity infeasibility beyond a 30% floor.
- The Random Forest remains exploratory; this release does not claim measured ML performance or use it for allocation.
- The actual 66-second demo recording and full live integration/smoke test remain to be completed by the presenter.


## HUMANIE v0.9+ district intelligence additions (demo/pilot)

- Case-level dignity/agency preferences can be supplied as JSON `constraints` when creating a case.
- Provider capabilities can be supplied as JSON `attributes` when registering a resource. Matching treats these supplied key/value constraints as hard filters (missing or mismatched attributes exclude a candidate).
- `POST /api/district/matches/generate` returns candidate recommendations and constraint exclusion reasons.
- `GET /api/district/intelligence/silent-exclusion` flags localities with high recorded average vulnerability and below-average case counts. This is a records-based signal only—not proof of exclusion or prevalence.
- `GET /api/district/intelligence/provider-leakage` flags recorded dispatch/receipt shortfalls for investigation; it is not an allegation.
- `GET /api/district/matches/{match_id}/why-not` provides score-based comparison with eligible alternative providers.
- District console includes buttons for silent-exclusion and receipt-discrepancy scans.

These capabilities are exploratory and require verified field data, safeguards, independent review and human decision-making before operational use.

## Phase 2 operational additions (v0.9.1 code snapshot)

- Hash-chained audit records in a separate SQLite ledger (`humanie_audit_chain.db` adjacent to configured DB); `GET /api/audit/verify` checks link and record digests. `POST /api/audit/tamper-test` deliberately mutates a ledger row for demonstration and **leaves the test ledger compromised**.
- Scenario endpoint `POST /api/simulate` runs SciPy/HiGHS on open, recorded workspace cases for food/training/employment types, with recorded demand and the minimum cost-per-unit among matching active providers used as a proxy route cost. This is a simplified workspace model, not a district-wide logistics model. Shadow-price fields are solver marginals and Bottleneck Advisor text is conditional on constraint marginal values.
- Floor infeasibility currently reports floor-only aggregate stock/transport slack estimates, not a full auxiliary slack LP; do not describe it as a fully optimized infeasibility recovery solver.
- Case matching can store dignity preferences (cooking fuel, dietary needs, commute, childcare) in the constraints JSON. Provider attributes must encode matching values; absent capability data is not proof of compatibility. Haversine is available when both case and provider coordinate arrays are supplied; matching otherwise falls back to locality/district proxies.
- Silent exclusion and approver-bias endpoints are workspace-records triage heuristics. They are **not ward vulnerability baselines** and do not prove discrimination. Overrides are currently reason-count insights from recorded audit text; semantic clustering is not implemented.
- Crisis and SMS parser are simulation-only. The mobile `/crisis` page proposes/records shock scenarios, while an approval flag logs a demo approval; no external dispatch/action is executed. SMS commands support English plus documented command aliases, not robust multilingual natural-language parsing or direct WhatsApp integration.
- Opt-in transition endpoint records pathway tracking. CSV/PDF brief exports recorded cases/deliveries and ledger verification status.
- Leaflet map draws only records with user-provided coordinates. It is not a geocoded or verified Mysuru/Bengaluru ward map, does not calculate road routing, and the QR directs to the crisis proposal page.

### Data grounding: ingest only sourced records

Use `scripts/ingest_district.py INPUT.csv OUTPUT.json` to validate locality CSV records. Required fields: `district,locality,latitude,longitude,source,source_date,vulnerability_proxy`. This package does not claim to have ingested or verified census/SECC ward data. Replace workspace/demo records only after a source and its provenance are checked.

### Secret configuration

Set `HUMANIE_SECRET_KEY` to a strong, stable secret in deployment (Render generates one in `render.yaml`). If absent locally, the app generates an ephemeral random secret: tokens will invalidate on restart. The old hard-coded insecure fallback has been removed. Set a persistent DB path appropriate to your deployment; free ephemeral hosts may lose database files.
