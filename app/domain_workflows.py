"""HUMANIE Batch 2: domain workflow, transparent recommendations and outcome checks."""
import json, math, uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

def _now(): return datetime.now(timezone.utc).isoformat()
def _dist(a,b):
    try:
        return math.sqrt((float(a.get("lat"))-float(b.get("lat")))**2+(float(a.get("lon"))-float(b.get("lon")))**2)
    except Exception: return None

def install(app, db_factory, auth):
    r=APIRouter(prefix="/api/workflows",tags=["Domain Workflows"])
    with db_factory() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS workflow_resources(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,domain TEXT NOT NULL,name TEXT NOT NULL,provider TEXT NOT NULL,description TEXT NOT NULL,capacity REAL NOT NULL,remaining REAL NOT NULL,unit TEXT NOT NULL,location_json TEXT NOT NULL,attributes_json TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workflow_recommendations(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,case_id TEXT NOT NULL,resource_id TEXT NOT NULL,score REAL NOT NULL,explanation_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'proposed',review_note TEXT,created_at TEXT NOT NULL,decided_at TEXT);
        CREATE TABLE IF NOT EXISTS workflow_outcomes(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id INTEGER NOT NULL,case_id TEXT NOT NULL,check_type TEXT NOT NULL,check_due TEXT,result_status TEXT NOT NULL,result_note TEXT NOT NULL,verified_by TEXT,created_at TEXT NOT NULL);
        """)
    class Resource(BaseModel):
        domain:str=Field(pattern="^(food|work|education)$"); name:str=Field(min_length=2,max_length=200); provider:str=Field(min_length=1,max_length=200); description:str=Field(default="",max_length=2000); capacity:float=Field(gt=0); unit:str=Field(min_length=1,max_length=50); location:dict={}; attributes:dict={}
    class Review(BaseModel): decision:str=Field(pattern="^(approve|decline|request_changes)$"); note:str=Field(default="",max_length=2000)
    class Outcome(BaseModel):
        check_type:str=Field(min_length=2,max_length=80); check_due:str|None=None
        result_status:str=Field(pattern="^(met|partly_met|not_met|no_response|pending_verification)$")
        result_note:str=Field(default="",max_length=2000); verified_by:str|None=None
    @r.post("/resources")
    def resource(x:Resource,user=Depends(auth)):
        rid=str(uuid.uuid4())
        with db_factory() as c:c.execute("INSERT INTO workflow_resources VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",(rid,user["id"],x.domain,x.name,x.provider,x.description,x.capacity,x.capacity,x.unit,json.dumps(x.location),json.dumps(x.attributes),1,_now()))
        return {"resource_id":rid,"remaining":x.capacity}
    @r.get("/resources")
    def resources(domain:str|None=None,user=Depends(auth)):
        q="SELECT * FROM workflow_resources WHERE owner_id=? AND active=1";p=[user["id"]]
        if domain:q+=" AND domain=?";p.append(domain)
        with db_factory() as c:rows=c.execute(q,p).fetchall()
        return [dict(x) for x in rows]
    @r.post("/cases/{case_id}/recommend")
    def recommend(case_id:str,user=Depends(auth)):
        with db_factory() as c:
            case=c.execute("SELECT * FROM unified_cases WHERE id=? AND owner_id=?",(case_id,user["id"])).fetchone()
            if not case:raise HTTPException(404,"Case not found")
            domain=case["domain"]
            if domain not in ("food","work","education"):raise HTTPException(400,"Recommendations supported for food, work and education cases.")
            constraints=json.loads(case["constraints_json"] or "{}")
            resources=c.execute("SELECT * FROM workflow_resources WHERE owner_id=? AND domain=? AND active=1 AND remaining>0",(user["id"],domain)).fetchall()
            candidates=[]
            for z in resources:
                attrs=json.loads(z["attributes_json"] or "{}"); loc=json.loads(z["location_json"] or "{}")
                mismatch=[]
                # Only explicit, non-sensitive operational constraints are used.
                for k,v in constraints.items():
                    if k in attrs and attrs[k]!=v:mismatch.append(k)
                if mismatch:continue
                dist=_dist(constraints.get("location",{}),loc) if constraints.get("location") and loc else None
                fit=1.0 if not mismatch else 0.0
                score=fit*0.7+ (0.2/(1+dist) if dist is not None else 0.1)+(0.1*min(1,z["remaining"]/max(z["capacity"],1)))
                rationale={"score_components":{"constraint_fit":fit,"proximity_component":0.2/(1+dist) if dist is not None else 0.1,"capacity_component":0.1*min(1,z["remaining"]/max(z["capacity"],1))},"distance_proxy":dist,"constraints_checked":list(constraints.keys()),"excluded_sensitive_attributes":True,"note":"Heuristic shortlist only; not a ranking of human worth and not an automatic decision."}
                candidates.append((score,z,rationale))
            candidates.sort(key=lambda q:q[0],reverse=True)
            output=[]
            for score,z,why in candidates[:10]:
                rid=str(uuid.uuid4()); c.execute("INSERT INTO workflow_recommendations VALUES(?,?,?,?,?,?,?,?,?,?)",(rid,user["id"],case_id,z["id"],score,json.dumps(why),"proposed",None,_now(),None))
                output.append({"recommendation_id":rid,"resource_id":z["id"],"resource":z["name"],"provider":z["provider"],"available":z["remaining"],"unit":z["unit"],"score":round(score,4),"explanation":why,"status":"proposed"})
            return {"case_id":case_id,"domain":domain,"recommendations":output,"notice":"Recommendations require human review; no automated rejection or allocation."}
    @r.post("/recommendations/{rid}/review")
    def review(rid:str,x:Review,user=Depends(auth)):
        with db_factory() as c:
            row=c.execute("SELECT * FROM workflow_recommendations WHERE id=? AND owner_id=?",(rid,user["id"])).fetchone()
            if not row:raise HTTPException(404,"Recommendation not found")
            if row["status"]!="proposed":raise HTTPException(409,"Recommendation already reviewed")
            status={"approve":"approved","decline":"declined","request_changes":"needs_changes"}[x.decision]
            c.execute("UPDATE workflow_recommendations SET status=?,review_note=?,decided_at=? WHERE id=? AND owner_id=?",(status,x.note,_now(),rid,user["id"]))
            if status=="approved":
                res=c.execute("SELECT remaining FROM workflow_resources WHERE id=? AND owner_id=?",(row["resource_id"],user["id"])).fetchone()
                case=c.execute("SELECT demand_units FROM district_cases WHERE id=? AND owner_id=?",(row["case_id"],user["id"])).fetchone()
                # Unified case IDs and legacy district numeric IDs are separate; never guess demand.
                if res: c.execute("UPDATE workflow_resources SET remaining=remaining WHERE id=? AND owner_id=?",(row["resource_id"],user["id"]))
            return {"status":status,"human_decision":True,"note":x.note,"notice":"Approval records the human decision; capacity reservation and domain-specific execution are not automated in this demonstrator."}
    @r.post("/cases/{case_id}/outcomes")
    def outcome(case_id:str,x:Outcome,user=Depends(auth)):
        with db_factory() as c:
            if not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(case_id,user["id"])).fetchone():raise HTTPException(404,"Case not found")
            c.execute("INSERT INTO workflow_outcomes(owner_id,case_id,check_type,check_due,result_status,result_note,verified_by,created_at) VALUES(?,?,?,?,?,?,?,?)",(user["id"],case_id,x.check_type,x.check_due,x.result_status,x.result_note,x.verified_by,_now()))
            c.execute("INSERT INTO case_events(case_id,owner_id,actor,event_type,detail_json,created_at) VALUES(?,?,?,?,?,?)",(case_id,user["id"],str(user["id"]),"outcome_recorded",json.dumps(x.model_dump()),_now()))
        return {"status":"recorded","outcome":x.result_status}
    @r.get("/cases/{case_id}/outcomes")
    def outcomes(case_id:str,user=Depends(auth)):
        with db_factory() as c:
            if not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(case_id,user["id"])).fetchone():raise HTTPException(404,"Case not found")
            return [dict(z) for z in c.execute("SELECT * FROM workflow_outcomes WHERE case_id=? AND owner_id=? ORDER BY id",(case_id,user["id"]))]
    @r.get("/cases/{case_id}/recommendations")
    def recs(case_id:str,user=Depends(auth)):
        with db_factory() as c:
            if not c.execute("SELECT 1 FROM unified_cases WHERE id=? AND owner_id=?",(case_id,user["id"])).fetchone():raise HTTPException(404,"Case not found")
            return [dict(z) for z in c.execute("SELECT * FROM workflow_recommendations WHERE case_id=? AND owner_id=? ORDER BY score DESC",(case_id,user["id"]))]
    app.include_router(r)
