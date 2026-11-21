import { NextRequest, NextResponse } from 'next/server';
import { getHumanieState } from '@/lib/humanie-store';
import { ROLE_PERMISSION_MATRIX, filterCasesForRole } from '@/lib/humanie-engine';
import type { UserRole } from '@/lib/humanie-types';
const csv=(v:any)=>{const s=String(v??'');return '"'+s.replace(/"/g,'""')+'"';};
export async function GET(req:NextRequest){
 const role=(req.headers.get('x-humanie-role')||'Auditor') as UserRole; const perm=ROLE_PERMISSION_MATRIX[role];
 if(!perm || !perm.canViewAuditLedger) return NextResponse.json({error:'Forbidden: export access requires an oversight role.'},{status:403});
 const state=getHumanieState(); const cases=filterCasesForRole(state.cases,role);
 const headers=['caseId','domain','status','lifecycleStage','intakeChannel','urgency','ward','assignedOrgName','createdAt'];
 const lines=[headers.join(','),...cases.map(c=>[c.caseId,c.domain,c.status,c.lifecycleStage,c.intakeChannel,c.urgency,c.constraints.wardOrLocation,c.assignedOrgName,c.createdAt].map(csv).join(','))];
 return new NextResponse(lines.join('\r\n'),{status:200,headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="humanie-cases-${state.activeCountryCode}.csv"`,'cache-control':'no-store'}});
}
