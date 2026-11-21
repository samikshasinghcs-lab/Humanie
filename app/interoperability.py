"""Batch 4: country packs, interoperability utilities, operational readiness and hardening."""
import json,uuid,hashlib
from datetime import datetime,timezone
from fastapi import APIRouter,Depends,HTTPException,Query
from pydantic import BaseModel,Field
def _time():return datetime.now(timezone.utc).isoformat()
PACKS={
 "IN-KA":{"name":"Karnataka, India","currency":"INR","timezone":"Asia/Kolkata","languages":["en","hi","kn"],"units":["kg","meal","kit","seat","person"],"disclaimer":"Starter configuration; local legal, privacy, safeguarding and language review required."},
 "IN":{"name":"India","currency":"INR","timezone":"Asia/Kolkata","languages":["en","hi"],"units":["kg","meal","kit","seat","person"],"disclaimer":"Starter configuration; local legal, privacy, safeguarding and language review required."},
 "GLOBAL":{"name":"Generic global pack","currency":None,"timezone":"UTC","languages":["en"],"units":["kg","meal","kit","seat","person"],"disclaimer":"Generic fallback; local validation required."}}
def install(app,db_factory,auth):
 r=APIRouter(prefix="/api/v1",tags=["Interoperability & Resilience"])
 with db_factory() as c:
  c.executescript("""
  CREATE TABLE IF NOT EXISTS country_pack_settings(owner_id INTEGER NOT NULL,pack_code TEXT NOT NULL,overrides_json TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,pack_code));
  CREATE TABLE IF NOT EXISTS partner_imports(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,source_label TEXT NOT NULL,records_count INTEGER NOT NULL,created_at TEXT NOT NULL,summary_json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS hardening_events(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id INTEGER NOT NULL,event_type TEXT NOT NULL,created_at TEXT NOT NULL,detail_json TEXT NOT NULL);
  """)
 class Pack(BaseModel):pack_code:str=Field(min_length=2,max_length=20);overrides:dict={}
 class ImportCases(BaseModel):source_label:str=Field(min_length=1,max_length=100);cases:list[dict]=Field(min_length=1,max_length=250)
 @r.get("/country-packs")
 def listpacks():return PACKS
 @r.get("/country-pack")
 def activepack(user=Depends(auth)):
  with db_factory() as c:
   z=c.execute("SELECT * FROM country_pack_settings WHERE owner_id=? ORDER BY updated_at DESC LIMIT 1",(user["id"],)).fetchone()
   if not z:return PACKS["GLOBAL"]
   base=PACKS.get(z["pack_code"],PACKS["GLOBAL"]);return {**base,**json.loads(z["overrides_json"]),"pack_code":z["pack_code"]}
 @r.put("/country-pack")
 def setpack(x:Pack,user=Depends(auth)):
  if x.pack_code not in PACKS:raise HTTPException(400,"Unknown pack; select from /country-packs")
  with db_factory() as c:
   c.execute("INSERT INTO country_pack_settings VALUES(?,?,?,?) ON CONFLICT(owner_id,pack_code) DO UPDATE SET overrides_json=excluded.overrides_json,updated_at=excluded.updated_at",(user["id"],x.pack_code,json.dumps(x.overrides),_time()))
   c.execute("INSERT INTO hardening_events(owner_id,event_type,created_at,detail_json) VALUES(?,?,?,?)",(user["id"],"country_pack_set",_time(),json.dumps({"pack_code":x.pack_code})))
  return {"status":"updated","pack_code":x.pack_code}
 @r.get("/cases/export")
 def export_cases(format:str=Query("json",pattern="^(json|csv)$"),user=Depends(auth)):
  with db_factory() as c:
   rows=[dict(z) for z in c.execute("SELECT id,domain,description,district,locality,status,demand_units,created_at,updated_at FROM unified_cases WHERE owner_id=? ORDER BY created_at",(user["id"],))]
  # JSON export; CSV payload is deliberately returned as row-based data for client-side serialization.
  return {"format":format,"records":rows,"count":len(rows),"notice":"Export omits contact/identity fields and attached evidence. Check destination security before sharing."}
 @r.post("/partner-import")
 def import_cases(x:ImportCases,user=Depends(auth)):
  accepted=[];rejected=[]
  for i,item in enumerate(x.cases):
   domain=str(item.get("domain","")).lower();description=str(item.get("description","")).strip()
   if domain not in ("food","work","education") or not description or len(description)>4000:rejected.append({"index":i,"reason":"Invalid domain or description"});continue
   # Import is staged as an intake record, not an auto-approved beneficiary case.
   accepted.append({"external_ref":str(item.get("external_ref",""))[:100],"domain":domain,"description":description,"district":str(item.get("district",""))[:100],"locality":str(item.get("locality",""))[:100],"demand_units":max(0,min(int(item.get("demand_units",1)),10000))})
  iid=str(uuid.uuid4())
  with db_factory() as c:
   c.execute("INSERT INTO partner_imports VALUES(?,?,?,?,?,?)",(iid,user["id"],x.source_label,len(accepted),_time(),json.dumps({"accepted":accepted,"rejected":rejected})))
   c.execute("INSERT INTO hardening_events(owner_id,event_type,created_at,detail_json) VALUES(?,?,?,?)",(user["id"],"partner_import_staged",_time(),json.dumps({"import_id":iid,"accepted":len(accepted),"rejected":len(rejected)})))
  return {"import_id":iid,"accepted":len(accepted),"rejected":rejected,"notice":"Staged only. Review and individually create cases; no automated enrollment or allocation."}
 @r.get("/partner-imports")
 def imports(user=Depends(auth)):
  with db_factory() as c:return [dict(z) for z in c.execute("SELECT id,source_label,records_count,created_at FROM partner_imports WHERE owner_id=? ORDER BY created_at DESC",(user["id"],))]
 @r.get("/readiness")
 def readiness(user=Depends(auth)):
  checks=[]
  with db_factory() as c:
   for table in ("unified_cases","case_events","workflow_resources","workflow_recommendations","workflow_outcomes","vault_decisions","integrity_flags","governance_complaints"):
    try:c.execute("SELECT 1 FROM "+table+" LIMIT 1");checks.append({"component":table,"schema_access":"ok"})
    except Exception:checks.append({"component":table,"schema_access":"unavailable"})
  return {"status":"diagnostic","checks":checks,"limits":["No live external integration check","No security penetration test","No multi-tenant isolation audit","No backup restoration test","No accessibility audit"],"notice":"Diagnostic endpoint checks table access only; it is not a production certification."}
 app.include_router(r)
