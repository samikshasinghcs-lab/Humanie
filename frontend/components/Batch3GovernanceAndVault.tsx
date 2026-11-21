'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileSearch,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  AuditLedgerEntry,
  CaseRecord,
  DecisionVaultRecord,
  DomainType,
  FollowUpOutcomeRecord,
  IntegritySignalFlag,
  OrganisationProfile,
  UserRole,
  WhistleblowerComplaint,
} from '@/lib/humanie-types';
import { RolePermissionProfile } from '@/lib/humanie-engine';

interface Batch3Props {
  decisions: DecisionVaultRecord[];
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
  cases: CaseRecord[];
  outcomes: FollowUpOutcomeRecord[];
  organisations: OrganisationProfile[];
  activeRole: UserRole;
  permissions: RolePermissionProfile;
  onSubmitComplaint: (params: {
    submissionType: 'ANONYMOUS' | 'IDENTIFIED_PROTECTED';
    category: WhistleblowerComplaint['category'];
    targetOrgId: string;
    relatedCaseId?: string;
    ward: string;
    description: string;
    evidenceAttachmentRef?: string;
    reporterContactOptional?: string;
  }) => Promise<void>;
  onIndependentReviewAction: (params: {
    complaintId: string;
    newStatus: WhistleblowerComplaint['status'];
    reviewNote: string;
  }) => Promise<void>;
  onTriggerTamperTest: (action: 'TAMPER_TEST' | 'RESTORE_TAMPER') => Promise<void>;
}

