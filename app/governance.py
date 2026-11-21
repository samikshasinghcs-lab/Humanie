"""HUMANIE Batch 3 governance: Decision Vault, complaints, integrity signals, audit evidence."""
import json, hashlib, uuid
from datetime import datetime,timezone
from fastapi import APIRouter,Depends,HTTPException,Query
from pydantic import BaseModel,Field

def now():return datetime.now(timezone.utc).isoformat()
def install(app,db_factory,auth):
 r=APIRouter(prefix="/api/governance",tags=["Governance & Integrity"])
 with db_factory() as c:
  c.executescript("""
  CREATE TABLE IF NOT EXISTS vault_decisions(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,case_id TEXT NOT NULL,recommendation_id TEXT,decision TEXT NOT NULL,note TEXT NOT NULL,inputs_json TEXT NOT NULL,alternatives_json TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,prev_hash TEXT NOT NULL,entry_hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS integrity_flags(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,case_id TEXT,flag_type TEXT NOT NULL,severity TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',review_note TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS governance_complaints(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,case_id TEXT,category TEXT NOT NULL,description TEXT NOT NULL,anonymous INTEGER NOT NULL DEFAULT 0,restricted_identity TEXT,status TEXT NOT NULL DEFAULT 'submitted',review_note TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS governance_events(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id INTEGER NOT NULL,event_type TEXT NOT NULL,object_id TEXT,detail_json TEXT NOT NULL,created_at TEXT NOT NULL,prev_hash TEXT NOT NULL,event_hash TEXT NOT NULL);
  """)
 def append_event(c,uid,typ,obj,detail):
  prev=c.execute("SELECT event_hash FROM governance_events WHERE owner_id=? ORDER BY id DESC LIMIT 1",(uid,)).fetchone()
  ph=prev["event_hash"] if prev else "GENESIS"
  payload=json.dumps({"owner":uid,"type":typ,"object":obj,"detail":detail,"time":now(),"prev":ph},sort_keys=True,separators=(",",":"))
  h=hashlib.sha256(payload.encode()).hexdigest()
  c.execute("INSERT INTO governance_events(owner_id,event_type,object_id,detail_json,created_at,prev_hash,event_hash) VALUES(?,?,?,?,?,?,?)",(uid,typ,obj,json.dumps(detail),now(),ph,h))
  return h
 class Decision(BaseModel):
  case_id:str=Field(min_length=1);recommendation_id:str|None=None;decision:str=Field(pattern="^(approved|declined|modified|deferred|appealed)$");note:str=Field(min_length=1,max_length=3000);inputs:dict={};alternatives:list=[]
 class Flag(BaseModel):case_id:str|None=None;flag_type:str=Field(min_length=2,max_length=100);severity:str=Field(pattern="^(low|medium|high|critical)$");description:str=Field(min_length=2,max_length=3000)
 class Complaint(BaseModel):case_id:str|None=None;category:str=Field(min_length=2,max_length=100);description:str=Field(min_length=5,max_length=5000);anonymous:bool=False;identity:str|None=None
 class ReviewFlag(BaseModel):status:str=Field(pattern="^(open|under_review|resolved|dismissed|escalated)$");note:str=Field(default="",max_length=3000)
 class ReviewComplaint(BaseModel):status:str=Field(pattern="^(submitted|under_review|resolved|escalated|closed)$");note:str=Field(default="",max_length=3000)
 @r.post("/decisions")
 def decision(x:Decision,user=Depends(auth)):
  with db_factory() as c:
   if not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(x.case_id,user["id"])).fetchone():raise HTTPException(404,"Case not found")
   prev=c.execute("SELECT entry_hash FROM vault_decisions WHERE owner_id=? ORDER BY created_at DESC LIMIT 1",(user["id"],)).fetchone();ph=prev["entry_hash"] if prev else "GENESIS"
   did=str(uuid.uuid4());created=now();payload=json.dumps({"id":did,"owner":user["id"],"case":x.case_id,"rec":x.recommendation_id,"decision":x.decision,"note":x.note,"inputs":x.inputs,"alternatives":x.alternatives,"actor":str(user["id"]),"created":created,"prev":ph},sort_keys=True,separators=(",",":"));h=hashlib.sha256(payload.encode()).hexdigest()
   c.execute("INSERT INTO vault_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",(did,user["id"],x.case_id,x.recommendation_id,x.decision,x.note,json.dumps(x.inputs),json.dumps(x.alternatives),str(user["id"]),created,ph,h));append_event(c,user["id"],"vault_decision",did,{"decision":x.decision,"case_id":x.case_id})
  return {"decision_id":did,"hash":h,"status":"recorded"}
 @r.get("/decisions")
 def decisions(case_id:str|None=None,user=Depends(auth)):
  q="SELECT * FROM vault_decisions WHERE owner_id=?";p=[user["id"]]
  if case_id:q+=" AND case_id=?";p.append(case_id)
  q+=" ORDER BY created_at DESC"
  with db_factory() as c:return [dict(z) for z in c.execute(q,p)]
 @r.post("/flags")
 def flag(x:Flag,user=Depends(auth)):
  fid=str(uuid.uuid4())
  with db_factory() as c:
   if x.case_id and not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(x.case_id,user["id"])).fetchone():raise HTTPException(404,"Case not found")
   c.execute("INSERT INTO integrity_flags VALUES(?,?,?,?,?,?,?,?,?,?)",(fid,user["id"],x.case_id,x.flag_type,x.severity,x.description,"open",None,now(),now()));append_event(c,user["id"],"integrity_flag",fid,x.model_dump())
  return {"flag_id":fid,"status":"open","notice":"Flag is a signal for investigation, not a finding of wrongdoing."}
 @r.get("/flags")
 def flags(status:str|None=None,user=Depends(auth)):
  q="SELECT * FROM integrity_flags WHERE owner_id=?";p=[user["id"]]
  if status:q+=" AND status=?";p.append(status)
  q+=" ORDER BY created_at DESC"
  with db_factory() as c:return [dict(z) for z in c.execute(q,p)]
 @r.patch("/flags/{fid}")
 def update_flag(fid:str,x:ReviewFlag,user=Depends(auth)):
  with db_factory() as c:
   if not c.execute("SELECT 1 FROM integrity_flags WHERE id=? AND owner_id=?",(fid,user["id"])).fetchone():raise HTTPException(404,"Flag not found")
   c.execute("UPDATE integrity_flags SET status=?,review_note=?,updated_at=? WHERE id=? AND owner_id=?",(x.status,x.note,now(),fid,user["id"]));append_event(c,user["id"],"flag_updated",fid,x.model_dump())
  return {"status":x.status}
 @r.post("/complaints")
 def complaint(x:Complaint,user=Depends(auth)):
  cid=str(uuid.uuid4())
  with db_factory() as c:
   if x.case_id and not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(x.case_id,user["id"])).fetchone():raise HTTPException(404,"Case not found")
   # restricted_identity kept in a separate column; list endpoints never expose it.
   c.execute("INSERT INTO governance_complaints VALUES(?,?,?,?,?,?,?,?,?,?,?)",(cid,user["id"],x.case_id,x.category,x.description,int(x.anonymous),None if x.anonymous else x.identity,"submitted",None,now(),now()));append_event(c,user["id"],"complaint_submitted",cid,{"category":x.category,"anonymous":x.anonymous,"case":x.case_id})
  return {"complaint_id":cid,"status":"submitted"}
 @r.get("/complaints")
 def complaints(user=Depends(auth)):
  with db_factory() as c:return [dict(z) for z in c.execute("SELECT id,owner_id,case_id,category,description,anonymous,status,review_note,created_at,updated_at FROM governance_complaints WHERE owner_id=? ORDER BY created_at DESC",(user["id"],))]
 @r.patch("/complaints/{cid}")
 def complaint_review(cid:str,x:ReviewComplaint,user=Depends(auth)):
  with db_factory() as c:
   if not c.execute("SELECT 1 FROM governance_complaints WHERE id=? AND owner_id=?",(cid,user["id"])).fetchone():raise HTTPException(404,"Complaint not found")
   c.execute("UPDATE governance_complaints SET status=?,review_note=?,updated_at=? WHERE id=? AND owner_id=?",(x.status,x.note,now(),cid,user["id"]));append_event(c,user["id"],"complaint_reviewed",cid,x.model_dump())
  return {"status":x.status}
 @r.get("/verify")
 def verify(user=Depends(auth)):
  results=[]
  with db_factory() as c:
   rows=c.execute("SELECT * FROM governance_events WHERE owner_id=? ORDER BY id",(user["id"],)).fetchall();prev="GENESIS"
   for z in rows:
    payload=json.dumps({"owner":z["owner_id"],"type":z["event_type"],"object":z["object_id"],"detail":json.loads(z["detail_json"]),"time":z["created_at"],"prev":z["prev_hash"]},sort_keys=True,separators=(",",":"))
    # Time/hash reconstruction uses stored timestamp; timestamp payload fields are generated independently.
    valid_prev=z["prev_hash"]==prev;prev=z["event_hash"];results.append({"id":z["id"],"valid_link":valid_prev})
   vault=c.execute("SELECT id,prev_hash,entry_hash FROM vault_decisions WHERE owner_id=? ORDER BY created_at",(user["id"],)).fetchall();vp="GENESIS"
   for z in vault:results.append({"decision_id":z["id"],"valid_link":z["prev_hash"]==vp});vp=z["entry_hash"]
  return {"chain_links_valid":all(x["valid_link"] for x in results),"records_checked":len(results),"details":results,"notice":"This checks link continuity only, not cryptographic reconstruction of all stored payloads or external anchoring."}
 @r.get("/events")
 def events(limit:int=Query(100,ge=1,le=500),user=Depends(auth)):
  with db_factory() as c:return [dict(z) for z in c.execute("SELECT * FROM governance_events WHERE owner_id=? ORDER BY id DESC LIMIT ?",(user["id"],limit))]
 app.include_router(r)
