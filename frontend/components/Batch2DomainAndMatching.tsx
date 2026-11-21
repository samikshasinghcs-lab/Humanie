'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  PackageCheck,
  RefreshCw,
  Sliders,
  Truck,
} from 'lucide-react';
import {
  CaseRecord,
  CountryPackConfig,
  EducationProgrammeRecord,
  EquityLPSolverResult,
  FollowUpOutcomeRecord,
  FoodBatchAndDelivery,
  ResultCheckStatus,
  WorkJobAndPlacement,
} from '@/lib/humanie-types';

interface Batch2Props {
  lpSolverState: EquityLPSolverResult;
  foodBatches: FoodBatchAndDelivery[];
  workJobs: WorkJobAndPlacement[];
  eduProgrammes: EducationProgrammeRecord[];
  outcomes: FollowUpOutcomeRecord[];
  cases: CaseRecord[];
  activeCountryPack: CountryPackConfig;
  onReSolveLP: (params: {
    totalStockUnits: number;
    transportBudgetLimit: number;
    transportCostMultiplier: number;
    coverageFloorTargetPct: number;
    scenario?: 'BASELINE_436_9' | 'FLOOD_SHOCK' | 'FLOOR_SWEEP_SLACK' | 'CUSTOM_LIVE';
  }) => Promise<void>;
  onRecordResultCheck: (params: {
    caseId: string;
    channel: 'SMS' | 'WhatsApp' | 'Website' | 'Field worker';
    status: ResultCheckStatus;
    dispatchedUnits?: number;
    receivedUnits?: number;
    stillEmployedAt7Days?: boolean;
    stillEmployedAt30Days?: boolean;
    stillAttendingAt30Days?: boolean;
    attendanceRatePct?: number;
    beneficiaryFeedback: string;
  }) => Promise<void>;
}

const WORK_STEPS = [
  '01. Candidate',
  '02. Matching',
  '03. Human Review',
  '04. Referral',
  '05. Employer Response',
  '06. Placement',
  '07. 7-Day Check',
  '08. 30-Day Check',
];

const EDU_STEPS = [
  '01. Need',
  '02. Programme Matching',
  '03. Human Review',
  '04. Referral',
  '05. Enrolment',
  '06. Attendance',
  '07. 30-Day Result Check',
];

