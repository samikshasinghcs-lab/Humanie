'use client';

import React, { useCallback, useEffect, useState } from 'react';
import CrisisDemoBar from '@/components/CrisisDemoBar';
import Batch1CaseInfrastructure from '@/components/Batch1CaseInfrastructure';
import Batch2DomainAndMatching from '@/components/Batch2DomainAndMatching';
import Batch3GovernanceAndVault from '@/components/Batch3GovernanceAndVault';
import Batch4GlobalAndHardening from '@/components/Batch4GlobalAndHardening';
import {
  AuditLedgerEntry,
  CaseRecord,
  CountryPackConfig,
  DecisionVaultRecord,
  EducationProgrammeRecord,
  EquityLPSolverResult,
  FollowUpOutcomeRecord,
  FoodBatchAndDelivery,
  IntegritySignalFlag,
  OrganisationProfile,
  UserRole,
  WhistleblowerComplaint,
  WorkJobAndPlacement,
} from '@/lib/humanie-types';
import { RolePermissionProfile } from '@/lib/humanie-engine';

interface SystemApiSnapshot {
  activeRole: UserRole;
  permissions: RolePermissionProfile;
  activeCountryCode: CountryPackConfig['countryCode'];
  activeCountryPack: CountryPackConfig;
  countryPacks: CountryPackConfig[];
  organisations: OrganisationProfile[];
  foodBatches: FoodBatchAndDelivery[];
  workJobs: WorkJobAndPlacement[];
  eduProgrammes: EducationProgrammeRecord[];
  cases: CaseRecord[];
  totalCasesUnfilteredCount: number;
  decisions: DecisionVaultRecord[];
  outcomes: FollowUpOutcomeRecord[];
  integrityFlags: IntegritySignalFlag[];
  complaints: WhistleblowerComplaint[];
  auditLedger: AuditLedgerEntry[];
  chainVerification: {
    valid: boolean;
    brokenAtSeq?: number;
    brokenEventId?: string;
    expectedHash?: string;
    actualHash?: string;
  };
  lpSolverState: EquityLPSolverResult;
  importLogs: {
    importId: string;
    timestamp: string;
    sourcePartner: string;
    rowsProcessed: number;
    casesCreated: number;
    duplicatesMerged: number;
    actorRole: UserRole;
  }[];
}

