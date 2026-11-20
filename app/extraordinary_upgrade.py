"""HUMANIE v1.0 governance and allocation upgrade primitives.

Integrate these primitives into authenticated FastAPI routes; never trust actor roles
or IDs supplied by the client. SQLite ledger uses transactions and hash chaining.
"""
from __future__ import annotations
import hashlib, json, random, sqlite3
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Any
try:
    from scipy.optimize import linprog
except ImportError:
    linprog = None

GENESIS = "GENESIS_HUMANIE_V1"
def now(): return datetime.now(timezone.utc).isoformat()
def canon(x): return json.dumps(x,sort_keys=True,separators=(",",":"),ensure_ascii=False)

class AuditLedger:
    def __init__(self,path="data/humanie_audit.db"):
        self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as c:
            c.execute("""CREATE TABLE IF NOT EXISTS audit_chain(
            seq INTEGER PRIMARY KEY, ts TEXT NOT NULL, kind TEXT NOT NULL, case_id TEXT NOT NULL,
            actor_id TEXT NOT NULL, role TEXT NOT NULL, details TEXT NOT NULL,
            prev_hash TEXT NOT NULL, hash TEXT NOT NULL)""")
    def connect(self):
        c=sqlite3.connect(self.path,timeout=30); c.row_factory=sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL"); c.execute("PRAGMA busy_timeout=30000")
        return c
    @staticmethod
    def digest(row):
        raw="|".join(str(row[k]) for k in ("seq","ts","kind","case_id","actor_id","role","details","prev_hash"))
        return hashlib.sha256(raw.encode()).hexdigest()
    def append(self,kind,case_id,actor_id,role,details):
        # BEGIN IMMEDIATE serializes writers before reading the chain tip.
        with self.connect() as c:
            c.execute("BEGIN IMMEDIATE")
            tip=c.execute("SELECT seq,hash FROM audit_chain ORDER BY seq DESC LIMIT 1").fetchone()
            seq=1 if tip is None else tip["seq"]+1; prev=GENESIS if tip is None else tip["hash"]
            row={"seq":seq,"ts":now(),"kind":kind,"case_id":case_id,"actor_id":actor_id,
                 "role":role,"details":canon(details),"prev_hash":prev}
            h=self.digest(row)
            c.execute("INSERT INTO audit_chain VALUES(?,?,?,?,?,?,?,?,?)",
                (seq,row["ts"],kind,case_id,actor_id,role,row["details"],prev,h))
            c.commit()
            row["hash"]=h; row["details"]=details
            return row
    def verify(self):
        with self.connect() as c: rows=c.execute("SELECT * FROM audit_chain ORDER BY seq").fetchall()
        prev=GENESIS
        for r in rows:
            d=dict(r)
            if d["prev_hash"]!=prev: return {"valid":False,"failed_seq":d["seq"],"reason":"chain link mismatch"}
            if self.digest(d)!=d["hash"]: return {"valid":False,"failed_seq":d["seq"],"reason":"entry digest mismatch"}
            prev=d["hash"]
        return {"valid":True,"records":len(rows),"tip_hash":prev}
    def events(self,case_id):
        with self.connect() as c: return [dict(r) for r in c.execute("SELECT * FROM audit_chain WHERE case_id=? ORDER BY seq",(case_id,))]

class Governance:
    """Persisted review state; caller must supply authenticated identity/role."""
    def __init__(self,ledger):
        self.ledger=ledger
        with ledger.connect() as c:
            c.execute("""CREATE TABLE IF NOT EXISTS case_reviews(
            case_id TEXT PRIMARY KEY, reviewer_id TEXT NOT NULL, notes TEXT NOT NULL, reviewed_at TEXT NOT NULL)""")
    def review(self,case_id,reviewer_id,role,notes):
        if role.lower() not in {"reviewer","district_reviewer"}: raise PermissionError("Reviewer role required")
        if not notes.strip(): raise ValueError("Review notes required")
        with self.ledger.connect() as c:
            c.execute("BEGIN IMMEDIATE")
            c.execute("INSERT OR REPLACE INTO case_reviews VALUES(?,?,?,?)",(case_id,reviewer_id,notes.strip(),now()))
            c.commit()
        return self.ledger.append("CASE_REVIEWED",case_id,reviewer_id,role,{"notes":notes.strip()})
    def decide(self,case_id,approver_id,role,decision,provider_id,units,reason):
        if role.lower() not in {"approver","district_approver","lead_approver"}: raise PermissionError("Approver role required")
        if decision.lower() not in {"approve","reject"}: raise ValueError("Decision must be approve or reject")
        if not reason.strip(): raise ValueError("Decision rationale required")
        with self.ledger.connect() as c:
            review=c.execute("SELECT reviewer_id,notes FROM case_reviews WHERE case_id=?",(case_id,)).fetchone()
        if review is None: raise PermissionError("Case must be reviewed first")
        if review["reviewer_id"]==approver_id: raise PermissionError("Reviewer and approver must be different people")
        return self.ledger.append("ALLOCATION_"+decision.upper(),case_id,approver_id,role,
          {"reviewer_id":review["reviewer_id"],"provider_id":provider_id,"units":units,"reason":reason.strip()})

@dataclass
class Community:
    name:str
    demand:float
    vulnerability:float
    transport_cost:float

