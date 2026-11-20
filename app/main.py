from __future__ import annotations

import json
import os
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Request, Query
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from scipy.optimize import linprog
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STATIC = Path(__file__).resolve().parent / "static"
DB_PATH = Path(os.getenv("HUMANIE_DB_PATH", str(ROOT / "humanie.db")))
SECRET = os.getenv("HUMANIE_SECRET_KEY", "INSECURE-LOCAL-DEMO-ONLY-CHANGE-ME")
ALGORITHM = "HS256"
TOKEN_MINUTES = 60 * 8
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

app = FastAPI(title="HUMANIE Intelligence API", version="0.9.0")
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")

# Simple in-memory rate limiter for demo protection. Use a gateway/WAF in production.
RATE: dict[str, list[float]] = {}
def rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = [t for t in RATE.get(ip, []) if now - t < 60]
    if len(hits) >= 120:
        raise HTTPException(429, "Rate limit exceeded")
    hits.append(now)
    RATE[ip] = hits

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'self' https://cdn.plot.ly https://cdn.jsdelivr.net https://unpkg.com; script-src 'self' 'unsafe-inline' https://cdn.plot.ly https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self' https://api.worldbank.org"
    return response

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1)""")
        c.execute("""CREATE TABLE IF NOT EXISTS scenarios(
            id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL,
            created_at TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
            result TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))""")
        c.execute("""CREATE TABLE IF NOT EXISTS audit(
            id INTEGER PRIMARY KEY, user_id INTEGER, event TEXT NOT NULL,
            created_at TEXT NOT NULL, detail TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS district_cases(
            id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, case_ref TEXT NOT NULL,
            district TEXT NOT NULL, locality TEXT NOT NULL, need_type TEXT NOT NULL,
            urgency INTEGER NOT NULL, vulnerability INTEGER NOT NULL, demand_units REAL NOT NULL,
            category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            UNIQUE(owner_id,case_ref))""")
        c.execute("""CREATE TABLE IF NOT EXISTS district_resources(
            id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, resource_ref TEXT NOT NULL,
            district TEXT NOT NULL, locality TEXT NOT NULL, provider_type TEXT NOT NULL,
            resource_type TEXT NOT NULL, capacity REAL NOT NULL, remaining REAL NOT NULL,
            unit TEXT NOT NULL, cost_per_unit REAL NOT NULL DEFAULT 0,
            verified INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            UNIQUE(owner_id,resource_ref))""")
        c.execute("""CREATE TABLE IF NOT EXISTS district_matches(
            id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, case_id INTEGER NOT NULL,
            resource_id INTEGER NOT NULL, recommended_units REAL NOT NULL,
            score REAL NOT NULL, rationale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'recommended',
            created_at TEXT NOT NULL, decided_at TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS district_deliveries(
            id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, match_id INTEGER NOT NULL,
            dispatched_units REAL NOT NULL, received_units REAL, status TEXT NOT NULL,
            recipient_channel TEXT NOT NULL, evidence_note TEXT NOT NULL,
            dispatched_at TEXT NOT NULL, confirmed_at TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS district_complaints(
            id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, case_id INTEGER,
            category TEXT NOT NULL, description TEXT NOT NULL, severity TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open', resolution TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""")

def audit(user_id, event, detail=""):
    with db() as c:
        c.execute("INSERT INTO audit(user_id,event,created_at,detail) VALUES(?,?,?,?)",
                  (user_id, event, datetime.now(timezone.utc).isoformat(), detail[:500]))

def get_user(token: str = Depends(oauth2)):
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid or expired access token", headers={"WWW-Authenticate":"Bearer"})
    with db() as c:
        row = c.execute("SELECT id,email,is_active FROM users WHERE id=?", (uid,)).fetchone()
    if not row or not row["is_active"]:
        raise HTTPException(401, "User is inactive")
    return dict(row)

def issue_token(user_id: int):
    exp = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET, algorithm=ALGORITHM)

class Register(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=12, max_length=72)

class AllocationInput(BaseModel):
    available_stock: float = Field(gt=0, le=1_000_000)
    transport_budget: float = Field(gt=0, le=1_000_000_000)
    vulnerability_weight: float = Field(default=0.65, ge=0, le=1)
    distance_weight: float = Field(default=0.20, ge=0, le=1)
    demand_weight: float = Field(default=0.15, ge=0, le=1)

class OpportunityInput(BaseModel):
    training_slots: int = Field(ge=0, le=1_000_000)
    placement_support_slots: int = Field(ge=0, le=1_000_000)
    training_effect_assumption: float = Field(default=0.08, ge=0, le=0.5)
    placement_effect_assumption: float = Field(default=0.05, ge=0, le=0.5)
    cost_per_training_slot: float = Field(default=1000, ge=0)
    cost_per_placement_slot: float = Field(default=500, ge=0)

def require_real_data():
    path = DATA / "world_bank_country_year.csv"
    if not path.exists():
        raise HTTPException(409, "Public dataset not downloaded. Run: python scripts/fetch_world_bank.py")
    return pd.read_csv(path)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def home():
    return FileResponse(STATIC / "index.html")

@app.get("/api/health")
def health():
    return {"status":"ok","version":"0.9.0","secret_configured":SECRET != "INSECURE-LOCAL-DEMO-ONLY-CHANGE-ME"}

@app.post("/api/auth/register", dependencies=[Depends(rate_limit)])
def register(body: Register):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(422, "Enter a valid email address")
    if SECRET == "INSECURE-LOCAL-DEMO-ONLY-CHANGE-ME":
        # Registration is allowed locally but token secret must be changed before deployment.
        pass
    hashed = pwd_context.hash(body.password)
    try:
        with db() as c:
            cur = c.execute("INSERT INTO users(email,password_hash,created_at) VALUES(?,?,?)",
                            (email, hashed, datetime.now(timezone.utc).isoformat()))
            uid = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists")
    audit(uid, "register")
    return {"access_token": issue_token(uid), "token_type":"bearer"}

@app.post("/api/auth/token", dependencies=[Depends(rate_limit)])
def login(form: OAuth2PasswordRequestForm = Depends()):
    with db() as c:
        user = c.execute("SELECT * FROM users WHERE email=?", (form.username.strip().lower(),)).fetchone()
    if not user or not pwd_context.verify(form.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password", headers={"WWW-Authenticate":"Bearer"})
    audit(user["id"], "login")
    return {"access_token":issue_token(user["id"]), "token_type":"bearer"}

@app.get("/api/auth/me")
def me(user=Depends(get_user)):
    return {"id":user["id"],"email":user["email"]}

@app.get("/api/data/status")
def data_status(user=Depends(get_user)):
    path = DATA / "world_bank_country_year.csv"
    manifest = DATA / "data_manifest.json"
    if not path.exists():
        return {"available":False,"message":"Run scripts/fetch_world_bank.py"}
    df = pd.read_csv(path)
    return {"available":True,"rows":len(df),"countries":df.iso3.nunique(),
            "years":[int(df.year.min()),int(df.year.max())],
            "target_observations":int(df.undernourishment_pct.notna().sum()),
            "manifest":json.loads(manifest.read_text()) if manifest.exists() else {}}

@app.post("/api/data/refresh")
def refresh_data(user=Depends(get_user)):
    # Keep network ingestion in a separate auditable script; endpoint explains safe operation.
    import subprocess, sys
    result = subprocess.run([sys.executable, str(ROOT/"scripts"/"fetch_world_bank.py")],
                            capture_output=True, text=True, timeout=180)
    audit(user["id"], "data_refresh", result.stdout[-400:])
    if result.returncode:
        raise HTTPException(502, result.stderr[-1000:])
    return {"status":"refreshed","output":result.stdout[-2000:]}

@app.get("/api/data/countries")
def countries(user=Depends(get_user)):
    df = require_real_data()
    latest = df.dropna(subset=["undernourishment_pct"]).sort_values("year").groupby("iso3").tail(1)
    return {"source":"World Bank WDI; target source FAO","data":latest[["iso3","country","year","undernourishment_pct"]].to_dict("records")}

@app.post("/api/model/train")
def train_model(user=Depends(get_user)):
    df = require_real_data()
    # Lag features: only predictors observed in year t-1; target is PoU in year t.
    df = df.sort_values(["iso3","year"]).copy()
    for col in ["population","gdp_pc_ppp_2021","unemployment_pct"]:
        df[col+"_lag1"] = df.groupby("iso3")[col].shift(1)
    features = ["population_lag1","gdp_pc_ppp_2021_lag1","unemployment_pct_lag1"]
    model_df = df.dropna(subset=["undernourishment_pct"] + features).copy()
    if len(model_df) < 100:
        raise HTTPException(422, f"Not enough complete country-year rows for model training ({len(model_df)}).")
    # Chronological holdout: latest 20% of distinct years.
    years = sorted(model_df.year.unique())
    cutoff_index = max(1, int(len(years)*0.8))
    cutoff = years[cutoff_index]
    train = model_df[model_df.year < cutoff]
    test = model_df[model_df.year >= cutoff]
    if len(train)<50 or len(test)<10:
        raise HTTPException(422, "Insufficient train/test observations after chronological split.")
    pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", RandomForestRegressor(n_estimators=300, max_depth=6, min_samples_leaf=3,
                                        random_state=42, n_jobs=-1))
    ])
    pipe.fit(train[features], train["undernourishment_pct"])
    pred = np.clip(pipe.predict(test[features]), 0, 100)
    metrics = {"train_rows":len(train),"test_rows":len(test),"test_start_year":int(cutoff),
               "mae_percentage_points":round(float(mean_absolute_error(test["undernourishment_pct"],pred)),3),
               "r2":round(float(r2_score(test["undernourishment_pct"],pred)),3),
               "target":"National prevalence of undernourishment (%)",
               "warning":"Exploratory association model; not causal, not subnational, not for operational allocation."}
    # Persist model and metadata locally.
    import joblib
    model_dir = ROOT/"models"; model_dir.mkdir(exist_ok=True)
    joblib.dump({"pipeline":pipe,"features":features,"trained_at":datetime.now(timezone.utc).isoformat(),"metrics":metrics},
                model_dir/"pou_random_forest.joblib")
    audit(user["id"],"model_train",json.dumps(metrics))
    return metrics

