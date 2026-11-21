import { NextRequest, NextResponse } from 'next/server';
import { getHumanieState, processUnifiedIntake, appendLedgerEvent } from '@/lib/humanie-store';
import { ROLE_PERMISSION_MATRIX } from '@/lib/humanie-engine';
import type { DomainType, UserRole, UrgencyLevel } from '@/lib/humanie-types';

const allowedDomains = new Set(['FOOD','WORK','EDUCATION']);
const allowedUrgencies = new Set(['LOW','MEDIUM','HIGH','CRITICAL']);
function parseCSV(text: string): string[][] {
  const rows: string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
  for(let i=0;i<text.length;i++){ const ch=text[i];
    if(ch==='"'){ if(quoted && text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(ch===',' && !quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){ if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell); if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''; }
    else cell+=ch;
  }
  row.push(cell); if(row.some(x=>x.trim())) rows.push(row); return rows;
}
export async function GET(req: NextRequest){
  const role=(req.headers.get('x-humanie-role')||'Auditor') as UserRole; const perm=ROLE_PERMISSION_MATRIX[role];
  if(!perm || !perm.canViewAuditLedger) return NextResponse.json({error:'Forbidden'}, {status:403});
  const s=getHumanieState(); return NextResponse.json({apiVersion:'v1',imports:s.importLogs, mappingTemplate:{alias:['alias','beneficiaryAlias','name'],domain:['domain'],ward:['ward','location'],need:['need','summaryNeed'],urgency:['urgency','priority']}});
}
export async function POST(req: NextRequest){
  try{
    const role=(req.headers.get('x-humanie-role')||'Approver') as UserRole; const perm=ROLE_PERMISSION_MATRIX[role];
    if(!perm || !perm.canCreateIntake) return NextResponse.json({error:'Forbidden: intake import permission required.'},{status:403});
    const body=await req.json(); const rows=Array.isArray(body.rows)?body.rows:parseCSV(String(body.csvText||''));
    if(!rows.length) return NextResponse.json({error:'Provide CSV text or row array.'},{status:400});
    const isArrayRows=Array.isArray(body.rows); let headers:string[]=[]; let records:any[]=[];
    if(isArrayRows){records=rows;} else {headers=rows[0].map((h:string)=>String(h).trim().toLowerCase()); records=rows.slice(1).map((r:string[])=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));}
    const norm=(r:any)=>{ const get=(...keys:string[])=>{for(const k of keys){if(r[k]!==undefined&&r[k]!==null&&String(r[k]).trim())return String(r[k]).trim();}return '';};
      const alias=get('alias','beneficiaryalias','name'); const domain=get('domain').toUpperCase(); const ward=get('ward','location'); const need=get('need','summaryneed'); const urgency=get('urgency','priority').toUpperCase()||'MEDIUM';
      return {alias,domain,ward,need,urgency}; };
    let created=0, merged=0, failed=0; const errors:any[]=[];
    records.forEach((r:any,index:number)=>{try{const x=norm(r); if(!x.alias||!x.ward||!x.need||!allowedDomains.has(x.domain)||!allowedUrgencies.has(x.urgency)) throw new Error('Required alias/domain/ward/need/urgency invalid.');
      const res=processUnifiedIntake({actorRole:role,channel:'PARTNER_IMPORT',domain:x.domain as DomainType,beneficiaryAlias:x.alias,urgency:x.urgency as UrgencyLevel,summaryNeed:x.need,consentGranted:Boolean(isArrayRows?r.consentGranted:r.consent_granted),dataSharingGranted:false,followUpGranted:false,constraints:{wardOrLocation:x.ward,transportAvailable:false,childcareRequired:false,cookingFuelAvailable:true,preferredLanguage:'Not specified',householdSize:1,maxCommuteKm:0,skills:[]}});
      if(res.deduplicatedExisting)merged++;else created++;
    }catch(e){failed++;errors.push({row:index+1,error:e instanceof Error?e.message:'Invalid row'});}});
    const s=getHumanieState(); s.importLogs.unshift({importId:`IMP-${Date.now()}`,timestamp:new Date().toISOString(),sourcePartner:String(body.sourcePartner||'API/CSV Import'),rowsProcessed:records.length,casesCreated:created,duplicatesMerged:merged,actorRole:role});
    appendLedgerEvent(s,{eventType:'COUNTRY_PACK_CHANGE',actorRole:role,entityId:`IMP-${Date.now()}`,summary:`Interoperability import: ${created} created, ${merged} duplicates, ${failed} rejected.`,payload:{sourcePartner:body.sourcePartner,rows:records.length,created,merged,failed}});
    return NextResponse.json({ok:true,rowsProcessed:records.length,created,merged,failed,errors},{status:failed?207:200});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Import failed'},{status:400});}
}
