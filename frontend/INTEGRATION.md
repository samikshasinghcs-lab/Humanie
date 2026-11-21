# HUMANIE Frontend ↔ Python Engine Integration

The Next.js app (`frontend/`) now talks to the FastAPI engine (repo root).

- The **Live Engine** page (`/engine`) runs a 10-step workflow against the real Python backend:
  matching, mandatory human approval, dispatch/receipt discrepancy, provider-leakage scan,
  HiGHS fairness-floor LP, SHA-256 audit-chain verification and a safe tamper test.
- Browser calls go to `/engine-api/*`; `next.config.ts` rewrites them to `HUMANIE_BACKEND_URL`.
  No CORS setup is needed because the proxy is same-origin.
- The older batch consoles on `/` still use frontend-local `/api/v1/*` routes (in-memory demo state).
  They are not connected to the Python engine; `/engine` is the connected path.

## Deploy (works from a phone browser)

1. **Engine:** Render → New → Blueprint/Web Service from this repo (uses `render.yaml` + `Dockerfile`).
   Open `https://<your-service>.onrender.com/api/health`; it should return `{"status":"ok",...}`.
2. **Frontend:** Vercel → project settings → Root Directory `frontend` → Environment Variables:
   `HUMANIE_BACKEND_URL` = `https://<your-service>.onrender.com` (no trailing slash) → Redeploy.
   The variable is read at build time, so a redeploy is required after changing it.
3. Open `https://<your-vercel-app>/engine` and tap **Run full live demo**.

## Known limits

- Render free plan sleeps when idle (first call can take ~60 s; the page retries automatically) and
  `/tmp` SQLite data is lost on restart. Open the page once before presenting.
- Every run creates a fresh fictional workspace; the audit ledger file is shared across workspaces.
- Prototype-grade security; see the root README for the full limitations list.