@app.get("/api/model/status")
def model_status(user=Depends(get_user)):
    path=ROOT/"models"/"pou_random_forest.joblib"
    if not path.exists(): return {"trained":False}
    import joblib
    obj=joblib.load(path)
    return {"trained":True,"trained_at":obj["trained_at"],"metrics":obj["metrics"],"features":obj["features"]}

@app.post("/api/allocations/solve")
def solve_allocation(req: AllocationInput, user=Depends(get_user)):
    # Illustrative operational data ONLY. Replace with verified partner inventory and demand.
    communities = [
        {"id":"C01","name":"North Ward","demand":120,"vulnerability":82,"route_cost":4.2},
        {"id":"C02","name":"Riverbend","demand":95,"vulnerability":68,"route_cost":8.5},
        {"id":"C03","name":"East Market","demand":150,"vulnerability":45,"route_cost":3.1},
        {"id":"C04","name":"Hillview","demand":80,"vulnerability":91,"route_cost":14.0},
        {"id":"C05","name":"South Gardens","demand":110,"vulnerability":57,"route_cost":6.7},
        {"id":"C06","name":"Lake Colony","demand":70,"vulnerability":76,"route_cost":11.2},
        {"id":"C07","name":"Old Town","demand":135,"vulnerability":63,"route_cost":2.8},
        {"id":"C08","name":"Meadow Park","demand":60,"vulnerability":38,"route_cost":9.4},
        {"id":"C09","name":"Industrial Edge","demand":105,"vulnerability":73,"route_cost":12.6},
        {"id":"C10","name":"West Cross","demand":75,"vulnerability":51,"route_cost":5.5},
    ]
    wsum=req.vulnerability_weight+req.distance_weight+req.demand_weight
    if wsum<=0: raise HTTPException(422,"At least one objective weight must be positive")
    wv,wd,wq=[v/wsum for v in [req.vulnerability_weight,req.distance_weight,req.demand_weight]]
    # LP maximises weighted served demand. Minimise negative objective coefficients.
    priority=[]
    for c in communities:
        proximity=1-c["route_cost"]/max(x["route_cost"] for x in communities)
        priority.append(wv*c["vulnerability"]/100 + wd*proximity + wq*c["demand"]/sum(x["demand"] for x in communities))
    cvec=-np.array(priority)
    A_ub=[np.ones(len(communities)), np.array([x["route_cost"] for x in communities])]
    b_ub=[req.available_stock, req.transport_budget]
    bounds=[(0,x["demand"]) for x in communities]
    result=linprog(cvec,A_ub=np.array(A_ub),b_ub=np.array(b_ub),bounds=bounds,method="highs")
    if not result.success: raise HTTPException(422,f"Optimizer failed: {result.message}")
    rows=[]
    for i,com in enumerate(communities):
        rows.append({**com,"priority_score":round(float(priority[i]),4),
                     "allocation":round(float(result.x[i]),2),
                     "unmet_demand":round(float(com["demand"]-result.x[i]),2)})
    total=sum(r["allocation"] for r in rows)
    payload={"method":"Linear programming (SciPy HiGHS)","data_notice":"Synthetic operational demand, vulnerability and route-cost inputs; not field data.",
             "objective":"Maximise weighted served need subject to stock, transport-budget and demand-cap constraints.",
             "metrics":{"allocated_units":round(total,2),"unmet_demand_units":round(sum(r["unmet_demand"] for r in rows),2),
                        "transport_cost":round(sum(r["allocation"]*r["route_cost"] for r in rows),2),
                        "stock_limit":req.available_stock,"transport_budget":req.transport_budget},
             "communities":rows}
    save_scenario(user["id"],"allocation",req.model_dump(),payload)
    audit(user["id"],"allocation_solve",json.dumps(payload["metrics"]))
    return payload


