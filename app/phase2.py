"""HUMANIE Phase 2 operations: chained audit, scenario LP, crisis/SMS, brief export.
All operational recommendations are decision support and require human review.
"""
from __future__ import annotations
import hashlib, json, math, csv, io, re, sqlite3, os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from scipy.optimize import linprog

GENESIS="HUMANIE_PHASE2_GENESIS"
def utcnow(): return datetime.now(timezone.utc).isoformat()
def canonical(x): return json.dumps(x,sort_keys=True,separators=(",",":"),ensure_ascii=False)
def haversine_km(a,b):
    if not a or not b: return None
    lat1,lon1=map(math.radians,a); lat2,lon2=map(math.radians,b)
    dlat,dlon=lat2-lat1,lon2-lon1
    h=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371.0088*2*math.asin(min(1,math.sqrt(h)))

class AuditLedger:
    def __init__(self,path): self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True); self.init()
    def conn(self):
        c=sqlite3.connect(self.path,timeout=30); c.row_factory=sqlite3.Row; c.execute("PRAGMA busy_timeout=30000"); return c
    def init(self):
        with self.conn() as c:
            c.execute("CREATE TABLE IF NOT EXISTS audit_chain(seq INTEGER PRIMARY KEY, ts TEXT NOT NULL, kind TEXT NOT NULL, case_id TEXT NOT NULL, actor_id TEXT NOT NULL, role TEXT NOT NULL, details TEXT NOT NULL, prev_hash TEXT NOT NULL, record_hash TEXT NOT NULL)")
            c.execute("CREATE TABLE IF NOT EXISTS phase2_events(id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)")
            c.execute("CREATE TABLE IF NOT EXISTS outreach(id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, locality TEXT NOT NULL, recommendation TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'recommended', created_at TEXT NOT NULL)")
            c.execute("CREATE TABLE IF NOT EXISTS transitions(id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, case_ref TEXT NOT NULL, from_program TEXT NOT NULL, to_program TEXT NOT NULL, opt_in INTEGER NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL)")
    def digest(self,row): return hashlib.sha256(canonical({k:row[k] for k in ('seq','ts','kind','case_id','actor_id','role','details','prev_hash')}).encode()).hexdigest()
    def append(self,kind,case_id,actor,role,details):
        with self.conn() as c:
            c.execute('BEGIN IMMEDIATE'); tip=c.execute('SELECT seq,record_hash FROM audit_chain ORDER BY seq DESC LIMIT 1').fetchone()
            seq=1 if not tip else tip['seq']+1; prev=GENESIS if not tip else tip['record_hash']
            row={'seq':seq,'ts':utcnow(),'kind':kind,'case_id':str(case_id or ''),'actor_id':str(actor),'role':role,'details':canonical(details),'prev_hash':prev}
            h=self.digest(row); c.execute('INSERT INTO audit_chain VALUES(?,?,?,?,?,?,?,?,?)',(seq,row['ts'],kind,row['case_id'],row['actor_id'],role,row['details'],prev,h)); c.commit()
            return {**row,'record_hash':h}
    def verify(self):
        with self.conn() as c: rows=[dict(r) for r in c.execute('SELECT * FROM audit_chain ORDER BY seq')]
        prev=GENESIS
        for r in rows:
            if r['prev_hash']!=prev: return {'valid':False,'altered_seq':r['seq'],'reason':'previous-hash link mismatch'}
            if self.digest(r)!=r['record_hash']: return {'valid':False,'altered_seq':r['seq'],'reason':'record hash mismatch'}
            prev=r['record_hash']
        return {'valid':True,'records':len(rows),'tip_hash':prev}

class Simulate(BaseModel):
    floor_pct: float=Field(default=30,ge=0,le=100)
    stock: float=Field(gt=0,le=1e9)
    transport_budget: float=Field(gt=0,le=1e12)
    resource_type: str=Field(default='food',pattern='^(food|training|employment)$')
class TamperTest(BaseModel):
    seq: int|None=None
class Crisis(BaseModel):
    case_ref:str=Field(min_length=2,max_length=40)
    event:str=Field(min_length=3,max_length=120)
    detail:str=Field(default='',max_length=500)
    approved:bool=False
class SMS(BaseModel):
    message:str=Field(min_length=3,max_length=300)
class Transition(BaseModel):
    case_ref:str=Field(min_length=2,max_length=40)
    from_program:str=Field(min_length=2,max_length=50)
    to_program:str=Field(min_length=2,max_length=50)
    opt_in:bool
    notes:str=Field(default='',max_length=500)


