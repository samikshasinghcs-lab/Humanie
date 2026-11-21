"""HUMANIE Batch 1: unified case infrastructure. SQLite-backed pilot module."""
import json, sqlite3, uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

def now(): return datetime.now(timezone.utc).isoformat()

def install(app, db_factory, auth):
    r=APIRouter(prefix="/api/cases", tags=["Unified Cases"])
    with db_factory() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS organisations(id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS unified_cases(id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL, organisation_id TEXT, domain TEXT NOT NULL, channel TEXT NOT NULL, beneficiary_ref TEXT, summary TEXT NOT NULL, urgency INTEGER NOT NULL, status TEXT NOT NULL, constraints_json TEXT NOT NULL, consent_json TEXT NOT NULL, assigned_to TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS case_events(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, owner_id INTEGER NOT NULL, actor TEXT NOT NULL, event_type TEXT NOT NULL, detail_json TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS case_assignments(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, owner_id INTEGER NOT NULL, assigned_to TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS case_followups(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, owner_id INTEGER NOT NULL, due_at TEXT, channel TEXT NOT NULL, status TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS case_evidence(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, owner_id INTEGER NOT NULL, evidence_type TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
        """)
    def event(c, uid, cid, typ, detail):
        c.execute("INSERT INTO case_events(case_id,owner_id,actor,event_type,detail_json,created_at) VALUES(?,?,?,?,?,?)",(cid,uid,str(uid),typ,json.dumps(detail),now()))
    class Intake(BaseModel):
        domain:str=Field(pattern="^(food|work|education|other)$")
        channel:str=Field(default="web",pattern="^(web|sms|whatsapp|phone|field|partner|api)$")
        beneficiary_ref:str|None=None
        summary:str=Field(min_length=3,max_length=2000)
        urgency:int=Field(default=1,ge=1,le=5)
        organisation_id:str|None=None
        constraints:dict={}
        consent:dict=Field(default_factory=lambda:{"participation":False,"sharing":False,"followup":False})
    class Assign(BaseModel): assigned_to:str=Field(min_length=1,max_length=100); role:str=Field(min_length=1,max_length=60)
    class Followup(BaseModel): due_at:str|None=None; channel:str=Field(default="web"); status:str=Field(default="pending"); result:str|None=None
    class Evidence(BaseModel): evidence_type:str=Field(min_length=1,max_length=60); note:str=Field(min_length=1,max_length=2000)
    @r.post("")
    def create(x:Intake,user=Depends(auth)):
        if not x.consent.get("participation",False): raise HTTPException(400,"Participation consent must be explicitly recorded before case creation.")
        cid=str(uuid.uuid4())
        with db_factory() as c:
            c.execute("INSERT INTO unified_cases VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(cid,user["id"],x.organisation_id,x.domain,x.channel,x.beneficiary_ref,x.summary,x.urgency,"received",json.dumps(x.constraints),json.dumps(x.consent),None,now(),now()))
            event(c,user["id"],cid,"created",{"domain":x.domain,"channel":x.channel})
        return {"case_id":cid,"status":"received"}
    @r.get("")
    def inbox(status:str|None=None,domain:str|None=None,search:str|None=None,limit:int=Query(100,ge=1,le=500),user=Depends(auth)):
        q="SELECT * FROM unified_cases WHERE owner_id=?"; p=[user["id"]]
        if status: q+=" AND status=?"; p.append(status)
        if domain: q+=" AND domain=?"; p.append(domain)
        if search: q+=" AND (summary LIKE ? OR beneficiary_ref LIKE ?)"; p.extend(["%"+search+"%"]*2)
        q+=" ORDER BY urgency DESC,created_at DESC LIMIT ?"; p.append(limit)
        with db_factory() as c: rows=c.execute(q,p).fetchall()
        return [dict(z) for z in rows]
    @r.get("/{cid}")
    def detail(cid,user=Depends(auth)):
        with db_factory() as c:
            row=c.execute("SELECT * FROM unified_cases WHERE id=? AND owner_id=?",(cid,user["id"])).fetchone()
            if not row: raise HTTPException(404,"Case not found")
            return {"case":dict(row),"events":[dict(x) for x in c.execute("SELECT * FROM case_events WHERE case_id=? AND owner_id=? ORDER BY id",(cid,user["id"]))],"assignments":[dict(x) for x in c.execute("SELECT * FROM case_assignments WHERE case_id=? AND owner_id=?",(cid,user["id"]))],"followups":[dict(x) for x in c.execute("SELECT * FROM case_followups WHERE case_id=? AND owner_id=?",(cid,user["id"]))],"evidence":[dict(x) for x in c.execute("SELECT * FROM case_evidence WHERE case_id=? AND owner_id=?",(cid,user["id"]))]}
    @r.post("/{cid}/assign")
    def assign(cid,x:Assign,user=Depends(auth)):
        with db_factory() as c:
            row=c.execute("SELECT id FROM unified_cases WHERE id=? AND owner_id=?",(cid,user["id"])).fetchone()
            if not row: raise HTTPException(404,"Case not found")
            c.execute("INSERT INTO case_assignments(case_id,owner_id,assigned_to,role,created_at) VALUES(?,?,?,?,?)",(cid,user["id"],x.assigned_to,x.role,now()))
            c.execute("UPDATE unified_cases SET assigned_to=?,status='assigned',updated_at=? WHERE id=? AND owner_id=?",(x.assigned_to,now(),cid,user["id"]))
            event(c,user["id"],cid,"assigned",x.model_dump())
        return {"status":"assigned"}
    @r.post("/{cid}/followups")
    def followup(cid,x:Followup,user=Depends(auth)):
        with db_factory() as c:
            if not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(cid,user["id"])).fetchone(): raise HTTPException(404,"Case not found")
            c.execute("INSERT INTO case_followups(case_id,owner_id,due_at,channel,status,result,created_at) VALUES(?,?,?,?,?,?,?)",(cid,user["id"],x.due_at,x.channel,x.status,x.result,now())); event(c,user["id"],cid,"followup_created",x.model_dump())
        return {"status":"created"}
    @r.post("/{cid}/evidence")
    def evidence(cid,x:Evidence,user=Depends(auth)):
        with db_factory() as c:
            if not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(cid,user["id"])).fetchone(): raise HTTPException(404,"Case not found")
            c.execute("INSERT INTO case_evidence(case_id,owner_id,evidence_type,note,created_at) VALUES(?,?,?,?,?)",(cid,user["id"],x.evidence_type,x.note,now())); event(c,user["id"],cid,"evidence_added",x.model_dump())
        return {"status":"recorded"}
    @r.patch("/{cid}/status")
    def status(cid,status:str=Query(...,pattern="^(received|assigned|in_review|approved|referred|delivered|enrolled|placed|closed|appeal|paused)$"),user=Depends(auth)):
        with db_factory() as c:
            if not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(cid,user["id"])).fetchone(): raise HTTPException(404,"Case not found")
            c.execute("UPDATE unified_cases SET status=?,updated_at=? WHERE id=? AND owner_id=?",(status,now(),cid,user["id"])); event(c,user["id"],cid,"status_changed",{"status":status})
        return {"status":status}
    app.include_router(r)