@app.get("/api/evaluation/allocation")
def allocation_evaluation(
    scenario: str = Query("urban", pattern="^(urban|rural|low_capacity)$"),
    floor_pct: float = Query(30.0, ge=0.0, le=80.0),
    user=Depends(get_user)
):
    """Three-policy allocation comparison on deterministic synthetic district scenarios."""
    base = [
        {"id":"C01","name":"North Ward","demand":120,"vulnerability":92,"route_cost":4.2},
        {"id":"C02","name":"Riverbend","demand":95,"vulnerability":76,"route_cost":8.5},
        {"id":"C03","name":"East Market","demand":150,"vulnerability":45,"route_cost":3.1},
        {"id":"C04","name":"Hillview","demand":80,"vulnerability":98,"route_cost":14.0},
        {"id":"C05","name":"South Gardens","demand":110,"vulnerability":57,"route_cost":6.7},
        {"id":"C06","name":"Lake Colony","demand":70,"vulnerability":84,"route_cost":11.2},
        {"id":"C07","name":"Old Town","demand":135,"vulnerability":63,"route_cost":2.8},
        {"id":"C08","name":"Meadow Park","demand":60,"vulnerability":38,"route_cost":9.4},
        {"id":"C09","name":"Industrial Edge","demand":105,"vulnerability":73,"route_cost":12.6},
        {"id":"C10","name":"West Cross","demand":75,"vulnerability":51,"route_cost":5.5},
    ]
    profiles = {
        "urban": {"stock":500.0, "budget":3100.0, "route_multiplier":1.0, "demand_multiplier":1.0},
        "rural": {"stock":420.0, "budget":3600.0, "route_multiplier":1.25, "demand_multiplier":1.0},
        "low_capacity": {"stock":320.0, "budget":2600.0, "route_multiplier":1.15, "demand_multiplier":1.0},
    }
    cfg = profiles[scenario]
    communities = [dict(x) for x in base]
    for c in communities:
        c["route_cost"] = round(c["route_cost"] * cfg["route_multiplier"], 4)
        c["demand"] = round(c["demand"] * cfg["demand_multiplier"], 4)
    stock, budget = cfg["stock"], cfg["budget"]
    demand = np.array([x["demand"] for x in communities], dtype=float)
    vulnerability = np.array([x["vulnerability"] for x in communities], dtype=float)
    route = np.array([x["route_cost"] for x in communities], dtype=float)
    demand_total = float(demand.sum())
    floor = floor_pct / 100.0

    # Policy 1: proportional-to-demand baseline. Budget is respected by scaling the
    # proportional allocation; this policy may leave stock unused when transport binds.
    baseline = np.minimum(stock * demand / demand_total, demand)
    baseline_cost = float(np.dot(baseline, route))
    if baseline_cost > budget:
        baseline *= budget / baseline_cost

    max_route = float(route.max())
    priority = np.array([
        0.70 * (vulnerability[i] / 100.0)
        + 0.20 * (1.0 - route[i] / max_route)
        + 0.10 * (demand[i] / demand_total)
        for i in range(len(communities))
    ])

    # Policy 2: unconstrained weighted LP; the observed 0% minimum coverage is
    # intentionally retained as a diagnostic comparator, not endorsed as fair.
    A_ub = np.array([np.ones(len(communities)), route])
    b_ub = [stock, budget]
    bounds = [(0.0, float(demand[i])) for i in range(len(communities))]
    unconstrained = linprog(-priority, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method="highs")
    if not unconstrained.success:
        raise HTTPException(500, f"Unconstrained evaluation failed: {unconstrained.message}")

    # Policy 3: same weighted objective and constraints, plus a minimum coverage floor.
    lower = floor * demand
    floored = linprog(-priority, A_ub=A_ub, b_ub=b_ub,
                      bounds=[(float(lower[i]), float(demand[i])) for i in range(len(communities))],
                      method="highs")
    if not floored.success:
        raise HTTPException(422, f"Coverage floor infeasible for this scenario: {floored.message}")

    def summarize(allocation):
        rates = allocation / demand
        return {
            "allocated_units": round(float(allocation.sum()), 2),
            "unmet_demand_units": round(float((demand-allocation).sum()), 2),
            "transport_cost": round(float(np.dot(allocation, route)), 2),
            "stock_utilisation_pct": round(float(allocation.sum()/stock*100), 2),
            "overall_demand_coverage_pct": round(float(allocation.sum()/demand_total*100), 2),
            "minimum_community_coverage_pct": round(float(rates.min()*100), 2),
            "vulnerability_weighted_coverage_pct": round(float(np.average(rates, weights=vulnerability)*100), 2),
            "coverage_gap_pp": round(float((rates.max()-rates.min())*100), 2)
        }

    # Floor sweep: solve the same weighted LP at 0%, 5%, ... 50%.
    # Infeasible floors are returned as null rather than silently omitted.
    floor_sweep = []
    for sweep_floor_pct in range(0, 51, 5):
        sweep_lower = (sweep_floor_pct / 100.0) * demand
        sweep_lp = linprog(
            -priority, A_ub=A_ub, b_ub=b_ub,
            bounds=[(float(sweep_lower[i]), float(demand[i])) for i in range(len(communities))],
            method="highs"
        )
        if sweep_lp.success:
            sweep_metrics = summarize(sweep_lp.x)
            floor_sweep.append({
                "floor_pct": sweep_floor_pct,
                "feasible": True,
                "minimum_community_coverage_pct": sweep_metrics["minimum_community_coverage_pct"],
                "vulnerability_weighted_coverage_pct": sweep_metrics["vulnerability_weighted_coverage_pct"],
                "allocated_units": sweep_metrics["allocated_units"],
                "transport_cost": sweep_metrics["transport_cost"]
            })
        else:
            floor_sweep.append({
                "floor_pct": sweep_floor_pct, "feasible": False,
                "minimum_community_coverage_pct": None,
                "vulnerability_weighted_coverage_pct": None,
                "allocated_units": None, "transport_cost": None
            })

    policies = {
        "baseline": baseline,
        "unconstrained": unconstrained.x,
        "floored": floored.x
    }
    rows=[]
    for i, community in enumerate(communities):
        row={**community}
        for key, allocation in policies.items():
            row[f"{key}_allocation"] = round(float(allocation[i]), 2)
            row[f"{key}_coverage_pct"] = round(float(allocation[i]/demand[i]*100), 2)
        rows.append(row)

    result = {
        "experiment": "Three-policy allocation comparison: proportional baseline, unconstrained weighted LP, and minimum-coverage-floor LP",
        "data_classification": "SYNTHETIC DEMONSTRATION DATA — not observed district or household data",
        "scenario": scenario,
        "constraints": {
            "available_stock_units": stock,
            "transport_budget_cost_units": budget,
            "demand_caps": "Allocation cannot exceed each community's synthetic demand",
            "minimum_coverage_floor_pct": floor_pct
        },
        "methodology": {
            "baseline": "Proportional-to-demand allocation; scaled down if the transport budget binds. This preserves equal percentage coverage but may leave stock unused.",
            "unconstrained": "SciPy HiGHS LP maximising 70% vulnerability + 20% route-cost proximity + 10% demand share; no minimum community coverage.",
            "floored": f"Same weighted LP objective and resource constraints, with each community guaranteed at least {floor_pct:.1f}% of its synthetic demand.",
            "comparability_note": "All three policies respect the same stock, transport budget and demand caps. The proportional baseline can use less stock because its equal-share pattern hits the transport budget; LP policies reallocate toward lower-cost communities and may use more of the same stock.",
            "policy_warning": "A 30% floor is a policy assumption for demonstration, not an empirically validated or universally fair threshold. Communities and programme authorities must set and review it."
        },
        "baseline": summarize(baseline),
        "unconstrained": summarize(unconstrained.x),
        "floored": summarize(floored.x),
        "community_results": rows,
        "floor_sweep": floor_sweep,
        "interpretation": "The proportional baseline has the strongest minimum-coverage guarantee because it gives equal percentage coverage, but may leave stock unused and can deliver lower vulnerability-weighted coverage. The weighted LP can improve vulnerability-weighted coverage while reducing minimum coverage; a floor makes this trade-off configurable. This does not prove fairness or field impact."
    }
    audit(user["id"], "allocation_evaluation", json.dumps({
        "scenario": scenario, "floor_pct": floor_pct,
        "baseline": result["baseline"], "unconstrained": result["unconstrained"], "floored": result["floored"], "floor_sweep_points": len(result["floor_sweep"])
    }))
    return result