export default function Batch2DomainAndMatching({
  lpSolverState,
  foodBatches,
  workJobs,
  eduProgrammes,
  outcomes,
  cases,
  activeCountryPack,
  onReSolveLP,
  onRecordResultCheck,
}: Batch2Props) {
  const [domainTab, setDomainTab] = useState<'ENGINE_LP' | 'FOOD' | 'WORK' | 'EDUCATION' | 'RESULT_CHECK'>('ENGINE_LP');

  // Live LP Sliders
  const [stockInput, setStockInput] = useState<number>(lpSolverState.totalStockUnits);
  const [costMultInput, setCostMultInput] = useState<number>(lpSolverState.transportCostMultiplier);
  const [floorTargetInput, setFloorTargetInput] = useState<number>(lpSolverState.coverageFloorTargetPct);

  // Result Check Form State
  const [rcCaseId, setRcCaseId] = useState<string>(cases[0]?.caseId || 'CASE-2026-0101');
  const [rcChannel, setRcChannel] = useState<'SMS' | 'WhatsApp' | 'Website' | 'Field worker'>('SMS');
  const [rcStatus, setRcStatus] = useState<ResultCheckStatus>('Met');
  const [rcDispatched, setRcDispatched] = useState<number>(40);
  const [rcReceived, setRcReceived] = useState<number>(35);
  const [rcFeedback, setRcFeedback] = useState<string>(
    'Verified delivery count and beneficiary satisfaction via post-service check.'
  );

  const handleApplySolver = async (e: React.FormEvent) => {
    e.preventDefault();
    await onReSolveLP({
      totalStockUnits: stockInput,
      transportBudgetLimit: 2400,
      transportCostMultiplier: costMultInput,
      coverageFloorTargetPct: floorTargetInput,
      scenario: 'CUSTOM_LIVE',
    });
  };

  const handleResultCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCase = cases.find((c) => c.caseId === rcCaseId);
    await onRecordResultCheck({
      caseId: rcCaseId,
      channel: rcChannel,
      status: rcStatus,
      dispatchedUnits: targetCase?.domain === 'FOOD' ? rcDispatched : undefined,
      receivedUnits: targetCase?.domain === 'FOOD' ? rcReceived : undefined,
      stillEmployedAt7Days: targetCase?.domain === 'WORK' ? rcStatus === 'Met' : undefined,
      stillEmployedAt30Days: targetCase?.domain === 'WORK' ? rcStatus === 'Met' : undefined,
      stillAttendingAt30Days: targetCase?.domain === 'EDUCATION' ? rcStatus === 'Met' : undefined,
      attendanceRatePct: targetCase?.domain === 'EDUCATION' ? (rcStatus === 'Met' ? 95 : 62) : undefined,
      beneficiaryFeedback: rcFeedback,
    });
  };

  return (
    <div className="space-y-8">
      {/* Domain & Engine Header Strip (Slide 6: Three Domains, One Engine) */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-medium text-emerald-700">02. Three Domains, One Engine</p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Operational Domain Workflows, Equity LP Matching & 30-Day Result Checks
            </h2>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            No automated denial. Humans authorise every consequential placement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900 text-sm">FOOD OPERATIONS</div>
            <p className="text-slate-600 mt-1">
              Stock to wards and households. Batch tracking, cold-chain, and low-fuel dignity packs.
            </p>
            <div className="mt-2 font-mono font-semibold text-emerald-800">
              Success metric: received = dispatched
            </div>
          </div>

          <div className="p-4 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900 text-sm">WORK OPERATIONS</div>
            <p className="text-slate-600 mt-1">
              Skills, commute radius, and childcare shift compatibility matched to local jobs.
            </p>
            <div className="mt-2 font-mono font-semibold text-emerald-800">
              Success metric: still working at 30 days
            </div>
          </div>

          <div className="p-4 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900 text-sm">EDUCATION OPERATIONS</div>
            <p className="text-slate-600 mt-1">
              Students matched to verified seats, 100% fee vouchers, and safe transit passes.
            </p>
            <div className="mt-2 font-mono font-semibold text-emerald-800">
              Success metric: still attending at 30 days
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs for Batch 2 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setDomainTab('ENGINE_LP')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              domainTab === 'ENGINE_LP' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Equity LP Engine & Bottleneck X-Ray
          </button>
          <button
            type="button"
            onClick={() => setDomainTab('FOOD')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              domainTab === 'FOOD' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Food Batches & Last-Mile ({foodBatches.length})
          </button>
          <button
            type="button"
            onClick={() => setDomainTab('WORK')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              domainTab === 'WORK' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Work Placements & 8-Step Flow ({workJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setDomainTab('EDUCATION')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              domainTab === 'EDUCATION' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Education Seats & Vouchers ({eduProgrammes.length})
          </button>
          <button
            type="button"
            onClick={() => setDomainTab('RESULT_CHECK')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              domainTab === 'RESULT_CHECK' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Result Check Console ({outcomes.length})
          </button>
        </div>
      </div>

      {/* TAB 1: AN ENGINE THAT EXPLAINS ITSELF (SLIDES 7, 8, 15) */}
      {domainTab === 'ENGINE_LP' && (
        <div className="space-y-6">
          {/* Slide 8: Equal-Stock Comparison & Live Re-Solve */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Equal Stock Better Coverage Card (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Equal-Stock Comparison</p>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    Equal Stock ({lpSolverState.totalStockUnits} {activeCountryPack.unitLabelFood}), Better Coverage
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {lpSolverState.solverVersion} · {lpSolverState.activeScenario}
                </span>
              </div>

              {/* Horizontal Comparison Bars matching Slide 8 */}
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-900">EQUITY LP (Minimum Ward Coverage Floor)</span>
                    <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                      {lpSolverState.equityLPMinWardCoveragePct}%
                    </span>
                  </div>
                  <div className="w-full h-7 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200"
                      style={{ width: `${Math.min(100, lpSolverState.equityLPMinWardCoveragePct)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600">PROPORTIONAL (Standard Friction-Biased Allocation)</span>
                    <span className="font-mono text-base font-bold text-slate-600 tabular-nums">
                      {lpSolverState.proportionalMinWardCoveragePct}%
                    </span>
                  </div>
                  <div className="w-full h-7 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-slate-400 transition-all duration-200"
                      style={{ width: `${Math.min(100, lpSolverState.proportionalMinWardCoveragePct)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-base font-bold text-emerald-700 font-mono tabular-nums">
                  +{lpSolverState.coverageGainPercentagePoints} percentage points, same{' '}
                  {lpSolverState.totalStockUnits} units
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Demo data: shows the method, not real-world impact.
                </div>
              </div>

              {/* Bottleneck X-Ray & Slack Recovery */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-900">
                    Bottleneck X-Ray (LP Dual Shadow Prices) & Slack Recovery
                  </h4>
                  <span className="text-xs font-mono text-slate-600 tabular-nums">
                    Slack to 60% floor: +{lpSolverState.slackRecoveryNeededUnits} units
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {lpSolverState.bottleneckXRay.map((b, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{b.constraintName}</span>
                        <span className="font-mono text-emerald-800 tabular-nums">
                          Dual λ = {b.shadowPriceDual}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{b.impactExplanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Re-Solve Controls & 6 Engine Pillars (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold text-emerald-700">Interactive LP Sensitivity</p>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Live Re-Solve: Change a Constraint, the Plan Updates
                </h3>
              </div>

              <form onSubmit={handleApplySolver} className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-medium text-slate-700 mb-1">
                    <span>Total District Stock Pool ({activeCountryPack.unitLabelFood})</span>
                    <span className="font-mono font-semibold tabular-nums">{stockInput} units</span>
                  </div>
                  <input
                    type="range"
                    min={250}
                    max={750}
                    step={0.1}
                    value={stockInput}
                    onChange={(e) => setStockInput(Number(e.target.value))}
                    className="w-full accent-emerald-700"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-700 mb-1">
                    <span>Transport Corridor Cost Multiplier (1.0x = Normal, 1.65x = Flood Shock)</span>
                    <span className="font-mono font-semibold tabular-nums">{costMultInput}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={2.0}
                    step={0.05}
                    value={costMultInput}
                    onChange={(e) => setCostMultInput(Number(e.target.value))}
                    className="w-full accent-emerald-700"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-700 mb-1">
                    <span>Floor Sweep Target Coverage (%)</span>
                    <span className="font-mono font-semibold tabular-nums">{floorTargetInput}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={80}
                    step={0.5}
                    value={floorTargetInput}
                    onChange={(e) => setFloorTargetInput(Number(e.target.value))}
                    className="w-full accent-emerald-700"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-md transition-colors"
                  >
                    Live Re-Solve Equity LP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockInput(436.9);
                      setCostMultInput(1.0);
                      setFloorTargetInput(47.87);
                      onReSolveLP({
                        totalStockUnits: 436.9,
                        transportBudgetLimit: 2400,
                        transportCostMultiplier: 1.0,
                        coverageFloorTargetPct: 47.87,
                        scenario: 'BASELINE_436_9',
                      });
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-medium rounded-md transition-colors"
                  >
                    Reset 436.9 Baseline
                  </button>
                </div>
              </form>

              {/* 6 Capabilities from Slide 7 */}
              <div className="border-t border-slate-200 pt-4 grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-semibold text-slate-900">Silent-Exclusion Alert</div>
                  <div className="text-slate-600 mt-0.5">
                    Flags quiet, high-need wards ({lpSolverState.silentExclusionWards.join(', ')}).
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-semibold text-slate-900">Dignity & Agency</div>
                  <div className="text-slate-600 mt-0.5">
                    Cooking fuel, diet, commute radius, and childcare shift constraints.
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-semibold text-slate-900">Slack Recovery</div>
                  <div className="text-slate-600 mt-0.5">
                    +{lpSolverState.slackRecoveryNeededUnits} units closes the 60% floor gap.
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-semibold text-slate-900">Moral Calibration</div>
                  <div className="text-slate-600 mt-0.5">
                    Human override patterns calibrate solver rules transparently.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ward-by-Ward Allocation & Silent-Exclusion Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Ward-Level Allocation Matrix: Equity LP vs Proportional & Silent-Exclusion Detection
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protected personal attributes are strictly excluded from ranking; Equity LP protects remote wards from transport-cost drop-off.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Ward & Silent-Exclusion Check</th>
                    <th className="py-3 px-4 text-right">Demand (Units)</th>
                    <th className="py-3 px-4 text-right">Transport Cost</th>
                    <th className="py-3 px-4 text-right">Proportional</th>
                    <th className="py-3 px-4 text-right">Equity LP</th>
                    <th className="py-3 px-4 text-right">Slack to 60%</th>
                    <th className="py-3 px-4">Binding Constraint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lpSolverState.wards.map((w) => (
                    <tr
                      key={w.wardId}
                      className={w.silentExclusionAlert ? 'bg-amber-50/50' : 'hover:bg-slate-50'}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{w.wardName}</div>
                        <div className="text-slate-500">
                          Need index: {w.vulnerabilityIndex} · Inbound reporting:{' '}
                          {Math.round(w.recentReportingRate * 100)}%
                        </div>
                        {w.silentExclusionAlert && (
                          <div className="text-amber-800 font-semibold mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>SILENT-EXCLUSION ALERT: Quiet, high-need ward protected by floor clamp</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                        {w.demandUnits}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {activeCountryPack.currencySymbol}
                        {w.transportCostPerUnit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        <div>{w.proportionalAllocation} u</div>
                        <div className="text-slate-500">({w.proportionalCoveragePct}%)</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-800">
                        <div>{w.equityLPAllocation} u</div>
                        <div>({w.equityLPCoveragePct}%)</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                        +{w.slackUnitsToReach60Pct} u
                      </td>
                      <td className="py-3 px-4 text-slate-600">{w.bindingConstraint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FOOD OPERATIONS */}
      {domainTab === 'FOOD' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Food Inventory, Batch Tracking, Dispatch & Receipt Reconciliation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Success metric: Received versus dispatched. Every discrepancy automatically triggers an Integrity Shield investigation case.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-3 px-4">Batch ID & Case</th>
                  <th className="py-3 px-4">Commodity & Ward</th>
                  <th className="py-3 px-4">Transport & Expiry</th>
                  <th className="py-3 px-4 text-right">Stock Pool</th>
                  <th className="py-3 px-4 text-right">Dispatched</th>
                  <th className="py-3 px-4 text-right">Received</th>
                  <th className="py-3 px-4">Reconciliation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {foodBatches.map((b) => (
                  <tr key={b.batchId} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-mono tabular-nums">
                      <div className="font-semibold text-slate-900">{b.batchId}</div>
                      <div className="text-slate-500">Case: {b.caseId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{b.commodity}</div>
                      <div className="text-slate-500">
                        {b.ward} · {b.distributorName}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800">{b.transportMode}</div>
                      <div className="text-slate-500">
                        Exp: {b.expiryDate} · Condition: {b.stockCondition}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {b.stockAvailableUnits}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {b.dispatchedUnits}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                      {b.receivedUnits !== null ? b.receivedUnits : 'Pending'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div
                        className={`font-semibold ${
                          b.dispatchStatus === 'DISCREPANCY_OPEN'
                            ? 'text-red-700'
                            : b.dispatchStatus === 'RECEIPT_CONFIRMED'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {b.dispatchStatus.replace(/_/g, ' ')}
                      </div>
                      {b.discrepancyUnits > 0 && (
                        <div className="text-red-700 mt-0.5">{b.discrepancyNote}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WORK OPERATIONS */}
      {domainTab === 'WORK' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs font-semibold text-emerald-700 mb-2">
              8-Step Human-Gated Employment Workflow (No Automated Rejection)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              {WORK_STEPS.map((step) => (
                <div
                  key={step}
                  className="p-2.5 rounded border border-slate-200 bg-slate-50 font-medium text-slate-800"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Work Job Profiles, Childcare Shift Compatibility & 7/30-Day Retention Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Success metric: Still working at 30 days with written contract. Candidates never suffer automated algorithm rejection.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Job ID & Employer</th>
                    <th className="py-3 px-4">Role, Skills & Commute</th>
                    <th className="py-3 px-4">Dignity & Childcare</th>
                    <th className="py-3 px-4">Workflow Stage & Candidate</th>
                    <th className="py-3 px-4">7-Day & 30-Day Checks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {workJobs.map((j) => (
                    <tr key={j.jobId} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-slate-900">{j.jobId}</div>
                        <div className="font-medium text-slate-800">{j.employerName}</div>
                        <div className="text-slate-500">{j.compensationLocal} · {j.workingHoursPerWeek}h/wk</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{j.jobTitle}</div>
                        <div className="text-slate-500">{j.wardLocation}</div>
                        <div className="text-slate-500 mt-0.5">Skills: {j.requiredSkills.join(', ')}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          Childcare Compatible: {j.childcareCompatible ? 'Yes (Day Shift)' : 'No (Night Shift)'}
                        </div>
                        <div className="text-slate-500">
                          Written Contract: {j.contractWritten ? 'Verified' : 'Pending'}
                        </div>
                        {j.accessibilityAccommodations.length > 0 && (
                          <div className="text-emerald-800 mt-0.5">
                            Access: {j.accessibilityAccommodations.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">Stage: {j.workflowStage}</div>
                        <div className="text-slate-600">
                          Candidate: {j.candidateAlias || 'Open for Human Review'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          7-Day Check:{' '}
                          <span className="font-semibold text-emerald-800">{j.check7DayStatus}</span>
                        </div>
                        <div className="mt-0.5">
                          30-Day Check:{' '}
                          <span className="font-semibold text-emerald-800">{j.check30DayStatus}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EDUCATION OPERATIONS */}
      {domainTab === 'EDUCATION' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs font-semibold text-emerald-700 mb-2">
              7-Step Education Enrolment & Attendance Verification Workflow
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
              {EDU_STEPS.map((step) => (
                <div
                  key={step}
                  className="p-2.5 rounded border border-slate-200 bg-slate-50 font-medium text-slate-800"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Education Programme Catalog, Seats, Fee Vouchers & 30-Day Attendance Checks
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Success metric: Still attending at 30 days. Pairs seats with transit passes and multilingual instruction.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Programme ID & Institution</th>
                    <th className="py-3 px-4">Title, Language & Ward</th>
                    <th className="py-3 px-4 text-right">Open Seats</th>
                    <th className="py-3 px-4">Fee Voucher & Transit</th>
                    <th className="py-3 px-4">Stage & 30-Day Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {eduProgrammes.map((p) => (
                    <tr key={p.programmeId} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-slate-900">{p.programmeId}</div>
                        <div className="font-medium text-slate-800">{p.institutionName}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{p.programmeTitle}</div>
                        <div className="text-slate-500">
                          {p.wardLocation} · Language: {p.instructionLanguage}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        <span className="font-bold text-slate-900">{p.seatsAvailable}</span> / {p.seatsTotal}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {p.feeStructure} ({activeCountryPack.currencySymbol}
                          {p.voucherAmountValue})
                        </div>
                        <div className="text-emerald-800">
                          Safe Transit Pass: {p.transitPassIncluded ? 'Bundled' : 'Separate'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">Stage: {p.workflowStage}</div>
                        <div className="text-slate-600">
                          Student: {p.studentAlias || 'Awaiting Step 3 Approval'}
                        </div>
                        <div className="mt-0.5 font-medium text-emerald-800">
                          30-Day Result: {p.check30DayStatus}{' '}
                          {p.attendanceVerifiedPct !== undefined ? `(${p.attendanceVerifiedPct}% attendance)` : ''}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RESULT CHECK CONSOLE */}
      {domainTab === 'RESULT_CHECK' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Structured Result Check Form (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold text-emerald-700">Step 5 · Result Check</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Log Post-Delivery, 7-Day, or 30-Day Outcome Verification
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Failure and non-response are never falsely counted as success. Discrepancies automatically open an Integrity Shield case.
              </p>
            </div>

            <form onSubmit={handleResultCheckSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Case</label>
                <select
                  value={rcCaseId}
                  onChange={(e) => setRcCaseId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                >
                  {cases.map((c) => (
                    <option key={c.caseId} value={c.caseId}>
                      {c.caseId} · {c.domain} · {c.beneficiaryAlias}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Verification Channel</label>
                  <select
                    value={rcChannel}
                    onChange={(e) =>
                      setRcChannel(e.target.value as 'SMS' | 'WhatsApp' | 'Website' | 'Field worker')
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="SMS">SMS Reply</option>
                    <option value="WhatsApp">WhatsApp Check</option>
                    <option value="Field worker">Field Worker Audit</option>
                    <option value="Website">Website Self-Report</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Outcome State</label>
                  <select
                    value={rcStatus}
                    onChange={(e) => setRcStatus(e.target.value as ResultCheckStatus)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="Met">Met (Verified Complete)</option>
                    <option value="Partly met">Partly met (Shortfall / Gap)</option>
                    <option value="Not met">Not met (Failed / Dropped)</option>
                    <option value="No response">No response (Never counted as Met)</option>
                    <option value="Pending verification">Pending verification</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Dispatched Units (Food)
                  </label>
                  <input
                    type="number"
                    value={rcDispatched}
                    onChange={(e) => setRcDispatched(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Received Units (Food)
                  </label>
                  <input
                    type="number"
                    value={rcReceived}
                    onChange={(e) => setRcReceived(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Beneficiary / Field Verification Notes
                </label>
                <textarea
                  rows={2}
                  value={rcFeedback}
                  onChange={(e) => setRcFeedback(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-md transition-colors"
              >
                Record Result Check & Link to Decision Vault
              </button>
            </form>
          </div>

          {/* Right: Outcomes Ledger (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Verified Outcome Ledger (Linked to Original Decisions)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Outcome & Decision Link</th>
                    <th className="py-3 px-4">Schedule & Channel</th>
                    <th className="py-3 px-4">Outcome Status</th>
                    <th className="py-3 px-4">Verification Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {outcomes.map((o) => (
                    <tr key={o.outcomeId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">{o.outcomeId}</div>
                        <div className="text-slate-500">
                          Case: {o.caseId} · Dec: {o.decisionId}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{o.scheduleLabel}</div>
                        <div className="text-slate-500">
                          Via {o.channel} · By {o.verifiedByRole}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div
                          className={`font-bold ${
                            o.status === 'Met'
                              ? 'text-emerald-700'
                              : o.status === 'Partly met' || o.status === 'Not met'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {o.status.toUpperCase()}
                        </div>
                        {o.dispatchedUnits !== undefined && (
                          <div className="font-mono text-slate-600 tabular-nums">
                            Dispatched {o.dispatchedUnits} / Received {o.receivedUnits}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{o.beneficiaryFeedback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
