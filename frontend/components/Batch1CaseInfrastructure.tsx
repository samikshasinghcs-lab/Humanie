'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  Filter,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import {
  CaseRecord,
  DomainType,
  IntakeChannel,
  LifecycleStage,
  OrganisationProfile,
  UrgencyLevel,
  UserRole,
} from '@/lib/humanie-types';
import { RolePermissionProfile } from '@/lib/humanie-engine';

const SEVEN_STEPS: { stage: LifecycleStage; label: string; caption: string }[] = [
  { stage: 'NEED', label: '01. Need', caption: 'Dignity & consent first' },
  { stage: 'MATCH', label: '02. Match', caption: 'Equity LP & adapters' },
  { stage: 'HUMAN_REVIEW', label: '03. Human Review', caption: 'A person decides. Always.' },
  { stage: 'DELIVERY', label: '04. Delivery', caption: 'Receipt confirmed' },
  { stage: 'RESULT_CHECK', label: '05. Result Check', caption: 'Did it work at 30 days?' },
  { stage: 'EVIDENCE', label: '06. Evidence', caption: 'Hash-chained vault' },
  { stage: 'INTEGRITY', label: '07. Integrity', caption: 'Flags to oversight' },
];

interface Batch1Props {
  cases: CaseRecord[];
  totalUnfilteredCount: number;
  organisations: OrganisationProfile[];
  activeRole: UserRole;
  permissions: RolePermissionProfile;
  onCreateIntake: (payload: {
    channel: IntakeChannel;
    domain: DomainType;
    beneficiaryAlias: string;
    urgency: UrgencyLevel;
    summaryNeed: string;
    wardOrLocation: string;
    transportAvailable: boolean;
    childcareRequired: boolean;
    cookingFuelAvailable: boolean;
    preferredLanguage: string;
    householdSize: number;
    consentGranted: boolean;
    dataSharingGranted: boolean;
    followUpGranted: boolean;
    idempotencyKey?: string;
  }) => Promise<void>;
  onRecordHumanDecision: (payload: {
    caseId: string;
    decisionAction: 'APPROVED_AS_RECOMMENDED' | 'OVERRIDDEN_WITH_REASON' | 'SECOND_APPROVER_SIGN_OFF';
    selectedResourceId?: string;
    overrideReason?: string;
    conflictDeclared: boolean;
    conflictNote?: string;
    approvalChannel?: 'WEB_CONSOLE' | 'MOBILE_JUDGE_FAST_PATH';
  }) => Promise<void>;
  onUpdateConsent: (payload: {
    caseId: string;
    withdrawConsent: boolean;
    dataSharing?: boolean;
    followUpContact?: boolean;
    notes?: string;
  }) => Promise<void>;
  onRecordResultCheck: (payload: {
    caseId: string;
    channel: 'SMS' | 'WhatsApp' | 'Website' | 'Field worker';
    status: 'Met' | 'Partly met' | 'Not met' | 'No response';
    dispatchedUnits?: number;
    receivedUnits?: number;
    beneficiaryFeedback: string;
  }) => Promise<void>;
  onSubmitComplaint: (payload: {
    submissionType: 'ANONYMOUS' | 'IDENTIFIED_PROTECTED';
    category: 'BRIBE_DEMAND' | 'DIVERSION_LEAKAGE' | 'COERCION_OR_EXCLUSION' | 'RETALIATION_REPORT';
    targetOrgId: string;
    relatedCaseId?: string;
    ward: string;
    description: string;
  }) => Promise<void>;
}