@app.get("/api/data/catalog")
def data_catalog(user=Depends(get_user)):
    return {"classification":"public national-level indicators; not district/household observations",
      "indicators":[
        {"code":"SN.ITK.DEFC.ZS","name":"Prevalence of undernourishment (% population)","source":"FAO via World Bank WDI","granularity":"country-year","use":"contextual monitoring only","limitations":"Modelled national estimate; not an individual or district eligibility measure."},
        {"code":"SP.POP.TOTL","name":"Population, total","source":"World Bank WDI","granularity":"country-year","use":"normalisation/context","limitations":"National aggregate."},
        {"code":"NY.GDP.PCAP.PP.KD","name":"GDP per capita, PPP (constant 2021 international $)","source":"World Bank WDI","granularity":"country-year","use":"exploratory modelling feature","limitations":"National macroeconomic proxy; not household income."},
        {"code":"SL.UEM.TOTL.ZS","name":"Unemployment, total (% labour force; modelled ILO estimate)","source":"ILO modelled estimates via World Bank WDI","granularity":"country-year","use":"exploratory modelling feature","limitations":"National modelled estimate; not an individual employment status."}],
      "provenance":"Fetch script stores source URLs, retrieval timestamp, indicator codes and missingness in data/data_manifest.json."}

@app.post("/api/opportunity/simulate")
def opportunity_simulate(req: OpportunityInput, user=Depends(get_user)):
    # Explicit assumptions, not causal estimates. Illustrative cohort size.
    cohort=10000
    training_reach=min(cohort,req.training_slots)
    placement_reach=min(max(0,cohort-training_reach),req.placement_support_slots)
    assumed_improved=training_reach*req.training_effect_assumption + placement_reach*req.placement_effect_assumption
    cost=training_reach*req.cost_per_training_slot + placement_reach*req.cost_per_placement_slot
    result={"data_notice":"Scenario assumptions only; not causal estimates or measured employment outcomes.",
            "cohort_size_assumed":cohort,"training_reach":training_reach,"placement_support_reach":placement_reach,
            "assumed_additional_positive_outcomes":round(assumed_improved,1),"estimated_program_cost":round(cost,2),
            "assumptions":{"training_effect_assumption":req.training_effect_assumption,
                           "placement_effect_assumption":req.placement_effect_assumption},
            "interpretation":"Change the assumptions and compare scenarios. Validate effects with a credible evaluation before making impact claims."}
    save_scenario(user["id"],"opportunity",req.model_dump(),result)
    audit(user["id"],"opportunity_simulate",json.dumps({"cost":cost,"assumed_outcomes":assumed_improved}))
    return result

