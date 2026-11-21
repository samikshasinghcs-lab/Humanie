import { governanceAction, governanceSummary } from '@/lib/humanie-store';
import type { UserRole } from '@/lib/humanie-types';
export async function GET() { return Response.json(governanceSummary()); }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = (req.headers.get('x-humanie-role') || body.actorRole || 'GOVERNANCE_ADMIN') as UserRole;
    if (!body.action || !body.payload) return Response.json({ error:'action and payload required' }, { status:400 });
    return Response.json({ result: governanceAction({ action:body.action, actorRole:role, payload:body.payload }) });
  } catch (e) { return Response.json({ error:e instanceof Error ? e.message : 'Governance action failed' }, { status:400 }); }
}
