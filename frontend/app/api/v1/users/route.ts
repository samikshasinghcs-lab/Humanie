import { NextRequest, NextResponse } from 'next/server';
import { ROLE_PERMISSION_MATRIX } from '@/lib/humanie-engine';
import { UserRole } from '@/lib/humanie-types';
export async function GET(req: NextRequest) {
  const roleName = req.headers.get('x-humanie-role') || 'Auditor';
  const role = ROLE_PERMISSION_MATRIX[roleName as UserRole] ? roleName as UserRole : 'Auditor';
  const profile = ROLE_PERMISSION_MATRIX[role];
  if (!profile.canExportFullPIIOrAudit && !profile.canConfigureCountryPack) return NextResponse.json({ error: 'Forbidden: role matrix access is restricted.' }, { status: 403 });
  return NextResponse.json({ apiVersion: 'v1', roles: Object.values(ROLE_PERMISSION_MATRIX).map(p => ({ role: p.role, description: p.description, allowedDomains: p.allowedDomains, permissions: { canCreateIntake: p.canCreateIntake, canApproveDecisions: p.canApproveDecisions, canActAsSecondApprover: p.canActAsSecondApprover, canRecordDeliveryOrPlacement: p.canRecordDeliveryOrPlacement, canViewRestrictedWhistleblowerVault: p.canViewRestrictedWhistleblowerVault, canReviewComplaintsIndependently: p.canReviewComplaintsIndependently, canExportFullPIIOrAudit: p.canExportFullPIIOrAudit, canConfigureCountryPack: p.canConfigureCountryPack }, orgBoundaryRestricted: p.orgBoundaryRestricted, assignedOrgId: p.assignedOrgId })) });
}
