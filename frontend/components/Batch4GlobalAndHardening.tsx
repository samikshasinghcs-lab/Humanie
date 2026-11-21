'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Globe,
  Lock,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  CaseRecord,
  CountryPackConfig,
  EquityLPSolverResult,
  FollowUpOutcomeRecord,
  UserRole,
} from '@/lib/humanie-types';
import { RolePermissionProfile } from '@/lib/humanie-engine';

interface Batch4Props {
  activeCountryPack: CountryPackConfig;
  countryPacks: CountryPackConfig[];
  onSwitchCountry: (code: CountryPackConfig['countryCode']) => Promise<void>;
  onImportPartnerCsv: (params: { sourcePartner: string; csvText: string }) => Promise<void>;
  importLogs: {
    importId: string;
    timestamp: string;
    sourcePartner: string;
    rowsProcessed: number;
    casesCreated: number;
    duplicatesMerged: number;
    actorRole: UserRole;
  }[];
  cases: CaseRecord[];
  outcomes: FollowUpOutcomeRecord[];
  lpSolverState: EquityLPSolverResult;
  activeRole: UserRole;
  permissions: RolePermissionProfile;
}

const SOURCED_BENCHMARKS = [
  {
    area: 'FOOD LEAKAGE',
    todaySourced: "India's recent grain-leakage estimates range from 8.8% to about 28% (Cornell TCI & Gulati et al.).",
    humanieAdds: 'Receipt-level checks measure it (Dispatched vs Received reconciliation).',
  },
  {
    area: 'WHO GETS MISSED',
    todaySourced: 'Proxy means tests label about 80% of the poor as non-poor (IMF Finance & Development 2017).',
    humanieAdds: 'Silent-exclusion alerts & max-min Equity LP ward floor protection.',
  },
  {
    area: 'BENEFICIARY SYSTEMS',
    todaySourced: "About 70% of WFP's beneficiary data sat outside SCOPE (WFP Internal Audit of SCOPE 2021).",
    humanieAdds: 'Works alongside existing systems via CSV/API adapters; adds explainable matching.',
  },
  {
    area: 'AUTOMATED DECISIONS',
    todaySourced: "Austria's job algorithm was prohibited in 2020 (AMS appealed; Allhutter et al. 2020).",
    humanieAdds: 'Mandatory Step 3 Human Gate, zero automated denial, and formal appeals.',
  },
  {
    area: 'AUDIT TRAIL',
    todaySourced: "WFP's blockchain serves 106,000 people in Jordan (WFP Innovation Accelerator).",
    humanieAdds: 'Cryptographic SHA-256 hash-chain across three domains (Food, Work, Education).',
  },
];

