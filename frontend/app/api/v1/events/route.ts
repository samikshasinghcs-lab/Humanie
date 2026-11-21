import { NextResponse } from 'next/server';
import { getHumanieState } from '@/lib/humanie-store';
import { verifyAuditLedgerChain } from '@/lib/humanie-engine';

export async function GET() {
  const state = getHumanieState();
  const verification = verifyAuditLedgerChain(state.auditLedger);
  return NextResponse.json({
    apiVersion: 'v1',
    integrityVerification: verification,
    totalEvents: state.auditLedger.length,
    events: state.auditLedger,
  });
}