export default function Batch1CaseInfrastructure({
  cases,
  totalUnfilteredCount,
  organisations,
  activeRole,
  permissions,
  onCreateIntake,
  onRecordHumanDecision,
  onUpdateConsent,
  onRecordResultCheck,
  onSubmitComplaint,
}: Batch1Props) {
  const [subView, setSubView] = useState<'INBOX' | 'TWO_DOORS_INTAKE' | 'ORGS_AND_RBAC'>('INBOX');

  // Shared Case Inbox filters
  const [domainFilter, setDomainFilter] = useState<'ALL' | DomainType>('ALL');
  const [orgFilter, setOrgFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | UrgencyLevel>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.caseId || 'CASE-2026-0101');

  // Step 3 Human Decision Controls
  const [conflictChecked, setConflictChecked] = useState<boolean>(true);
  const [overrideResourceId, setOverrideResourceId] = useState<string>('');
  const [overrideReasonText, setOverrideReasonText] = useState<string>('');
  const [showOverridePanel, setShowOverridePanel] = useState<boolean>(false);

  // Door 1 Structured Web / Coordinator / API Intake Form
  const [intakeChannel, setIntakeChannel] = useState<IntakeChannel>('WEBSITE');
  const [intakeDomain, setIntakeDomain] = useState<DomainType>('FOOD');
  const [intakeAlias, setIntakeAlias] = useState<string>('Radha P. & Household (Ward 4)');
  const [intakeUrgency, setIntakeUrgency] = useState<UrgencyLevel>('CRITICAL');
  const [intakeWard, setIntakeWard] = useState<string>('Ward 4 · Upland Canal Sector');
  const [intakeSummary, setIntakeSummary] = useState<string>(
    'Household of 5 in Upland Canal needing fortified low-fuel food ration and doorstep delivery.'
  );
  const [intakeHouseholdSize, setIntakeHouseholdSize] = useState<number>(5);
  const [intakeTransport, setIntakeTransport] = useState<boolean>(false);
  const [intakeChildcare, setIntakeChildcare] = useState<boolean>(true);
  const [intakeFuel, setIntakeFuel] = useState<boolean>(false);
  const [intakeLanguage, setIntakeLanguage] = useState<string>('Hindi');
  const [consentService, setConsentService] = useState<boolean>(true);
  const [consentSharing, setConsentSharing] = useState<boolean>(true);
  const [consentFollowUp, setConsentFollowUp] = useState<boolean>(true);

  // Door 2 SMS / WhatsApp Simulator state
  const [smsChannel, setSmsChannel] = useState<'SMS' | 'WHATSAPP'>('SMS');
  const [smsInput, setSmsInput] = useState<string>('INTAKE FOOD WARD4 5 NOFUEL');
  const [smsLog, setSmsLog] = useState<{ sender: 'USER' | 'GATEWAY'; text: string; time: string }[]>([
    {
      sender: 'GATEWAY',
      text: 'HUMANIE Low-Tech Gateway (Shortcode 56070). Commands: INTAKE <DOMAIN> <WARD> <SIZE> <NOFUEL|CHILDCARE> | RECEIPT <CASE_ID> <UNITS> | STATUS <CASE_ID> | BRIBE <ORG_ID> <DETAILS>',
      time: '08:00',
    },
    {
      sender: 'USER',
      text: 'RECEIPT CASE-2026-0101 35',
      time: '09:15',
    },
    {
      sender: 'GATEWAY',
      text: 'ALERT LOGGED: CASE-2026-0101 dispatched 40 units vs 35 confirmed (-5 unit gap). Discrepancy investigation FLG-901 opened.',
      time: '09:15',
    },
  ]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (domainFilter !== 'ALL' && c.domain !== domainFilter) return false;
      if (orgFilter !== 'ALL' && c.assignedOrgId !== orgFilter) return false;
      if (urgencyFilter !== 'ALL' && c.urgency !== urgencyFilter) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const hay = `${c.caseId} ${c.beneficiaryAlias} ${c.beneficiaryRef} ${c.summaryNeed} ${c.constraints.wardOrLocation} ${c.intakeChannel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, domainFilter, orgFilter, urgencyFilter, statusFilter, searchQuery]);

  const activeCase = useMemo(() => {
    return (
      filteredCases.find((c) => c.caseId === selectedCaseId) ||
      cases.find((c) => c.caseId === selectedCaseId) ||
      filteredCases[0] ||
      cases[0]
    );
  }, [filteredCases, cases, selectedCaseId]);

  const handleStructuredIntakeSubmit = async (e: React.FormEvent, forceDuplicateTest = false) => {
    e.preventDefault();
    await onCreateIntake({
      channel: intakeChannel,
      domain: intakeDomain,
      beneficiaryAlias: forceDuplicateTest ? cases[0]?.beneficiaryAlias || intakeAlias : intakeAlias,
      urgency: intakeUrgency,
      summaryNeed: intakeSummary,
      wardOrLocation: intakeWard,
      transportAvailable: intakeTransport,
      childcareRequired: intakeChildcare,
      cookingFuelAvailable: intakeFuel,
      preferredLanguage: intakeLanguage,
      householdSize: intakeHouseholdSize,
      consentGranted: consentService,
      dataSharingGranted: consentSharing,
      followUpGranted: consentFollowUp,
      idempotencyKey: forceDuplicateTest ? cases[0]?.idempotencyKey : undefined,
    });
    if (!forceDuplicateTest) {
      setSubView('INBOX');
    }
  };

  const handleSendSmsCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = smsInput.trim();
    if (!raw) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSmsLog((prev) => [...prev, { sender: 'USER', text: raw, time: nowTime }]);

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toUpperCase();

    if (cmd === 'STATUS') {
      const targetId = parts[1]?.toUpperCase() || 'CASE-2026-0101';
      const found = cases.find((c) => c.caseId === targetId);
      setSmsLog((prev) => [
        ...prev,
        {
          sender: 'GATEWAY',
          text: found
            ? `[${found.caseId}] Stage: ${found.lifecycleStage} · Status: ${found.status} · Assigned: ${found.assignedOrgName}. Next: ${found.pendingAction}`
            : `Case ${targetId} not found or restricted under role ${activeRole}.`,
          time: nowTime,
        },
      ]);
      setSmsInput('');
      return;
    }

    if (cmd === 'RECEIPT') {
      const targetId = parts[1]?.toUpperCase() || 'CASE-2026-0101';
      const unitsReceived = Number(parts[2] ?? 35);
      await onRecordResultCheck({
        caseId: targetId,
        channel: smsChannel === 'SMS' ? 'SMS' : 'WhatsApp',
        status: unitsReceived < 40 ? 'Partly met' : 'Met',
        dispatchedUnits: 40,
        receivedUnits: unitsReceived,
        beneficiaryFeedback: `${smsChannel} receipt reply: Confirmed ${unitsReceived} units received.`,
      });
      setSmsLog((prev) => [
        ...prev,
        {
          sender: 'GATEWAY',
          text:
            unitsReceived < 40
              ? `DISCREPANCY DETECTED on ${targetId}: 40 dispatched vs ${unitsReceived} received (-${
                  40 - unitsReceived
                } gap). Integrity Shield case opened.`
              : `RECEIPT VERIFIED on ${targetId}: ${unitsReceived} units matched dispatch manifest.`,
          time: nowTime,
        },
      ]);
      setSmsInput('');
      return;
    }

    if (cmd === 'BRIBE') {
      const orgId = parts[1]?.toUpperCase() || 'ORG-DIST-01';
      const note = parts.slice(2).join(' ') || 'Unloading bribe demanded at ward drop point.';
      await onSubmitComplaint({
        submissionType: 'ANONYMOUS',
        category: 'BRIBE_DEMAND',
        targetOrgId: orgId,
        ward: 'Ward 4 · Upland Canal Sector',
        description: `[${smsChannel} Hotline Report] ${note}`,
      });
      setSmsLog((prev) => [
        ...prev,
        {
          sender: 'GATEWAY',
          text: `PROTECTED REPORT LOCKED: Anonymous bribe report filed against ${orgId}. Accused org blocked from viewing record.`,
          time: nowTime,
        },
      ]);
      setSmsInput('');
      return;
    }

    // Default: INTAKE command
    const domPart = (parts[1]?.toUpperCase() || 'FOOD') as DomainType;
    const validDom: DomainType = ['FOOD', 'WORK', 'EDUCATION'].includes(domPart) ? domPart : 'FOOD';
    const wardPart = parts[2] || 'Ward 4 · Upland Canal Sector';
    const hhSize = Number(parts[3] || 4);
    const alias = `${smsChannel} Applicant #${Math.floor(100 + Math.random() * 899)} (${wardPart})`;

    await onCreateIntake({
      channel: smsChannel,
      domain: validDom,
      beneficiaryAlias: alias,
      urgency: 'CRITICAL',
      summaryNeed: `${smsChannel} inbound request: ${raw}`,
      wardOrLocation: wardPart.includes('Ward') ? wardPart : 'Ward 4 · Upland Canal Sector',
      transportAvailable: false,
      childcareRequired: raw.toUpperCase().includes('CHILDCARE'),
      cookingFuelAvailable: !raw.toUpperCase().includes('NOFUEL'),
      preferredLanguage: 'Hindi',
      householdSize: isNaN(hhSize) ? 4 : hhSize,
      consentGranted: true,
      dataSharingGranted: true,
      followUpGranted: true,
    });

    setSmsLog((prev) => [
      ...prev,
      {
        sender: 'GATEWAY',
        text: `UNIFIED CASE CREATED from ${smsChannel} for ${alias}. Routed to Shared Case Inbox & matched via Equity LP. Consent token logged.`,
        time: nowTime,
      },
    ]);
    setSmsInput('');
  };

  return (
    <div className="space-y-8">
      {/* Slide 5: Seven Steps, One Flow Pipeline */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-medium text-emerald-700">01. Seven Steps, One Flow</p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Unified Lifecycle Across Food, Work, and Education
            </h2>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            A human decides at step 3. Always. No automated denial across any channel.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {SEVEN_STEPS.map((s) => {
            const isActiveStage = activeCase?.lifecycleStage === s.stage;
            const isHumanGate = s.stage === 'HUMAN_REVIEW';
            return (
              <div
                key={s.stage}
                className={`p-3.5 rounded-md border transition-colors ${
                  isActiveStage
                    ? 'bg-emerald-950 text-white border-emerald-900'
                    : isHumanGate
                    ? 'bg-emerald-50/70 text-slate-900 border-emerald-300'
                    : 'bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <div className="text-xs font-semibold tracking-tight">{s.label}</div>
                <div
                  className={`text-xs mt-1 ${
                    isActiveStage ? 'text-emerald-200' : 'text-slate-500'
                  }`}
                >
                  {s.caption}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sub-navigation for Batch 1 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setSubView('INBOX')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subView === 'INBOX'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Shared Case Inbox ({cases.length} Permitted / {totalUnfilteredCount} Total)
          </button>
          <button
            type="button"
            onClick={() => setSubView('TWO_DOORS_INTAKE')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subView === 'TWO_DOORS_INTAKE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            One Backend, Two Doors (Web + SMS/WhatsApp Intake)
          </button>
          <button
            type="button"
            onClick={() => setSubView('ORGS_AND_RBAC')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subView === 'ORGS_AND_RBAC'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Organisations & Server RBAC Permissions ({organisations.length})
          </button>
        </div>

        <div className="text-xs text-slate-500">
          <span>Active Role: {activeRole}</span>
          <span aria-hidden="true"> · </span>
          <span>Allowed Domains: {permissions.allowedDomains.join(', ')}</span>
          <span aria-hidden="true"> · </span>
          <span>Step 3 Authority: {permissions.canApproveDecisions ? 'Permitted' : 'Read-Only'}</span>
        </div>
      </div>

      {/* VIEW 1: SHARED CASE INBOX & CASE DOSSIER */}
      {subView === 'INBOX' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, ward, alias, channel..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md w-60 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                {(['ALL', 'FOOD', 'WORK', 'EDUCATION'] as const).map((dom) => (
                  <button
                    key={dom}
                    type="button"
                    onClick={() => setDomainFilter(dom)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      domainFilter === dom
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {dom === 'ALL' ? 'All Domains' : dom}
                  </button>
                ))}
              </div>

              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                aria-label="Filter by Organisation"
                className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">All Organisations</option>
                {organisations.map((o) => (
                  <option key={o.orgId} value={o.orgId}>
                    {o.name}
                  </option>
                ))}
              </select>

              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value as 'ALL' | UrgencyLevel)}
                aria-label="Filter by Urgency"
                className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">All Urgencies</option>
                <option value="CRITICAL">Critical Urgency</option>
                <option value="HIGH">High Urgency</option>
                <option value="STANDARD">Standard Urgency</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Lifecycle Status"
                className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="MATCHED_PENDING_REVIEW">Pending Step 3 Human Review</option>
                <option value="AWAITING_SECOND_APPROVAL">Awaiting 2nd Approver</option>
                <option value="APPROVED_FOR_DELIVERY">Approved for Delivery</option>
                <option value="DISCREPANCY_INVESTIGATION">Discrepancy Investigation</option>
                <option value="VERIFIED_CLOSED">30-Day Verified Closed</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setSubView('TWO_DOORS_INTAKE')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              New Unified Intake
            </button>
          </div>

          {/* Master-Detail Grid: Left Case Table, Right Full Unified Case Dossier */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Shared Case Inbox Table (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Shared Case Inbox (Same Inbox Across Website, SMS, WhatsApp, Coordinator, CSV & API)
                </h3>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Showing {filteredCases.length} records
                </span>
              </div>

              {filteredCases.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No cases match current filter or RBAC domain boundary ({activeRole}).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDomainFilter('ALL');
                      setOrgFilter('ALL');
                      setUrgencyFilter('ALL');
                      setStatusFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="mt-3 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md"
                  >
                    Reset Inbox Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-4">Case ID & Channel</th>
                        <th className="py-2.5 px-4">Domain & Beneficiary</th>
                        <th className="py-2.5 px-4">Lifecycle & Status</th>
                        <th className="py-2.5 px-4 text-right">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredCases.map((c) => {
                        const isSelected = activeCase?.caseId === c.caseId;
                        return (
                          <tr
                            key={c.caseId}
                            onClick={() => {
                              setSelectedCaseId(c.caseId);
                              setShowOverridePanel(false);
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-4 align-top">
                              <div className="font-mono font-semibold text-slate-900 tabular-nums">
                                {c.caseId}
                              </div>
                              <div className="text-slate-500 mt-0.5">
                                <span>{c.intakeChannel}</span>
                                <span aria-hidden="true"> · </span>
                                <span>{c.constraints.wardOrLocation.split('·')[0]}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top">
                              <div className="font-semibold text-slate-900">{c.beneficiaryAlias}</div>
                              <div className="text-slate-500 mt-0.5">
                                <span>{c.domain}</span>
                                <span aria-hidden="true"> · </span>
                                <span>{c.assignedOrgName}</span>
                              </div>
                              {c.escalationFlag && (
                                <div className="text-red-700 font-medium mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{c.escalationReason}</span>
                                </div>
                              )}
                              {c.duplicateWarning && (
                                <div className="text-amber-700 font-medium mt-1">
                                  {c.duplicateWarning}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 align-top">
                              <div className="font-semibold text-slate-800">{c.lifecycleStage}</div>
                              <div
                                className={`mt-0.5 font-medium ${
                                  c.status === 'DISCREPANCY_INVESTIGATION'
                                    ? 'text-red-700'
                                    : c.status === 'VERIFIED_CLOSED'
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {c.status.replace(/_/g, ' ')}
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                              <div className="font-semibold text-slate-900">{c.priorityScore}/100</div>
                              <div className="text-slate-500 mt-0.5">{c.urgency}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Column: Unified Case Dossier, Explainable Match, Step 3 Human Gate, and Consent (5 cols) */}
            {activeCase && (
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
                <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      <span>{activeCase.caseId}</span>
                      <span aria-hidden="true"> · </span>
                      <span>Ref: {activeCase.beneficiaryRef}</span>
                      <span aria-hidden="true"> · </span>
                      <span>Channel: {activeCase.intakeChannel}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {activeCase.beneficiaryAlias}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">{activeCase.summaryNeed}</p>
                  </div>
                  <div className="text-right text-xs font-mono tabular-nums shrink-0">
                    <div className="font-semibold text-slate-900">{activeCase.domain}</div>
                    <div className="text-slate-500">{activeCase.urgency}</div>
                  </div>
                </div>

                {/* Constraints & Dignity Profile */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900">
                    Constraints, Dignity & Agency Profile
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-700 space-y-1.5">
                    <div>
                      <span className="font-medium text-slate-900">Ward / Geography:</span>{' '}
                      {activeCase.constraints.wardOrLocation}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900">Dignity & Household Factors:</span>{' '}
                      <span>
                        Cooking Fuel: {activeCase.constraints.cookingFuelAvailable === false ? 'None (Needs Low-Fuel Pack)' : 'Available'}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        Childcare: {activeCase.constraints.childcareRequired ? 'Required (Daytime Shift)' : 'Standard'}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        Transit: {activeCase.constraints.transportAvailable ? 'Self-Transit' : 'Needs Doorstep / Transit Pass'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-900">Language & Accessibility:</span>{' '}
                      <span>{activeCase.constraints.preferredLanguage}</span>
                      {activeCase.constraints.accessibilityNeeds &&
                        activeCase.constraints.accessibilityNeeds.length > 0 && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>{activeCase.constraints.accessibilityNeeds.join(', ')}</span>
                          </>
                        )}
                    </div>
                  </div>
                </div>

                {/* Step 2 & Step 3: Explainable Matching Recommendation & Human Review Gate */}
                {activeCase.currentMatch && (
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-900">
                        Step 2 Match & Step 3 Human Decision Authority
                      </h4>
                      <span className="text-xs font-mono text-emerald-800 font-semibold tabular-nums">
                        Score: {activeCase.currentMatch.compatibilityScore}/100
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
                      <div className="font-semibold text-slate-900">
                        Recommended: {activeCase.currentMatch.recommendedResourceName} (
                        {activeCase.currentMatch.allocatedUnitsOrSeats}{' '}
                        {activeCase.domain === 'FOOD' ? 'units' : 'seat/placement'})
                      </div>
                      <p className="text-slate-600">{activeCase.currentMatch.scoreExplanation}</p>

                      <div className="pt-1 space-y-1 text-slate-700">
                        {activeCase.currentMatch.constraintAnalysis.details.map((d, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>

                      {/* Runner-Ups & Why Alternatives Lost */}
                      {activeCase.currentMatch.runnerUps.length > 0 && (
                        <div className="border-t border-slate-200 pt-2.5 mt-2.5">
                          <div className="font-semibold text-slate-800 mb-1.5">
                            Runner-Ups & Why Alternatives Lost:
                          </div>
                          <div className="space-y-1.5">
                            {activeCase.currentMatch.runnerUps.map((ru) => (
                              <div key={ru.resourceId} className="text-slate-600">
                                <span className="font-medium text-slate-800">
                                  {ru.resourceName} ({ru.score}/100):
                                </span>{' '}
                                {ru.whyLost}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 3 Action Panel */}
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-md p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900">
                          Step 3 Human Gate ({activeRole})
                        </span>
                        {activeCase.currentMatch.highRiskTwoPersonApproval && (
                          <span className="text-xs font-medium text-amber-800">
                            Two-Person Approval Required
                          </span>
                        )}
                      </div>

                      <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={conflictChecked}
                          onChange={(e) => setConflictChecked(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>
                          I declare zero financial, familial, or institutional Conflict of Interest
                          with {activeCase.currentMatch.providerOrgName}.
                        </span>
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onRecordHumanDecision({
                              caseId: activeCase.caseId,
                              decisionAction: 'APPROVED_AS_RECOMMENDED',
                              conflictDeclared: conflictChecked,
                              approvalChannel: 'WEB_CONSOLE',
                            })
                          }
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md transition-colors"
                        >
                          Approve Recommendation
                        </button>

                        {activeCase.status === 'AWAITING_SECOND_APPROVAL' && (
                          <button
                            type="button"
                            onClick={() =>
                              onRecordHumanDecision({
                                caseId: activeCase.caseId,
                                decisionAction: 'SECOND_APPROVER_SIGN_OFF',
                                conflictDeclared: conflictChecked,
                              })
                            }
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors"
                          >
                            Co-Sign as 2nd Approver
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setShowOverridePanel(!showOverridePanel);
                            if (activeCase.currentMatch?.runnerUps[0]) {
                              setOverrideResourceId(activeCase.currentMatch.runnerUps[0].resourceId);
                            }
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-medium rounded-md transition-colors"
                        >
                          Override with Reason
                        </button>
                      </div>

                      {showOverridePanel && (
                        <div className="pt-2 border-t border-emerald-200 space-y-2">
                          <label className="block text-xs font-medium text-slate-800">
                            Select Alternative Resource:
                          </label>
                          <select
                            value={overrideResourceId}
                            onChange={(e) => setOverrideResourceId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                          >
                            {activeCase.currentMatch.runnerUps.map((ru) => (
                              <option key={ru.resourceId} value={ru.resourceId}>
                                {ru.resourceName} ({ru.score}/100)
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={overrideReasonText}
                            onChange={(e) => setOverrideReasonText(e.target.value)}
                            placeholder="Document mandatory human override reason (for Decision Vault)..."
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onRecordHumanDecision({
                                caseId: activeCase.caseId,
                                decisionAction: 'OVERRIDDEN_WITH_REASON',
                                selectedResourceId: overrideResourceId,
                                overrideReason: overrideReasonText,
                                conflictDeclared: conflictChecked,
                              });
                              setShowOverridePanel(false);
                              setOverrideReasonText('');
                            }}
                            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md"
                          >
                            Confirm Documented Override
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Consent & Dignity Infrastructure Control */}
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-900">
                      Structured Consent & Dignity State ({activeCase.consent.consentId})
                    </h4>
                    <span className="text-xs text-slate-500">
                      {activeCase.consent.withdrawn ? 'WITHDRAWN' : 'ACTIVE'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span>Service: {activeCase.consent.serviceParticipation ? 'Yes' : 'No'}</span>
                    <span aria-hidden="true"> · </span>
                    <span>Data Sharing: {activeCase.consent.dataSharing ? 'Yes' : 'Halted'}</span>
                    <span aria-hidden="true"> · </span>
                    <span>Follow-Up: {activeCase.consent.followUpContact ? 'Yes' : 'Halted'}</span>
                    <span aria-hidden="true"> · </span>
                    <span>Lang: {activeCase.consent.accessibleExplanationLanguage}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {!activeCase.consent.withdrawn ? (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConsent({
                            caseId: activeCase.caseId,
                            withdrawConsent: true,
                            notes: 'Beneficiary requested immediate consent withdrawal.',
                          })
                        }
                        className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                      >
                        Withdraw Data-Sharing & Follow-Up Consent
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConsent({
                            caseId: activeCase.caseId,
                            withdrawConsent: false,
                            dataSharing: true,
                            followUpContact: true,
                            notes: 'Beneficiary re-authorised service & follow-up consent.',
                          })
                        }
                        className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded"
                      >
                        Restore Consent
                      </button>
                    )}
                  </div>
                </div>

                {/* Case Audit History */}
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900">
                    Immutable Case Event Timeline ({activeCase.history.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeCase.history.map((h) => (
                      <div key={h.id} className="text-xs border-b border-slate-100 pb-2">
                        <div className="flex items-center justify-between text-slate-500 font-mono tabular-nums">
                          <span>
                            {h.stage} · {h.actorRole}
                          </span>
                          <span>{h.eventHash.slice(0, 15)}...</span>
                        </div>
                        <div className="font-semibold text-slate-800 mt-0.5">{h.action}</div>
                        <div className="text-slate-600">{h.details}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ONE BACKEND, TWO DOORS (MULTI-CHANNEL INTAKE & SMS/WHATSAPP GATEWAY) */}
      {subView === 'TWO_DOORS_INTAKE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Door 1: Structured Website / Coordinator / Partner API Pipeline */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-emerald-700">Door 1 · Structured Portal & API</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Unified Intake Pipeline: Channel → Normalisation → Validation → Consent → Case
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Creates consistent cases across Website, Field Coordinator, Partner Imports, and API without silos.
              </p>
            </div>

            <form onSubmit={(e) => handleStructuredIntakeSubmit(e, false)} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Intake Channel</label>
                  <select
                    value={intakeChannel}
                    onChange={(e) => setIntakeChannel(e.target.value as IntakeChannel)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="WEBSITE">Website Self-Service</option>
                    <option value="COORDINATOR">Frontline Coordinator</option>
                    <option value="PARTNER_IMPORT">Partner Import</option>
                    <option value="API">Federated API</option>
                    <option value="SMS">SMS Gateway</option>
                    <option value="WHATSAPP">WhatsApp Gateway</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Domain</label>
                  <select
                    value={intakeDomain}
                    onChange={(e) => setIntakeDomain(e.target.value as DomainType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="FOOD">FOOD (Rations & Wards)</option>
                    <option value="WORK">WORK (Local Jobs)</option>
                    <option value="EDUCATION">EDUCATION (Seats & Vouchers)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Urgency</label>
                  <select
                    value={intakeUrgency}
                    onChange={(e) => setIntakeUrgency(e.target.value as UrgencyLevel)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="STANDARD">STANDARD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Applicant / Household Alias (Minimal Data)
                  </label>
                  <input
                    type="text"
                    required
                    value={intakeAlias}
                    onChange={(e) => setIntakeAlias(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ward / Service Area</label>
                  <select
                    value={intakeWard}
                    onChange={(e) => setIntakeWard(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-2"
                  >
                    <option value="Ward 4 · Upland Canal Sector">Ward 4 · Upland Canal Sector (Silent-Exclusion Ward)</option>
                    <option value="Ward 3 · Peri-Urban Settlement">Ward 3 · Peri-Urban Settlement</option>
                    <option value="Ward 1 · Riverbank North">Ward 1 · Riverbank North</option>
                    <option value="Ward 2 · Industrial Corridor">Ward 2 · Industrial Corridor</option>
                    <option value="Ward 5 · Old Market Transit Hub">Ward 5 · Old Market Transit Hub</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Summary of Need</label>
                <textarea
                  rows={2}
                  required
                  value={intakeSummary}
                  onChange={(e) => setIntakeSummary(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              {/* Dignity & Agency Constraints */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2.5">
                <div className="font-semibold text-slate-900">
                  Dignity & Agency Constraints (Used by Matching Solver)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!intakeFuel}
                      onChange={(e) => setIntakeFuel(!e.target.checked)}
                    />
                    <span>No Cooking Fuel (Needs Fortified/Milled)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={intakeChildcare}
                      onChange={(e) => setIntakeChildcare(e.target.checked)}
                    />
                    <span>Childcare Shift Required</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!intakeTransport}
                      onChange={(e) => setIntakeTransport(!e.target.checked)}
                    />
                    <span>Needs Doorstep / Transit Pass</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-600 mb-1">Household Size</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={intakeHouseholdSize}
                      onChange={(e) => setIntakeHouseholdSize(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Preferred Language</label>
                    <input
                      type="text"
                      value={intakeLanguage}
                      onChange={(e) => setIntakeLanguage(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Explicit Structured Consent Gate */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-md p-3.5 space-y-2">
                <div className="font-semibold text-slate-900">
                  Explicit Structured Consent Gate (Mandatory)
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentService}
                    onChange={(e) => setConsentService(e.target.checked)}
                  />
                  <span>Consent for Service Participation & Minimal-Data Case Creation (Required)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentSharing}
                    onChange={(e) => setConsentSharing(e.target.checked)}
                  />
                  <span>Consent for Partner Organisation Data Sharing (Food/Work/Education Provider)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentFollowUp}
                    onChange={(e) => setConsentFollowUp(e.target.checked)}
                  />
                  <span>Consent for Post-Delivery / 7-Day / 30-Day Result Check Follow-Up</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-md transition-colors"
                >
                  Run Intake Pipeline & Match
                </button>
                <button
                  type="button"
                  onClick={(e) => handleStructuredIntakeSubmit(e, true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-medium rounded-md transition-colors"
                >
                  Test Idempotent Duplicate Detection
                </button>
              </div>
            </form>
          </div>

          {/* Door 2: Low-Tech SMS / WhatsApp Two-Way Simulator */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Door 2 · Any Phone, Their Language</p>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    SMS & WhatsApp Low-Bandwidth Gateway
                  </h3>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs">
                  <button
                    type="button"
                    onClick={() => setSmsChannel('SMS')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      smsChannel === 'SMS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    SMS Shortcode
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmsChannel('WHATSAPP')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      smsChannel === 'WHATSAPP' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    WhatsApp
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Intake, receipts, status updates, and anonymous bribe complaints feed directly into the same backend and Shared Case Inbox.
              </p>
            </div>

            {/* Simulated Phone Log */}
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 h-72 overflow-y-auto space-y-3 font-mono text-xs">
              {smsLog.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-md ${
                    msg.sender === 'USER'
                      ? 'bg-emerald-800/80 text-white ml-8'
                      : 'bg-slate-800 text-slate-200 mr-8 border border-slate-700'
                  }`}
                >
                  <div className="text-[11px] text-slate-400 mb-0.5">
                    {msg.sender === 'USER' ? `Beneficiary (${smsChannel})` : 'HUMANIE Gateway 56070'} ·{' '}
                    {msg.time}
                  </div>
                  <div>{msg.text}</div>
                </div>
              ))}
            </div>

            {/* Quick SMS Preset Buttons */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">
                One-Click Low-Tech Commands:
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSmsInput('INTAKE FOOD WARD4 6 NOFUEL')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-mono"
                >
                  INTAKE FOOD WARD4 6 NOFUEL
                </button>
                <button
                  type="button"
                  onClick={() => setSmsInput('RECEIPT CASE-2026-0101 35')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-mono"
                >
                  RECEIPT CASE-2026-0101 35
                </button>
                <button
                  type="button"
                  onClick={() => setSmsInput('STATUS CASE-2026-0101')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-mono"
                >
                  STATUS CASE-2026-0101
                </button>
                <button
                  type="button"
                  onClick={() => setSmsInput('BRIBE ORG-DIST-01 Driver demanded 200 INR unloading fee')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-mono"
                >
                  BRIBE ORG-DIST-01 ...
                </button>
              </div>
            </div>

            <form onSubmit={handleSendSmsCommand} className="flex items-center gap-2">
              <input
                type="text"
                value={smsInput}
                onChange={(e) => setSmsInput(e.target.value)}
                placeholder="Type SMS or WhatsApp command..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Send {smsChannel}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 3: ORGANISATION INFRASTRUCTURE & SERVER-SIDE RBAC PERMISSIONS */}
      {subView === 'ORGS_AND_RBAC' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Participating Institutional Profiles & Data-Sharing Governance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every participating institution has verified capabilities, resource capacity limits, signed data-sharing agreements, and spot-check scores.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Org ID & Name</th>
                    <th className="py-3 px-4">Type & Verification</th>
                    <th className="py-3 px-4">Domains & Service Area</th>
                    <th className="py-3 px-4 text-right">Capacity</th>
                    <th className="py-3 px-4 text-right">Spot-Check Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {organisations.map((org) => (
                    <tr key={org.orgId} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">{org.orgId}</div>
                        <div className="font-medium text-slate-800">{org.name}</div>
                        <div className="text-slate-500">Contact: {org.contactPerson}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{org.type}</div>
                        <div className="text-emerald-700 font-semibold">
                          {org.verifiedStatus} · DSA Signed: {org.dataSharingAgreementSigned ? 'Yes' : 'No'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{org.domains.join(' · ')}</div>
                        <div className="text-slate-500">{org.serviceAreaWards.join(', ')}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">
                          {org.resourceCapacityCurrent} / {org.resourceCapacityMax}
                        </div>
                        <div className="text-slate-500">{org.operatingHours}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-semibold text-emerald-800">{org.spotCheckScorePct}%</div>
                        <div className="text-slate-500">Audited {org.lastAuditDate}</div>
                      </td>
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
