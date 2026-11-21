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

        {/* AI / ML / Optimisation proof — deliberately prominent */}
        <section id="computational-core" className="border-2 border-emerald-700 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"><div className="max-w-3xl space-y-3"><div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-[11px] uppercase tracking-[.18em] font-bold text-emerald-200">Computational core · live proof</div><h2 className="text-3xl sm:text-4xl font-black tracking-tight">AI / ML <span className="text-emerald-300">+</span> Mathematical Optimisation</h2><p className="text-sm sm:text-base leading-relaxed text-emerald-50/80">Inspectable computational methods—not decorative AI claims. Open the walkthrough to execute explainable matching, the HiGHS fairness-floor linear-programming solver and audit verification/tamper tests.</p><div className="flex flex-wrap gap-2 pt-1">{['scikit-learn · exploratory ML','SciPy · HiGHS LP','Constraint-based allocation','Metrics & scenarios','SHA-256 audit verification'].map(x=><span key={x} className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-xs font-semibold">{x}</span>)}</div></div><div className="flex flex-col gap-3 lg:min-w-[250px]"><a href="/engine" className="text-center rounded-xl bg-emerald-300 text-emerald-950 font-extrabold px-5 py-4 hover:bg-white transition-colors">RUN LIVE AI / OPTIMISATION PROOF ↗</a><a href="https://github.com/samikshasinghcs-lab/Humanie" target="_blank" rel="noreferrer" className="text-center rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold hover:bg-white/10">Inspect source on GitHub ↗</a></div></div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="rounded-xl bg-black/20 p-4"><div className="text-emerald-300 text-xs font-bold tracking-widest">01 · ML</div><div className="mt-1 font-bold">Exploratory model</div><p className="mt-1 text-xs text-white/70">Pipeline, holdout evaluation and metrics; not causal or individual-level scoring.</p></div><div className="rounded-xl bg-black/20 p-4"><div className="text-emerald-300 text-xs font-bold tracking-widest">02 · OPTIMISATION</div><div className="mt-1 font-bold">Linear programming</div><p className="mt-1 text-xs text-white/70">Compare allocation policies under resource and minimum-coverage constraints.</p></div><div className="rounded-xl bg-black/20 p-4"><div className="text-emerald-300 text-xs font-bold tracking-widest">03 · VERIFY</div><div className="mt-1 font-bold">Reproducible demo</div><p className="mt-1 text-xs text-white/70">Inspect outputs, ledger verification and safe tamper-test evidence.</p></div></div>
        </section>

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
