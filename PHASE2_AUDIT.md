# HUMANIE v0.9 — Phase 2 Technical Review

## Scope
Static inspection of the v0.9 source bundle, documentation, scripts and packaging. This is not a penetration test or field validation.

## High-priority deployment caveats
- JWT secret has an insecure demo fallback. Generate a unique key and set HUMANIE_SECRET_KEY before deployment.
- Browser bearer-token storage is localStorage in the demo UI; production needs a safer authentication architecture.
- SQLite, owner-based isolation and process-local rate limiting are demo-grade.
- No independent provider verification, GIS routing, protected complaint channel or append-only audit storage.
- No real-world efficacy/fairness/causal evidence; the model and allocation modules are research demonstrations.

## Package cleanup and changes
- Removed Python bytecode caches from the source package.
- Kept source, scripts, data placeholder, evaluation CSV/chart, demo walkthrough and presentation assets.
- Added an isolated smoke-test DB so test execution does not pollute a local user database.
- Expanded README with review scope and validation commands.

## Validation performed
- Python syntax compilation succeeds for app and scripts.
- Full smoke test could not be executed here because python-jose is unavailable and network package installation is unavailable.

## Not verified
Runtime endpoint tests and solver behavior, browser E2E, dependency vulnerability scan, penetration test, privacy/legal review, deployment, external integrations, institutional pilot and impact outcomes.
