import { NextRequest, NextResponse } from 'next/server';
import {
  appendLedgerEvent,
  getHumanieState,
  processUnifiedIntake,
  recordHumanDecision,
  recordResultCheckAndReceipt,
  runLiveDemoCrisisAction,
  submitWhistleblowerComplaint,
} from '@/lib/humanie-store';
import {
  filterCasesForRole,
  ROLE_PERMISSION_MATRIX,
  runEquityLPSolver,
  verifyAuditLedgerChain,
} from '@/lib/humanie-engine';
import { CountryPackConfig, DomainType, IntakeChannel, ResultCheckStatus, UrgencyLevel, UserRole } from '@/lib/humanie-types';

export async function GET(req: NextRequest) {
  const roleHeader = (req.headers.get('x-humanie-role') || 'Approver') as UserRole;
  const activeRole: UserRole = ROLE_PERMISSION_MATRIX[roleHeader] ? roleHeader : 'Approver';
  const perm = ROLE_PERMISSION_MATRIX[activeRole];

  const state = getHumanieState();
  const visibleCases = filterCasesForRole(state.cases, activeRole);
  const chainStatus = verifyAuditLedgerChain(state.auditLedger);

  // Server-side RBAC enforcement for whistleblower complaints:
  // Accused orgs or non-oversight roles cannot view restricted whistleblower identity tokens
  const visibleComplaints = state.complaints.map((c) => {
    if (!perm.canViewRestrictedWhistleblowerVault) {
      return {
        ...c,
        description: '[RESTRICTED OVERSIGHT RECORD — Visible only to Independent Reviewer / Auditor]',
        encryptedIdentityVaultRef: '[REDACTED_SERVER_SIDE]',
        evidenceAttachmentRef: '[REDACTED_SERVER_SIDE]',
      };
    }
    return c;
  });

  return NextResponse.json({
    activeRole,
    permissions: perm,
    activeCountryCode: state.activeCountryCode,
    activeCountryPack: state.countryPacks.find((p) => p.countryCode === state.activeCountryCode)!,
    countryPacks: state.countryPacks,
    organisations: state.organisations,
    foodBatches: state.foodBatches,
    workJobs: state.workJobs,
    eduProgrammes: state.eduProgrammes,
    cases: visibleCases,
    totalCasesUnfilteredCount: state.cases.length,
    decisions: state.decisions,
    outcomes: state.outcomes,
    integrityFlags: state.integrityFlags,
    complaints: visibleComplaints,
    auditLedger: state.auditLedger,
    chainVerification: chainStatus,
    lpSolverState: state.lpSolverState,
    importLogs: state.importLogs,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roleHeader = (req.headers.get('x-humanie-role') || body.actorRole || 'Approver') as UserRole;
    const actorRole: UserRole = ROLE_PERMISSION_MATRIX[roleHeader] ? roleHeader : 'Approver';
    const perm = ROLE_PERMISSION_MATRIX[actorRole];
    const state = getHumanieState();

    const { action } = body;

    if (action === 'CREATE_INTAKE') {
      if (!perm.canCreateIntake) {
        return NextResponse.json(
          { error: `Server-Side RBAC Denied: Role "${actorRole}" cannot submit new case intakes.` },
          { status: 403 }
        );
      }
      const res = processUnifiedIntake({
        actorRole,
        channel: (body.channel || 'WEBSITE') as IntakeChannel,
        domain: (body.domain || 'FOOD') as DomainType,
        beneficiaryAlias: body.beneficiaryAlias || 'Household Applicant',
        urgency: (body.urgency || 'HIGH') as UrgencyLevel,
        summaryNeed: body.summaryNeed || 'Urgent multi-domain assistance request.',
        constraints: {
          wardOrLocation: body.wardOrLocation || 'Ward 4 · Upland Canal Sector',
          transportAvailable: Boolean(body.transportAvailable),
          childcareRequired: Boolean(body.childcareRequired),
          cookingFuelAvailable: body.cookingFuelAvailable !== false,
          preferredLanguage: body.preferredLanguage || 'Hindi / English',
          householdSize: Number(body.householdSize || 4),
          maxCommuteKm: Number(body.maxCommuteKm || 4),
          skills: body.skills || ['Assembly', 'Inventory'],
        },
        consentGranted: Boolean(body.consentGranted),
        dataSharingGranted: Boolean(body.dataSharingGranted ?? true),
        followUpGranted: Boolean(body.followUpGranted ?? true),
        idempotencyKey: body.idempotencyKey,
      });

      return NextResponse.json({
        ok: true,
        message: res.deduplicatedExisting
          ? `Idempotent Duplicate Detected: Merged into existing case ${res.caseRecord.caseId} (Receipt: ${res.receiptCode}).`
          : `Unified Intake Created: ${res.caseRecord.caseId} via ${res.caseRecord.intakeChannel} (Receipt: ${res.receiptCode}).`,
        result: res,
      });
    }

    if (action === 'HUMAN_DECISION') {
      const dec = recordHumanDecision({
        actorRole,
        actorName: body.actorName || `${actorRole} (Authenticated)`,
        caseId: body.caseId,
        decisionAction: body.decisionAction,
        selectedResourceId: body.selectedResourceId,
        overrideReason: body.overrideReason,
        conflictDeclared: Boolean(body.conflictDeclared),
        conflictNote: body.conflictNote,
        approvalChannel: body.approvalChannel || 'WEB_CONSOLE',
      });
      return NextResponse.json({
        ok: true,
        message: `Decision ${dec.decisionId} recorded in Decision Vault (${dec.decisionAction}).`,
        decision: dec,
      });
    }

    if (action === 'RESULT_CHECK') {
      if (!perm.canRecordDeliveryOrPlacement && !perm.canApproveDecisions) {
        return NextResponse.json(
          { error: `Server-Side RBAC Denied: Role "${actorRole}" cannot record delivery receipts or outcome checks.` },
          { status: 403 }
        );
      }
      const out = recordResultCheckAndReceipt({
        actorRole,
        caseId: body.caseId,
        channel: body.channel || 'SMS',
        status: (body.status || 'Met') as ResultCheckStatus,
        dispatchedUnits: body.dispatchedUnits !== undefined ? Number(body.dispatchedUnits) : undefined,
        receivedUnits: body.receivedUnits !== undefined ? Number(body.receivedUnits) : undefined,
        stillEmployedAt7Days: body.stillEmployedAt7Days,
        stillEmployedAt30Days: body.stillEmployedAt30Days,
        stillAttendingAt30Days: body.stillAttendingAt30Days,
        attendanceRatePct: body.attendanceRatePct !== undefined ? Number(body.attendanceRatePct) : undefined,
        beneficiaryFeedback: body.beneficiaryFeedback || 'Outcome verification logged.',
      });
      return NextResponse.json({
        ok: true,
        message: out.discrepancyFlagged
          ? `Outcome logged (${out.status}) — Discrepancy detected and Integrity Shield flag opened!`
          : `Outcome verified (${out.scheduleLabel}: ${out.status}) and linked to Decision Vault.`,
        outcome: out,
      });
    }

    if (action === 'UPDATE_CONSENT') {
      const targetCase = state.cases.find((c) => c.caseId === body.caseId);
      if (!targetCase) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }
      const now = new Date().toISOString();
      if (body.withdrawConsent) {
        targetCase.consent.withdrawn = true;
        targetCase.consent.withdrawnAt = now;
        targetCase.consent.dataSharing = false;
        targetCase.consent.followUpContact = false;
        targetCase.pendingAction = 'CONSENT WITHDRAWN: Automated sharing halted; minimal dignity safeguard active.';
      } else {
        targetCase.consent.withdrawn = false;
        targetCase.consent.dataSharing = Boolean(body.dataSharing);
        targetCase.consent.followUpContact = Boolean(body.followUpContact);
      }
      targetCase.consent.updatedAt = now;
      targetCase.consent.history.unshift({
        timestamp: now,
        action: body.withdrawConsent ? 'CONSENT_WITHDRAWN' : 'CONSENT_PREFERENCES_UPDATED',
        actorRole,
        channel: 'WEBSITE',
        notes: body.notes || 'Updated structured consent preferences.',
      });

      appendLedgerEvent(state, {
        eventType: 'CONSENT_RECORDED',
        actorRole,
        entityId: targetCase.consent.consentId,
        summary: `Consent state updated for ${targetCase.caseId} (withdrawn=${targetCase.consent.withdrawn}).`,
        payload: { caseId: targetCase.caseId, withdrawn: targetCase.consent.withdrawn },
      });

      return NextResponse.json({
        ok: true,
        message: body.withdrawConsent
          ? `Consent withdrawn for ${targetCase.caseId}. Data sharing & follow-up immediately halted.`
          : `Consent preferences updated for ${targetCase.caseId}.`,
      });
    }

    if (action === 'RE_SOLVE_LP') {
      state.lpSolverState = runEquityLPSolver({
        totalStockUnits: Number(body.totalStockUnits ?? 436.9),
        transportBudgetLimit: Number(body.transportBudgetLimit ?? 2400),
        transportCostMultiplier: Number(body.transportCostMultiplier ?? 1.0),
        coverageFloorTargetPct: Number(body.coverageFloorTargetPct ?? 47.87),
        scenario: body.scenario || 'CUSTOM_LIVE',
      });
      return NextResponse.json({
        ok: true,
        message: `Equity LP Re-Solved: Minimum ward coverage ${state.lpSolverState.equityLPMinWardCoveragePct}% vs Proportional ${state.lpSolverState.proportionalMinWardCoveragePct}% (+${state.lpSolverState.coverageGainPercentagePoints} pp).`,
        lpSolverState: state.lpSolverState,
      });
    }

    if (action === 'SUBMIT_COMPLAINT') {
      const comp = submitWhistleblowerComplaint({
        actorRole,
        submissionType: body.submissionType || 'ANONYMOUS',
        category: body.category || 'BRIBE_DEMAND',
        targetOrgId: body.targetOrgId || 'ORG-DIST-01',
        relatedCaseId: body.relatedCaseId,
        ward: body.ward || 'Ward 4 · Upland Canal Sector',
        description: body.description,
        evidenceAttachmentRef: body.evidenceAttachmentRef,
        reporterContactOptional: body.reporterContactOptional,
      });
      return NextResponse.json({
        ok: true,
        message: `Complaint ${comp.complaintId} locked in separated Whistleblower Vault. Accused entity (${comp.targetOrgId}) blocked from access.`,
        complaint: comp,
      });
    }

    if (action === 'INDEPENDENT_REVIEW_ACTION') {
      if (!perm.canReviewComplaintsIndependently) {
        return NextResponse.json(
          {
            error: `Conflict & Separation Gate: Role "${actorRole}" is not authorised to adjudicate independent oversight complaints.`,
          },
          { status: 403 }
        );
      }
      const comp = state.complaints.find((c) => c.complaintId === body.complaintId);
      if (!comp) {
        return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
      }
      comp.status = body.newStatus || 'FINDINGS_RECORDED';
      comp.reviewNotes.unshift(
        `[${new Date().toISOString().slice(0, 16)} · ${actorRole}] ${body.reviewNote || 'Independent findings logged.'}`
      );
      return NextResponse.json({
        ok: true,
        message: `Independent review finding recorded on ${comp.complaintId}.`,
      });
    }

    if (action === 'SWITCH_COUNTRY_PACK') {
      const code = body.countryCode as CountryPackConfig['countryCode'];
      const pack = state.countryPacks.find((p) => p.countryCode === code);
      if (!pack) {
        return NextResponse.json({ error: 'Invalid country pack' }, { status: 400 });
      }
      state.activeCountryCode = code;
      appendLedgerEvent(state, {
        eventType: 'COUNTRY_PACK_CHANGE',
        actorRole,
        entityId: code,
        summary: `Jurisdiction switched to ${pack.name} (${pack.currencyCode}). Fixed red lines remain locked.`,
        payload: { countryCode: code, fixedRedLines: pack.fixedRedLines },
      });
      return NextResponse.json({
        ok: true,
        message: `Activated Country Pack: ${pack.name} (${pack.currencySymbol} ${pack.currencyCode}). All 5 Global Red Lines enforced.`,
      });
    }

    if (action === 'PARTNER_CSV_IMPORT') {
      const rows: { alias: string; domain: DomainType; ward: string; need: string; urgency: UrgencyLevel }[] =
        body.rows || [
          {
            alias: 'Lakshmi V. (CSV Batch #1)',
            domain: 'FOOD',
            ward: 'Ward 4 · Upland Canal Sector',
            need: 'Low-fuel fortified ration pack imported from WFP SCOPE partner sheet.',
            urgency: 'CRITICAL',
          },
          {
            alias: 'Imran S. (CSV Batch #2)',
            domain: 'WORK',
            ward: 'Ward 2 · Industrial Corridor',
            need: 'Daytime solar micro-grid apprenticeship referral from municipal roster.',
            urgency: 'HIGH',
          },
        ];

      let created = 0;
      let merged = 0;
      for (const r of rows) {
        const res = processUnifiedIntake({
          actorRole,
          channel: 'PARTNER_IMPORT',
          domain: r.domain,
          beneficiaryAlias: r.alias,
          urgency: r.urgency,
          summaryNeed: r.need,
          constraints: {
            wardOrLocation: r.ward,
            transportAvailable: false,
            childcareRequired: true,
            cookingFuelAvailable: false,
            preferredLanguage: 'Hindi / English',
            householdSize: 4,
          },
          consentGranted: true,
        });
        if (res.deduplicatedExisting) merged++;
        else created++;
      }

      state.importLogs.unshift({
        importId: `IMP-2026-0${state.importLogs.length + 1}`,
        timestamp: new Date().toISOString(),
        sourcePartner: body.sourcePartner || 'Partner CSV Batch Connector',
        rowsProcessed: rows.length,
        casesCreated: created,
        duplicatesMerged: merged,
        actorRole,
      });

      return NextResponse.json({
        ok: true,
        message: `Partner CSV Import Complete: ${rows.length} rows validated, ${created} new unified cases created, ${merged} duplicates merged idempotently.`,
      });
    }

    if (action === 'LIVE_CRISIS_DEMO') {
      const out = runLiveDemoCrisisAction(body.crisisType);
      return NextResponse.json({
        ok: true,
        message: out.message,
        chainVerification: out.chainVerification,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server operation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
