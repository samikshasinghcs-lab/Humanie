# HUMANIE — Intelligence for Humanity

**HUMANIE** is a research and district-operations demonstrator exploring transparent, human-reviewed allocation of scarce food, employment, and education opportunities.

> This repository currently contains the v0.9 Datanova submission bundle as a ZIP. The bundle is the canonical source package; extract it before running the application.

## Quick start

1. Download and extract `HUMANIE_v0_9_Datanova_Submission_Bundle_FINAL.zip`.
2. Open the extracted `HUMANIE_v0.9` project folder.
3. Install Python 3.10+ and create a virtual environment.
4. Install dependencies and create a local secret:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/quickstart_local.py
```

5. Start the app:

```bash
uvicorn app.main:app --reload
```

Open:
- `http://127.0.0.1:8000` — research dashboard
- `http://127.0.0.1:8000/district` — district workflow and Evaluation Lab
- `http://127.0.0.1:8000/docs` — API docs

## What it demonstrates

- Pseudonymous need-case intake and resource registration
- Explainable heuristic candidate ranking
- Mandatory human approve/reject decisions with written reasons
- Dispatch and receipt confirmation, quantity discrepancy tracking
- Complaint workflow and workspace audit events
- Synthetic three-policy allocation comparison and minimum-coverage floor sweep
- Exploratory country-level data and modelling modules

## Evaluation and demo

See the bundled `DEMO_WALKTHROUGH.md` for the walkthrough and `README.md` inside the extracted project for API details, evaluation methodology, limitations and production pathway.

The optional demo records are fictional. Do not enter real beneficiary or sensitive personal data.

## Important limitations

HUMANIE v0.9 is a **research and operational workflow demonstrator**, not a production public-benefit system. Matching is a heuristic, not a validated policy. The data, scenarios and floor-sweep results do not establish real-world impact, causality or fairness. The application has no live government/NGO integrations or signed institutional partners. Human review is required; the system must not autonomously deny essential support.

Security, privacy, institutional access controls, provider verification, routing, audit independence, legal review, field validation and independent evaluation are incomplete. Read the project's full limitations before any real-world use.

## Bundle

`HUMANIE_v0_9_Datanova_Submission_Bundle_FINAL.zip` contains the v0.9 project, walkthrough, evaluation CSV/chart and presentation assets.

## License

See LICENSE.


## v1.0 Extraordinary Upgrade (branch)

This branch adds standalone upgrade primitives in `app/extraordinary_upgrade.py`: chained audit ledger, persistent reviewer/approver separation, floor feasibility diagnostics and allocation solver, and weight sensitivity. Unit tests are in `tests/`. Run `python -m unittest discover -s tests -v`. These primitives are not yet wired to the original UI/API. See `EXTRAORDINARY_UPGRADE_INTEGRATION.md`.
