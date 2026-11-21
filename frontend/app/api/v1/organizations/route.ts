import { NextRequest, NextResponse } from 'next/server';
import { getHumanieState, appendLedgerEvent } from '@/lib/humanie-store';
import { ROLE_PERMISSION_MATRIX } from '@/lib/humanie-engine';
import { UserRole } from '@/lib/humanie-types';

function actor(req: NextRequest): UserRole {
  const r = req.headers.get('x-humanie-role') || 'Auditor';
  return ROLE_PERMISSION_MATRIX[r as UserRole] ? r as UserRole : 'Auditor';
}
export async function GET(req: NextRequest) {
  const state = getHumanieState();
  const role = actor(req);
  const profile = ROLE_PERMISSION_MATRIX[role];
  const orgs = profile.orgBoundaryRestricted && profile.assignedOrgId !== 'SELF-BENEFICIARY'
    ? state.organisations.filter(o => o.orgId === profile.assignedOrgId)
    : profile.orgBoundaryRestricted ? [] : state.organisations;
  return NextResponse.json({ apiVersion: 'v1', count: orgs.length, organisations: orgs });
}
export async function POST(req: NextRequest) {
  const role = actor(req); const perm = ROLE_PERMISSION_MATRIX[role];
  if (!perm.canConfigureCountryPack) return NextResponse.json({ error: 'Forbidden: organisation administration is restricted.' }, { status: 403 });
  const body = await req.json(); const state = getHumanieState();
  if (!body.name || !Array.isArray(body.domains) || !Array.isArray(body.serviceAreaWards)) return NextResponse.json({ error: 'name, domains and serviceAreaWards are required.' }, { status: 400 });
  if (state.organisations.some(o => o.orgId === body.orgId)) return NextResponse.json({ error: 'orgId already exists.' }, { status: 409 });
  const org = { orgId: String(body.orgId || `ORG-${Date.now()}`), name: String(body.name), type: body.type || 'NGO', verifiedStatus: 'PROVISIONAL' as const, serviceAreaWards: body.serviceAreaWards.map(String), domains: body.domains, capabilities: (body.capabilities || []).map(String), resourceCapacityCurrent: 0, resourceCapacityMax: Number(body.resourceCapacityMax || 0), operatingHours: String(body.operatingHours || 'Not configured'), contactPerson: String(body.contactPerson || 'Unassigned'), escalationContact: String(body.escalationContact || 'Not configured'), dataSharingAgreementSigned: false, spotCheckScorePct: 0, lastAuditDate: new Date().toISOString() };
  state.organisations.push(org);
  appendLedgerEvent(state, { eventType: 'COUNTRY_PACK_CHANGE', actorRole: role, entityId: org.orgId, summary: `Organisation profile created: ${org.name}`, payload: { orgId: org.orgId, verifiedStatus: org.verifiedStatus } });
  return NextResponse.json({ ok: true, organisation: org }, { status: 201 });
}
