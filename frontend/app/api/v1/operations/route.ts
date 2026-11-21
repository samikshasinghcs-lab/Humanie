import { NextRequest, NextResponse } from 'next/server';
import { executeBatch2Operation } from '@/lib/humanie-store';
import { ROLE_PERMISSION_MATRIX } from '@/lib/humanie-engine';
import { UserRole } from '@/lib/humanie-types';

export async function POST(req: NextRequest) {
  try {
    const role = (req.headers.get('x-humanie-role') || 'Approver') as UserRole;
    if (!ROLE_PERMISSION_MATRIX[role]) return NextResponse.json({ error: 'Invalid role' }, { status: 403 });
    const body = await req.json();
    if (!body?.action || typeof body.payload !== 'object') return NextResponse.json({ error: 'action and payload required' }, { status: 400 });
    const result = executeBatch2Operation({ action: body.action, payload: body.payload, actorRole: role });
    return NextResponse.json({ apiVersion: 'v1', action: body.action, result });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Operation failed' }, { status: 400 }); }
}
