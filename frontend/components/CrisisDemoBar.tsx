'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  FileText,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Smartphone,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { CountryPackConfig, UserRole } from '@/lib/humanie-types';

const ALL_ROLES: UserRole[] = [
  'Approver',
  'NGO coordinator',
  'Field worker',
  'Independent reviewer',
  'Auditor',
  'Beneficiary',
  'Food distributor',
  'Employer',
  'Education partner',
  'Governance administrator',
];

interface CrisisDemoBarProps {
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  activeCountryPack: CountryPackConfig;
  countryPacks: CountryPackConfig[];
  onSwitchCountry: (code: CountryPackConfig['countryCode']) => void;
  lowBandwidthMode: boolean;
  onToggleLowBandwidth: () => void;
  chainValid: boolean;
  brokenAtSeq?: number;
  onTriggerCrisis: (
    crisisType:
      | 'FIELD_RECEIPT_GAP'
      | 'TAMPER_TEST'
      | 'RESTORE_TAMPER'
      | 'FLOOD_SHOCK'
      | 'JUDGE_APPROVES_PHONE'
      | 'FLOOR_SWEEP'
      | 'RESET_BASELINE'
  ) => Promise<void>;
  busyAction: string | null;
  statusBanner: { type: 'info' | 'error' | 'success'; text: string } | null;
  onClearBanner: () => void;
}

export default function CrisisDemoBar({
  activeRole,
  onSelectRole,
  activeCountryPack,
  countryPacks,
  onSwitchCountry,
  lowBandwidthMode,
  onToggleLowBandwidth,
  chainValid,
  brokenAtSeq,
  onTriggerCrisis,
  busyAction,
  statusBanner,
  onClearBanner,
}: CrisisDemoBarProps) {
  const [showPitchDeckModal, setShowPitchDeckModal] = useState(false);

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Role & Country Pack Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <label htmlFor="role-select" className="font-medium text-slate-600 whitespace-nowrap">
              Active Institutional Role (Server RBAC):
            </label>
            <select
              id="role-select"
              value={activeRole}
              onChange={(e) => onSelectRole(e.target.value as UserRole)}
              className="bg-slate-50 border border-slate-300 text-slate-900 font-semibold rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-300" aria-hidden="true">
            |
          </span>

          <div className="flex items-center gap-2">
            <label htmlFor="country-select" className="font-medium text-slate-600 whitespace-nowrap">
              Jurisdiction Pack:
            </label>
            <select
              id="country-select"
              value={activeCountryPack.countryCode}
              onChange={(e) => onSwitchCountry(e.target.value as CountryPackConfig['countryCode'])}
              className="bg-slate-50 border border-slate-300 text-slate-900 font-medium rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {countryPacks.map((p) => (
                <option key={p.countryCode} value={p.countryCode}>
                  {p.countryCode} · {p.currencySymbol} ({p.languagePrimary})
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-300" aria-hidden="true">
            |
          </span>

          <button
            type="button"
            onClick={onToggleLowBandwidth}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              lowBandwidthMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            {lowBandwidthMode ? 'Low-Bandwidth Text Mode: ON' : 'Low-Bandwidth Mode'}
          </button>

          <button
            type="button"
            onClick={() => setShowPitchDeckModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
            View Pitch Deck Reference (PDF)
          </button>
        </div>

        {/* Cryptographic Hash Chain Verification Status */}
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          {chainValid ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-800 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Hash-Chain Ledger: VERIFIED
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-red-700 font-semibold">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              CHAIN BROKEN AT SEQ #{brokenAtSeq} (TAMPER ALERT)
              <button
                type="button"
                onClick={() => onTriggerCrisis('RESTORE_TAMPER')}
                className="ml-1 px-2 py-1 bg-red-700 text-white rounded text-xs font-sans hover:bg-red-800 transition-colors"
              >
                Restore Vault Snapshot
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Slide 13 Interactive Crisis Walkthrough Strip */}
      <div className="bg-slate-900 text-slate-100 border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold tracking-tight text-emerald-400 whitespace-nowrap">
              Live Demo Crisis Walkthrough:
            </span>
            <span className="text-slate-400 hidden xl:inline">
              Trigger real operational shocks across Cases, Solver, Decision Vault & Ledger
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => onTriggerCrisis('FIELD_RECEIPT_GAP')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="Dispatched 40, received 35 -> opens an investigation case"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              1. Field Receipt (5-unit gap)
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => onTriggerCrisis(chainValid ? 'TAMPER_TEST' : 'RESTORE_TAMPER')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                chainValid
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  : 'bg-red-700 hover:bg-red-600 text-white border-red-500'
              }`}
              title="Simulates editing a historical decision to show cryptographic hash-chain break"
            >
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              {chainValid ? '2. Tamper Test (Break Chain)' : '2. Restore Tampered Chain'}
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => onTriggerCrisis('FLOOD_SHOCK')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="Rural transport costs surge +65%, Equity LP re-solves live"
            >
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              3. Flood Shock (Live Re-Solve)
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => onTriggerCrisis('JUDGE_APPROVES_PHONE')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="Mobile fast-path Step 3 human approval from a phone"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              4. Judge Approves (Phone)
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => onTriggerCrisis('FLOOR_SWEEP')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="Sweeps coverage floor to 60% and computes slack units needed"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              5. Floor Sweep (Slack Needed)
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => onTriggerCrisis('RESET_BASELINE')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="Reset LP solver to 436.9 units baseline"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Baseline
            </button>
          </div>
        </div>
      </div>

      {/* Live Action Notification Banner */}
      {statusBanner && (
        <div
          className={`border-b px-6 py-2.5 text-xs font-medium ${
            statusBanner.type === 'error'
              ? 'bg-red-50 text-red-900 border-red-200'
              : statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
              : 'bg-slate-100 text-slate-900 border-slate-200'
          }`}
        >
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
            <span>{statusBanner.text}</span>
            <button
              type="button"
              onClick={onClearBanner}
              className="text-slate-500 hover:text-slate-900 p-0.5 rounded"
              aria-label="Close message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pitch Deck Modal */}
      {showPitchDeckModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-lg max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  HUMANIE Walkthrough & Engineering Reference Deck
                </h3>
                <p className="text-xs text-slate-500">
                  Need → Match → Human Review → Delivery → Result Check → Evidence → Integrity
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPitchDeckModal(false)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
              >
                Close Preview
              </button>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe
                src="/assets/aistudio/HUMANIE_Pitch_Deck_v4_Template_5606daff.pdf"
                className="w-full h-full border-0"
                title="HUMANIE Pitch Deck PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