export default function Batch4GlobalAndHardening({
  activeCountryPack,
  countryPacks,
  onSwitchCountry,
  onImportPartnerCsv,
  importLogs,
  cases,
  outcomes,
  lpSolverState,
  activeRole,
  permissions,
}: Batch4Props) {
  const [batch4Tab, setBatch4Tab] = useState<
    'COUNTRY_PACKS' | 'INTEROP_CSV' | 'EVIDENCE_AND_PILOT' | 'SECURITY_RELIABILITY'
  >('COUNTRY_PACKS');

  const [partnerSchema, setPartnerSchema] = useState<string>(
    'WFP SCOPE Beneficiary CSV Adapter (External Partner Schema)'
  );
  const [csvRawInput, setCsvRawInput] = useState<string>(
    `alias,domain,ward,need,urgency\n"Kamla T. (SCOPE-881)",FOOD,"Ward 4 · Upland Canal Sector","Low-fuel fortified grain pack for 5-member flood-affected household",CRITICAL\n"auto_dedup_sunita",FOOD,"Ward 4 · Upland Canal Sector","Duplicate check row",HIGH\n"Devendra R. (MUNI-442)",WORK,"Ward 2 · Industrial Corridor","Daytime solar micro-grid assembly placement",HIGH`
  );

  const handleExportCasesCsv = () => {
    const headers = ['caseId,domain,beneficiaryAlias,intakeChannel,status,lifecycleStage,ward,assignedOrg'];
    const rows = cases.map(
      (c) =>
        `${c.caseId},${c.domain},"${c.beneficiaryAlias}",${c.intakeChannel},${c.status},${c.lifecycleStage},"${c.constraints.wardOrLocation}","${c.assignedOrgName}"`
    );
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanie-cases-${activeCountryPack.countryCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Slide 11: Global by Design Header */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-medium text-emerald-700">04. Global by Design & Production Hardening</p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Configurable Country Packs, Fixed Global Red Lines & 3-Tier Evidence Separation
            </h2>
          </div>
          <span className="text-xs text-slate-600 font-medium">
            Scale by adoption: partner-led pilots and open country packs.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900 text-sm">CONFIGURABLE PER COUNTRY</div>
            <p className="text-slate-600 mt-1">
              Language, currency ({activeCountryPack.currencySymbol} {activeCountryPack.currencyCode}), local channels, eligibility rules, data retention ({activeCountryPack.dataRetentionDays} days), and legal regime.
            </p>
          </div>
          <div className="p-4 rounded-md border border-emerald-300 bg-emerald-50/60">
            <div className="font-bold text-slate-900 text-sm">FIXED GLOBAL RED LINES (NON-NEGOTIABLE)</div>
            <p className="text-slate-700 mt-1">
              Step 3 human review authority, zero automated denial, formal appealability, explainable runner-ups, and independent oversight.
            </p>
          </div>
          <div className="p-4 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900 text-sm">SAFEGUARDS & INTEROPERABILITY</div>
            <p className="text-slate-600 mt-1">
              Bias audits, provider spot checks, low-bandwidth SMS/USSD paths, and non-disruptive CSV/API partner bridges.
            </p>
          </div>
        </div>
      </section>

      {/* Sub-navigation for Batch 4 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setBatch4Tab('COUNTRY_PACKS')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              batch4Tab === 'COUNTRY_PACKS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Country Packs & Fixed Red Lines ({countryPacks.length})
          </button>
          <button
            type="button"
            onClick={() => setBatch4Tab('INTEROP_CSV')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              batch4Tab === 'INTEROP_CSV'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Interoperability (CSV / SCOPE / API)
          </button>
          <button
            type="button"
            onClick={() => setBatch4Tab('EVIDENCE_AND_PILOT')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              batch4Tab === 'EVIDENCE_AND_PILOT'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3-Tier Evidence, Benchmarks & 30-Day Pilot
          </button>
          <button
            type="button"
            onClick={() => setBatch4Tab('SECURITY_RELIABILITY')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              batch4Tab === 'SECURITY_RELIABILITY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Security, Privacy & Reliability Hardening
          </button>
        </div>
      </div>

      {/* TAB 1: COUNTRY PACKS & FIXED GLOBAL RED LINES */}
      {batch4Tab === 'COUNTRY_PACKS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {countryPacks.map((pack) => {
              const isCurrent = pack.countryCode === activeCountryPack.countryCode;
              return (
                <div
                  key={pack.countryCode}
                  className={`p-5 rounded-lg border transition-colors flex flex-col justify-between space-y-4 text-xs ${
                    isCurrent
                      ? 'bg-emerald-50/60 border-emerald-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-slate-900">{pack.countryCode}</span>
                      <span className="font-semibold text-emerald-800">
                        {pack.currencySymbol} {pack.currencyCode}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{pack.name}</h3>
                    <div className="text-slate-600 space-y-1">
                      <div>
                        <span className="font-semibold text-slate-800">Languages:</span>{' '}
                        {pack.languagesSupported.join(', ')}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">Channels:</span>{' '}
                        {pack.localChannels.join(' · ')}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">Legal Regime:</span>{' '}
                        {pack.legalFramework}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">Eligibility Rule:</span>{' '}
                        {pack.eligibilityRuleSummary}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSwitchCountry(pack.countryCode)}
                    className={`w-full py-2 px-3 rounded-md font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {isCurrent ? 'Active Jurisdiction Pack' : `Activate ${pack.countryCode} Pack`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
            <div>
              <p className="text-emerald-700 font-semibold">Immutable Constitutional Layer</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                5 Fixed Global Red Lines (Cannot Be Disabled by Any Country Pack)
              </h3>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  title: '1. Human Decision Authority at Step 3',
                  desc: 'Every consequential allocation or placement requires an identified human approver.',
                },
                {
                  title: '2. Zero Automated Denial',
                  desc: 'The matching solver can recommend and rank, never reject or terminate eligibility autonomously.',
                },
                {
                  title: '3. Universal Appealability',
                  desc: 'Every beneficiary can contest or appeal a decision via SMS, WhatsApp, frontline worker, or web.',
                },
                {
                  title: '4. Mandatory Explainability',
                  desc: 'Every match records "why this?", constraint analysis, runner-ups, and why alternatives lost.',
                },
                {
                  title: '5. Separated Independent Oversight',
                  desc: 'Accused institutions are automatically recused and locked out of whistleblower complaints.',
                },
              ].map((item, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-slate-600 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTEROPERABILITY (CSV / WFP SCOPE / API) */}
      {batch4Tab === 'INTEROP_CSV' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
            <div>
              <p className="text-emerald-700 font-semibold">Non-Disruptive Partner Integration</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Partner CSV & Schema Mapper (Works Alongside WFP SCOPE / Municipal Systems)
              </h3>
              <p className="text-slate-500 mt-1">
                Existing organisations do not have to replace their systems. Import structured partner rows with automatic field mapping and idempotent duplicate merging.
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Partner Source Schema Adapter</label>
              <select
                value={partnerSchema}
                onChange={(e) => setPartnerSchema(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2"
              >
                <option value="WFP SCOPE Beneficiary CSV Adapter">WFP SCOPE Beneficiary CSV Adapter</option>
                <option value="Municipal PDS Ration Roster CSV">Municipal PDS Ration Roster CSV</option>
                <option value="District Employment Exchange Batch">District Employment Exchange Batch</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                CSV Payload Preview (Editable)
              </label>
              <textarea
                rows={5}
                value={csvRawInput}
                onChange={(e) => setCsvRawInput(e.target.value)}
                className="w-full bg-slate-900 text-emerald-300 font-mono rounded-md p-3 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onImportPartnerCsv({
                    sourcePartner: partnerSchema,
                    csvText: csvRawInput,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-md transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Validate, Map & Import CSV Batch
              </button>

              <button
                type="button"
                onClick={handleExportCasesCsv}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Unified Cases (CSV)
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Partner Import & Deduplication Audit Log
            </h3>
            <div className="space-y-3">
              {importLogs.map((log) => (
                <div key={log.importId} className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-slate-900">{log.importId}</span>
                    <span className="text-slate-500">{log.timestamp.slice(0, 16)}</span>
                  </div>
                  <div className="font-semibold text-slate-800 mt-1">{log.sourcePartner}</div>
                  <div className="text-slate-600 mt-1 font-mono tabular-nums">
                    Rows Processed: {log.rowsProcessed} · Cases Created: {log.casesCreated} · Duplicates
                    Merged: {log.duplicatesMerged} · Role: {log.actorRole}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 3-TIER EVIDENCE SEPARATION, BENCHMARKS & 30-DAY PILOT GATE (SLIDES 12, 14, 15) */}
      {batch4Tab === 'EVIDENCE_AND_PILOT' && (
        <div className="space-y-6">
          {/* 3-Tier Evidence Separation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="text-slate-500 font-semibold">TIER 1 · DEMONSTRATOR METRICS</div>
              <h3 className="text-base font-bold text-slate-900">
                Solver Output & Synthetic Scenarios
              </h3>
              <div className="font-mono text-sm font-bold text-emerald-800 tabular-nums">
                Equity LP {lpSolverState.equityLPMinWardCoveragePct}% vs Proportional{' '}
                {lpSolverState.proportionalMinWardCoveragePct}% (+{lpSolverState.coverageGainPercentagePoints} pp)
              </div>
              <p className="text-slate-600">
                Demonstrates mathematical max-min floor optimization on {lpSolverState.totalStockUnits}{' '}
                units and crisis sensitivity (Flood Shock, Floor Sweep).
              </p>
              <div className="pt-2 border-t border-slate-100 text-amber-800 font-semibold">
                Strict Rule: Demo metrics are never represented as real-world impact.
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="text-emerald-700 font-semibold">TIER 2 · OPERATIONAL METRICS</div>
              <h3 className="text-base font-bold text-slate-900">
                Live Case, Receipt & Retention Tracking
              </h3>
              <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                {cases.length} Active Cases · {outcomes.filter((o) => o.status === 'Met').length} Verified
                Outcomes · {outcomes.filter((o) => o.discrepancyFlagged).length} Discrepancies
              </div>
              <p className="text-slate-600">
                Tracks real deliveries (Dispatched vs Received), verified job placements at 7/30 days, and school attendance at 30 days.
              </p>
              <div className="pt-2 border-t border-slate-100 text-slate-700 font-medium">
                Non-response or shortfall is never counted as Met.
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="text-slate-900 font-semibold">TIER 3 · IMPACT METRICS (30-DAY PILOT GATE)</div>
              <h3 className="text-base font-bold text-slate-900">
                Requires Independent Field Evaluation
              </h3>
              <div className="font-mono text-sm font-bold text-slate-800">
                Status: GATED ON 30-DAY DISTRICT PILOT
              </div>
              <p className="text-slate-600">
                Partner (District or NGO, clear scope & baseline) → Gate (Privacy, legal, consent, security review) → Pilot (30 days, independently monitored).
              </p>
              <div className="pt-2 border-t border-slate-100 text-slate-900 font-semibold">
                No impact claim without real data and independent evaluation.
              </div>
            </div>
          </div>

          {/* Slide 12: Sourced Benchmark Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Benchmark: What Exists Today vs What HUMANIE Adds
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sources: Cornell TCI and Gulati et al.; IMF Finance & Development 2017; WFP Internal Audit of SCOPE 2021; WFP Innovation Accelerator; Allhutter et al. 2020. HUMANIE column = design features, not proven outcomes.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-emerald-800 text-white font-semibold">
                    <th className="py-3 px-4">AREA</th>
                    <th className="py-3 px-4">TODAY (SOURCED)</th>
                    <th className="py-3 px-4">HUMANIE ADDS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {SOURCED_BENCHMARKS.map((row) => (
                    <tr key={row.area} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{row.area}</td>
                      <td className="py-3.5 px-4 text-slate-700">{row.todaySourced}</td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-800">{row.humanieAdds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY, PRIVACY & RELIABILITY HARDENING */}
      {batch4Tab === 'SECURITY_RELIABILITY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Security & Privacy Controls Verification
            </h3>
            <div className="space-y-2 text-slate-700">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="font-semibold text-slate-900">Data Minimisation & Aliasing:</span>{' '}
                Beneficiary records use minimal-data aliases (`BEN-1018`) and restrict raw PII exposure.
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="font-semibold text-slate-900">Server-Side RBAC Enforcement:</span>{' '}
                API routes verify `x-humanie-role` permissions before allowing intake, Step 3 approval, or whistleblower vault reads.
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="font-semibold text-slate-900">Whistleblower Isolation:</span>{' '}
                Identity tokens are stored in a separated vault reference; accused institutions are automatically blocked.
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Reliability, Idempotency & Deployment Gate Checklist
            </h3>
            <div className="space-y-2 text-slate-700">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="font-semibold text-slate-900">Idempotent Multi-Channel Intake:</span>{' '}
                Duplicate SMS, WhatsApp, or CSV retries with matching idempotency keys merge safely without creating duplicate cases.
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="font-semibold text-slate-900">Cryptographic Tamper Recovery:</span>{' '}
                Append-only SHA-256 event ledger detects any unauthorized historical edit and restores from Decision Vault snapshots.
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="font-semibold text-slate-900">Deployment Gate Readiness:</span>{' '}
                Source data verified · Consent active · Provider spot-checks logged · Bias audit rule (zero protected attributes in ranking) verified.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