def _floor_feasible(nodes,stock,budget,floor):
    if floor<0 or floor>1: return False
    if sum(floor*n.demand for n in nodes)>stock+1e-8: return False
    if sum(floor*n.demand*n.transport_cost for n in nodes)>budget+1e-8: return False
    return True

def allocation(nodes,stock,budget,floor):
    if not nodes or any(n.demand<=0 or n.transport_cost<0 for n in nodes):
        return {"feasible":False,"error":"Demand must be positive and transport costs non-negative."}
    if floor<0 or floor>1: return {"feasible":False,"error":"floor must be within [0,1]"}
    total=sum(n.demand for n in nodes); costs=[n.transport_cost for n in nodes]
    weights=[max(0,n.vulnerability) for n in nodes]; wsum=sum(weights) or len(nodes)
    weights=[w/wsum if wsum else 1/len(nodes) for w in weights]
    base=[n.demand*min(1,stock/total) for n in nodes]
    base_cost=sum(a*n.transport_cost for a,n in zip(base,nodes))
    if base_cost>budget and base_cost>0: base=[a*budget/base_cost for a in base]
    baseline=sum(w*a/n.demand for w,a,n in zip(weights,base,nodes))*100
    feasible=_floor_feasible(nodes,stock,budget,floor)
    if not feasible:
        lo,hi=0.,1.
        for _ in range(60):
            mid=(lo+hi)/2
            if _floor_feasible(nodes,stock,budget,mid): lo=mid
            else: hi=mid
        required_stock=floor*total
        required_transport=floor*sum(n.demand*n.transport_cost for n in nodes)
        return {"feasible":False,"requested_floor_pct":round(floor*100,2),
          "highest_feasible_floor_pct":round(lo*100,2),
          "extra_stock_needed_for_requested_floor":round(max(0,required_stock-stock),2),
          "extra_transport_budget_needed":round(max(0,required_transport-budget),2),
          "baseline_weighted_coverage_pct":round(baseline,2)}
    if linprog:
        result=linprog([-w/n.demand for w,n in zip(weights,nodes)],
          A_ub=[[1]*len(nodes),costs],b_ub=[stock,budget],
          bounds=[(floor*n.demand,n.demand) for n in nodes],method="highs")
        if not result.success: return {"feasible":False,"solver_error":result.message}
        allocs=list(map(float,result.x)); solver="scipy-highs"
    else:
        allocs=[floor*n.demand for n in nodes]; rs=stock-sum(allocs)
        rb=budget-sum(a*n.transport_cost for a,n in zip(allocs,nodes))
        for i in sorted(range(len(nodes)),key=lambda i:weights[i]/max(nodes[i].transport_cost,1e-9),reverse=True):
            n=nodes[i]; add=min(n.demand-allocs[i],rs,rb/n.transport_cost if n.transport_cost else rs)
            add=max(0,add); allocs[i]+=add; rs-=add; rb-=add*n.transport_cost
        solver="greedy-fallback"
    cov=[100*a/n.demand for a,n in zip(allocs,nodes)]
    score=sum(w*a/n.demand for w,a,n in zip(weights,allocs,nodes))*100
    return {"feasible":True,"solver":solver,"floor_pct":floor*100,
      "weighted_coverage_pct":round(score,2),"baseline_weighted_coverage_pct":round(baseline,2),
      "lift_pp":round(score-baseline,2),"min_community_coverage_pct":round(min(cov),2),
      "stock_used":round(sum(allocs),2),"transport_used":round(sum(a*n.transport_cost for a,n in zip(allocs,nodes)),2),
      "communities":[{"name":n.name,"allocated":round(a,2),"demand":n.demand,"coverage_pct":round(c,2)}
      for n,a,c in zip(nodes,allocs,cov)]}

def sensitivity(candidates,weights,noise=.30,draws=200,seed=2026):
    if not candidates or draws<=0: return {"draws":draws,"stability_pct":0}
    rng=random.Random(seed)
    def score(c,w): return sum(w[k]*float(c.get(k,0)) for k in w)
    base=max(candidates,key=lambda c:score(c,weights))["id"]; count=0; wins={}
    for _ in range(draws):
        pert={k:max(0,v*(1+rng.uniform(-noise,noise))) for k,v in weights.items()}
        winner=max(candidates,key=lambda c:score(c,pert))["id"]; wins[winner]=wins.get(winner,0)+1
        count+=winner==base
    return {"draws":draws,"noise_band":f"+/-{int(noise*100)}%",
      "baseline_top_candidate":base,"top1_stability_pct":round(count/draws*100,2),
      "winner_frequency_pct":{k:round(v/draws*100,2) for k,v in wins.items()}}

if __name__=="__main__":
    ledger=AuditLedger("data/smoke_audit.db"); gov=Governance(ledger)
    gov.review("C-101","reviewer-1","reviewer","Need and provider stock verified.")
    gov.decide("C-101","approver-1","district_approver","approve","PROV-1",40,"Urgent need and local capacity.")
    print("audit",ledger.verify())
    nodes=[Community("North",300,.85,5),Community("South",250,.60,6.5),Community("East",200,.45,7)]
    print("30% floor",allocation(nodes,500,3100,.30))
    print("55% floor",allocation(nodes,500,3100,.55))