def save_scenario(uid,kind,payload,result):
    with db() as c:
        c.execute("INSERT INTO scenarios(user_id,name,created_at,kind,payload,result) VALUES(?,?,?,?,?,?)",
                  (uid,kind.title()+" scenario",datetime.now(timezone.utc).isoformat(),kind,
                   json.dumps(payload),json.dumps(result)))

@app.get("/api/scenarios")
def scenarios(user=Depends(get_user)):
    with db() as c:
        rows=c.execute("SELECT id,name,created_at,kind,result FROM scenarios WHERE user_id=? ORDER BY id DESC",(user["id"],)).fetchall()
    return [{"id":r["id"],"name":r["name"],"created_at":r["created_at"],"kind":r["kind"],"result":json.loads(r["result"])} for r in rows]


# ---------------------------------------------------------------------------
# HUMANIE v0.3 — district operations, matching, delivery and accountability.
# These endpoints are a controlled pilot workspace, not a live public service.
# Personal identifiers are intentionally excluded from the case schema.
# ---------------------------------------------------------------------------
from pydantic import ConfigDict

class CaseCreate(BaseModel):
    case_ref: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    district: str = Field(min_length=2, max_length=100)
    locality: str = Field(min_length=2, max_length=120)
    need_type: str = Field(pattern=r"^(food|training|employment|other)$")
    urgency: int = Field(ge=1, le=5, description="1=low, 5=critical")
    vulnerability: int = Field(ge=0, le=100)
    demand_units: float = Field(gt=0, le=100000)
    category: str = Field(min_length=2, max_length=80)

class ResourceCreate(BaseModel):
    resource_ref: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    district: str = Field(min_length=2, max_length=100)
    locality: str = Field(min_length=2, max_length=120)
    provider_type: str = Field(pattern=r"^(government|ngo|food_bank|employer|training_provider|community_group|other)$")
    resource_type: str = Field(pattern=r"^(food|training|employment|other)$")
    capacity: float = Field(gt=0, le=1000000)
    unit: str = Field(min_length=1, max_length=30)
    cost_per_unit: float = Field(default=0, ge=0, le=10000000)
    verified: bool = False

class MatchDecision(BaseModel):
    decision: str = Field(pattern=r"^(approve|reject)$")
    approved_units: Optional[float] = Field(default=None, gt=0)
    reason: str = Field(min_length=5, max_length=500)

class DeliveryCreate(BaseModel):
    dispatched_units: float = Field(gt=0)
    recipient_channel: str = Field(pattern=r"^(direct|community_worker|partner_receipt|assisted_phone|other)$")
    evidence_note: str = Field(default="", max_length=500)

class DeliveryConfirm(BaseModel):
    received_units: float = Field(ge=0)
    evidence_note: str = Field(min_length=3, max_length=500)

class ComplaintCreate(BaseModel):
    case_id: Optional[int] = None
    category: str = Field(pattern=r"^(bribery|discrimination|non_delivery|quality|privacy|staff_misconduct|other)$")
    description: str = Field(min_length=10, max_length=2000)
    severity: str = Field(pattern=r"^(low|medium|high|critical)$")

