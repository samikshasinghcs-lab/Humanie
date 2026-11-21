import { NextRequest, NextResponse } from 'next/server';
import { getHumanieState, appendLedgerEvent } from '@/lib/humanie-store';
import { ROLE_PERMISSION_MATRIX } from '@/lib/humanie-engine';
import { UserRole } from '@/lib/humanie-types';
export async function GET(req: NextRequest) {
 const roleName=req.headers.get('x-humanie-role')||'Auditor'; const role=ROLE_PERMISSION_MATRIX[roleName as UserRole]?roleName as UserRole:'Auditor';
 const state=getHumanieState(); const cases=state.cases;
 if (ROLE_PERMISSION_MATRIX[role].orgBoundaryRestricted) return NextResponse.json({error:'Forbidden: consent register restricted.'},{status:403});
 return NextResponse.json({apiVersion:'v1',consents:cases.map(c=>({caseId:c.caseId,consentId:c.consent.consentId,serviceParticipation:c.consent.serviceParticipation,dataSharing:c.consent.dataSharing,followUpContact:c.consent.followUpContact,withdrawn:c.consent.withdrawn,updatedAt:c.consent.updatedAt,history:c.consent.history}))});
}
export async function POST(req: NextRequest) {
 try { const body=await req.json(); const roleName=req.headers.get('x-humanie-role')||body.actorRole||'NGO coordinator'; const role=ROLE_PERMISSION_MATRIX[roleName as UserRole]?roleName as UserRole:'NGO coordinator'; const state=getHumanieState(); const c=state.cases.find(x=>x.caseId===body.caseId); if(!c)return NextResponse.json({error:'Case not found'},{status:404});
 const now=new Date().toISOString(); const withdrawal=Boolean(body.withdrawConsent); if(withdrawal){c.consent.withdrawn=true;c.consent.withdrawnAt=now;c.consent.serviceParticipation=false;c.consent.dataSharing=false;c.consent.followUpContact=false;c.consent.minimalDataIntake=true;c.pendingAction='Consent withdrawn. Sharing and follow-up halted; case requires human review.';c.status='APPEAL_OPEN';}else {if(c.consent.withdrawn && !body.reaffirmServiceParticipation)return NextResponse.json({error:'Re-consent after withdrawal requires explicit reaffirmServiceParticipation.'},{status:400});c.consent.withdrawn=false;c.consent.serviceParticipation=Boolean(body.reaffirmServiceParticipation??body.serviceParticipation);c.consent.dataSharing=Boolean(body.dataSharing);c.consent.followUpContact=Boolean(body.followUpContact);if(!c.consent.serviceParticipation)return NextResponse.json({error:'Service participation consent is required.'},{status:400});}
 c.consent.updatedAt=now;c.consent.history.unshift({timestamp:now,action:withdrawal?'CONSENT_WITHDRAWN':'CONSENT_PREFERENCES_UPDATED',actorRole:role,channel:'WEBSITE',notes:String(body.notes||'Consent state updated via consent API.')});appendLedgerEvent(state,{eventType:'CONSENT_RECORDED',actorRole:role,entityId:c.consent.consentId,summary:`Consent lifecycle updated for ${c.caseId}`,payload:{caseId:c.caseId,withdrawn:c.consent.withdrawn,sharing:c.consent.dataSharing,followUp:c.consent.followUpContact}});return NextResponse.json({ok:true,consent:c.consent});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid consent request'},{status:400});}
}
