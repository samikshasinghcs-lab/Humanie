"""HUMANIE v0.9 smoke checks; run from project root: python scripts/smoke_test.py"""
from pathlib import Path
import tempfile
import sys
import os

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
_tmp = tempfile.TemporaryDirectory(prefix="humanie-smoke-")
os.environ["HUMANIE_DB_PATH"] = str(Path(_tmp.name) / "smoke.sqlite3")
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
email = "smoke-test@example.invalid"
password = "LocalOnly-Test-Password-123!"
health = client.get("/api/health")
assert health.status_code == 200 and health.json().get("status") == "ok"
register = client.post("/api/auth/register", json={"email": email, "password": password})
if register.status_code == 409:
    register = client.post("/api/auth/token", data={"username": email, "password": password})
assert register.status_code == 200, register.text
headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
headers_response = client.get("/")
for name in ("X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Content-Security-Policy"):
    assert name in headers_response.headers, f"Missing header: {name}"
for scenario in ("urban", "rural", "low_capacity"):
    response = client.get(f"/api/evaluation/allocation?scenario={scenario}&floor_pct=30", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["floor_sweep"]) == 11
    assert [x["floor_pct"] for x in data["floor_sweep"]] == list(range(0, 51, 5))
    assert len(data["community_results"]) == 10
    for policy in ("baseline", "unconstrained", "floored"):
        assert data[policy]["allocated_units"] <= data["constraints"]["available_stock_units"] + 1e-5
        assert data[policy]["transport_cost"] <= data["constraints"]["transport_budget_cost_units"] + 1e-5
print("HUMANIE v0.9 API smoke checks passed for auth, headers, three scenarios, and floor sweeps.")
_tmp.cleanup()