class ComplaintResolve(BaseModel):
    resolution: str = Field(min_length=10, max_length=1000)
    status: str = Field(pattern=r"^(resolved|referred|unsubstantiated|closed)$")


def _now():
    return datetime.now(timezone.utc).isoformat()

def _owned_row(table, row_id, uid):
    allowed = {"district_cases", "district_resources", "district_matches", "district_deliveries", "district_complaints"}
    if table not in allowed:
        raise ValueError("invalid table")
    with db() as c:
        row = c.execute(f"SELECT * FROM {table} WHERE id=? AND owner_id=?", (row_id, uid)).fetchone()
    if not row:
        raise HTTPException(404, "Record not found")
    return dict(row)

def _district_audit(uid, event, detail):
    audit(uid, "district:" + event, json.dumps(detail, ensure_ascii=False, default=str)[:500])

def _distance_proxy(a: str, b: str) -> float:
    # Until verified coordinates and routing are integrated, locality equality is only a coarse proxy.
    return 0.0 if a.strip().casefold() == b.strip().casefold() else 1.0

@app.get("/district")
def district_console():
    return FileResponse(STATIC / "district.html")

@app.post("/api/district/cases")
def create_district_case(body: CaseCreate, user=Depends(get_user)):
    now = _now()
    try:
        with db() as c:
            cur = c.execute("""INSERT INTO district_cases(owner_id,case_ref,district,locality,need_type,urgency,vulnerability,demand_units,category,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (user["id"],body.case_ref,body.district,body.locality,body.need_type,body.urgency,body.vulnerability,body.demand_units,body.category,now,now))
            rid = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Case reference already exists in this workspace")
    _district_audit(user["id"], "case_created", {"case_id":rid,"case_ref":body.case_ref,"need_type":body.need_type})
    return _owned_row("district_cases", rid, user["id"])

@app.get("/api/district/cases")
def list_district_cases(user=Depends(get_user)):
    with db() as c:
        rows=c.execute("SELECT * FROM district_cases WHERE owner_id=? ORDER BY urgency DESC,created_at DESC",(user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/district/resources")
def create_district_resource(body: ResourceCreate, user=Depends(get_user)):
    now=_now()
    try:
        with db() as c:
            cur=c.execute("""INSERT INTO district_resources(owner_id,resource_ref,district,locality,provider_type,resource_type,capacity,remaining,unit,cost_per_unit,verified,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",(user["id"],body.resource_ref,body.district,body.locality,body.provider_type,body.resource_type,body.capacity,body.capacity,body.unit,body.cost_per_unit,int(body.verified),now,now))
            rid=cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(409,"Resource reference already exists in this workspace")
    _district_audit(user["id"],"resource_created",{"resource_id":rid,"resource_ref":body.resource_ref,"verified":body.verified})
    return _owned_row("district_resources",rid,user["id"])

@app.get("/api/district/resources")
def list_district_resources(user=Depends(get_user)):
    with db() as c:
        rows=c.execute("SELECT * FROM district_resources WHERE owner_id=? ORDER BY verified DESC,remaining DESC",(user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/district/matches/generate")
def generate_matches(user=Depends(get_user)):
    """Generate explainable candidate matches. This does not allocate or approve aid."""
    with db() as c:
        cases=[dict(r) for r in c.execute("SELECT * FROM district_cases WHERE owner_id=? AND status='open'",(user["id"],)).fetchall()]
        resources=[dict(r) for r in c.execute("SELECT * FROM district_resources WHERE owner_id=? AND status='active' AND remaining>0",(user["id"],)).fetchall()]
    made=[]
    for case in cases:
        candidates=[]
        for resource in resources:
            if case["need_type"] != resource["resource_type"]: continue
            if case["district"].strip().casefold() != resource["district"].strip().casefold(): continue
            same_locality = _distance_proxy(case["locality"],resource["locality"]) == 0
            fit = 1.0 if same_locality else 0.65
            trust = 1.0 if resource["verified"] else 0.55
            capacity_fit = min(1.0,resource["remaining"]/max(case["demand_units"],0.001))
            score = 100*(0.40*(case["urgency"]/5)+0.25*(case["vulnerability"]/100)+0.20*fit+0.10*trust+0.05*capacity_fit)
            rationale=[f"Same district: {case['district']}","Need/resource types match",f"Locality match: {'yes' if same_locality else 'no; coarse district-level candidate'}",f"Provider verification: {'verified' if resource['verified'] else 'not yet verified'}",f"Capacity available: {resource['remaining']} {resource['unit']}"]
            candidates.append((score,resource,rationale))
        candidates.sort(key=lambda x:x[0],reverse=True)
        for score,res,rationale in candidates[:3]:
            units=min(case["demand_units"],res["remaining"])
            with db() as c:
                cur=c.execute("""INSERT INTO district_matches(owner_id,case_id,resource_id,recommended_units,score,rationale,created_at)
                    VALUES(?,?,?,?,?,?,?)""",(user["id"],case["id"],res["id"],units,round(score,2),json.dumps(rationale),_now()))
                made.append({"match_id":cur.lastrowid,"case_ref":case["case_ref"],"resource_ref":res["resource_ref"],"score":round(score,2),"recommended_units":units,"rationale":rationale})
    _district_audit(user["id"],"matches_generated",{"candidate_matches":len(made),"method":"transparent rule-based ranking v0.3"})
    return {"count":len(made),"notice":"Recommendations only. Scores are prioritisation aids, not eligibility decisions. Verify need, provider, capacity and logistics; human approval is mandatory.","matches":made}

@app.get("/api/district/matches")
def list_district_matches(user=Depends(get_user)):
    with db() as c:
        rows=c.execute("""SELECT m.*,ca.case_ref,ca.need_type,ca.locality AS case_locality,re.resource_ref,re.provider_type,re.locality AS resource_locality,re.verified
          FROM district_matches m JOIN district_cases ca ON ca.id=m.case_id JOIN district_resources re ON re.id=m.resource_id
          WHERE m.owner_id=? ORDER BY m.created_at DESC""",(user["id"],)).fetchall()
    out=[]
    for r in rows:
        d=dict(r); d["rationale"]=json.loads(d["rationale"]); out.append(d)
    return out

@app.post("/api/district/matches/{match_id}/decision")
def decide_match(match_id:int,body:MatchDecision,user=Depends(get_user)):
    m=_owned_row("district_matches",match_id,user["id"])
    if m["status"]!="recommended": raise HTTPException(409,"Match has already been decided")
    if body.decision=="reject":
        with db() as c:c.execute("UPDATE district_matches SET status='rejected',decided_at=? WHERE id=?",(_now(),match_id))
        _district_audit(user["id"],"match_rejected",{"match_id":match_id,"reason":body.reason})
        return {"status":"rejected","reason":body.reason}
    case=_owned_row("district_cases",m["case_id"],user["id"]); resource=_owned_row("district_resources",m["resource_id"],user["id"])
    qty=body.approved_units if body.approved_units is not None else m["recommended_units"]
    with db() as c:
        already_approved=c.execute("SELECT COALESCE(SUM(recommended_units),0) n FROM district_matches WHERE owner_id=? AND case_id=? AND status='approved'",(user["id"],case["id"])).fetchone()["n"]
    remaining_case=max(0.0,float(case["demand_units"])-float(already_approved))
    if qty>remaining_case or qty>resource["remaining"]: raise HTTPException(422,"Approved quantity exceeds remaining recorded demand or available capacity")
    with db() as c:
        c.execute("UPDATE district_matches SET status='approved',recommended_units=?,decided_at=? WHERE id=?",(qty,_now(),match_id))
        c.execute("UPDATE district_resources SET remaining=remaining-?,updated_at=? WHERE id=?",(qty,_now(),resource["id"]))
    _district_audit(user["id"],"match_approved",{"match_id":match_id,"approved_units":qty,"reason":body.reason,"resource_ref":resource["resource_ref"]})
    return {"status":"approved","approved_units":qty,"human_decision_reason":body.reason,"notice":"Capacity reserved in this pilot workspace. Dispatch must be recorded separately."}

@app.post("/api/district/matches/{match_id}/dispatch")
def dispatch_match(match_id:int,body:DeliveryCreate,user=Depends(get_user)):
    m=_owned_row("district_matches",match_id,user["id"])
    if m["status"]!="approved": raise HTTPException(409,"Only approved matches can be dispatched")
    with db() as c:
        previously_dispatched=c.execute("SELECT COALESCE(SUM(dispatched_units),0) n FROM district_deliveries WHERE owner_id=? AND match_id=?",(user["id"],match_id)).fetchone()["n"]
    if body.dispatched_units+previously_dispatched>m["recommended_units"]: raise HTTPException(422,"Cumulative dispatch would exceed approved quantity")
    with db() as c:
        cur=c.execute("""INSERT INTO district_deliveries(owner_id,match_id,dispatched_units,status,recipient_channel,evidence_note,dispatched_at)
            VALUES(?,?,?,'dispatched',?,?,?)""",(user["id"],match_id,body.dispatched_units,body.recipient_channel,body.evidence_note,_now()))
        did=cur.lastrowid
    _district_audit(user["id"],"delivery_dispatched",{"delivery_id":did,"match_id":match_id,"units":body.dispatched_units})
    return _owned_row("district_deliveries",did,user["id"])

@app.post("/api/district/deliveries/{delivery_id}/confirm")
def confirm_delivery(delivery_id:int,body:DeliveryConfirm,user=Depends(get_user)):
    d=_owned_row("district_deliveries",delivery_id,user["id"])
    if d["status"]!="dispatched": raise HTTPException(409,"Delivery is not awaiting confirmation")
    if body.received_units>d["dispatched_units"]: raise HTTPException(422,"Received quantity cannot exceed dispatched quantity")
    with db() as c:c.execute("UPDATE district_deliveries SET received_units=?,status=?,evidence_note=?,confirmed_at=? WHERE id=?",(body.received_units,"confirmed" if body.received_units==d["dispatched_units"] else "discrepancy",body.evidence_note,_now(),delivery_id))
    _district_audit(user["id"],"delivery_confirmed",{"delivery_id":delivery_id,"dispatched":d["dispatched_units"],"received":body.received_units,"discrepancy":body.received_units!=d["dispatched_units"]})
    return _owned_row("district_deliveries",delivery_id,user["id"])

@app.get("/api/district/deliveries")
def list_deliveries(user=Depends(get_user)):
    with db() as c:
        rows=c.execute("""SELECT d.*,m.case_id,ca.case_ref,re.resource_ref FROM district_deliveries d JOIN district_matches m ON m.id=d.match_id
          JOIN district_cases ca ON ca.id=m.case_id JOIN district_resources re ON re.id=m.resource_id WHERE d.owner_id=? ORDER BY d.id DESC""",(user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/district/complaints")
def create_complaint(body:ComplaintCreate,user=Depends(get_user)):
    if body.case_id is not None: _owned_row("district_cases",body.case_id,user["id"])
    now=_now()
    with db() as c:
        cur=c.execute("INSERT INTO district_complaints(owner_id,case_id,category,description,severity,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",(user["id"],body.case_id,body.category,body.description,body.severity,now,now))
        cid=cur.lastrowid
    _district_audit(user["id"],"complaint_received",{"complaint_id":cid,"category":body.category,"severity":body.severity})
    return _owned_row("district_complaints",cid,user["id"])

@app.get("/api/district/complaints")
def list_complaints(user=Depends(get_user)):
    with db() as c: rows=c.execute("SELECT id,case_id,category,severity,status,created_at,updated_at,resolution FROM district_complaints WHERE owner_id=? ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,created_at DESC",(user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/district/complaints/{complaint_id}/resolve")
def resolve_complaint(complaint_id:int,body:ComplaintResolve,user=Depends(get_user)):
    comp=_owned_row("district_complaints",complaint_id,user["id"])
    if comp["status"]!="open": raise HTTPException(409,"Complaint is no longer open")
    with db() as c:c.execute("UPDATE district_complaints SET status=?,resolution=?,updated_at=? WHERE id=?",(body.status,body.resolution,_now(),complaint_id))
    _district_audit(user["id"],"complaint_resolution",{"complaint_id":complaint_id,"status":body.status,"resolution":body.resolution})
    return _owned_row("district_complaints",complaint_id,user["id"])

@app.get("/api/district/impact")
def district_impact(user=Depends(get_user)):
    with db() as c:
        cases=c.execute("SELECT COUNT(*) n,COALESCE(SUM(demand_units),0) demand,COALESCE(SUM(CASE WHEN status='open' THEN 1 ELSE 0 END),0) open_cases FROM district_cases WHERE owner_id=?",(user["id"],)).fetchone()
        res=c.execute("SELECT COUNT(*) n,COALESCE(SUM(capacity),0) capacity,COALESCE(SUM(remaining),0) remaining,COALESCE(SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END),0) verified FROM district_resources WHERE owner_id=?",(user["id"],)).fetchone()
        dl=c.execute("SELECT COUNT(*) n,COALESCE(SUM(dispatched_units),0) dispatched,COALESCE(SUM(received_units),0) received,COALESCE(SUM(CASE WHEN status='discrepancy' THEN 1 ELSE 0 END),0) discrepancies FROM district_deliveries WHERE owner_id=?",(user["id"],)).fetchone()
        cp=c.execute("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN status='open' THEN 1 ELSE 0 END),0) open_count FROM district_complaints WHERE owner_id=?",(user["id"],)).fetchone()
        matches=c.execute("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END),0) approved FROM district_matches WHERE owner_id=?",(user["id"],)).fetchone()
    demand=float(cases["demand"]); received=float(dl["received"]); dispatched=float(dl["dispatched"])
    return {"classification":"operational pilot metrics; not population impact or causal evidence","cases":{"total":cases["n"],"open":cases["open_cases"],"recorded_demand_units":demand},"resources":{"total":res["n"],"capacity_units":res["capacity"],"remaining_units":res["remaining"],"verified_providers":res["verified"]},"matching":{"candidates":matches["total"],"human_approved":matches["approved"]},"delivery":{"records":dl["n"],"dispatched_units":dispatched,"confirmed_received_units":received,"receipt_ratio":round(received/dispatched,4) if dispatched else None,"quantity_discrepancies":dl["discrepancies"]},"complaints":{"total":cp["total"],"open":cp["open_count"]},"interpretation":"These are workflow and service-delivery indicators. They do not establish reduced hunger, improved nutrition, or causal programme impact. Those require validated household outcome measures and independent evaluation."}

@app.get("/api/district/audit")
def district_audit_feed(user=Depends(get_user),limit:int=Query(default=100,ge=1,le=500)):
    with db() as c: rows=c.execute("SELECT id,event,created_at,detail FROM audit WHERE user_id=? AND event LIKE 'district:%' ORDER BY id DESC LIMIT ?",(user["id"],limit)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/district/demo/seed")
def seed_district_demo(user=Depends(get_user)):
    """Insert clearly fictional sample records for a local walkthrough."""
    with db() as c:
        existing=c.execute("SELECT COUNT(*) n FROM district_cases WHERE owner_id=?",(user["id"],)).fetchone()["n"]
        if existing:
            raise HTTPException(409,"Workspace already contains cases; demo seed only works in an empty case workspace")
        now=_now()
        cases=[
            ("DEMO-FOOD-001","Demo District","North Ward","food",5,92,120,"food kit"),
            ("DEMO-FOOD-002","Demo District","Riverbend","food",4,76,80,"food kit"),
            ("DEMO-TRAIN-001","Demo District","Central Town","training",3,64,20,"digital skills seat"),
        ]
        for x in cases:
            c.execute("""INSERT INTO district_cases(owner_id,case_ref,district,locality,need_type,urgency,vulnerability,demand_units,category,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""",(user["id"],*x,now,now))
        resources=[
            ("DEMO-PROV-FOOD-01","Demo District","North Ward","food_bank","food",100,"kits",0,0),
            ("DEMO-PROV-FOOD-02","Demo District","Central Town","ngo","food",120,"kits",0,0),
            ("DEMO-PROV-TRAIN-01","Demo District","Central Town","training_provider","training",25,"seats",0,0),
        ]
        for x in resources:
            c.execute("""INSERT INTO district_resources(owner_id,resource_ref,district,locality,provider_type,resource_type,capacity,remaining,unit,cost_per_unit,verified,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",(user["id"],x[0],x[1],x[2],x[3],x[4],x[5],x[5],x[6],x[7],x[8],now,now))
    _district_audit(user["id"],"fictional_demo_seeded",{"cases":3,"resources":3,"notice":"fictional data; not field evidence"})
    return {"status":"seeded","cases":3,"resources":3,"notice":"All inserted records are fictional demonstration data, not verified people, providers or field data."}
