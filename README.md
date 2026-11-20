# HUMANIE v0.9 — District Evaluation & Operations Demonstrator

**Intelligence for humanity.** This release packages the district workflow demonstrator with an end-to-end district workflow: pseudonymous need intake, provider/resource registration, explainable candidate matching, mandatory human approval, dispatch and receipt confirmation, complaints, audit events and operational outcome reporting.

## Start locally

Python 3.10+ recommended.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set a long random `HUMANIE_SECRET_KEY` in `.env` before running. After copying `.env.example`, run `python scripts/quickstart_local.py` to generate a local random key if one is not already present. Never rely on the hardcoded fallback or expose the service to a network without setting your own secret.

```bash
uvicorn app.main:app --reload
```

Open:
- `http://127.0.0.1:8000` — research dashboard
- `http://127.0.0.1:8000/district` — district operations console, including Evaluation Lab
- `http://127.0.0.1:8000/docs` — API documentation

Create an account in either console. The same local token is used by both.

## District workflow

1. **Need intake:** pseudonymous case reference, locality, need type, urgency, vulnerability and demand.
2. **Resource register:** provider, resource type, capacity, locality, unit and verification status.
3. **Candidate matching:** explainable ranked candidates.
4. **Human decision:** approve/reject with a mandatory written reason; approval reserves resource capacity.
5. **Dispatch:** record dispatched quantity and confirmation channel.
6. **Receipt confirmation:** record received quantity; mismatches are flagged.
7. **Complaints:** record and track complaints.
8. **Impact & audit:** inspect workflow metrics and district audit events.

### Demo data

The district console has a **Load fictional demo records** button. The records are synthetic, not real households, verified providers or field observations. Do not enter identifiable or sensitive personal data.

## Evaluation Lab

- Three-policy comparison: proportional baseline, unconstrained vulnerability-weighted LP, and LP with a configurable minimum community coverage floor.
- Three deterministic synthetic contexts: urban, rural and low-capacity.
- Floor sweep at 0%, 5%, ... 50%, reporting infeasibility explicitly.
- The floor is a policy assumption, not a universal or empirically validated fairness threshold.

## Important limitations

HUMANIE is a **research and operational workflow demonstrator**, not a production public-benefit system. Matching is a heuristic, not a validated policy. Synthetic data and scenarios do not establish real-world impact, causality or fairness. There are no live government/NGO integrations or signed institutional partners. Human review is required; the system must not autonomously deny essential support.

Security, privacy, institutional access controls, provider verification, routing, audit independence, legal review, field validation and independent evaluation are incomplete. SQLite is for local development; browser localStorage token storage is used in the demo. Read the project's full limitations and production pathway before any real-world use.

## Existing research modules

- World Bank indicator ingestion script and exploratory country-level data/model modules.
- Linear-programming allocation demonstrator using SciPy HiGHS; community-level inputs are synthetic.
- Exploratory Random Forest; not causal, not subnational and not for individual eligibility or operational decisions.

## Production pathway

Formal partner and operating agreement, legal review, data-protection impact assessment, threat model, provider verification, appeal process, GIS routing, tenant boundaries and granular roles, MFA, independently controlled audit storage, verified delivery integrations, community-defined outcomes and independent evaluation are required before a pilot.

**Status:** Research and operational workflow demonstrator. Not certified, not production-ready and not authorised to administer public benefits.

## v1.0 Extraordinary Upgrade (branch)

This branch adds standalone upgrade primitives in `app/extraordinary_upgrade.py`: chained audit ledger, persistent reviewer/approver separation, floor feasibility diagnostics and allocation solver, and weight sensitivity. Unit tests are in `tests/`. Run `python -m unittest discover -s tests -v`. These primitives are not yet wired to the original UI/API. See `EXTRAORDINARY_UPGRADE_INTEGRATION.md`.

## License

See LICENSE.