export default function HumanieHomePage() {
  const [activeBatch, setActiveBatch] = useState<'BATCH_1' | 'BATCH_2' | 'BATCH_3' | 'BATCH_4'>('BATCH_1');
  const [activeRole, setActiveRole] = useState<UserRole>('Approver');
  const [lowBandwidthMode, setLowBandwidthMode] = useState<boolean>(false);
  const [data, setData] = useState<SystemApiSnapshot | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'error' | 'success';
    text: string;
  } | null>(null);

  const fetchSnapshot = useCallback(async (roleToUse: UserRole) => {
    try {
      const res = await fetch('/api/v1/system', {
        headers: {
          'x-humanie-role': roleToUse,
        },
      });
      if (!res.ok) throw new Error('Failed to load HUMANIE system state');
      const json = (await res.json()) as SystemApiSnapshot;
      setData(json);
    } catch (err: unknown) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to fetch system snapshot',
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/system', {
          headers: {
            'x-humanie-role': activeRole,
          },
        });
        if (!res.ok) throw new Error('Failed to load HUMANIE system state');
        const json = (await res.json()) as SystemApiSnapshot;
        if (active) setData(json);
      } catch (err: unknown) {
        if (active) {
          setStatusBanner({
            type: 'error',
            text: err instanceof Error ? err.message : 'Unable to fetch system snapshot',
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [activeRole]);

  const mutateSystem = async (payload: Record<string, unknown>) => {
    setBusyAction(String(payload.action || 'MUTATE'));
    try {
      const res = await fetch('/api/v1/system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-humanie-role': activeRole,
        },
        body: JSON.stringify({ ...payload, actorRole: activeRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusBanner({
          type: 'error',
          text: json.error || 'Operation rejected by server policy.',
        });
      } else {
        setStatusBanner({
          type: 'success',
          text: json.message || 'Operation completed and recorded in hash-chained ledger.',
        });
      }
      await fetchSnapshot(activeRole);
    } catch (err: unknown) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error during mutation',
      });
    } finally {
      setBusyAction(null);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full text-center space-y-2">
          <div className="text-base font-bold text-slate-900">HUMANIE</div>
          <p className="text-xs text-slate-500">
            Initialising Unified Case Infrastructure, Equity LP Solver, Decision Vault & Hash-Chain Ledger...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${lowBandwidthMode ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Bar Contract: Strictly 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveBatch('BATCH_1');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            HUMANIE
          </a>
          <a href="/engine" className="md:hidden text-sm font-semibold text-emerald-700 whitespace-nowrap">
            Live Engine
          </a>

          {/* Zone 2: 4 clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveBatch('BATCH_1')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                activeBatch === 'BATCH_1'
                  ? 'text-slate-900 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              01. Case Infrastructure
            </button>
            <button
              type="button"
              onClick={() => setActiveBatch('BATCH_2')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                activeBatch === 'BATCH_2'
                  ? 'text-slate-900 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              02. Domains & Equity LP
            </button>
            <button
              type="button"
              onClick={() => setActiveBatch('BATCH_3')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                activeBatch === 'BATCH_3'
                  ? 'text-slate-900 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              03. Vault & Integrity Shield
            </button>
            <button
              type="button"
              onClick={() => setActiveBatch('BATCH_4')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                activeBatch === 'BATCH_4'
                  ? 'text-slate-900 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              04. Global & Hardening
            </button>
          <a href="#computational-core" className="transition-colors whitespace-nowrap shrink-0 pb-0.5 text-emerald-700 font-extrabold hover:text-emerald-900">AI / ML + Optimisation</a>
<a
              href="/engine"
              className="transition-colors whitespace-nowrap shrink-0 pb-0.5 text-emerald-700 font-semibold hover:text-emerald-900"
            >
              Live Engine
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                mutateSystem({
                  action: 'LIVE_CRISIS_DEMO',
                  crisisType: 'JUDGE_APPROVES_PHONE',
                })
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              Step 3 Human Gate
            </button>
          </div>
        </div>
      </header>

      {/* Interactive Role, Jurisdiction & Slide-13 Crisis Demo Walkthrough Bar */}
      <CrisisDemoBar
        activeRole={activeRole}
        onSelectRole={(role) => setActiveRole(role)}
        activeCountryPack={data.activeCountryPack}
        countryPacks={data.countryPacks}
        onSwitchCountry={(code) =>
          mutateSystem({
            action: 'SWITCH_COUNTRY_PACK',
            countryCode: code,
          })
        }
        lowBandwidthMode={lowBandwidthMode}
        onToggleLowBandwidth={() => setLowBandwidthMode((v) => !v)}
        chainValid={data.chainVerification.valid}
        brokenAtSeq={data.chainVerification.brokenAtSeq}
        onTriggerCrisis={async (crisisType) => {
          await mutateSystem({
            action: 'LIVE_CRISIS_DEMO',
            crisisType,
          });
          if (crisisType === 'FLOOD_SHOCK' || crisisType === 'FLOOR_SWEEP') {
            setActiveBatch('BATCH_2');
          } else if (crisisType === 'TAMPER_TEST' || crisisType === 'RESTORE_TAMPER') {
            setActiveBatch('BATCH_3');
          }
        }}
        busyAction={busyAction}
        statusBanner={statusBanner}
        onClearBanner={() => setStatusBanner(null)}
      />

        {/* Impeccable: computational intelligence is the dashboard's first-class destination */}
        <section id="computational-core" className="mx-4 mt-5 overflow-hidden rounded-2xl bg-[#092e28] text-white shadow-xl">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative p-6 sm:p-9 lg:p-11"><div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage:'radial-gradient(circle at 85% 10%, #9acb91 0, transparent 28%),linear-gradient(120deg,transparent 70%,#356b51 100%)'}}/><div className="relative"><div className="mb-5 text-[10px] font-black tracking-[.22em] uppercase text-lime-200">HUMANIE · Computational Intelligence · Source inspectable</div><h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">AI / ML <span className="text-lime-300">+</span><br/>Optimisation</h2><p className="mt-5 max-w-xl text-sm sm:text-base leading-7 text-emerald-50/75">The computational core: exploratory ML, predictive intelligence for expected demand and checkpoint outcomes, constrained resource allocation, and verifiable decision records. Compare predictions with later observed results rather than treating forecasts as impact claims.</p><div className="mt-7 flex flex-wrap gap-3"><a href="/engine" className="inline-flex items-center justify-center rounded-md bg-lime-300 px-5 py-3 text-sm font-bold text-[#092e28] hover:bg-white transition-colors">OPEN LIVE COMPUTATIONAL LAB ↗</a><a href="https://github.com/samikshasinghcs-lab/Humanie" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-md border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">SOURCE CODE ↗</a><a href="/intelligence" className="inline-flex items-center justify-center rounded-md border border-lime-300/50 bg-white/5 px-4 py-3 text-sm font-semibold text-lime-100 hover:bg-white/10">OUTCOMES + FORECASTS ↗</a><button type="button" onClick={() => { setTourStep(0); setTourOpen(true); }} className="inline-flex items-center justify-center rounded-md border border-white/40 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">GUIDED FULL DEMO ▶</button></div><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-emerald-100/70"><span>scikit-learn</span><span>•</span><span>SciPy / HiGHS</span><span>•</span><span>Linear programming</span><span>•</span><span>Audit verification</span></div></div></div>
            <div className="bg-[#0e3c33] p-5 sm:p-7 flex flex-col justify-center gap-3"><a href="/engine" className="group border border-emerald-200/15 bg-white/[.045] p-5 rounded-xl hover:bg-white/[.09] transition-colors"><div className="flex justify-between"><span className="text-[10px] uppercase tracking-[.2em] text-lime-200 font-bold">01 · Machine learning</span><span className="text-lime-200 group-hover:translate-x-1 transition-transform">↗</span></div><h3 className="mt-3 text-xl font-semibold">Exploratory model</h3><p className="mt-2 text-xs leading-5 text-emerald-50/65">Pipeline · chronological holdout · MAE / R² · limitations</p></a><a href="/engine" className="group border border-emerald-200/15 bg-white/[.045] p-5 rounded-xl hover:bg-white/[.09] transition-colors"><div className="flex justify-between"><span className="text-[10px] uppercase tracking-[.2em] text-lime-200 font-bold">02 · Operations research</span><span className="text-lime-200 group-hover:translate-x-1 transition-transform">↗</span></div><h3 className="mt-3 text-xl font-semibold">Equity-constrained LP</h3><p className="mt-2 text-xs leading-5 text-emerald-50/65">Variables · constraints · policy trade-offs · scenarios</p></a><a href="/intelligence" className="group border border-emerald-200/15 bg-white/[.045] p-5 rounded-xl hover:bg-white/[.09] transition-colors"><div className="flex justify-between"><span className="text-[10px] uppercase tracking-[.2em] text-lime-200 font-bold">03 · Predictive intelligence</span><span className="text-lime-200 group-hover:translate-x-1 transition-transform">↗</span></div><h3 className="mt-3 text-xl font-semibold">Forecast & checkpoint prediction</h3><p className="mt-2 text-xs leading-5 text-emerald-50/65">Demand forecasts · predicted checkpoint outcomes · expected vs observed · follow-up and learning</p></a><a href="/engine" className="group border border-emerald-200/15 bg-white/[.045] p-5 rounded-xl hover:bg-white/[.09] transition-colors"><div className="flex justify-between"><span className="text-[10px] uppercase tracking-[.2em] text-lime-200 font-bold">04 · Verifiability</span><span className="text-lime-200 group-hover:translate-x-1 transition-transform">↗</span></div><h3 className="mt-3 text-xl font-semibold">Evidence & integrity</h3><p className="mt-2 text-xs leading-5 text-emerald-50/65">Scenario outputs · human gate · hash-chain check · tamper demo</p></a></div>
          </div><div className="flex flex-col sm:flex-row sm:justify-between gap-3 border-t border-white/10 bg-black/10 px-6 py-4 text-[11px] text-emerald-100/60"><span>Demonstrator · synthetic scenarios · no automated denial</span><span className="font-semibold text-lime-200">Inspectable results—not impact claims.</span></div></section>

      {/* Main Content Container (1440px baseline) */}
      <main className="max-w-[1440px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
        {/* Hero & Three Compounding Failures Strip (Slides 1 & 2) */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 space-y-2.5">
              <div className="text-xs font-semibold text-emerald-700">
                Intelligence for Humanity · {data.activeCountryPack.name}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
                Helping organisations reach the right people, with humans accountable for every decision.
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                HUMANIE connects the workflow across Food, Work, and Education and surfaces gaps before allocation locks:
                Need → Match → Human Review → Delivery → Result Check → Evidence → Integrity.
              </p>
            </div>

            {/* Slide 2: Three Failures Compound -> Solved */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-md border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900">1. FRAGMENTED RECORDS</div>
                <p className="text-slate-600">
                  Need, capacity and programme data live apart.
                </p>
                <div className="pt-1 font-semibold text-emerald-800">
                  → Unified Case Inbox ({data.cases.length} active)
                </div>
              </div>

              <div className="p-4 rounded-md border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900">2. LAST-MILE LEAKAGE</div>
                <p className="text-slate-600">
                  Dispatched 40, received 35. Nobody connects it.
                </p>
                <div className="pt-1 font-semibold text-red-700">
                  → Receipt Check & Flag FLG-901
                </div>
              </div>

              <div className="p-4 rounded-md border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900">3. SILENT EXCLUSION</div>
                <p className="text-slate-600">
                  The neediest are often missing from the lists.
                </p>
                <div className="pt-1 font-semibold text-emerald-800">
                  → Equity LP +4.18 pp Ward Floor
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Batch Switcher */}
          <div className="mt-5 pt-4 border-t border-slate-200 flex md:hidden flex-wrap gap-2">
            {(
              [
                ['BATCH_1', '01. Case Infrastructure'],
                ['BATCH_2', '02. Domains & Equity LP'],
                ['BATCH_3', '03. Vault & Integrity'],
                ['BATCH_4', '04. Global & Hardening'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveBatch(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  activeBatch === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Active Engineering Batch View */}
        {activeBatch === 'BATCH_1' && (
          <Batch1CaseInfrastructure
            cases={data.cases}
            totalUnfilteredCount={data.totalCasesUnfilteredCount}
            organisations={data.organisations}
            activeRole={data.activeRole}
            permissions={data.permissions}
            onCreateIntake={async (payload) => {
              await mutateSystem({
                action: 'CREATE_INTAKE',
                ...payload,
              });
            }}
            onRecordHumanDecision={async (payload) => {
              await mutateSystem({
                action: 'HUMAN_DECISION',
                ...payload,
              });
            }}
            onUpdateConsent={async (payload) => {
              await mutateSystem({
                action: 'UPDATE_CONSENT',
                ...payload,
              });
            }}
            onRecordResultCheck={async (payload) => {
              await mutateSystem({
                action: 'RESULT_CHECK',
                ...payload,
              });
            }}
            onSubmitComplaint={async (payload) => {
              await mutateSystem({
                action: 'SUBMIT_COMPLAINT',
                ...payload,
              });
            }}
          />
        )}

        {activeBatch === 'BATCH_2' && (
          <Batch2DomainAndMatching
            lpSolverState={data.lpSolverState}
            foodBatches={data.foodBatches}
            workJobs={data.workJobs}
            eduProgrammes={data.eduProgrammes}
            outcomes={data.outcomes}
            cases={data.cases}
            activeCountryPack={data.activeCountryPack}
            onReSolveLP={async (params) => {
              await mutateSystem({
                action: 'RE_SOLVE_LP',
                ...params,
              });
            }}
            onRecordResultCheck={async (params) => {
              await mutateSystem({
                action: 'RESULT_CHECK',
                ...params,
              });
            }}
          />
        )}

        {activeBatch === 'BATCH_3' && (
          <Batch3GovernanceAndVault
            decisions={data.decisions}
            integrityFlags={data.integrityFlags}
            complaints={data.complaints}
            auditLedger={data.auditLedger}
            chainVerification={data.chainVerification}
            cases={data.cases}
            outcomes={data.outcomes}
            organisations={data.organisations}
            activeRole={data.activeRole}
            permissions={data.permissions}
            onSubmitComplaint={async (params) => {
              await mutateSystem({
                action: 'SUBMIT_COMPLAINT',
                ...params,
              });
            }}
            onIndependentReviewAction={async (params) => {
              await mutateSystem({
                action: 'INDEPENDENT_REVIEW_ACTION',
                ...params,
              });
            }}
            onTriggerTamperTest={async (crisisType) => {
              await mutateSystem({
                action: 'LIVE_CRISIS_DEMO',
                crisisType,
              });
            }}
          />
        )}

        {activeBatch === 'BATCH_4' && (
          <Batch4GlobalAndHardening
            activeCountryPack={data.activeCountryPack}
            countryPacks={data.countryPacks}
            onSwitchCountry={async (code) => {
              await mutateSystem({
                action: 'SWITCH_COUNTRY_PACK',
                countryCode: code,
              });
            }}
            onImportPartnerCsv={async (params) => {
              await mutateSystem({
                action: 'PARTNER_CSV_IMPORT',
                ...params,
              });
            }}
            importLogs={data.importLogs}
            cases={data.cases}
            outcomes={data.outcomes}
            lpSolverState={data.lpSolverState}
            activeRole={data.activeRole}
            permissions={data.permissions}
          />
        )}
      </main>


      {tourOpen && (() => { const tour = [{title:"1 · The unified case inbox",batch:"BATCH_1",body:"Start with fragmented records across channels. Inspect the shared inbox, case details, constraints, explainable matching, human approval, consent, result checks and case timeline."},{title:"2 · Food, work and education",batch:"BATCH_2",body:"Explore the three operational domains: food batches and receipt reconciliation; job matching, accessibility and retention checkpoints; education seats, enrolment and attendance checks."},{title:"3 · Equity allocation",batch:"BATCH_2",body:"Open the LP scenario controls. Examine allocation variables, stock and transport constraints, coverage floors, feasibility and policy trade-offs. The figures are scenario outputs, not impact evidence."},{title:"4 · Prediction & checkpoints",batch:"BATCH_2",body:"Open Outcomes + Forecasts. Inspect demand predictions and the decision follow-up tracker: expected checkpoint results, actual results, evidence, review status and lessons. Prediction is not verification; outcomes must be observed."},{title:"5 · Governance & integrity",batch:"BATCH_3",body:"Inspect decisions, complaint and independent-review pathways, the audit ledger, hash-chain verification and the safe-copy tamper test. Tamper-evidence is not a guarantee that source data is true."},{title:"6 · Global & operational hardening",batch:"BATCH_4",body:"Inspect jurisdiction packs, imports, permissions and operational constraints. These are prototype configuration and workflow demonstrations, not proof of production integrations."},{title:"7 · Live Python engine",batch:"BATCH_1",body:"Finish in the live engine: synthetic cases and providers, explainable matching, reason-required approval, dispatch and receipt discrepancy, leakage scan, LP floors, ledger verification and safe tamper test."}]; const t=tour[tourStep]; return <div className="fixed inset-0 z-[80] bg-slate-950/70 flex items-center justify-center p-4"><div className="w-full max-w-lg rounded-2xl bg-white text-slate-900 p-6 shadow-2xl"><div className="flex justify-between items-start gap-4"><div><div className="text-xs font-bold tracking-widest text-emerald-700">HUMANIE · GUIDED DASHBOARD TOUR</div><div className="mt-2 text-xs text-slate-500">STEP {tourStep+1} OF {tour.length}</div><h2 className="mt-2 text-xl font-bold">{t.title}</h2></div><button onClick={()=>setTourOpen(false)} className="text-slate-500 text-xl" aria-label="Close guided tour">×</button></div><p className="mt-4 text-sm leading-6 text-slate-600">{t.body}</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>{setActiveBatch(t.batch as "BATCH_1"|"BATCH_2"|"BATCH_3"|"BATCH_4");setTourOpen(false);}} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Open this dashboard section</button>{tourStep===3 && <a href="/intelligence" className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800">Open predictions & checkpoints ↗</a>}{tourStep===6 && <a href="/engine" className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800">Run live Python demo ↗</a>}</div><div className="mt-6 flex justify-between"><button disabled={tourStep===0} onClick={()=>setTourStep(v=>v-1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">← Back</button><button onClick={()=>tourStep===tour.length-1?setTourOpen(false):setTourStep(v=>v+1)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{tourStep===tour.length-1?"Finish":"Next →"}</button></div></div></div>; })()}
      {/* Clean Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            HUMANIE · Intelligence for Humanity · Supports, Never Replaces Human Decision Authority
          </div>
          <div>
            <span>Fixed Red Lines: Step 3 Human Gate</span>
            <span aria-hidden="true"> · </span>
            <span>No Automated Denial</span>
            <span aria-hidden="true"> · </span>
            <span>Universal Appeals</span>
            <span aria-hidden="true"> · </span>
            <span>Hash-Chained Vault</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
