import { NextRequest, NextResponse } from 'next/server';
import { getHumanieState } from '@/lib/humanie-store';
import { filterCasesForRole, ROLE_PERMISSION_MATRIX } from '@/lib/humanie-engine';
import { UserRole } from '@/lib/humanie-types';

export async function GET(req: NextRequest) {
  const roleHeader = (req.headers.get('x-humanie-role') || 'Approver') as UserRole;
  const activeRole: UserRole = ROLE_PERMISSION_MATRIX[roleHeader] ? roleHeader : 'Approver';
  const state = getHumanieState();
  const cases = filterCasesForRole(state.cases, activeRole);

  return NextResponse.json({
    apiVersion: 'v1',
    roleEnforced: activeRole,
    count: cases.length,
    cases,
  });
}
