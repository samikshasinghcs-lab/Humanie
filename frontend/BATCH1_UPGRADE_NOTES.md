# HUMANIE Batch 1 upgrade notes

This patch adds Batch-1 API surface and safer consent/intake defaults:

- `GET/POST /api/v1/organizations`: role-gated organization listing/creation; new profiles default to provisional/unverified and no signed data-sharing agreement.
- `GET /api/v1/users`: role matrix introspection restricted to privileged roles.
- `GET/POST /api/v1/consent`: consent-register access restrictions and lifecycle updates, withdrawal/reaffirmation checks, and audit-ledger recording.
- `POST /api/v1/intake`: requires explicit `consentGranted: true`; validates domain, urgency and summary size; sharing/follow-up opt-in default to false.

## Important deployment limitation

This is still the HUMANIE demonstrator's in-memory state architecture. `x-humanie-role` is a demonstration role selector, not a verified authentication/session mechanism; tenant isolation, persistent storage, production encryption, legal retention, and end-to-end channel integrations cannot be claimed as production-ready from these changes. A production deployment must replace role-header trust with authenticated identity, server-side tenant membership, persistent transactional storage, and tested authorization policies.
