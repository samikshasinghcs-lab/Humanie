import { NextResponse } from 'next/server';
import { getHumanieState } from '@/lib/humanie-store';
import { verifyAuditLedgerChain } from '@/lib/humanie-engine';
export async function GET(){
  try{const s=getHumanieState(); const chain=verifyAuditLedgerChain(s.auditLedger); return NextResponse.json({status:'ok',service:'HUMANIE',apiVersion:'v1',timestamp:new Date().toISOString(),stateLoaded:true,auditChain:chain},{status:200});}
  catch(e){return NextResponse.json({status:'degraded',service:'HUMANIE',timestamp:new Date().toISOString(),error:e instanceof Error?e.message:'health check failed'},{status:503});}
}
