'use client';

import React, { useRef, useState } from 'react';

// All calls go through the Next.js rewrite /engine-api/* -> Python FastAPI engine.
const BASE = '/engine-api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

type StepStatus = 'idle' | 'running' | 'ok' | 'error';

interface StepState {
  status: StepStatus;
  headline: string;
  raw?: Json;
}

interface Ctx {
  token: string;
  matchIds: number[];
  approvedMatchId: number | null;
  approvedUnits: number;
  deliveryId: number | null;
}

const STEPS: { id: string; title: string; why: string }[] = [
  { id: 'wake', title: '1. Connect to Python engine', why: 'Proves this site is wired to the FastAPI backend (free hosts may need up to ~60 s to wake).' },
  { id: 'account', title: '2. Create isolated demo workspace', why: 'Fresh pseudonymous account; nothing real is stored.' },
  { id: 'data', title: '3. Register fictional cases and providers', why: '3 need cases and 2 providers, all labelled synthetic.' },
  { id: 'match', title: '4. Explainable matching', why: 'Ranked candidates with score rationale. Recommendation only.' },
  { id: 'approve', title: '5. Human approval (reason required)', why: 'The system cannot approve on its own; a written reason is mandatory.' },
  { id: 'deliver', title: '6. Dispatch and receipt check', why: 'Receiving fewer units than dispatched is flagged as a discrepancy.' },
  { id: 'leak', title: '7. Provider leakage scan', why: 'Flags providers with receipt shortfalls as a triage signal, not an allegation.' },
  { id: 'lp', title: '8. Fairness-floor LP (HiGHS solver)', why: 'Runs the same allocation at 0%, 30% and 60% minimum-coverage floors.' },
  { id: 'verify', title: '9. Verify hash-chained audit ledger', why: 'Recomputes every SHA-256 link in the audit chain.' },
  { id: 'tamper', title: '10. Tamper test (safe copy)', why: 'Alters a copy of the ledger and shows detection. The live ledger is untouched.' },
];