export default function Batch3GovernanceAndVault({
  decisions,
  integrityFlags,
  complaints,
  auditLedger,
  chainVerification,
  cases,
  outcomes,
  organisations,
  activeRole,
  permissions,
  onSubmitComplaint,
  onIndependentReviewAction,
  onTriggerTamperTest,
}: Batch3Props) {
  const [govTab, setGovTab] = useState<
    'DECISION_VAULT' | 'INTEGRITY_SHIELD' | 'WHISTLEBLOWER' | 'HASH_LEDGER' | 'PUBLIC_TRANSPARENCY'
  >('DECISION_VAULT');

  // Decision Vault filter & replay state
  const [vaultDomain, setVaultDomain] = useState<'ALL' | DomainType>('ALL');
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [replayingDecision, setReplayingDecision] = useState<DecisionVaultRecord | null>(
    decisions[0] || null
  );

  // Whistleblower Submission Form
  const [wbType, setWbType] = useState<'ANONYMOUS' | 'IDENTIFIED_PROTECTED'>('ANONYMOUS');
  const [wbCategory, setWbCategory] = useState<WhistleblowerComplaint['category']>('BRIBE_DEMAND');
  const [wbTargetOrg, setWbTargetOrg] = useState<string>('ORG-DIST-01');
  const [wbCaseId, setWbCaseId] = useState<string>('CASE-2026-0101');
  const [wbWard, setWbWard] = useState<string>('Ward 4 · Upland Canal Sector');
  const [wbDescription, setWbDescription] = useState<string>(
    'Sub-contractor demanded cash fee before releasing fortified grain packs at Upland Canal drop point.'
  );
  const [wbEvidence, setWbEvidence] = useState<string>('Audio hash + signed witness token #884');
  const [wbContact, setWbContact] = useState<string>('');
  const [reviewerNoteInput, setReviewerNoteInput] = useState<string>(
    'Verified discrepancy overlap with FLG-901; referred sub-contractor for sanction.'
  );

  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (vaultDomain !== 'ALL' && d.domain !== vaultDomain) return false;
      if (vaultSearch.trim() !== '') {
        const q = vaultSearch.toLowerCase();
        const hay = `${d.decisionId} ${d.caseId} ${d.primaryApproverName} ${d.selectedResourceName} ${d.integrityHash}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [decisions, vaultDomain, vaultSearch]);

  const handleExportAuditBundle = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedByRole: activeRole,
      hashChainVerification: chainVerification,
      decisionsCount: decisions.length,
      decisions,
      auditLedger,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanie-audit-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitComplaint({
      submissionType: wbType,
      category: wbCategory,
      targetOrgId: wbTargetOrg,
      relatedCaseId: wbCaseId,
      ward: wbWard,
      description: wbDescription,
      evidenceAttachmentRef: wbEvidence,
      reporterContactOptional: wbContact,
    });
    setWbDescription('');
  };

  return (
    <div className="space-y-8">
      {/* Slide 10: Integrity Shield 5-Pillar Architecture Header */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-medium text-emerald-700">03. Integrity Shield & Decision Vault</p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Anti-Corruption Built In: Makes Corruption Visible and Costly
            </h2>
          </div>
          <button
            type="button"
            onClick={handleExportAuditBundle}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export Cryptographic Audit Evidence (JSON)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900">01. PREVENT</div>
            <p className="text-slate-600 mt-1">
              Two approvers for high-risk placements. Conflict-of-interest declarations required. Protected attributes excluded.
            </p>
          </div>
          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900">02. DETECT</div>
            <p className="text-slate-600 mt-1">
              Override patterns, receipt discrepancy alerts (40 vs 35), and silent-exclusion ward checks.
            </p>
          </div>
          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900">03. REPORT</div>
            <p className="text-slate-600 mt-1">
              Anonymous bribe-demand line. Identity stored separately. Accused entity blocked from access.
            </p>
          </div>
          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900">04. PROVE</div>
            <p className="text-slate-600 mt-1">
              Tamper-proof SHA-256 hash-chained Decision Vault & ledger. Privacy-safe public summary.
            </p>
          </div>
          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50">
            <div className="font-bold text-slate-900">05. RESPOND</div>
            <p className="text-slate-600 mt-1">
              Independent human-led review, recusal enforcement, and institutional sanction referral.
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Tabs for Batch 3 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setGovTab('DECISION_VAULT')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              govTab === 'DECISION_VAULT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Decision Vault & Replay ({decisions.length})
          </button>
          <button
            type="button"
            onClick={() => setGovTab('INTEGRITY_SHIELD')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              govTab === 'INTEGRITY_SHIELD'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Integrity Shield Signals ({integrityFlags.length})
          </button>
          <button
            type="button"
            onClick={() => setGovTab('WHISTLEBLOWER')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              govTab === 'WHISTLEBLOWER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Whistleblower & Anti-Bribe Vault ({complaints.length})
          </button>
          <button
            type="button"
            onClick={() => setGovTab('HASH_LEDGER')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              govTab === 'HASH_LEDGER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hash-Chain Ledger & Tamper Test ({auditLedger.length})
          </button>
          <button
            type="button"
            onClick={() => setGovTab('PUBLIC_TRANSPARENCY')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              govTab === 'PUBLIC_TRANSPARENCY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Public Transparency Summary (Anonymised)
          </button>
        </div>
      </div>

      {/* TAB 1: DECISION VAULT & REPLAY */}
      {govTab === 'DECISION_VAULT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Decision Vault Table (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Search Decision ID, approver, hash..."
                  className="bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs w-56"
                />
                <select
                  value={vaultDomain}
                  onChange={(e) => setVaultDomain(e.target.value as 'ALL' | DomainType)}
                  className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">All Domains</option>
                  <option value="FOOD">FOOD</option>
                  <option value="WORK">WORK</option>
                  <option value="EDUCATION">EDUCATION</option>
                </select>
              </div>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {filteredDecisions.length} immutable records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Decision & Case</th>
                    <th className="py-3 px-4">Approver & Channel</th>
                    <th className="py-3 px-4">Selected Placement</th>
                    <th className="py-3 px-4">Linked Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDecisions.map((d) => {
                    const isSelected = replayingDecision?.decisionId === d.decisionId;
                    return (
                      <tr
                        key={d.decisionId}
                        onClick={() => setReplayingDecision(d)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <div className="font-semibold text-slate-900">{d.decisionId}</div>
                          <div className="text-slate-500">
                            {d.caseId} · {d.domain}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{d.primaryApproverName}</div>
                          {d.secondApproverName && (
                            <div className="text-emerald-800 font-medium">
                              2nd: {d.secondApproverName}
                            </div>
                          )}
                          <div className="text-slate-500">{d.approvalChannel}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{d.selectedResourceName}</div>
                          <div className="text-slate-500">{d.decisionAction.replace(/_/g, ' ')}</div>
                          {d.overrideReason && (
                            <div className="text-amber-800 mt-0.5">Override: {d.overrideReason}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">
                            {d.linkedOutcomeState || 'Pending check'}
                          </div>
                          <div className="font-mono text-slate-400 text-[11px]">
                            {d.integrityHash.slice(0, 14)}...
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Decision Replay & Cryptographic Reconstruction Inspector (5 cols) */}
          {replayingDecision && (
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-3 flex items-start justify-between">
                <div>
                  <span className="text-emerald-700 font-semibold">Decision Vault Replay</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                    {replayingDecision.decisionId} ({replayingDecision.caseId})
                  </h3>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">
                  {replayingDecision.timestamp.slice(0, 16)}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="font-semibold text-slate-900">1. Solver & Constraint Snapshot at Decision Time</div>
                <div className="text-slate-700">
                  <span>Solver: {replayingDecision.solverVersion}</span>
                  <span aria-hidden="true"> · </span>
                  <span>Pool Capacity: {replayingDecision.constraintSnapshot.totalAvailableCapacity}</span>
                  <span aria-hidden="true"> · </span>
                  <span>Floor: {replayingDecision.constraintSnapshot.coverageFloorTarget}%</span>
                </div>
                <div className="text-slate-600">
                  Input Constraints: Ward = {replayingDecision.inputSnapshot.wardOrLocation} · Urgency ={' '}
                  {replayingDecision.inputSnapshot.urgency}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="font-semibold text-slate-900">
                  2. What Was Recommended vs What Was Authorised
                </div>
                <div>
                  <span className="text-slate-500">Original Solver Recommendation:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {replayingDecision.originalRecommendation.recommendedResourceName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Human Authorised Resource:</span>{' '}
                  <span className="font-semibold text-emerald-800">
                    {replayingDecision.selectedResourceName} ({replayingDecision.approvedUnits} units)
                  </span>
                </div>
                <div className="text-slate-600">{replayingDecision.recommendationExplanation}</div>
                {replayingDecision.overrideReason && (
                  <div className="text-amber-800 font-medium">
                    Documented Override Reason: {replayingDecision.overrideReason}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1.5">
                <div className="font-semibold text-slate-900">
                  3. Human Accountability & Conflict Declaration
                </div>
                <div>
                  Primary Approver: <span className="font-semibold">{replayingDecision.primaryApproverName}</span> (
                  {replayingDecision.primaryApproverRole})
                </div>
                {replayingDecision.secondApproverName && (
                  <div>
                    Second Approver: <span className="font-semibold">{replayingDecision.secondApproverName}</span> (
                    {replayingDecision.secondApproverRole})
                  </div>
                )}
                <div className="text-emerald-800">
                  Conflict Declaration: {replayingDecision.conflictDeclarationNote}
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-md p-3.5 font-mono space-y-1">
                <div className="text-slate-400">Cryptographic Chain Link</div>
                <div className="truncate">Prev: {replayingDecision.previousHash}</div>
                <div className="text-emerald-400 truncate">Hash: {replayingDecision.integrityHash}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTEGRITY SHIELD SIGNALS */}
      {govTab === 'INTEGRITY_SHIELD' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Integrity Shield Detection Signals (Override, Leakage & Silent-Exclusion Patterns)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Important Safeguard: Flags are structured investigation signals for human oversight, not automated proof of fraud.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-3 px-4">Signal ID & Category</th>
                  <th className="py-3 px-4">Investigation Signal & Context</th>
                  <th className="py-3 px-4">Evidence Metric</th>
                  <th className="py-3 px-4">Independent Reviewer & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {integrityFlags.map((f) => (
                  <tr key={f.flagId} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-mono tabular-nums">
                      <div className="font-semibold text-slate-900">{f.flagId}</div>
                      <div
                        className={`font-sans font-semibold mt-0.5 ${
                          f.severity === 'HIGH' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {f.category.replace(/_/g, ' ')} ({f.severity})
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{f.title}</div>
                      <div className="text-slate-600 mt-0.5">{f.description}</div>
                      <div className="text-slate-500 mt-0.5">
                        {f.caseId ? `Case: ${f.caseId} · ` : ''}
                        {f.ward || ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800 tabular-nums">
                      {f.evidenceMetric}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{f.status.replace(/_/g, ' ')}</div>
                      <div className="text-slate-500">Assigned: {f.assignedIndependentReviewer}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WHISTLEBLOWER & ANTI-BRIBE VAULT */}
      {govTab === 'WHISTLEBLOWER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Anonymous / Protected Submission Form (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold text-emerald-700">Protected Reporting Line</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                File Anonymous or Protected Bribe-Demand / Diversion Report
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Identity is stored in a separated encrypted vault. The accused organisation is automatically recused and blocked from viewing or controlling the complaint.
              </p>
            </div>

            <form onSubmit={handleComplaintSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Protection Mode</label>
                  <select
                    value={wbType}
                    onChange={(e) => setWbType(e.target.value as 'ANONYMOUS' | 'IDENTIFIED_PROTECTED')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="ANONYMOUS">Zero-Knowledge Anonymous</option>
                    <option value="IDENTIFIED_PROTECTED">Identified (Separated Vault)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={wbCategory}
                    onChange={(e) => setWbCategory(e.target.value as WhistleblowerComplaint['category'])}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="BRIBE_DEMAND">Bribe Demand</option>
                    <option value="DIVERSION_LEAKAGE">Ration Diversion / Leakage</option>
                    <option value="COERCION_OR_EXCLUSION">Unfair Exclusion / Coercion</option>
                    <option value="RETALIATION_REPORT">Retaliation Alert</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Accused Organisation (Will Be Blocked)
                  </label>
                  <select
                    value={wbTargetOrg}
                    onChange={(e) => setWbTargetOrg(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    {organisations.map((o) => (
                      <option key={o.orgId} value={o.orgId}>
                        {o.orgId} · {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ward Location</label>
                  <input
                    type="text"
                    value={wbWard}
                    onChange={(e) => setWbWard(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Incident Description</label>
                <textarea
                  rows={3}
                  required
                  value={wbDescription}
                  onChange={(e) => setWbDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Evidence Reference (Audio Hash / Receipt Photo / Weighbridge Slip)
                </label>
                <input
                  type="text"
                  value={wbEvidence}
                  onChange={(e) => setWbEvidence(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5"
                />
              </div>

              {wbType === 'IDENTIFIED_PROTECTED' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Protected Contact (Stored in Isolated Identity Vault Only)
                  </label>
                  <input
                    type="text"
                    value={wbContact}
                    onChange={(e) => setWbContact(e.target.value)}
                    placeholder="Encrypted contact for Independent Reviewer only"
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md transition-colors"
              >
                Submit Protected Report & Lock Accused Entity Out
              </button>
            </form>
          </div>

          {/* Right: Separated Independent Review Queue (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Independent Reviewer Whistleblower Vault
                </h3>
                <p className="text-xs text-slate-500">
                  Active Role: <span className="font-semibold text-slate-800">{activeRole}</span> · Vault
                  Visibility:{' '}
                  <span className="font-semibold text-emerald-800">
                    {permissions.canViewRestrictedWhistleblowerVault
                      ? 'FULL OVERSIGHT ACCESS'
                      : 'REDACTED (Switch role to Independent reviewer or Auditor to inspect full payload)'}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {complaints.map((c) => (
                <div
                  key={c.complaintId}
                  className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono font-bold text-slate-900">
                      {c.complaintId} · {c.category.replace(/_/g, ' ')} ({c.submissionType})
                    </div>
                    <span className="font-semibold text-emerald-800">{c.status.replace(/_/g, ' ')}</span>
                  </div>

                  <div className="text-slate-700 font-medium">{c.description}</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div>
                      <span className="font-semibold text-slate-800">Accused Org Blocked:</span>{' '}
                      {c.targetOrgName} (Access Denied)
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Separated Identity Vault:</span>{' '}
                      <span className="font-mono">{c.encryptedIdentityVaultRef}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Evidence Ref:</span>{' '}
                      {c.evidenceAttachmentRef}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Recused Entities:</span>{' '}
                      {c.recusedReviewers.join(', ')}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2 space-y-1">
                    <div className="font-semibold text-slate-800">Independent Review Audit Notes:</div>
                    {c.reviewNotes.map((note, idx) => (
                      <div key={idx} className="text-slate-600">
                        • {note}
                      </div>
                    ))}
                  </div>

                  {permissions.canReviewComplaintsIndependently && (
                    <div className="border-t border-slate-200 pt-2.5 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={reviewerNoteInput}
                        onChange={(e) => setReviewerNoteInput(e.target.value)}
                        placeholder="Add independent review finding..."
                        className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onIndependentReviewAction({
                            complaintId: c.complaintId,
                            newStatus: 'ESCALATED_SANCTION',
                            reviewNote: reviewerNoteInput,
                          })
                        }
                        className="px-3 py-1.5 bg-emerald-700 text-white font-semibold rounded"
                      >
                        Record Finding & Escalate Sanction
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: APPEND-ONLY HASH-CHAINED AUDIT LEDGER & TAMPER TEST */}
      {govTab === 'HASH_LEDGER' && (
        <div className="space-y-4">
          <div
            className={`p-5 rounded-lg border flex flex-wrap items-center justify-between gap-4 ${
              chainVerification.valid
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="space-y-1">
              <div className="text-sm font-bold flex items-center gap-2">
                {chainVerification.valid ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    <span>Append-Only Cryptographic Hash-Chain Verified Across All {auditLedger.length} Blocks</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-5 h-5 text-red-700" />
                    <span>
                      CRITICAL INTEGRITY BREACH: Hash Chain Broken at Block #{chainVerification.brokenAtSeq} (
                      {chainVerification.brokenEventId})
                    </span>
                  </>
                )}
              </div>
              {!chainVerification.valid && (
                <div className="text-xs font-mono">
                  Expected: {chainVerification.expectedHash} | Found: {chainVerification.actualHash}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {chainVerification.valid ? (
                <button
                  type="button"
                  onClick={() => onTriggerTamperTest('TAMPER_TEST')}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors"
                >
                  Run Interactive Tamper Test (Edit Historical Block #4)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onTriggerTamperTest('RESTORE_TAMPER')}
                  className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-md transition-colors"
                >
                  Restore Immutable Snapshot & Verify Chain
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Seq & Event ID</th>
                    <th className="py-3 px-4">Type & Actor</th>
                    <th className="py-3 px-4">Event Summary & Payload Snapshot</th>
                    <th className="py-3 px-4">Cryptographic Hash Chain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {auditLedger.map((entry) => {
                    const isBrokenBlock =
                      !chainVerification.valid && chainVerification.brokenAtSeq === entry.seq;
                    return (
                      <tr
                        key={entry.eventId}
                        className={isBrokenBlock ? 'bg-red-100/80' : 'hover:bg-slate-50'}
                      >
                        <td className="py-3 px-4 tabular-nums">
                          <div className="font-bold text-slate-900">
                            #{entry.seq} · {entry.eventId}
                          </div>
                          <div className="text-slate-500 text-[11px]">{entry.timestamp.slice(0, 19)}</div>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <div className="font-semibold text-slate-900">{entry.eventType}</div>
                          <div className="text-slate-500">
                            {entry.actorRole} · {entry.entityId}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <div className="font-medium text-slate-900">{entry.summary}</div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5 break-all">
                            {entry.payloadSnapshot}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[11px] tabular-nums">
                          <div className="text-slate-400">Prev: {entry.previousHash.slice(0, 22)}...</div>
                          <div
                            className={`font-semibold mt-0.5 ${
                              isBrokenBlock ? 'text-red-700' : 'text-emerald-800'
                            }`}
                          >
                            Curr: {entry.currentHash.slice(0, 22)}...
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PUBLIC TRANSPARENCY REPORT (PRIVACY-SAFE ANONYMISED SUMMARY) */}
      {govTab === 'PUBLIC_TRANSPARENCY' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-700">Zero-PII Public Accountability</p>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                Public Transparency Summary (Aggregated & Privacy-Safe)
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              No beneficiary-level personal identifiers are ever exposed in public reporting.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs font-mono tabular-nums">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-sans text-slate-500">Cases Processed</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{cases.length}</div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-sans text-slate-500">Domain Split (F/W/E)</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {cases.filter((c) => c.domain === 'FOOD').length} /{' '}
                {cases.filter((c) => c.domain === 'WORK').length} /{' '}
                {cases.filter((c) => c.domain === 'EDUCATION').length}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-sans text-slate-500">Verified Outcomes (Met)</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {outcomes.filter((o) => o.status === 'Met').length} / {outcomes.length}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-sans text-slate-500">Receipt Discrepancies</div>
              <div className="text-xl font-bold text-red-700 mt-1">
                {outcomes.filter((o) => o.discrepancyFlagged).length}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-sans text-slate-500">Override Frequency</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {decisions.filter((d) => d.decisionAction === 'OVERRIDDEN_WITH_REASON').length} /{' '}
                {decisions.length}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-sans text-slate-500">Complaints Active</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{complaints.length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