def attach(app,DB_PATH,db,get_user,audit,ROOT,STATIC):
    ledger=AuditLedger(Path(DB_PATH).with_name('humanie_audit_chain.db'))
    def event(uid,kind,case_id='',details=None,role='operator'):
        ledger.append(kind,case_id,uid,role,details or {})
        with db() as c: c.execute('INSERT INTO phase2_events(owner_id,event_type,payload,created_at) VALUES(?,?,?,?)',(uid,kind,canonical(details or {}),utcnow())); c.commit()
        audit(uid,'phase2:'+kind,canonical(details or {})[:500])
    def owned_data(uid):
        with db() as c:
            cases=[dict(r) for r in c.execute('SELECT * FROM district_cases WHERE owner_id=? AND status="open"',(uid,))]
            resources=[dict(r) for r in c.execute('SELECT * FROM district_resources WHERE owner_id=? AND status="active" AND remaining>0',(uid,))]
        return cases,resources
    @app.get('/api/audit/verify')
    def audit_verify(user=Depends(get_user)): return ledger.verify()
    @app.post('/api/audit/tamper-test')
    def audit_tamper(body:TamperTest,user=Depends(get_user)):
        with ledger.conn() as c:
            row=c.execute('SELECT seq,details FROM audit_chain ORDER BY seq DESC LIMIT 1').fetchone() if body.seq is None else c.execute('SELECT seq,details FROM audit_chain WHERE seq=?',(body.seq,)).fetchone()
            if not row: raise HTTPException(404,'No audit row found')
            seq=row['seq']; details=row['details']
            # Deliberate test mutation: alter a selected row's stored details without recalculating hashes.
            c.execute('UPDATE audit_chain SET details=? WHERE seq=?',(details+' [TAMPER TEST]',seq)); c.commit()
        return {'tampered_seq':seq,'verification':ledger.verify(),'notice':'Integrity test deliberately altered the ledger. Restore the test database or reset the demo ledger before continuing.'}
    @app.post('/api/simulate')
    def simulate(body:Simulate,user=Depends(get_user)):
        cases,resources=owned_data(user['id']); rtype=body.resource_type
        nodes=[]
        for ca in cases:
            if ca['need_type'] not in (rtype,): continue
            demand=float(ca['demand_units']); loc=ca['locality']; district=ca['district']
            eligible=[r for r in resources if r['resource_type']==rtype and r['district'].casefold()==district.casefold()]
            # scenario nodes aggregate case demand and lowest estimated cost among matching provider routes
            route=min([float(r['cost_per_unit']) for r in eligible] or [1.0])
            nodes.append({'name':ca['locality']+' / '+ca['case_ref'],'demand':demand,'vulnerability':float(ca['vulnerability'])/100,'route':route,'case':ca})
        if not nodes: return {'feasible':False,'message':'No open cases of the selected programme type in this workspace.'}
        n=len(nodes); demands=[x['demand'] for x in nodes]; routes=[x['route'] for x in nodes]; weights=[max(.01,x['vulnerability']) for x in nodes]
        floor=body.floor_pct/100; bounds=[(floor*d,d) for d in demands]
        res=linprog([-w/d for w,d in zip(weights,demands)],A_ub=[[1]*n,routes],b_ub=[body.stock,body.transport_budget],bounds=bounds,method='highs')
        if not res.success:
            # Slack recovery LP: minimize combined stock and transport shortfall needed to satisfy floor.
            required_stock=sum(floor*d for d in demands); required_transport=sum(floor*d*r for d,r in zip(demands,routes))
            # Report floor requirement with clear resource-wise slack, not pretend joint optimization solved.
            return {'feasible':False,'requested_floor_pct':body.floor_pct,'extra_stock_needed':round(max(0,required_stock-body.stock),2),'extra_transport_budget_needed':round(max(0,required_transport-body.transport_budget),2),'message':'Requested floor is infeasible under these aggregate constraints. The displayed slack is a floor-only requirement estimate; increase stock/budget or lower the floor.','solver_status':res.message}
        alloc=res.x; cov=[a/d*100 for a,d in zip(alloc,demands)]; weighted=sum(w*c for w,c in zip(weights,cov))/sum(weights)
        duals=getattr(res,'ineqlin',None); marginals=list(duals.marginals) if duals is not None else []
        advisor=[]
        if len(marginals)>=2:
            if abs(marginals[0])>1e-8: advisor.append(f'Stock is binding: increasing stock may improve weighted coverage (LP marginal {marginals[0]:.4g}).')
            else: advisor.append('Stock constraint is not binding at this solution.')
            if abs(marginals[1])>1e-8: advisor.append(f'Transport budget is binding: budget relief may improve weighted coverage (LP marginal {marginals[1]:.4g}).')
            else: advisor.append('Transport budget is not binding at this solution.')
        rows=[{'community':x['name'],'demand':round(x['demand'],2),'allocation':round(float(a),2),'coverage_pct':round(float(c),2),'route_cost_per_unit':x['route']} for x,a,c in zip(nodes,alloc,cov)]
        result={'feasible':True,'solver':'HiGHS','resource_type':rtype,'floor_pct':body.floor_pct,'weighted_coverage_pct':round(weighted,2),'stock_used':round(float(sum(alloc)),2),'transport_used':round(float(sum(a*r for a,r in zip(alloc,routes))),2),'shadow_prices':{'stock':float(marginals[0]) if len(marginals)>0 else None,'transport_budget':float(marginals[1]) if len(marginals)>1 else None},'bottleneck_advisor':advisor,'communities':rows,'caution':'Scenario optimization over recorded workspace cases, not validated population-level need.'}
        event(user['id'],'SIMULATION','',result); return result
    @app.get('/api/district/intelligence/silent-exclusion')
    def silent_exclusion(user=Depends(get_user)):
        with db() as c:
            rows=[dict(r) for r in c.execute('SELECT district,locality,COUNT(*) n,AVG(vulnerability) avg_vulnerability,SUM(demand_units) demand FROM district_cases WHERE owner_id=? GROUP BY district,locality',(user['id'],))]
        # Baseline is an explicit workspace baseline from its recorded localities; low-count/high-vulnerability groups flagged.
        mean_v=sum(r['avg_vulnerability'] for r in rows)/len(rows) if rows else 0; mean_n=sum(r['n'] for r in rows)/len(rows) if rows else 0
        flags=[{**r,'flag':'Potential silent exclusion','recommendation':'Consider an outreach-volunteer verification visit; validate with ward-level population/vulnerability baseline.'} for r in rows if r['avg_vulnerability']>mean_v and r['n']<mean_n]
        return {'flags':flags,'baseline':'workspace-records proxy only; not census/SECC ward baseline','mean_case_count':mean_n,'mean_vulnerability_score':mean_v}
    @app.get('/api/district/intelligence/approver-bias')
    def approver_bias(user=Depends(get_user)):
        with db() as c:
            rows=[dict(r) for r in c.execute("SELECT ca.id,ca.case_ref,ca.locality,ca.vulnerability,ca.urgency,m.status,m.rationale FROM district_cases ca LEFT JOIN district_matches m ON m.case_id=ca.id AND m.owner_id=ca.owner_id WHERE ca.owner_id=? AND ca.vulnerability>=75 AND ca.urgency>=4 AND (m.status IS NULL OR m.status='rejected' OR m.status='recommended')",(user['id'],))]
        return {'flags':rows,'notice':'Risk flags only. This endpoint cannot establish bias or intent; review reasons and context.'}
    @app.get('/api/district/intelligence/overrides')
    def overrides(user=Depends(get_user)):
        with db() as c: rows=[dict(r) for r in c.execute("SELECT id,event,created_at,detail FROM audit WHERE user_id=? AND event LIKE 'district:match_%' ORDER BY id DESC LIMIT 300",(user['id'],))]
        reasons=[]
        for r in rows:
            try: reasons.append(json.loads(r['detail']).get('reason',''))
            except: pass
        nonempty=[x.lower().strip() for x in reasons if x]
        counts={}
        for x in nonempty: counts[x]=counts.get(x,0)+1
        insight=max(counts.items(),key=lambda x:x[1]) if counts else None
        return {'override_reasons':counts,'policy_blindspot_insight':f"Repeated recorded override reason: '{insight[0]}' ({insight[1]} occurrences). Review policy and training." if insight and insight[1]>=2 else 'Insufficient recorded reasons to identify a recurring blindspot.','records_reviewed':len(rows)}
    @app.post('/api/crisis')
    def crisis(body:Crisis,user=Depends(get_user)):
        if not body.approved:
            return {'status':'awaiting_human_approval','case_ref':body.case_ref,'event':body.event,'detail':body.detail,'notice':'Shock recorded as proposed only; approval is required before operational action.'}
        event(user['id'],'CRISIS_APPROVED',body.case_ref,body.model_dump()); return {'status':'approved_for_demo_simulation','case_ref':body.case_ref,'event':body.event,'notice':'Approval logged. This does not execute external actions.'}
    @app.post('/api/sms/parse')
    def sms_parse(body:SMS,user=Depends(get_user)):
        s=body.message.strip(); m=re.match(r'^(RECV|SHORT|RECEIVED| कमी|KAM|कम|SHORTAGE)\s+([A-Za-z0-9_-]+)(?:\s+(\d+(?:\.\d+)?))?$',s,re.I)
        # Hindi/Kannada shorthand documented as supported command aliases; free text remains unparsed.
        aliases={'ಪಡೆ':'RECV','ಕಡಿಮೆ':'SHORT','प्राप्त':'RECV','कम':'SHORT'}
        if not m:
            for a,k in aliases.items():
                if s.startswith(a+' '): s=k+s[len(a):]; break
            m=re.match(r'^(RECV|SHORT|RECEIVED|KAM|कम|SHORTAGE)\s+([A-Za-z0-9_-]+)(?:\s+(\d+(?:\.\d+)?))?$',s,re.I)
        if not m: return {'parsed':False,'message':'Use RECV C-101 35 or SHORT C-101; Kannada/Hindi command aliases supported. Free-text natural language is not reliably parsed.'}
        cmd,ref,qty=m.group(1).upper(),m.group(2),m.group(3); action='receipt' if cmd in {'RECV','RECEIVED','ಪಡೆ','प्राप्त'} else 'shortage_report'
        payload={'action':action,'case_or_delivery_ref':ref,'quantity':float(qty) if qty else None,'original_message':body.message,'language':'command alias / English'}
        event(user['id'],'SMS_SIMULATOR',ref,payload); return {'parsed':True,**payload,'status':'simulation_only'}
    @app.post('/api/district/transitions')
    def transition(body:Transition,user=Depends(get_user)):
        if not body.opt_in: raise HTTPException(400,'Explicit opt-in is required for transition tracking')
        with db() as c: c.execute('INSERT INTO transitions(owner_id,case_ref,from_program,to_program,opt_in,notes,created_at) VALUES(?,?,?,?,?,?,?)',(user['id'],body.case_ref,body.from_program,body.to_program,1,body.notes,utcnow())); c.commit()
        event(user['id'],'PROGRAM_TRANSITION',body.case_ref,body.model_dump()); return {'status':'recorded','transition':'Food → Jobs → Education pathways are opt-in and tracking is not automatic.'}
    @app.get('/api/export-brief')
    def export_brief(format:str='csv',user=Depends(get_user)):
        if format not in {'csv','pdf'}: raise HTTPException(422,'format must be csv or pdf')
        with db() as c:
            cases=[dict(r) for r in c.execute('SELECT * FROM district_cases WHERE owner_id=?',(user['id'],))]
            deliveries=[dict(r) for r in c.execute('SELECT * FROM district_deliveries WHERE owner_id=?',(user['id'],))]
        verification=ledger.verify(); data={'cases':cases,'deliveries':deliveries,'audit_verification':verification,'created_at':utcnow(),'classification':'operational records; not impact evidence'}
        if format=='csv':
            out=io.StringIO(); w=csv.writer(out); w.writerow(['record_type','record_id','reference','details']);
            for x in cases:w.writerow(['case',x['id'],x['case_ref'],canonical(x)])
            for x in deliveries:w.writerow(['delivery',x['id'],x['match_id'],canonical(x)])
            w.writerow(['audit_verification','','',canonical(verification)]); return StreamingResponse(iter([out.getvalue()]),media_type='text/csv',headers={'Content-Disposition':'attachment; filename=humanie-brief.csv'})
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table
            from reportlab.lib.styles import getSampleStyleSheet
            out=io.BytesIO(); doc=SimpleDocTemplate(out,pagesize=letter); st=getSampleStyleSheet(); story=[Paragraph('HUMANIE Operational Brief',st['Title']),Paragraph(f"Generated {data['created_at']}",st['Normal']),Paragraph(f"Audit integrity: {verification}",st['Normal']),Spacer(1,12),Paragraph('Cases',st['Heading2']),Table([['Ref','District','Locality','Need','Demand','Vulnerability']]+[[x['case_ref'],x['district'],x['locality'],x['need_type'],x['demand_units'],x['vulnerability']] for x in cases])]
            doc.build(story); out.seek(0); return StreamingResponse(out,media_type='application/pdf',headers={'Content-Disposition':'attachment; filename=humanie-brief.pdf'})
        except ImportError: raise HTTPException(501,'PDF export requires reportlab; CSV is available.')
    @app.get('/api/crisis/events')
    def crisis_events(user=Depends(get_user),since:int=0):
        with db() as c: rows=[dict(r) for r in c.execute('SELECT id,event_type,payload,created_at FROM phase2_events WHERE owner_id=? AND id>? ORDER BY id',(user['id'],since))]
        return [{'id':r['id'],'event_type':r['event_type'],'payload':json.loads(r['payload']),'created_at':r['created_at']} for r in rows]