function emptyState(): Record<string, StepState> {
  const o: Record<string, StepState> = {};
  for (const s of STEPS) o[s.id] = { status: 'idle', headline: '' };
  return o;
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: Json; form?: URLSearchParams } = {},
): Promise<Json> {
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = opts.form.toString();
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { method: opts.method || 'GET', headers, body });
  const text = await res.text();
  let json: Json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail = json && json.detail ? JSON.stringify(json.detail) : text.slice(0, 160);
    throw new Error(`${res.status} ${path}: ${detail || 'request failed'}`);
  }
  return json;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function randomSecret(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function EnginePage() {
  const [state, setState] = useState<Record<string, StepState>>(emptyState());
  const [running, setRunning] = useState(false);
  const ctx = useRef<Ctx>({ token: '', matchIds: [], approvedMatchId: null, approvedUnits: 0, deliveryId: null });

  const set = (id: string, patch: Partial<StepState>) =>
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const runners: Record<string, () => Promise<{ headline: string; raw: Json }>> = {
    wake: async () => {
      let lastErr = 'no response';
      for (let i = 0; i < 14; i++) {
        try {
          const h = await api('/api/health');
          return { headline: `Engine online, version ${h.version}`, raw: h };
        } catch (e: unknown) {
          lastErr = e instanceof Error ? e.message : String(e);
          set('wake', { status: 'running', headline: `Waking engine… attempt ${i + 1}/14` });
          await sleep(5000);
        }
      }
      throw new Error(
        `Could not reach the Python engine (${lastErr}). Set HUMANIE_BACKEND_URL in Vercel and redeploy.`,
      );
    },

    account: async () => {
      const email = `judge-${Date.now()}@demo.humanie.test`;
      const password = randomSecret();
      const r = await api('/api/auth/register', { method: 'POST', body: { email, password } });
      ctx.current.token = r.access_token;
      return { headline: 'Isolated workspace created (token held in memory only)', raw: { email, token_type: r.token_type } };
    },

    data: async () => {
      const t = ctx.current.token;
      const cases = [
        { case_ref: 'DEMO-FOOD-A', district: 'Demo District', locality: 'North Ward', need_type: 'food', urgency: 5, vulnerability: 92, demand_units: 120, category: 'food kit' },
        { case_ref: 'DEMO-FOOD-B', district: 'Demo District', locality: 'Riverbend', need_type: 'food', urgency: 4, vulnerability: 76, demand_units: 95, category: 'food kit' },
        { case_ref: 'DEMO-FOOD-C', district: 'Demo District', locality: 'Hillview', need_type: 'food', urgency: 5, vulnerability: 98, demand_units: 80, category: 'food kit' },
      ];
      const resources = [
        { resource_ref: 'DEMO-PROV-1', district: 'Demo District', locality: 'North Ward', provider_type: 'food_bank', resource_type: 'food', capacity: 150, unit: 'kits', cost_per_unit: 4, verified: true },
        { resource_ref: 'DEMO-PROV-2', district: 'Demo District', locality: 'Riverbend', provider_type: 'ngo', resource_type: 'food', capacity: 100, unit: 'kits', cost_per_unit: 8, verified: true },
      ];
      for (const c of cases) await api('/api/district/cases', { method: 'POST', token: t, body: c });
      for (const r of resources) await api('/api/district/resources', { method: 'POST', token: t, body: r });
      return { headline: '3 fictional cases and 2 fictional providers registered', raw: { cases, resources } };
    },

    match: async () => {
      const t = ctx.current.token;
      const gen = await api('/api/district/matches/generate', { method: 'POST', token: t });
      const list: Json[] = await api('/api/district/matches', { token: t });
      ctx.current.matchIds = list.map((m) => m.id as number);
      const top = list
        .slice()
        .sort((a, b) => (b.score as number) - (a.score as number))[0];
      return {
        headline: `${gen.count} candidate matches. Top: ${top ? `${top.case_ref} → ${top.resource_ref} (score ${top.score})` : 'none'}`,
        raw: list.map((m) => ({ match_id: m.id, case: m.case_ref, provider: m.resource_ref, score: m.score, units: m.recommended_units, why: m.rationale })),
      };
    },

    approve: async () => {
      const t = ctx.current.token;
      const list: Json[] = await api('/api/district/matches', { token: t });
      const pick = list
        .filter((m) => m.case_ref === 'DEMO-FOOD-A' && m.status === 'recommended')
        .sort((a, b) => (b.score as number) - (a.score as number))[0];
      if (!pick) throw new Error('No recommended match found for DEMO-FOOD-A');
      const r = await api(`/api/district/matches/${pick.id}/decision`, {
        method: 'POST',
        token: t,
        body: { decision: 'approve', reason: 'District officer verified urgency and provider stock for North Ward.' },
      });
      ctx.current.approvedMatchId = pick.id as number;
      ctx.current.approvedUnits = r.approved_units as number;
      return { headline: `Approved ${r.approved_units} units with recorded human reason`, raw: r };
    },

    deliver: async () => {
      const t = ctx.current.token;
      const id = ctx.current.approvedMatchId;
      if (id === null) throw new Error('Run the approval step first');
      const units = ctx.current.approvedUnits;
      const d = await api(`/api/district/matches/${id}/dispatch`, {
        method: 'POST',
        token: t,
        body: { dispatched_units: units, recipient_channel: 'community_worker', evidence_note: 'Demo dispatch (fictional)' },
      });
      ctx.current.deliveryId = d.id as number;
      const received = Math.max(0, units - 12);
      const c = await api(`/api/district/deliveries/${d.id}/confirm`, {
        method: 'POST',
        token: t,
        body: { received_units: received, evidence_note: 'Community worker counted fewer kits than dispatched (demo).' },
      });
      return { headline: `Dispatched ${units}, received ${received} → status: ${c.status}`, raw: c };
    },

    leak: async () => {
      const r = await api('/api/district/intelligence/provider-leakage', { token: ctx.current.token });
      const f: Json[] = r.flags || [];
      return {
        headline: f.length ? `${f.length} provider flagged: shortfall ${f[0].shortfall_units} units (${f[0].resource_ref})` : 'No flags',
        raw: r,
      };
    },

    lp: async () => {
      const t = ctx.current.token;
      const out: Json[] = [];
      for (const floor of [0, 30, 60]) {
        const r = await api('/api/simulate', {
          method: 'POST',
          token: t,
          body: { floor_pct: floor, stock: 200, transport_budget: 700, resource_type: 'food' },
        });
        out.push({ floor_pct: floor, ...r });
      }
      const line = out
        .map((r) => (r.feasible ? `${r.floor_pct}%: weighted coverage ${r.weighted_coverage_pct}%` : `${r.floor_pct}%: infeasible`))
        .join('  |  ');
      return { headline: line, raw: out };
    },

    verify: async () => {
      const v = await api('/api/audit/verify', { token: ctx.current.token });
      return {
        headline: v.valid ? `Ledger VALID: ${v.records} records, tip ${String(v.tip_hash).slice(0, 12)}…` : `Ledger BROKEN at seq ${v.altered_seq}`,
        raw: v,
      };
    },

    tamper: async () => {
      const r = await api('/api/audit/tamper-test', { method: 'POST', token: ctx.current.token, body: {} });
      const tv = r.verification_of_tampered_copy || {};
      const live = r.live_ledger || {};
      return {
        headline: `Tampered copy: ${tv.valid ? 'NOT detected' : `DETECTED at seq ${tv.altered_seq}`}. Live ledger still ${live.valid ? 'valid' : 'invalid'}.`,
        raw: r,
      };
    },
  };

  const runStep = async (id: string): Promise<boolean> => {
    set(id, { status: 'running', headline: 'Running…' });
    try {
      const r = await runners[id]();
      set(id, { status: 'ok', headline: r.headline, raw: r.raw });
      return true;
    } catch (e: unknown) {
      set(id, { status: 'error', headline: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };

  const runAll = async () => {
    if (running) return;
    setRunning(true);
    ctx.current = { token: '', matchIds: [], approvedMatchId: null, approvedUnits: 0, deliveryId: null };
    setState(emptyState());
    for (const s of STEPS) {
      const ok = await runStep(s.id);
      if (!ok) break;
    }
    setRunning(false);
  };

  const dot = (s: StepStatus) =>
    s === 'ok' ? 'bg-emerald-600' : s === 'error' ? 'bg-red-600' : s === 'running' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <a href="/" className="text-lg font-bold tracking-tight">HUMANIE</a>
          <a href="/" className="text-sm text-slate-600">← Back to console</a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Live Engine</h1>
          <p className="text-sm text-slate-600">
            Every step below calls the real Python/FastAPI engine (matching, HiGHS linear-programming solver,
            hash-chained audit ledger). All data is fictional and created fresh for this run.
          </p>
          <button
            type="button"
            onClick={runAll}
            disabled={running}
            className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-sm px-5 py-3 rounded-lg"
          >
            {running ? 'Running full demo…' : 'Run full live demo'}
          </button>
        </section>

        <ol className="space-y-3">
          {STEPS.map((s) => {
            const st = state[s.id];
            return (
              <li key={s.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${dot(st.status)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{s.title}</div>
                    <div className="text-xs text-slate-500">{s.why}</div>
                  </div>
                </div>
                {st.headline && (
                  <div className={`text-sm break-words ${st.status === 'error' ? 'text-red-700' : 'text-slate-800'}`}>
                    {st.headline}
                  </div>
                )}
                {st.raw !== undefined && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-500">Raw engine response</summary>
                    <pre className="mt-2 max-h-64 overflow-auto bg-slate-900 text-slate-100 rounded p-3 whitespace-pre-wrap break-words">
                      {JSON.stringify(st.raw, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ol>

        <p className="text-xs text-slate-500">
          Decision-support demonstrator. Matching is a transparent heuristic; every approval needs a human reason.
          No real beneficiary data, partners or live integrations are claimed.
        </p>
      </div>
    </main>
  );
}
